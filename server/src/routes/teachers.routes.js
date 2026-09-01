const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole, isAdminRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');

const router = express.Router();
router.use(authenticate);
const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'hr'];
const LINK_ROLES = ['super_admin', 'school_admin'];

async function resolveUserId(b, { ignoreId } = {}) {
  if (b.user_id === undefined || b.user_id === null || b.user_id === '') return null;
  const userId = Number(b.user_id);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  const u = await q('SELECT id FROM users WHERE id = ?', [userId]);
  if (!u) return { error: 'Linked login account not found' };
  const cond = ignoreId ? 'AND t.id != ?' : '';
  const used = await q(`SELECT id FROM teachers t WHERE t.user_id = ? ${cond}`, [userId, ...(ignoreId ? [ignoreId] : [])]);
  if (used) return { error: 'That login account is already linked to another teacher' };
  return userId;
}

router.get('/', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const q2 = req.query.q ? `%${req.query.q}%` : '%';
  const rows = await qa(
    'SELECT id, employee_no, first_name, middle_name, last_name, suffix, sex, position, prc_no, email, contact, room, status, user_id FROM teachers WHERE (last_name LIKE ? OR first_name LIKE ? OR employee_no LIKE ?) ORDER BY last_name, first_name LIMIT ? OFFSET ?',
    [q2, q2, q2, limit, offset]);
  if (isAdminRole(req.user.role)) {
    const linked = rows.filter((r) => r.user_id);
    if (linked.length) {
      const ids = linked.map((r) => r.user_id);
      const users = await qa('SELECT id, username FROM users WHERE id IN (' + ids.map(() => '?').join(',') + ')', ids);
      const um = Object.fromEntries(users.map((u) => [u.id, u.username]));
      for (const r of rows) r.username = r.user_id ? (um[r.user_id] || null) : null;
    }
  }
  res.json({ data: rows, limit, offset });
}));

router.get('/:id', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM teachers WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Teacher not found' });
  if (isAdminRole(req.user.role) && row.user_id) {
    const u = await q('SELECT username FROM users WHERE id = ?', [row.user_id]);
    if (u) row.username = u.username;
  }
  res.json(row);
}));

router.post('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.first_name || !b.last_name) return res.status(400).json({ error: 'first_name and last_name are required' });
  const userId = LINK_ROLES.includes(req.role) ? await resolveUserId(b) : null;
  if (userId && userId.error) return res.status(400).json({ error: userId.error });
  const id = await qi(
    'INSERT INTO teachers (employee_no, first_name, middle_name, last_name, suffix, sex, position, prc_no, email, contact, room, status, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [b.employee_no || null, b.first_name, b.middle_name || null, b.last_name, b.suffix || null,
      b.sex || null, b.position || null, b.prc_no || null, b.email || null, b.contact || null,
      b.room || null, b.status || 'active', userId || null]);
  await audit(req, 'CREATE_TEACHER', 'teachers', id, { name: `${b.last_name}, ${b.first_name}`, user_id: userId || null });
  res.status(201).json({ id });
}));

router.patch('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM teachers WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Teacher not found' });
  const b = req.body || {};
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  let userId = row.user_id;
  if (LINK_ROLES.includes(req.role) && b.user_id !== undefined) {
    const resolved = await resolveUserId(b, { ignoreId: row.id });
    if (resolved && resolved.error) return res.status(400).json({ error: resolved.error });
    userId = resolved;
  }
  await qr(
    'UPDATE teachers SET employee_no = ?, first_name = ?, middle_name = ?, last_name = ?, suffix = ?, sex = ?, position = ?, prc_no = ?, email = ?, contact = ?, room = ?, status = ?, user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [f('employee_no', row.employee_no), f('first_name', row.first_name), f('middle_name', row.middle_name),
      f('last_name', row.last_name), f('suffix', row.suffix), f('sex', row.sex), f('position', row.position),
      f('prc_no', row.prc_no), f('email', row.email), f('contact', row.contact), f('room', row.room),
      f('status', row.status), userId, row.id]);
  await audit(req, 'UPDATE_TEACHER', 'teachers', row.id);
  res.json({ ok: true });
}));

router.delete('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM teachers WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Teacher not found' });
  await qr('DELETE FROM teachers WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_TEACHER', 'teachers', row.id);
  res.json({ ok: true });
}));

module.exports = router;
