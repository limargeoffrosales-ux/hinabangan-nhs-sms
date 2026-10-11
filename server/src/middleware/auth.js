const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_AUDIENCE, JWT_ISSUER, ACCESS_TTL } = require('../config');
const { q, qa, qr, withUser } = require('../db');
const crypto = require('crypto');

const userCache = new Map();
const CACHE_TTL_MS = 60_000;
const CSRF_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function evictIfNeeded(map, maxEntries = 10000) {
  if (map.size > maxEntries) {
    const half = Math.floor(maxEntries / 2);
    let i = 0;
    for (const key of map.keys()) {
      if (i++ >= half) map.delete(key);
    }
  }
}

function signAccess(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, name: user.name, username: user.username, tokenUse: 'access' },
    JWT_SECRET,
    { expiresIn: ACCESS_TTL, audience: JWT_AUDIENCE, issuer: JWT_ISSUER }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      audience: JWT_AUDIENCE,
      issuer: JWT_ISSUER,
      algorithms: ['HS256'],
    });
  } catch {
    return null;
  }
}

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

// CSRF tokens are stored hashed in the csrf_tokens table (migration 089) so
// they survive deploys and Render's sleep cycle. Only the hash is kept — the
// plaintext token is returned to the client once at issue time.
function hashCsrfToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function storeCsrfToken(userId, token) {
  const expiresAt = new Date(Date.now() + CSRF_TTL_MS).toISOString();
  await qr(
    'INSERT INTO csrf_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?) ON CONFLICT (user_id, token_hash) DO NOTHING',
    [userId, hashCsrfToken(token), expiresAt]
  );
  // Best-effort sweep of that user's stale rows so a long-lived session can't
  // accumulate tokens faster than the TTL cleanup.
  await qr('DELETE FROM csrf_tokens WHERE user_id = ? AND expires_at < ?', [userId, new Date().toISOString()])
    .catch(() => {});
}

async function getCsrfToken(userId) {
  const row = await q(
    'SELECT token_hash FROM csrf_tokens WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1',
    [userId, new Date().toISOString()]
  );
  return row ? row.token_hash : null;
}

// Single-use validation: the matching row is deleted atomically so a token can
// never be replayed (PG RETURNING not needed — the delete's change count is the
// verdict). Constant-time compare is not required here because we only ever
// look up by the SHA-256 hash.
async function validateCsrfToken(userId, providedToken) {
  if (!providedToken) return false;
  const res = await qr(
    'DELETE FROM csrf_tokens WHERE user_id = ? AND token_hash = ? AND expires_at > ?',
    [userId, hashCsrfToken(String(providedToken)), new Date().toISOString()]
  );
  return Number(res?.changes || 0) > 0;
}

async function clearCsrfToken(userId) {
  await qr('DELETE FROM csrf_tokens WHERE user_id = ?', [userId]).catch(() => {});
}

async function authenticate(req, res, next) {
  try {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });
  if (payload.tokenUse === 'mfa' || payload.mfa_pending) {
    return res.status(401).json({ error: 'MFA verification required' });
  }

  const userId = payload.sub;
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    req.user = cached.user;
    req.role = cached.user.role;
    req.db = withUser(cached.user.id, cached.user.role, (db) => db);
    return next();
  }

  const user = await q('SELECT id, username, name, role, status, password_changed_at FROM users WHERE id = ?', [userId]);
  if (!user || user.status !== 'active') return res.status(401).json({ error: 'Account disabled or removed' });
  const userObj = { id: user.id, username: user.username, name: user.name, role: user.role };
  if (user.role === 'teacher') {
    const t = await q('SELECT id FROM teachers WHERE user_id = ? LIMIT 1', [user.id]);
    userObj.teacher_id = t ? Number(t.id) : null;
  }
  userCache.set(userId, { user: userObj, ts: Date.now() });
  evictIfNeeded(userCache);
  req.user = userObj;
  req.role = user.role;

  // Attach user-scoped DB for RLS (PostgreSQL) - falls back to normal driver on SQLite
  req.db = withUser(userObj.id, userObj.role, (db) => db);

  if (user.password_changed_at) {
    try {
      const setting = (await qa("SELECT value FROM app_settings WHERE key = 'password_max_age_days'"))[0];
      const maxDays = Number(setting?.value || 0);
      if (maxDays > 0) {
        const changedAt = new Date(user.password_changed_at);
        const ageMs = Date.now() - changedAt.getTime();
        if (ageMs > maxDays * 24 * 3600 * 1000) {
          res.setHeader('X-Password-Expired', 'true');
        }
      }
    } catch (e) {
      // Log but don't fail — password age check is non-critical
      if (process.env.NODE_ENV !== 'production') console.error('Password age check error:', e.message);
    }
  }

  next();
  } catch (err) {
    return next(err);
  }
}

const ROLES = ['super_admin', 'region_admin', 'division_admin', 'school_admin',
  'principal', 'assistant_principal', 'registrar', 'teacher', 'guidance',
  'cashier', 'accounting', 'hr', 'property_custodian', 'ict',
  'security', 'student', 'parent'];

const ADMIN_ROLES = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];

// Roles that sit above a plain school_admin in the hierarchy, including the
// regional/divisional tiers. ADMIN_ROLES deliberately stays narrow (it gates
// "may see school-wide admin data" in many unrelated routes), so anything that
// must block modification of a *privileged target account* uses this set
// instead. Missing region_admin/division_admin previously let a school_admin
// reset those accounts' passwords and take them over.
const PRIVILEGED_ROLES = ['super_admin', 'region_admin', 'division_admin', ...ADMIN_ROLES];

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.role)) {
      return res.status(403).json({ error: 'Insufficient permissions for this role' });
    }
    next();
  };
}

function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

function hashToken(token) {
  return require('crypto').createHash('sha256').update(token).digest('hex');
}

function clearUserCache(id) {
  userCache.delete(String(id));
}

/**
 * Resolve a token subject to a currently-ACTIVE user record, bypassing the
 * request cache. Used by long-lived transports (SSE) that must re-check
 * account status periodically: a revoked or suspended user would otherwise keep
 * receiving broadcasts for the life of the open stream, because the JWT itself
 * stays valid until it expires.
 * @param {string|number} userId
 * @returns {Promise<object | null>}
 */
async function loadActiveUser(userId) {
  const user = await q('SELECT id, username, name, role, status FROM users WHERE id = ?', [userId]);
  if (!user || user.status !== 'active') return null;
  const userObj = { id: user.id, username: user.username, name: user.name, role: user.role };
  if (user.role === 'teacher') {
    const t = await q('SELECT id FROM teachers WHERE user_id = ? LIMIT 1', [user.id]);
    userObj.teacher_id = t ? Number(t.id) : null;
  }
  return userObj;
}

async function requireCsrf(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Authentication required for CSRF validation' });
  const providedToken = req.headers['x-csrf-token'] || req.body?.csrf_token;
  let ok = false;
  try {
    ok = await validateCsrfToken(req.user.id, providedToken);
  } catch (err) {
    return next(err);
  }
  if (!ok) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }
  next();
}

module.exports = { signAccess, verifyToken, authenticate, requireRole, requireCsrf, ROLES, ADMIN_ROLES, PRIVILEGED_ROLES, isAdminRole, hashToken, clearUserCache, loadActiveUser, generateCsrfToken, storeCsrfToken, getCsrfToken, validateCsrfToken, clearCsrfToken };
