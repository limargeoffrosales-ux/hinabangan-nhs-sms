const express = require('express');
const { q, qa, qr, tx } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, logAccess } = require('../utils');
const { ensureTeacherSeesStudent, ensureTeacherSeesSection, ensurePortalSeesStudent, teacherScope, sectionInScope } = require('../scope');
const { notifyEvent } = require('../notify');
const { sendSpreadsheet } = require('../export');
const { todayStr, normalizeDateStr } = require('../dates');
const { getCurrentSchoolYear } = require('../schoolYear');
const logger = require('../logger');

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
    }).catch((err) => logger.error({ err: err?.message, stack: err?.stack, student_id: r.student_id }, '[ATTENDANCE] notifyEvent failed'));
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
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 50), 500);
  const offset = (page - 1) * limit;
  let sql = 'SELECT a.*, s.first_name, s.last_name, s.lrn FROM attendance a JOIN students s ON s.id = a.student_id';
  const params = [];
  const where = [];
  if (section_id) { where.push('a.section_id = ?'); params.push(section_id); }
  if (date) { where.push('a.date = ?'); params.push(date); }
  if (req.role === 'teacher') {
    const scope = await teacherScope(req.user);
    if (scope) {
      const sc = sectionInScope(scope, 'a', 'section_id');
      where.push(sc.sql);
      params.push(...sc.params);
    } else {
      where.push('0 = 1');
    }
  }
  const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const total = Number((await q(`SELECT COUNT(*) AS total FROM attendance a${whereClause}`, params)).total || 0);
  const rows = await qa(`${sql}${whereClause} ORDER BY a.date DESC, s.last_name LIMIT ? OFFSET ?`, [...params, limit, offset]);
  res.json({ data: rows, total, page, limit, totalPages: Math.ceil(total / limit) });
}));

// GET /export — attendance records for a section/date as a downloadable
// .xlsx/.csv, mirroring the list endpoint's scope rules but without pagination.
router.get('/export', requireRole(...WRITE), asyncH(async (req, res) => {
  const { section_id, date } = req.query;
  let sql = `SELECT a.date, a.student_id, a.section_id, a.status, a.session, a.time_in, a.time_out, a.remarks,
      s.lrn, s.first_name, s.last_name, sec.name AS section_name, u.name AS recorded_by
      FROM attendance a
      JOIN students s ON s.id = a.student_id
      LEFT JOIN sections sec ON sec.id = a.section_id
      LEFT JOIN users u ON u.id = a.recorded_by`;
  const params = [];
  const where = [];
  if (section_id) { where.push('a.section_id = ?'); params.push(section_id); }
  if (date) { where.push('a.date = ?'); params.push(date); }
  if (req.role === 'teacher') {
    const scope = await teacherScope(req.user);
    if (scope) {
      const sc = sectionInScope(scope, 'a', 'section_id');
      where.push(sc.sql);
      params.push(...sc.params);
    } else {
      where.push('0 = 1');
    }
  }
  const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const rows = await qa(`${sql}${whereClause} ORDER BY a.date DESC, s.last_name`, params);
  const columns = [
    { key: 'date', header: 'Date', width: 12 },
    { key: 'section_name', header: 'Section', width: 18 },
    { key: 'lrn', header: 'LRN', width: 16 },
    { key: 'last_name', header: 'Last Name', width: 18 },
    { key: 'first_name', header: 'First Name', width: 18 },
    { key: 'status', header: 'Status', width: 10 },
    { key: 'session', header: 'Session', width: 10 },
    { key: 'time_in', header: 'Time In', width: 10 },
    { key: 'time_out', header: 'Time Out', width: 10 },
    { key: 'remarks', header: 'Remarks', width: 24 },
    { key: 'recorded_by', header: 'Recorded By', width: 20 },
  ];
  const fname = `attendance${date ? `-${date}` : ''}${section_id ? `-${section_id}` : ''}`;
  await sendSpreadsheet(res, String(req.query.format || 'xlsx'), { columns, rows, sheetName: 'Attendance', filename: fname });
}));

router.post('/bulk', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.section_id || !b.date || !Array.isArray(b.records) || b.records.length === 0) {
    return res.status(400).json({ error: 'section_id, date and non-empty records are required' });
  }
  if (!normalizeDateStr(b.date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  const section = await q('SELECT id FROM sections WHERE id = ?', [b.section_id]);
  if (!section) return res.status(404).json({ error: 'Section not found' });
  if (req.role === 'teacher') {
    const chk = await ensureTeacherSeesSection(req.user, b.section_id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }
  const valid = ['present', 'absent', 'late', 'excused', 'half_day'];
  const sy = await getCurrentSchoolYear();
  const enrolled = await qa(
    `SELECT student_id FROM enrollments WHERE section_id = ? AND status = 'enrolled' AND school_year = ?`,
    [b.section_id, sy]);
  const allowedIds = new Set(enrolled.map((e) => Number(e.student_id)));
  if (allowedIds.size === 0) {
    return res.status(400).json({ error: 'Section has no enrolled students' });
  }
  const invalid = b.records
    .filter((r) => r.student_id && Number(r.student_id) > 0 && !allowedIds.has(Number(r.student_id)))
    .map((r) => r.student_id);
  const unlisted = b.records.filter((r) => !r.student_id);
  if (invalid.length || unlisted.length) {
    return res.status(400).json({
      error: 'One or more student_ids are not enrolled in this section',
      invalid_student_ids: [...new Set(invalid)],
      missing_student_ids: unlisted.map(() => null),
    });
  }
  let n = 0;
  await tx(async (conn) => {
    for (const r of b.records) {
      if (!r.student_id || !valid.includes(r.status)) continue;
      const sess = r.session || null;
      // Upsert without a read-then-write race, and without relying on catching a
      // unique violation: on PostgreSQL any statement error aborts the whole
      // transaction (25P02), so a "try insert, on 23505 go back and SELECT the
      // winner" fallback could never run inside tx() — it would throw on the
      // poisoned connection and roll back the entire batch.
      //
      // ON CONFLICT DO NOTHING (no conflict target) works on both dialects and
      // is required here because the unique index is expression-based:
      // (student_id, date, COALESCE(session,'default')), which a targeted
      // ON CONFLICT (student_id, date, session) clause would not match.
      await conn.run(
        'INSERT INTO attendance (student_id, section_id, date, status, session, remarks, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING',
        [r.student_id, b.section_id, b.date, r.status, sess, r.remarks || null, req.user.id]);
      // Whether we inserted the row or a concurrent teacher beat us to it, this
      // update settles on the requested value.
      await conn.run(
        `UPDATE attendance SET status = ?, session = ?, remarks = ?, recorded_by = ?
         WHERE student_id = ? AND date = ? AND session IS NOT DISTINCT FROM ?`,
        [r.status, sess, r.remarks || null, req.user.id, r.student_id, b.date, sess]);
      n++;
    }
  });
  await audit(req, 'ATTENDANCE_BULK', 'attendance', b.section_id, { date: b.date, records: n });
  fireAttendanceAlerts(b.records, b.date);
  res.json({ ok: true, recorded: n });
}));

router.post('/:studentId/check', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  // Defaults to the SCHOOL-local date. Render runs UTC, so a UTC default
  // wrote yesterday's date during the first 8 hours of every school day.
  const date = b.date || todayStr();
  if (!normalizeDateStr(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  const student = await q('SELECT id FROM students WHERE id = ?', [req.params.studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (req.role === 'teacher') {
    const chk = await ensureTeacherSeesStudent(req.user, student.id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }
  const sess = b.session || null;
  const status = b.status || 'present';
  // Same conflict-free upsert as the bulk endpoint: insert-or-skip, then settle
  // the value with an update on the natural key. No prior SELECT is needed, so a
  // concurrent write by another teacher cannot slip between the two steps.
  await qr('INSERT INTO attendance (student_id, section_id, date, status, session, remarks, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING',
    [req.params.studentId, b.section_id || null, date, status, sess, b.remarks || null, req.user.id]);
  await qr(`UPDATE attendance SET status = ?, session = ?, remarks = ?, recorded_by = ?
            WHERE student_id = ? AND date = ? AND session IS NOT DISTINCT FROM ?`,
    [status, sess, b.remarks || null, req.user.id, req.params.studentId, date, sess]);
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
  logAccess(req, student.id);
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
