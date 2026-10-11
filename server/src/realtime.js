// Server-Sent Events (SSE) — pushes lightweight "something changed, refetch"
// hints to connected web clients. It carries no history and is not the source
// of truth; pages use it to refresh their own queries without manual reloads.
//
// Browsers cannot set Authorization headers on EventSource, so the short-lived
// access token is accepted once via ?token= and validated with the same JWT
// verify path as the authenticate middleware.
//
// Cross-instance: connected clients live in a per-instance in-memory Set, so a
// broadcast would only reach clients on the same instance. To work behind a
// load balancer, broadcast() writes to the realtime_outbox table and every
// instance polls for rows it hasn't seen, pushing them to its own local
// clients. Old rows are pruned by the outbox sweep.
const { verifyToken, loadActiveUser } = require('./middleware/auth');
const { qa, qr } = require('./db');
const logger = require('./logger');

const clients = new Set();
const MAX_CLIENTS = 200;
// One account can hold several tabs, but not unlimited ones — without this a
// single user could exhaust the global connection budget and starve everyone.
const MAX_CLIENTS_PER_USER = 6;
// Re-check the account on every heartbeat so a suspended/disabled/deleted user
// is dropped from the stream instead of receiving broadcasts until the socket
// happens to close.
const REVALIDATE_EVERY_MS = 60000;
const HEARTBEAT_MS = 25000;
// How often each instance polls the outbox for cross-instance broadcasts.
const POLL_MS = 2000;
// Outbox rows older than this are pruned.
const OUTBOX_TTL_MS = 5 * 60 * 1000;

// id of the last outbox row this instance has pushed to its local clients.
let lastSeenId = 0;
let polling = false;

function send(client, payload) {
  try {
    client.write(`data: ${JSON.stringify(payload)}\n\n`);
    return true;
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack }, '[REALTIME] write failed');
    return false;
  }
}

// broadcast(type, payload) — writes to the outbox so EVERY instance (not just
// this one) can push it to its local clients. Fire-and-forget: a DB error here
// must never break the caller (e.g. a notification dispatch).
function broadcast(type, payload = {}) {
  const frame = { type, ...payload, ts: Date.now() };
  qr(
    'INSERT INTO realtime_outbox (type, payload) VALUES (?, ?)',
    [type, JSON.stringify(frame)]
  ).catch((err) => logger.error({ err: err?.message, stack: err?.stack }, '[REALTIME] outbox write failed'));
}

// Poll the outbox for rows newer than lastSeenId and push them to local clients.
async function pollOutbox() {
  if (polling) return;
  polling = true;
  try {
    const rows = await qa(
      'SELECT id, type, payload FROM realtime_outbox WHERE id > ? ORDER BY id ASC LIMIT 100',
      [lastSeenId]
    );
    for (const row of rows) {
      lastSeenId = Math.max(lastSeenId, Number(row.id));
      const frame = typeof row.payload === 'string' ? safeParse(row.payload) : row.payload;
      if (!frame) continue;
      const dead = [];
      for (const res of clients) {
        if (!send(res, frame)) dead.push(res);
      }
      dead.forEach((res) => clients.delete(res));
    }
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack }, '[REALTIME] outbox poll failed');
  } finally {
    polling = false;
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

// Prune old outbox rows so the table doesn't grow unbounded.
async function pruneOutbox() {
  try {
    const { dialect } = require('./db');
    const cutoff = dialect === 'pg'
      ? `now() - interval '${Math.round(OUTBOX_TTL_MS / 1000)} seconds'`
      : `datetime('now', '-${Math.round(OUTBOX_TTL_MS / 1000)} seconds')`;
    await qr(`DELETE FROM realtime_outbox WHERE created_at < ${cutoff}`, []);
  } catch {
    /* best-effort */
  }
}

// Start the outbox poller for this instance. Called once at boot.
function startOutboxPoller() {
  setInterval(() => { pollOutbox().catch(() => {}); }, POLL_MS);
  setInterval(() => { pruneOutbox().catch(() => {}); }, OUTBOX_TTL_MS);
  if (typeof setInterval === 'function') {
    // unref so these don't keep the process alive on their own
  }
}

function streamHandler(req, res) {
  const token = String(req.query.token || '');
  const payload = token ? verifyToken(token) : null;
  if (!payload || !payload.sub || payload.tokenUse !== 'access') {
    res.status(401).json({ error: 'Invalid or missing token' });
    return;
  }
  if (clients.size >= MAX_CLIENTS) {
    res.status(503).json({ error: 'Too many live connections' });
    return;
  }
  const userId = payload.sub;
  let live = 0;
  for (const c of clients) if (c.userId === userId) live++;
  if (live >= MAX_CLIENTS_PER_USER) {
    res.status(429).json({ error: 'Too many live connections for this account' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();

  send(res, { type: 'connected', ok: true, clients: clients.size + 1 });
  res.userId = userId;
  clients.add(res);

  let ticks = 0;
  const closeStream = () => {
    clearInterval(heartbeat);
    clients.delete(res);
  };

  // Heartbeat keeps reverse proxies (Render edge) from timing the idle stream
  // out; EventSource ignores comment-only frames. Every REVALIDATE_EVERY_MS it
  // also confirms the token is still unexpired and the account still active, so
  // a revoked/disabled/deleted user stops receiving broadcasts promptly rather
  // than riding the stream until the socket dies.
  const heartbeat = setInterval(async () => {
    if (res.writableEnded) return closeStream();
    try { res.write(': ping\n\n'); } catch { /* closed */ }
    ticks++;
    if (ticks * HEARTBEAT_MS < REVALIDATE_EVERY_MS) return;
    ticks = 0;

    // Re-verify the token itself: it was only checked at connect time, so an
    // otherwise-valid session would otherwise keep streaming indefinitely.
    // The client reconnects and re-reads the (refreshed) token from api.js.
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      send(res, { type: 'token_expired' });
      return closeStream();
    }

    try {
      const user = await loadActiveUser(userId);
      if (!user) {
        send(res, { type: 'session_revoked' });
        return closeStream();
      }
    } catch (err) {
      logger.error({ err: err?.message, stack: err?.stack }, '[REALTIME] revalidation failed');
    }
  }, HEARTBEAT_MS);

  req.on('close', closeStream);
  res.on('error', closeStream);
}

module.exports = { broadcast, streamHandler, clientCount: () => clients.size, startOutboxPoller };
