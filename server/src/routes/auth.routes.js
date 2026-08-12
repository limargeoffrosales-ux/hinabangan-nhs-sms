const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { q, qa, qi, qr } = require('../db');
const { signAccess, authenticate, hashToken } = require('../auth');
const { REFRESH_TTL_DAYS } = require('../config');
const { asyncH, audit } = require('../utils');

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
  const user = await q('SELECT * FROM users WHERE username = ?', [String(username).trim()]);
  if (!user || user.status !== 'active' || !(await bcrypt.compare(String(password), user.password_hash))) {
    await audit(req, 'LOGIN_FAILED', 'auth', null, { username });
    return res.status(401).json({ error: 'Invalid username or password' });
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
  if (String(newPassword).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const user = await q('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(String(currentPassword), user.password_hash))) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  await qr('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(String(newPassword), 10), req.user.id]);
  await qr('UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ?', [req.user.id]);
  await audit(req, 'CHANGE_PASSWORD', 'auth', req.user.id);
  res.json({ ok: true });
}));

module.exports = router;
