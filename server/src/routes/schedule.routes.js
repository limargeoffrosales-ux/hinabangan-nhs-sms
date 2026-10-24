const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');
const { generateSchedule, findConflicts, loadAssignments, DAYS } = require('../schedule');
const { ensureTeacherSeesStudent, ensurePortalSeesStudent } = require('../scope');

const router = express.Router();
router.use(authenticate);
const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
const PORTAL_READ = ['super_admin', 'school_admin', 'registrar', 'student', 'parent'];
const DURATIONS = [60, 90, 120];
const TIME_RE = /^(([01]\d|2[0-3]):[0-5]\d)$/;

function toMin(t) {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
}

async function ownTeacherId(userId) {
  const t = await q('SELECT id FROM teachers WHERE user_id = ?', [userId]);
  return t ? t.id : null;
}

function canEditEntry(req, row) {
  if (req.role !== 'teacher') return true;
  return req._ownTeacherId && req._ownTeacherId === row.teacher_id;
}

function parseFixedTime(b) {
  const day = b.fixed_day === undefined || b.fixed_day === null || b.fixed_day === ''
    ? null : Number(b.fixed_day);
  const start = !b.fixed_start_time ? null : String(b.fixed_start_time).trim();
  if (day !== null || start !== null) {
    if (day === null || start === null) return { error: 'Both fixed_day and fixed_start_time are required to pin a meeting' };
    if (!Number.isInteger(day) || day < 0 || day > 5) return { error: 'fixed_day must be 0 (Monday–Friday) to 5 (Friday)' };
    if (!TIME_RE.test(start)) return { error: 'fixed_start_time must be a valid HH:MM time' };
  }
  return { day, start };
}

router.get('/days', (req, res) => res.json({ days: DAYS, durations: DURATIONS }));

router.get('/assignments', requireRole(...WRITE), asyncH(async (req, res) => {
  const schoolYear = req.query.school_year || null;
  let sql =
    `SELECT ca.*, s.code AS subject_code, s.title AS subject_title, s.units,
             sec.name AS section_name, sec.grade_level, sec.room AS section_room,
             csec.name AS combined_section_name, csec.grade_level AS combined_grade_level,
             t.first_name || ' ' || t.last_name AS teacher_name,
             t.room AS teacher_room
     FROM class_assignments ca
     JOIN sections sec ON sec.id = ca.section_id
     JOIN subjects s ON s.id = ca.subject_id
     LEFT JOIN sections csec ON csec.id = ca.combined_section_id
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
  const combinedId = b.combined_section_id ? Number(b.combined_section_id) : null;
  if (combinedId && combinedId === Number(b.section_id)) {
    return res.status(400).json({ error: 'A section cannot be combined with itself' });
  }
  if (combinedId && !b.teacher_id) {
    return res.status(400).json({ error: 'A teacher is required for a combined class' });
  }
  let exists;
  if (combinedId) {
    const cs = await q('SELECT id, school_year FROM sections WHERE id = ?', [combinedId]);
    if (!cs) return res.status(404).json({ error: 'Combined section not found' });
    if (cs.school_year !== b.school_year) {
      return res.status(400).json({ error: `Combined section belongs to ${cs.school_year}, not ${b.school_year}` });
    }
    exists = await q(
      `SELECT id FROM class_assignments WHERE school_year = ? AND subject_id = ? AND (
         (section_id = ? AND combined_section_id = ?) OR (section_id = ? AND combined_section_id = ?))`,
      [b.school_year, b.subject_id, b.section_id, combinedId, combinedId, b.section_id]);
  } else {
    exists = await q(
      'SELECT id FROM class_assignments WHERE school_year = ? AND section_id = ? AND subject_id = ?',
      [b.school_year, b.section_id, b.subject_id]);
  }
  if (exists) return res.status(409).json({ error: 'Subject already assigned to this section (or this section pair) for this school year' });
  const pin = parseFixedTime(b);
  if (pin.error) return res.status(400).json({ error: pin.error });
  const id = await qi(
    `INSERT INTO class_assignments (school_year, section_id, combined_section_id, subject_id, teacher_id, duration_minutes, meetings_per_week, room, fixed_day, fixed_start_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.school_year, b.section_id, combinedId, b.subject_id, b.teacher_id || null, dur, meetings, b.room || null, pin.day, pin.start]);
  await audit(req, 'CREATE_ASSIGNMENT', 'class_assignments', id, { school_year: b.school_year, section_id: b.section_id, combined_section_id: combinedId, subject_id: b.subject_id, fixed_day: pin.day, fixed_start_time: pin.start });
  res.status(201).json({ id });
}));

router.patch('/assignments/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM class_assignments WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Assignment not found' });
  const b = req.body || {};
  let combinedId = row.combined_section_id;
  if (b.combined_section_id !== undefined) {
    combinedId = b.combined_section_id ? Number(b.combined_section_id) : null;
    if (combinedId && combinedId === Number(row.section_id)) {
      return res.status(400).json({ error: 'A section cannot be combined with itself' });
    }
    if (combinedId) {
      const cs = await q('SELECT id, school_year FROM sections WHERE id = ?', [combinedId]);
      if (!cs) return res.status(404).json({ error: 'Combined section not found' });
      if (cs.school_year !== row.school_year) {
        return res.status(400).json({ error: `Combined section belongs to ${cs.school_year}, not ${row.school_year}` });
      }
    }
  }
  const teacherId = b.teacher_id !== undefined ? b.teacher_id : row.teacher_id;
  if (combinedId && !teacherId) {
    return res.status(400).json({ error: 'A teacher is required for a combined class' });
  }
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  const pinFields = (b.fixed_day !== undefined || b.fixed_start_time !== undefined)
    ? parseFixedTime(b)
    : { day: row.fixed_day, start: row.fixed_start_time };
  if (pinFields.error) return res.status(400).json({ error: pinFields.error });
  const dur = Number(f('duration_minutes', row.duration_minutes));
  if (!DURATIONS.includes(dur)) return res.status(400).json({ error: 'duration_minutes must be 60, 90 or 120' });
  const meetings = Math.max(1, Math.min(5, Number(f('meetings_per_week', row.meetings_per_week)) || 1));
  await qr(
    `UPDATE class_assignments SET combined_section_id = ?, teacher_id = ?, duration_minutes = ?, meetings_per_week = ?, room = ?, fixed_day = ?, fixed_start_time = ? WHERE id = ?`,
    [combinedId, f('teacher_id', row.teacher_id), dur,
      meetings, f('room', row.room),
      pinFields.day, pinFields.start, row.id]);
  await audit(req, 'UPDATE_ASSIGNMENT', 'class_assignments', row.id, { combined_section_id: combinedId, duration_minutes: dur, meetings_per_week: meetings, fixed_day: pinFields.day, fixed_start_time: pinFields.start });
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
  const t = (v) => v === undefined || v === null || v === '' || TIME_RE.test(String(v).trim());
  const bad = Object.keys({ start_time: 1, end_time: 1, lunch_start: 1, lunch_end: 1, recess_start: 1, recess_end: 1 })
    .find((k) => !t(b[k]));
  if (bad) return res.status(400).json({ error: `${bad} must be a valid HH:MM time` });
  const g = (k) => b[k] === undefined || b[k] === '' ? null : String(b[k]).trim();
  const start = g('start_time'), end = g('end_time');
  const lunchStart = g('lunch_start'), lunchEnd = g('lunch_end');
  const recessStart = g('recess_start'), recessEnd = g('recess_end');
  if (start && end && toMin(start) >= toMin(end)) return res.status(400).json({ error: 'First class must be before last class' });
  if (lunchStart && lunchEnd && toMin(lunchStart) >= toMin(lunchEnd)) return res.status(400).json({ error: 'Lunch start must be before lunch end' });
  if (recessStart && recessEnd && toMin(recessStart) >= toMin(recessEnd)) return res.status(400).json({ error: 'Recess start must be before recess end' });
  const loaded = await loadAssignments(b.school_year);
  if (!loaded.length) return res.status(400).json({ error: 'No class assignments found for this school year' });
  const result = await generateSchedule(b.school_year, {
    start, end, lunchStart, lunchEnd, recessStart, recessEnd,
  });
  await audit(req, 'GENERATE_SCHEDULE', 'schedule_entries', b.school_year, {
    generated: result.generated, failures: result.failures.length, conflicts: result.conflicts.length,
  });
  res.json(result);
}));

router.get('/', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  const schoolYear = req.query.school_year || null;
  let teacherId = req.query.teacher_id || null;
  if (req.role === 'teacher') {
    const own = await ownTeacherId(req.user.id);
    if (!own) return res.json({ data: [], days: DAYS });
    teacherId = String(own);
  }
  const sectionId = req.query.section_id || null;
  const day = req.query.day || null;
  let sql =
    `SELECT e.*, sec.name AS section_name, sec.grade_level, s.code AS subject_code, s.title AS subject_title,
            csec.name AS combined_section_name, csec.grade_level AS combined_grade_level,
            t.first_name || ' ' || t.last_name AS teacher_name
     FROM schedule_entries e
     JOIN sections sec ON sec.id = e.section_id
     JOIN subjects s ON s.id = e.subject_id
     LEFT JOIN sections csec ON csec.id = e.combined_section_id
     LEFT JOIN teachers t ON t.id = e.teacher_id`;
  const where = [];
  const params = [];
  if (schoolYear) { where.push('e.school_year = ?'); params.push(schoolYear); }
  if (teacherId) { where.push('e.teacher_id = ?'); params.push(teacherId); }
  if (sectionId) { where.push('(e.section_id = ? OR e.combined_section_id = ?)'); params.push(sectionId, sectionId); }
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
            csec.name AS combined_section_name, csec.grade_level AS combined_grade_level,
            t.first_name || ' ' || t.last_name AS teacher_name
     FROM schedule_entries e
     JOIN sections sec ON sec.id = e.section_id
     JOIN subjects s ON s.id = e.subject_id
     LEFT JOIN sections csec ON csec.id = e.combined_section_id
     LEFT JOIN teachers t ON t.id = e.teacher_id
     WHERE e.school_year = ? AND (e.section_id IN (${place}) OR e.combined_section_id IN (${place}))
     ORDER BY e.day, e.start_time`,
    [school_year, ...sections.map((s) => s.section_id), ...sections.map((s) => s.section_id)]);
  res.json({ data: rows, days: DAYS, school_year });
}));

router.patch('/entries/:id', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
    const row = await q('SELECT * FROM schedule_entries WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Meeting not found' });
  if (req.role === 'teacher') {
    req._ownTeacherId = await ownTeacherId(req.user.id);
    if (!canEditEntry(req, row)) return res.status(403).json({ error: 'You can only change your own meetings' });
  }
  const b = req.body || {};
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  const day = f('day', row.day) === null ? null : Number(f('day', row.day));
  const start = f('start_time', row.start_time) === null ? null : String(f('start_time', row.start_time)).trim();
  const end = f('end_time', row.end_time) === null ? null : String(f('end_time', row.end_time)).trim();
  const room = f('room', row.room);
  if (!Number.isInteger(day) || day < 1 || day > 5) return res.status(400).json({ error: 'day must be 1 (Monday) to 5 (Friday)' });
  if (!start || !TIME_RE.test(start)) return res.status(400).json({ error: 'start_time must be a valid HH:MM time' });
  if (!end || !TIME_RE.test(end)) return res.status(400).json({ error: 'end_time must be a valid HH:MM time' });
  if (toMin(end) <= toMin(start)) return res.status(400).json({ error: 'end_time must be after start_time' });
  if (toMin(end) - toMin(start) > 600) return res.status(400).json({ error: 'A single meeting cannot exceed 10 hours' });
  await qr(
    'UPDATE schedule_entries SET day = ?, start_time = ?, end_time = ?, room = ? WHERE id = ?',
    [day, start, end, room === null || room === '' ? null : String(room), row.id]);
  await audit(req, 'UPDATE_SCHEDULE_ENTRY', 'schedule_entries', row.id, { day, start_time: start, end_time: end, room });
  res.json({ ok: true });
}));

router.delete('/entries/:id', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  const row = await q('SELECT id, teacher_id FROM schedule_entries WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Meeting not found' });
  if (req.role === 'teacher') {
    req._ownTeacherId = await ownTeacherId(req.user.id);
    if (!canEditEntry(req, row)) return res.status(403).json({ error: 'You can only change your own meetings' });
  }
  await qr('DELETE FROM schedule_entries WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_SCHEDULE_ENTRY', 'schedule_entries', row.id);
  res.json({ ok: true });
}));

router.get('/conflicts', requireRole(...WRITE), asyncH(async (req, res) => {
  const schoolYear = req.query.school_year || null;
  let sql =
    `SELECT e.*, sec.name AS section_name, s.code AS subject_code,
            csec.name AS combined_section_name,
            t.first_name || ' ' || t.last_name AS teacher_name
     FROM schedule_entries e
     JOIN sections sec ON sec.id = e.section_id
     JOIN subjects s ON s.id = e.subject_id
     LEFT JOIN sections csec ON csec.id = e.combined_section_id
     LEFT JOIN teachers t ON t.id = e.teacher_id`;
  const params = [];
  if (schoolYear) { sql += ' WHERE e.school_year = ?'; params.push(schoolYear); }
  const rows = await qa(sql, params);
  res.json({ data: findConflicts(rows) });
}));

module.exports = router;