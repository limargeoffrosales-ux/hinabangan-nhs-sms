const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');

const router = express.Router();
router.use(authenticate);
const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'teacher', 'security'];

router.get('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const { section_id, date } = req.query;
  let sql = 'SELECT a.*, s.first_name, s.last_name, s.lrn FROM attendance a JOIN students s ON s.id = a.student_id';
  const params = [];
  if (section_id) { sql += ' WHERE a.section_id = ?'; params.push(section_id); }
  if (date) { sql += (params.length ? ' AND' : ' WHERE') + ' a.date = ?'; params.push(date); }
  sql += ' ORDER BY a.date DESC, s.last_name';
  const rows = await qa(sql, params);
  res.json({ data: rows });
}));

router.post('/bulk', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.section_id || !b.date || !Array.isArray(b.records) || b.records.length === 0) {
    return res.status(400).json({ error: 'section_id, date and non-empty records are required' });
  }
  const section = await q('SELECT id FROM sections WHERE id = ?', [b.section_id]);
  if (!section) return res.status(404).json({ error: 'Section not found' });
  const valid = ['present', 'absent', 'late', 'excused'];
  let n = 0;
  for (const r of b.records) {
    if (!r.student_id || !valid.includes(r.status)) continue;
    const existing = await q('SELECT id FROM attendance WHERE student_id = ? AND date = ?', [r.student_id, b.date]);
    if (existing) {
      await qr('UPDATE attendance SET status = ?, remarks = ?, recorded_by = ? WHERE id = ?',
        [r.status, r.remarks || null, req.user.id, existing.id]);
    } else {
      await qi(
        'INSERT INTO attendance (student_id, section_id, date, status, remarks, recorded_by) VALUES (?, ?, ?, ?, ?, ?)',
        [r.student_id, b.section_id, b.date, r.status, r.remarks || null, req.user.id]);
    }
    n++;
  }
  await audit(req, 'ATTENDANCE_BULK', 'attendance', b.section_id, { date: b.date, records: n });
  res.json({ ok: true, recorded: n });
}));

router.post('/:studentId/check', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  const date = b.date || new Date().toISOString().slice(0, 10);
  const student = await q('SELECT id FROM students WHERE id = ?', [req.params.studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const existing = await q('SELECT id FROM attendance WHERE student_id = ? AND date = ?', [req.params.studentId, date]);
  const status = b.status || 'present';
  if (existing) {
    await qr('UPDATE attendance SET status = ?, remarks = ?, recorded_by = ? WHERE id = ?',
      [status, b.remarks || null, req.user.id, existing.id]);
  } else {
    await qi('INSERT INTO attendance (student_id, section_id, date, status, remarks, recorded_by) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.studentId, b.section_id || null, date, status, b.remarks || null, req.user.id]);
  }
  await audit(req, 'ATTENDANCE_CHECK', 'attendance', req.params.studentId, { date, status });
  res.json({ ok: true, date, status });
}));

module.exports = router;
