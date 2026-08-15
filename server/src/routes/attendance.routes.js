const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');
const { ensureTeacherSeesStudent, ensurePortalSeesStudent } = require('../scope');
const { notifyEvent } = require('../notify');

const router = express.Router();
router.use(authenticate);
const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'teacher', 'security'];

function round2(n) { return Math.round(n * 100) / 100; }

function fireAttendanceAlerts(records, date) {
  const seen = new Set();
  for (const r of records) {
    if (!['absent', 'excused'].includes(r.status)) continue;
    if (!r.student_id || seen.has(Number(r.student_id))) continue;
    seen.add(Number(r.student_id));
    notifyEvent('attendance_alert', {
      student_id: Number(r.student_id),
      data: { status: r.status, date, remarks: r.remarks || '' },
    }).catch(() => {});
  }
}

function summarizeAttendance(rows) {
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
  const total = rows.length;
  const rate = total ? round2(((counts.present + counts.late) / total) * 100) : null;
  return { counts, total, rate };
}

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
  fireAttendanceAlerts(b.records, b.date);
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
  fireAttendanceAlerts([{ student_id: req.params.studentId, status, remarks: b.remarks }], date);
  res.json({ ok: true, date, status });
}));

// GET /student/:studentId — scoped attendance record for one student (staff, student, parent).
// Filters: ?month=YYYY-MM, ?year=YYYY, ?summary=1 (returns status counts + rate).
router.get('/student/:studentId', requireRole(...WRITE, 'registrar', 'student', 'parent'), asyncH(async (req, res) => {
  const student = await q('SELECT id, first_name, last_name, lrn FROM students WHERE id = ?', [req.params.studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (req.role === 'teacher') {
    const chk = await ensureTeacherSeesStudent(req.user, student.id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  } else if (req.role === 'student' || req.role === 'parent') {
    const chk = await ensurePortalSeesStudent(req.user, student.id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }
  const { month, year, summary } = req.query;
  let sql = `SELECT a.date, a.status, a.time_in, a.time_out, a.remarks FROM attendance a WHERE a.student_id = ?`;
  const params = [student.id];
  if (month && /^\d{4}-\d{2}$/.test(String(month))) {
    sql += ' AND substr(CAST(a.date AS TEXT), 1, 7) = ?';
    params.push(String(month));
  }
  if (year && /^\d{4}$/.test(String(year))) {
    sql += ' AND substr(CAST(a.date AS TEXT), 1, 4) = ?';
    params.push(String(year));
  }
  sql += ' ORDER BY a.date DESC';
  const rows = await qa(sql, params);
  const out = { student, data: rows };
  if (summary === '1') out.summary = summarizeAttendance(rows);
  res.json(out);
}));

module.exports = router;
