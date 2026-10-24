'use strict';

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

// Shared per-route limiters. The mount-level limiters in index.js cover /auth,
// /uploads and /ai, but individual routes that buffer uploads or send mail
// still need their own cap — otherwise a single endpoint can exhaust memory or
// the provider quota no matter what the global limit is.

/**
 * Build a limiter keyed on the authenticated user id when available, falling
 * back to IP for unauthenticated requests.
 * @param {{ windowMs: number, limit: number, message: object, name?: string }} opts
 */
function userRateLimit({ windowMs, limit, message, name }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // ipKeyGenerator normalizes IPv6 to a /64 subnet so a single user cannot
    // bypass the cap by rotating addresses within their prefix.
    keyGenerator: (req) => (req.user ? String(req.user.id) : ipKeyGenerator(req.ip)),
    message,
    ...(name ? { name } : {}),
  });
}

module.exports = { userRateLimit };