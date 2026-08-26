const rateLimit = require('express-rate-limit');

/**
 * Per-user rate limiter.
 * Uses the authenticated user's ID as the key (falls back to IP for unauthenticated routes).
 * This prevents multiple users behind the same NAT from sharing limits.
 */
function userRateLimit(opts = {}) {
  const windowMs = opts.windowMs || 15 * 60 * 1000;
  const limit = opts.limit || 100;
  const message = opts.message || { error: 'Too many requests. Please slow down.' };

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator(req) {
      if (req.user?.id) return `user:${req.user.id}`;
      return req.ip;
    },
    message,
  });
}

module.exports = { userRateLimit };
