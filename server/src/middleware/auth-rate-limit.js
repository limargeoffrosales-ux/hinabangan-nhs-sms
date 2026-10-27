const rateLimit = require('express-rate-limit');
const { createDbStore } = require('../rate-limit-store');

const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 20;
const PREFIX = 'rl:auth:';

const store = createDbStore(WINDOW_MS, PREFIX);
const ipBanStore = createDbStore(15 * 60 * 1000, 'rl:ip-ban:');

const MAX_USERNAME = 100;

function keyFor(req) {
  const raw = req.body && typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : '';
  const ident = raw && raw.length <= MAX_USERNAME ? raw : '-';
  let ip = 'unknown';
  try {
    ip = rateLimit.ipKeyGenerator(req.ip) || 'unknown';
  } catch {
    ip = req.ip || req.socket?.remoteAddress || 'unknown';
  }
  return `${ident}|${ip}`;
}

async function isIpBanned(req) {
  let ip = 'unknown';
  try { ip = rateLimit.ipKeyGenerator(req.ip) || 'unknown'; } catch { ip = req.ip || 'unknown'; }
  try {
    const count = await ipBanStore.get(`ip-fail|${ip}`) || 0;
    return count >= 15;
  } catch {
    return false;
  }
}

async function recordIpFailure(req) {
  let ip = 'unknown';
  try { ip = rateLimit.ipKeyGenerator(req.ip) || 'unknown'; } catch { ip = req.ip || 'unknown'; }
  try {
    const key = `ip-fail|${ip}`;
    const count = (await ipBanStore.get(key) || 0) + 1;
    await ipBanStore.set(key, count);
  } catch {}
}

const authLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyFor,
  skip: async (req) => await isIpBanned(req),
  message: { error: 'Too many sign-in attempts. Try again in a few minutes.' },
  store,
});

function resetAuthLimit(req) {
  return store.resetKey(keyFor(req)).catch(() => {});
}

module.exports = { authLimiter, resetAuthLimit, recordIpFailure, isIpBanned, keyFor, WINDOW_MS, LIMIT };
