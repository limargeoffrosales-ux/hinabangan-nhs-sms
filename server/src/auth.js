const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_AUDIENCE, JWT_ISSUER, ACCESS_TTL } = require('./config');
const { q } = require('./db');

const userCache = new Map();
const CACHE_TTL_MS = 60_000;

function signAccess(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, name: user.name, username: user.username },
    JWT_SECRET,
    { expiresIn: ACCESS_TTL, audience: JWT_AUDIENCE, issuer: JWT_ISSUER }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, { audience: JWT_AUDIENCE, issuer: JWT_ISSUER });
  } catch {
    return null;
  }
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });

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
  userCache.set(userId, { user: userObj, ts: Date.now() });
  req.user = userObj;
  req.role = user.role;

  // Password expiry warning
  if (user.password_changed_at) {
    try {
      const { qa } = require('./db');
      const setting = (await qa("SELECT value FROM app_settings WHERE key = 'password_max_age_days'"))[0];
      const maxDays = Number(setting?.value || 0);
      if (maxDays > 0) {
        const changedAt = new Date(user.password_changed_at);
        const ageMs = Date.now() - changedAt.getTime();
        if (ageMs > maxDays * 24 * 3600 * 1000) {
          res.setHeader('X-Password-Expired', 'true');
        }
      }
    } catch {}
  }

  next();
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

module.exports = { signAccess, verifyToken, authenticate, requireRole, ROLES, ADMIN_ROLES, isAdminRole, hashToken, clearUserCache: (id) => userCache.delete(String(id)) };
