const jwt = require('jsonwebtoken');
const { JWT_SECRET, ACCESS_TTL } = require('./config');
const { q } = require('./db');

function signAccess(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, name: user.name, username: user.username },
    JWT_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
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
  const user = await q('SELECT id, username, name, role, status FROM users WHERE id = ?', [payload.sub]);
  if (!user || user.status !== 'active') return res.status(401).json({ error: 'Account disabled or removed' });
  req.user = { id: user.id, username: user.username, name: user.name, role: user.role };
  req.role = user.role;
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

module.exports = { signAccess, verifyToken, authenticate, requireRole, ROLES, ADMIN_ROLES, isAdminRole, hashToken };
