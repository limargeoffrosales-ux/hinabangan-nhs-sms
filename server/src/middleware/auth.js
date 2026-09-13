const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_AUDIENCE, JWT_ISSUER, ACCESS_TTL } = require('../config');
const { q, qa } = require('../db');
const crypto = require('crypto');

const userCache = new Map();
const csrfTokenCache = new Map();
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

function storeCsrfToken(userId, token) {
  const expiresAt = Date.now() + CSRF_TTL_MS;
  const tokens = csrfTokenCache.get(userId) || [];
  tokens.push({ token, expiresAt });
  csrfTokenCache.set(userId, tokens);
  evictIfNeeded(csrfTokenCache);
}

function getCsrfToken(userId) {
  const tokens = csrfTokenCache.get(userId) || [];
  const now = Date.now();
  const valid = tokens.filter((t) => t.expiresAt > now);
  if (valid.length === 0) {
    csrfTokenCache.delete(userId);
    return null;
  }
  csrfTokenCache.set(userId, valid);
  evictIfNeeded(csrfTokenCache);
  return valid[valid.length - 1].token;
}

function validateCsrfToken(userId, providedToken) {
  if (!providedToken) return false;
  const tokens = csrfTokenCache.get(userId) || [];
  const now = Date.now();
  const valid = tokens.filter((t) => t.expiresAt > now);
  for (let i = 0; i < valid.length; i++) {
    try {
      if (crypto.timingSafeEqual(Buffer.from(valid[i].token, 'hex'), Buffer.from(providedToken, 'hex'))) {
        valid.splice(i, 1);
        csrfTokenCache.set(userId, valid);
        return true;
      }
    } catch {}
  }
  csrfTokenCache.set(userId, valid);
  return false;
}

function clearCsrfToken(userId) {
  csrfTokenCache.delete(userId);
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
  'principal', 'assistant_principal', 'registrar', 'teacher', 'guidance', 'nurse',
  'librarian', 'cashier', 'accounting', 'hr', 'property_custodian', 'ict',
  'security', 'student', 'parent'];

const ADMIN_ROLES = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];

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

function requireCsrf(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Authentication required for CSRF validation' });
  const providedToken = req.headers['x-csrf-token'] || req.body?.csrf_token;
  if (!validateCsrfToken(req.user.id, providedToken)) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }
  next();
}

module.exports = { signAccess, verifyToken, authenticate, requireRole, requireCsrf, ROLES, ADMIN_ROLES, isAdminRole, hashToken, clearUserCache, generateCsrfToken, storeCsrfToken, getCsrfToken, validateCsrfToken, clearCsrfToken };
