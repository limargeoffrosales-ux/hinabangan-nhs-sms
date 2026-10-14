// Shared rate limiter for the credential endpoints (/auth/login, /auth/refresh).
//
// Keyed on username+IP rather than IP alone. A school sits behind a single NAT,
// so an IP-only bucket is shared by every teacher and staff member on campus: one
// person fumbling their password burned the school's entire login budget and
// locked everyone else out. Splitting the key means a genuine user keeps their
// own budget.
//
// Pairing with the IP also keeps the limiter useful as a brute-force control.
// Keying on username alone would let an attacker who knows a username reset that
// account's counter every few attempts and guess forever; keying on IP alone let
// them lock a known account out without ever knowing its password.
//
// The store lives here rather than inline in index.js so the login handler can
// call resetAuthLimit() on success. Without that reset the 20-attempt budget
// counted every successful sign-in too, so a teacher logging in repeatedly over
// a shift eventually hit the wall while never having failed once.

const rateLimit = require('express-rate-limit');
const { createDbStore } = require('../rate-limit-store');

const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 20;
const PREFIX = 'rl:auth:';

const store = createDbStore(WINDOW_MS, PREFIX);

// Mirrors the guard in auth.routes.js: an over-long username is rejected before
// any query, and must not be truncated into a distinct bucket here.
const MAX_USERNAME = 100;

function keyFor(req) {
  const raw = req.body && typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : '';
  const ident = raw && raw.length <= MAX_USERNAME ? raw : '-';
  let ip = 'unknown';
  try {
    // ipKeyGenerator takes the address STRING, not (req, res). Passing req
    // stringifies to "[object Object]", which would collapse every caller in the
    // school onto one shared bucket - exactly the failure this module exists to
    // prevent. The try/catch covers req.ip being absent.
    ip = rateLimit.ipKeyGenerator(req.ip) || 'unknown';
  } catch {
    ip = req.ip || req.socket?.remoteAddress || 'unknown';
  }
  return `${ident}|${ip}`;
}

const authLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyFor,
  message: { error: 'Too many sign-in attempts. Try again in a few minutes.' },
  store,
});

// Clear the caller's bucket after a verified sign-in. Best-effort: a failure here
// must not fail the login that already succeeded.
function resetAuthLimit(req) {
  return store.resetKey(keyFor(req)).catch(() => {});
}

module.exports = { authLimiter, resetAuthLimit, keyFor, WINDOW_MS, LIMIT };