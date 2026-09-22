// Server-Sent Events (SSE) — pushes lightweight "something changed, refetch"
// hints to connected web clients. It carries no history and is not the source
// of truth; pages use it to refresh their own queries without manual reloads.
//
// Browsers cannot set Authorization headers on EventSource, so the short-lived
// access token is accepted once via ?token= and validated with the same JWT
// verify path as the authenticate middleware.
const { verifyToken } = require('./middleware/auth');
const logger = require('./logger');

const clients = new Set();
const MAX_CLIENTS = 200;

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
  const user = token ? verifyToken(token) : null;
  if (!user || !user.sub || user.tokenUse !== 'access') {
    res.status(401).json({ error: 'Invalid or missing token' });
    return;
  }
  if (clients.size >= MAX_CLIENTS) {
    res.status(503).json({ error: 'Too many live connections' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();

  send(res, { type: 'connected', ok: true, clients: clients.size + 1 });
  clients.add(res);

  // Heartbeat keeps reverse proxies (Render edge) from timing the idle stream
  // out; EventSource ignores comment-only frames.
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* closed */ }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
  res.on('error', () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
}

module.exports = { broadcast, streamHandler, clientCount: () => clients.size };