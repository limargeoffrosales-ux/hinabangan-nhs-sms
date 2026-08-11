const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');

const router = express.Router();
router.use(authenticate);

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];

async function uniqueLrn() {
  for (let i = 0; i < 20; i++) {
    const lrn = String(1 + Math.floor(Math.random() * 9)) +
      String(Math.floor(Math.random() * 1e11)).padStart(11, '0');
    const exists = await q('SELECT id FROM students WHERE lrn = ?', [lrn]);
    if (!exists) return lrn;
  }
  throw new Error('Could not allocate a unique LRN');
}

router.get('/', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const q2 = req.query.q ? `%${req.query.q}%` : '%';
  const gradeLevel = req.query.grade_level ? req.query.grade_level : null;
  const params = [q2, q2];
  let sql = 'SELECT id, lrn, first_name, middle_name, last_name, suffix, sex, birth_date, religion, address, contact, guardian_name, guardian_contact, guardian_relation, grade_level, track_strand, status FROM students WHERE (last_name LIKE ? OR first_name LIKE ? OR lrn LIKE ?)';
  params.push(q2);
  if (gradeLevel) {
    sql += ' AND grade_level = ?';
    params.push(gradeLevel);
  }
  sql += ' ORDER BY last_name, first_name LIMIT ? OFFSET ?';
  params.push(limit, offset);
  res.json({ data: await qa(sql, params), limit, offset });
}));

router.get('/:id', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM students WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Student not found' });
  row.enrollments = await qa('SELECT e.*, s.name AS section_name FROM enrollments e LEFT JOIN sections s ON s.id = e.section_id WHERE e.student_id = ? ORDER BY e.school_year DESC', [row.id]);
  res.json(row);
}));

router.post('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.first_name || !b.last_name || !b.sex || !b.grade_level) {
    return res.status(400).json({ error: 'first_name, last_name, sex, grade_level are required' });
  }
  const lrn = b.lrn || await uniqueLrn();
  const id = await qi(
    'INSERT INTO students (lrn, first_name, middle_name, last_name, suffix, sex, birth_date, birth_place, religion, address, contact, guardian_name, guardian_contact, guardian_relation, grade_level, track_strand, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [lrn, b.first_name, b.middle_name || null, b.last_name, b.suffix || null, b.sex, b.birth_date || null,
      b.birth_place || null, b.religion || null, b.address || null, b.contact || null,
      b.guardian_name || null, b.guardian_contact || null, b.guardian_relation || null,
      b.grade_level, b.track_strand || null, b.status || 'enrolled']);
  await audit(req, 'CREATE_STUDENT', 'students', id, { lrn, name: `${b.last_name}, ${b.first_name}` });
  res.status(201).json({ id, lrn });
}));

router.patch('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM students WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Student not found' });
  const b = req.body || {};
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  await qr(
    'UPDATE students SET lrn = ?, first_name = ?, middle_name = ?, last_name = ?, suffix = ?, sex = ?, birth_date = ?, birth_place = ?, religion = ?, address = ?, contact = ?, guardian_name = ?, guardian_contact = ?, guardian_relation = ?, grade_level = ?, track_strand = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [f('lrn', row.lrn), f('first_name', row.first_name), f('middle_name', row.middle_name), f('last_name', row.last_name),
      f('suffix', row.suffix), f('sex', row.sex), f('birth_date', row.birth_date), f('birth_place', row.birth_place),
      f('religion', row.religion), f('address', row.address), f('contact', row.contact),
      f('guardian_name', row.guardian_name), f('guardian_contact', row.guardian_contact),
      f('guardian_relation', row.guardian_relation), f('grade_level', row.grade_level),
      f('track_strand', row.track_strand), f('status', row.status), row.id]);
  await audit(req, 'UPDATE_STUDENT', 'students', row.id, { lrn: row.lrn });
  res.json({ ok: true });
}));

router.delete('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT id, lrn FROM students WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Student not found' });
  await qr('DELETE FROM students WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_STUDENT', 'students', row.id, { lrn: row.lrn });
  res.json({ ok: true });
}));

module.exports = router;
