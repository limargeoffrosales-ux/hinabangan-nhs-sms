const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');
const { generateSchedule, findConflicts, DAYS } = require('../schedule');
const { ensureTeacherSeesStudent, ensurePortalSeesStudent } = require('../scope');

const router = express.Router();
router.use(authenticate);
const WRITE = ['super_admin', 'school_admin'];
const PORTAL_READ = ['super_admin', 'school_admin', 'registrar', 'student', 'parent'];
const DURATIONS = [60, 90, 120];

router.get('/days', (req, res) => res.json({ days: DAYS, durations: DURATIONS }));

router.get('/assignments', requireRole(...WRITE), asyncH(async (req, res) => {
  const schoolYear = req.query.school_year || null;
  let sql =
    `SELECT ca.*, s.code AS subject_code, s.title AS subject_title, s.units,
             sec.name AS section_name, sec.grade_level, sec.room AS section_room,
             t.first_name || ' ' || t.last_name AS teacher_name,
             t.room AS teacher_room
     FROM class_assignments ca
     JOIN sections sec ON sec.id = ca.section_id
     JOIN subjects s ON s.id = ca.subject_id
     LEFT JOIN teachers t ON t.id = ca.teacher_id`;
  const params = [];
  if (schoolYear) { sql += ' WHERE ca.school_year = ?'; params.push(schoolYear); }
  sql += ' ORDER BY sec.grade_level, sec.name, s.title';
  const data = await qa(sql, params);
  res.json({ data, durations: DURATIONS });
}));

router.post('/assignments', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.school_year || !b.section_id || !b.subject_id) {
    return res.status(400).json({ error: 'school_year, section_id, subject_id are required' });
  }
  const dur = Number(b.duration_minutes);
  if (!DURATIONS.includes(dur)) return res.status(400).json({ error: 'duration_minutes must be 60, 90 or 120' });
  const meetings = Math.max(1, Math.min(5, Number(b.meetings_per_week) || 1));
  const exists = await q(
    'SELECT id FROM class_assignments WHERE school_year = ? AND section_id = ? AND subject_id = ?',
    [b.school_year, b.section_id, b.subject_id]);
  if (exists) return res.status(409).json({ error: 'Subject already assigned to this section for this school year' });
  const id = await qi(
    `INSERT INTO class_assignments (school_year, section_id, subject_id, teacher_id, duration_minutes, meetings_per_week, room)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [b.school_year, b.section_id, b.subject_id, b.teacher_id || null, dur, meetings, b.room || null]);
  await audit(req, 'CREATE_ASSIGNMENT', 'class_assignments', id, { school_year: b.school_year, section_id: b.section_id, subject_id: b.subject_id });
  res.status(201).json({ id });
}));

router.patch('/assignments/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM class_assignments WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Assignment not found' });
  const b = req.body || {};
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  await qr(
    `UPDATE class_assignments SET teacher_id = ?, duration_minutes = ?, meetings_per_week = ?, room = ? WHERE id = ?`,
    [f('teacher_id', row.teacher_id), f('duration_minutes', row.duration_minutes),
      f('meetings_per_week', row.meetings_per_week), f('room', row.room), row.id]);
  await audit(req, 'UPDATE_ASSIGNMENT', 'class_assignments', row.id);
  res.json({ ok: true });
}));

router.delete('/assignments/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM class_assignments WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Assignment not found' });
  await qr('DELETE FROM class_assignments WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_ASSIGNMENT', 'class_assignments', row.id);
  res.json({ ok: true });
}));

router.post('/generate', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.school_year) return res.status(400).json({ error: 'school_year is required' });
  const result = await generateSchedule(b.school_year, {
    start: b.start_time, end: b.end_time, lunchStart: b.lunch_start, lunchEnd: b.lunch_end,
  });
  await audit(req, 'GENERATE_SCHEDULE', 'schedule_entries', b.school_year, {
    generated: result.generated, failures: result.failures.length, conflicts: result.conflicts.length,
  });
  res.json(result);
}));

router.get('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const schoolYear = req.query.school_year || null;
  const teacherId = req.query.teacher_id || null;
  const sectionId = req.query.section_id || null;
  const day = req.query.day || null;
  let sql =
    `SELECT e.*, sec.name AS section_name, sec.grade_level, s.code AS subject_code, s.title AS subject_title,
            t.first_name || ' ' || t.last_name AS teacher_name
     FROM schedule_entries e
     JOIN sections sec ON sec.id = e.section_id
     JOIN subjects s ON s.id = e.subject_id
     LEFT JOIN teachers t ON t.id = e.teacher_id`;
  const where = [];
  const params = [];
  if (schoolYear) { where.push('e.school_year = ?'); params.push(schoolYear); }
  if (teacherId) { where.push('e.teacher_id = ?'); params.push(teacherId); }
  if (sectionId) { where.push('e.section_id = ?'); params.push(sectionId); }
  if (day) { where.push('e.day = ?'); params.push(day); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY e.section_id, e.day, e.start_time';
  res.json({ data: await qa(sql, params), days: DAYS });
}));

// GET /student/:studentId — scoped class schedule for one student (staff, student, parent).
router.get('/student/:studentId', requireRole(...PORTAL_READ), asyncH(async (req, res) => {
  const { school_year } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });
  const student = await q('SELECT id FROM students WHERE id = ?', [req.params.studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (req.role === 'teacher') {
    const chk = await ensureTeacherSeesStudent(req.user, student.id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  } else if (req.role === 'student' || req.role === 'parent') {
    const chk = await ensurePortalSeesStudent(req.user, student.id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }
  const sections = await qa(
    'SELECT DISTINCT section_id FROM enrollments WHERE student_id = ? AND school_year = ?',
    [student.id, school_year]);
  if (!sections.length) return res.json({ data: [], days: DAYS, school_year });
  const place = sections.map(() => '?').join(',');
  const rows = await qa(
    `SELECT e.*, sec.name AS section_name, sec.grade_level, s.code AS subject_code, s.title AS subject_title,
            t.first_name || ' ' || t.last_name AS teacher_name
     FROM schedule_entries e
     JOIN sections sec ON sec.id = e.section_id
     JOIN subjects s ON s.id = e.subject_id
     LEFT JOIN teachers t ON t.id = e.teacher_id
     WHERE e.school_year = ? AND e.section_id IN (${place})
     ORDER BY e.day, e.start_time`,
    [school_year, ...sections.map((s) => s.section_id)]);
  res.json({ data: rows, days: DAYS, school_year });
}));

router.get('/conflicts', requireRole(...WRITE), asyncH(async (req, res) => {
  const schoolYear = req.query.school_year || null;
  let sql =
    `SELECT e.*, sec.name AS section_name, s.code AS subject_code,
            t.first_name || ' ' || t.last_name AS teacher_name
     FROM schedule_entries e
     JOIN sections sec ON sec.id = e.section_id
     JOIN subjects s ON s.id = e.subject_id
     LEFT JOIN teachers t ON t.id = e.teacher_id`;
  const params = [];
  if (schoolYear) { sql += ' WHERE e.school_year = ?'; params.push(schoolYear); }
  const rows = await qa(sql, params);
  res.json({ data: findConflicts(rows) });
}));

module.exports = router;