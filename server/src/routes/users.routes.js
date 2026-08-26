const express = require('express');
const bcrypt = require('bcryptjs');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole, ROLES, isAdminRole, clearUserCache } = require('../auth');
const { asyncH, audit, page } = require('../utils');

const router = express.Router();
router.use(authenticate);

router.get('/', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const searchQ = req.query.q ? `%${req.query.q}%` : '%';
  const rows = await qa(
    'SELECT id, username, name, role, email, phone, status, created_at FROM users WHERE (username LIKE ? OR name LIKE ?) ORDER BY id DESC LIMIT ? OFFSET ?',
    [searchQ, searchQ, limit, offset]);
  res.json({ data: rows, limit, offset });
}));

router.post('/', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
  const { username, password, name, role, email, phone } = req.body || {};
  if (!username || !password || !name || !role) return res.status(400).json({ error: 'username, password, name, role are required' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: `role must be one of: ${ROLES.join(', ')}` });
  if (req.user.role === 'school_admin' && role === 'super_admin') {
    return res.status(403).json({ error: 'Cannot assign super_admin role' });
  }
  if (String(password).length < 12) return res.status(400).json({ error: 'Password must be at least 12 characters' });
  const exists = await q('SELECT id FROM users WHERE username = ?', [String(username).trim()]);
  if (exists) return res.status(409).json({ error: 'Username already taken' });
  const id = await qi(
    'INSERT INTO users (username, password_hash, name, role, email, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [String(username).trim(), await bcrypt.hash(String(password), 10), name, role, email || null, phone || null, 'active']);
  await qi(
    'INSERT INTO password_audit (user_id, changed_by, action, ip_address) VALUES (?, ?, ?, ?)',
    [id, req.user.id, 'created', req.ip]);
  await audit(req, 'CREATE_USER', 'users', id, { username, role });
  res.status(201).json({ id });
}));

router.patch('/:id', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
  const { name, role, email, phone, status, password } = req.body || {};
  const user = await q('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (role && !ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (req.user.role === 'school_admin' && role === 'super_admin') {
    return res.status(403).json({ error: 'Cannot assign super_admin role' });
  }
  if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only super_admin can modify another super_admin' });
  }
  if (password) {
    if (String(password).length < 12) return res.status(400).json({ error: 'Password must be at least 12 characters' });
    await qr('UPDATE users SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP WHERE id = ?',
      [await bcrypt.hash(String(password), 10), user.id]);
    await qi(
      'INSERT INTO password_audit (user_id, changed_by, action, ip_address) VALUES (?, ?, ?, ?)',
      [user.id, req.user.id, 'reset', req.ip]);
  }
  await qr('UPDATE users SET name = ?, role = ?, email = ?, phone = ?, status = ? WHERE id = ?',
    [name ?? user.name, role ?? user.role, email ?? user.email, phone ?? user.phone, status ?? user.status, user.id]);
  clearUserCache(user.id);
  await audit(req, 'UPDATE_USER', 'users', user.id, { role, status, password: !!password });
  res.json({ ok: true });
}));

router.delete('/:id', requireRole('super_admin'), asyncH(async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });
  const user = await q('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await qr('DELETE FROM users WHERE id = ?', [user.id]);
  clearUserCache(user.id);
  await audit(req, 'DELETE_USER', 'users', user.id, { username: user.username });
  res.json({ ok: true });
}));

router.get('/roles', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
  res.json({ data: ROLES.map((r) => ({ role: r, admin: isAdminRole(r) })) });
}));

router.post('/bulk-reset-password', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
  const { user_ids, password } = req.body || {};
  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({ error: 'user_ids array is required' });
  }
  if (!password || String(password).length < 12) {
    return res.status(400).json({ error: 'Password must be at least 12 characters' });
  }
  const hash = await bcrypt.hash(String(password), 10);
  let reset = 0;
  for (const uid of user_ids) {
    const user = await q('SELECT id, username, role FROM users WHERE id = ?', [Number(uid)]);
    if (!user) continue;
    if (user.role === 'super_admin' && req.user.role !== 'super_admin') continue;
    await qr('UPDATE users SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP WHERE id = ?', [hash, user.id]);
    clearUserCache(user.id);
    await qi(
      'INSERT INTO password_audit (user_id, changed_by, action, ip_address) VALUES (?, ?, ?, ?)',
      [user.id, req.user.id, 'bulk_reset', req.ip]);
    reset++;
  }
  await audit(req, 'BULK_PASSWORD_RESET', 'users', null, { count: reset });
  res.json({ ok: true, reset });
}));

module.exports = router;
