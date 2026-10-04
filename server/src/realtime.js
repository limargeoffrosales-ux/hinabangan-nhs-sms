// Server-Sent Events (SSE) — pushes lightweight "something changed, refetch"
// hints to connected web clients. It carries no history and is not the source
// of truth; pages use it to refresh their own queries without manual reloads.
//
// Browsers cannot set Authorization headers on EventSource, so the short-lived
// access token is accepted once via ?token= and validated with the same JWT
// verify path as the authenticate middleware.
const { verifyToken, loadActiveUser } = require('./middleware/auth');
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

function send(client, payload) {
  try {
    client.write(`data: ${JSON.stringify(payload)}\n\n`);
    return true;
  } catch (err) {
    logger.error({ err: err.message }, '[REALTIME] write failed');
    return false;
  }
}

// broadcast(type, payload) — pushes to every connected client. Payload gets a
// `type` + `ts` envelope so subscribers can cheaply filter.
function broadcast(type, payload = {}) {
  if (clients.size === 0) return;
  const frame = { type, ...payload, ts: Date.now() };
  const dead = [];
  for (const res of clients) {
    if (!send(res, frame)) dead.push(res);
  }
  dead.forEach((res) => clients.delete(res));
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
      logger.error({ err: err.message }, '[REALTIME] revalidation failed');
    }
  }, HEARTBEAT_MS);

  req.on('close', closeStream);
  res.on('error', closeStream);
}

module.exports = { broadcast, streamHandler, clientCount: () => clients.size };