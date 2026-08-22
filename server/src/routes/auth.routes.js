const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { q, qa, qi, qr } = require('../db');
const { signAccess, authenticate, hashToken, clearUserCache } = require('../auth');
const { JWT_SECRET, REFRESH_TTL_DAYS } = require('../config');
const { asyncH, audit } = require('../utils');

async function getLockoutSettings() {
  const rows = await qa("SELECT key, value FROM app_settings WHERE key IN ('lockout_max_attempts','lockout_duration_minutes')", []);
  const s = {};
  for (const r of rows) s[r.key] = r.value;
  return { maxAttempts: Number(s.lockout_max_attempts || 5), lockMinutes: Number(s.lockout_duration_minutes || 15) };
}

async function recordFailedLogin(username, userId, ip) {
  const { maxAttempts, lockMinutes } = await getLockoutSettings();
  if (userId) {
    const user = await q('SELECT failed_attempts, role FROM users WHERE id = ?', [userId]);
    const attempts = (user?.failed_attempts || 0) + 1;
    if (attempts >= maxAttempts) {
      const until = new Date(Date.now() + lockMinutes * 60000).toISOString();
      await qr('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?', [attempts, until, userId]);
      await logSecurityIncident('ACCOUNT_LOCKOUT', 'high', ip, username, userId, { attempts, lockMinutes, lockedUntil: until });
    } else {
      await qr('UPDATE users SET failed_attempts = ? WHERE id = ?', [attempts, userId]);
    }
  }
}

async function clearFailedLogins(userId) {
  if (userId) await qr('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?', [userId]);
}

async function logSecurityIncident(type, severity, ip, username, userId, details) {
  try {
    await qi(
      'INSERT INTO security_incidents (incident_type, severity, source_ip, username, user_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [type, severity, ip, username, userId || null, details ? JSON.stringify(details) : null]
    );
  } catch {}
}

const router = express.Router();

function genRefresh() {
  return crypto.randomBytes(48).toString('base64url');
}

async function issueRefresh(userId) {
  const raw = genRefresh();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000).toISOString();
  await qi('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, hashToken(raw), expiresAt]);
  return raw;
}

router.post('/login', asyncH(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });
  if (String(username).length > 100 || String(password).length > 128) {
    return res.status(400).json({ error: 'username or password too long' });
  }
  const user = await q('SELECT * FROM users WHERE username = ?', [String(username).trim()]);

  if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
    const remaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    await logSecurityIncident('LOGIN_BLOCKED_LOCKED', 'high', req.ip, user.username, user.id, { remainingMinutes: remaining });
    return res.status(423).json({ error: `Account locked. Try again in ${remaining} minute(s).` });
  }

  if (!user || user.status !== 'active' || !(await bcrypt.compare(String(password), user.password_hash))) {
    await audit(req, 'LOGIN_FAILED', 'auth', null, { username });
    await recordFailedLogin(String(username).trim(), user?.id || null, req.ip);
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  await clearFailedLogins(user.id);

  // Check if MFA is enabled
  if (user.mfa_enabled && user.mfa_secret) {
    const tempToken = jwt.sign(
      { sub: String(user.id), mfa_pending: true },
      JWT_SECRET,
      { expiresIn: '5m' }
    );
    await audit(req, 'LOGIN_MFA_PENDING', 'auth', user.id, { username: user.username });
    return res.json({ requiresMfa: true, tempToken });
  }

  const accessToken = signAccess(user);
  const refreshToken = await issueRefresh(user.id);
  await audit(req, 'LOGIN', 'auth', user.id, { username: user.username, role: user.role });
  res.json({
    token: accessToken,
    refreshToken,
    user: { id: user.id, username: user.username, name: user.name, role: user.role, email: user.email },
  });
}));

router.post('/refresh', asyncH(async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' });
  const row = await q('SELECT rt.id AS token_id, rt.user_id, rt.expires_at, rt.revoked, u.id, u.username, u.name, u.role, u.status FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = ?',
    [hashToken(refreshToken)]);
  if (!row || row.revoked) return res.status(401).json({ error: 'Invalid refresh token' });
  if (new Date(row.expires_at) < new Date()) return res.status(401).json({ error: 'Refresh token expired' });
  if (row.status !== 'active') return res.status(401).json({ error: 'Account disabled' });
  await qr('UPDATE refresh_tokens SET revoked = TRUE WHERE id = ?', [row.token_id]);
  const accessToken = signAccess({ id: row.user_id, username: row.username, name: row.name, role: row.role });
  const newRefresh = await issueRefresh(row.user_id);
  res.json({ token: accessToken, refreshToken: newRefresh });
}));

router.post('/logout', asyncH(async (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) {
    await qr('UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = ?', [hashToken(refreshToken)]);
  }
  res.json({ ok: true });
}));

router.get('/me', authenticate, asyncH(async (req, res) => {
  const user = await q('SELECT id, username, name, role, email, phone, created_at FROM users WHERE id = ?', [req.user.id]);
  res.json({ user });
}));

router.post('/change-password', authenticate, asyncH(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  if (String(newPassword).length > 128) return res.status(400).json({ error: 'Password too long' });
  const user = await q('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(String(currentPassword), user.password_hash))) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  // Password policy validation from app_settings
  const policyRows = await qa(
    "SELECT key, value FROM app_settings WHERE key IN ('password_min_length', 'password_require_uppercase', 'password_require_lowercase', 'password_require_digit', 'password_require_special')",
    []);
  const policy = {};
  for (const r of policyRows) policy[r.key] = r.value;

  const minLength = Number(policy.password_min_length || 12);
  const requireUppercase = policy.password_require_uppercase !== '0';
  const requireLowercase = policy.password_require_lowercase !== '0';
  const requireDigit = policy.password_require_digit !== '0';
  const requireSpecial = policy.password_require_special !== '0';

  if (String(newPassword).length < minLength) {
    return res.status(400).json({ error: `Password must be at least ${minLength} characters` });
  }
  if (requireUppercase && !/[A-Z]/.test(String(newPassword))) {
    return res.status(400).json({ error: 'Password must contain at least one uppercase letter' });
  }
  if (requireLowercase && !/[a-z]/.test(String(newPassword))) {
    return res.status(400).json({ error: 'Password must contain at least one lowercase letter' });
  }
  if (requireDigit && !/[0-9]/.test(String(newPassword))) {
    return res.status(400).json({ error: 'Password must contain at least one digit' });
  }
  if (requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(String(newPassword))) {
    return res.status(400).json({ error: 'Password must contain at least one special character' });
  }

  await qr('UPDATE users SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP WHERE id = ?', [await bcrypt.hash(String(newPassword), 10), req.user.id]);
  clearUserCache(req.user.id);
  await qi(
    'INSERT INTO password_audit (user_id, changed_by, action, ip_address) VALUES (?, ?, ?, ?)',
    [req.user.id, req.user.id, 'changed', req.ip]);
  await qr('UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ?', [req.user.id]);
  await audit(req, 'CHANGE_PASSWORD', 'auth', req.user.id);
  res.json({ ok: true });
}));

module.exports = router;
