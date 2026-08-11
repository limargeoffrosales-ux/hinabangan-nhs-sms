const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');

const router = express.Router();
router.use(authenticate);
const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'hr'];

router.get('/', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const q2 = req.query.q ? `%${req.query.q}%` : '%';
  const rows = await qa(
    'SELECT id, employee_no, first_name, middle_name, last_name, suffix, sex, position, prc_no, email, contact, status FROM teachers WHERE (last_name LIKE ? OR first_name LIKE ? OR employee_no LIKE ?) ORDER BY last_name, first_name LIMIT ? OFFSET ?',
    [q2, q2, q2, limit, offset]);
  res.json({ data: rows, limit, offset });
}));

router.get('/:id', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM teachers WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Teacher not found' });
  res.json(row);
}));

router.post('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.first_name || !b.last_name) return res.status(400).json({ error: 'first_name and last_name are required' });
  const id = await qi(
    'INSERT INTO teachers (employee_no, first_name, middle_name, last_name, suffix, sex, position, prc_no, email, contact, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [b.employee_no || null, b.first_name, b.middle_name || null, b.last_name, b.suffix || null,
      b.sex || null, b.position || null, b.prc_no || null, b.email || null, b.contact || null, b.status || 'active']);
  await audit(req, 'CREATE_TEACHER', 'teachers', id, { name: `${b.last_name}, ${b.first_name}` });
  res.status(201).json({ id });
}));

router.patch('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM teachers WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Teacher not found' });
  const b = req.body || {};
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  await qr(
    'UPDATE teachers SET employee_no = ?, first_name = ?, middle_name = ?, last_name = ?, suffix = ?, sex = ?, position = ?, prc_no = ?, email = ?, contact = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [f('employee_no', row.employee_no), f('first_name', row.first_name), f('middle_name', row.middle_name),
      f('last_name', row.last_name), f('suffix', row.suffix), f('sex', row.sex), f('position', row.position),
      f('prc_no', row.prc_no), f('email', row.email), f('contact', row.contact), f('status', row.status), row.id]);
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
