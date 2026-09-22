// Attendance feature module
import { Router } from 'express';
import { q, qa, qi, qr, tx } from '../../db';
import { authenticate, requireRole } from '../../auth';
import { asyncH, audit } from '../../utils';
import { ensureTeacherSeesStudent, ensureTeacherSeesSection, ensurePortalSeesStudent, teacherScope, sectionInScope } from '../../scope';
import { notifyEvent } from '../../notify';
import { sendSpreadsheet } from '../../export';
import { logger } from '../../logger';
import { WRITE } from '../../constants';

const router = Router();
router.use(authenticate);

function round2(n: number): number { return Math.round(n * 100) / 100; }

function fireAttendanceAlerts(records: any[], date: string) {
  const seen = new Set();
  for (const r of records) {
    if (!['absent', 'excused'].includes(r.status)) continue;
    if (!r.student_id || seen.has(Number(r.student_id))) continue;
    seen.add(Number(r.student_id));
    notifyEvent('attendance_alert', {
      student_id: Number(r.student_id),
      data: { status: r.status, date, remarks: r.remarks || '' },
    }).catch((err) => logger.error({ err: err.message, student_id: r.student_id }, '[ATTENDANCE] notifyEvent failed'));
  }
}

function summarizeAttendance(rows: any[]) {
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
  const total = rows.length;
  const rate = total ? round2(((counts.present + counts.late) / total) * 100) : null;
  return { counts, total, rate };
}

router.get('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const { section_id, date } = req.query;
  const pageNum = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const limit = Math.min(Math.max(1, parseInt(String(req.query.limit || '50'), 10)), 500);
  const offset = (pageNum - 1) * limit;
  let sql = 'SELECT a.*, s.first_name, s.last_name, s.lrn FROM attendance a JOIN students s ON s.id = a.student_id';
  const params: (string | number)[] = [];
  const where: string[] = [];
  if (section_id) { where.push('a.section_id = ?'); params.push(Number(section_id)); }
  if (date) { where.push('a.date = ?'); params.push(String(date)); }
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
  res.json({ data: rows, total, page: pageNum, limit, totalPages: Math.ceil(total / limit) });
}));

// GET /export
router.get('/export', requireRole(...WRITE), asyncH(async (req, res) => {
  const { section_id, date } = req.query;
  let sql = `SELECT a.date, a.student_id, a.section_id, a.status, a.session, a.time_in, a.time_out, a.remarks,
      s.lrn, s.first_name, s.last_name, sec.name AS section_name, u.name AS recorded_by
      FROM attendance a
      JOIN students s ON s.id = a.student_id
      LEFT JOIN sections sec ON sec.id = a.section_id
      LEFT JOIN users u ON u.id = a.recorded_by`;
  const params: (string | number)[] = [];
  const where: string[] = [];
  if (section_id) { where.push('a.section_id = ?'); params.push(Number(section_id)); }
  if (date) { where.push('a.date = ?'); params.push(String(date)); }
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
  const section = await q('SELECT id FROM sections WHERE id = ?', [b.section_id]);
  if (!section) return res.status(404).json({ error: 'Section not found' });
  if (req.role === 'teacher') {
    const chk = await ensureTeacherSeesSection(req.user, b.section_id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }
  const valid = ['present', 'absent', 'late', 'excused', 'half_day'];
  const enrolled = await qa(
    `SELECT student_id FROM enrollments WHERE section_id = ? AND status = 'enrolled'`,
    [b.section_id]);
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
      const existing = await conn.get(
        sess
          ? 'SELECT id FROM attendance WHERE student_id = ? AND date = ? AND session IS NOT DISTINCT FROM ?'
          : 'SELECT id FROM attendance WHERE student_id = ? AND date = ? AND session IS NULL',
        [r.student_id, b.date, sess]
      );
      if (existing) {
        await conn.run('UPDATE attendance SET status = ?, session = ?, remarks = ?, recorded_by = ? WHERE id = ?',
          [r.status, sess, r.remarks || null, req.user.id, existing.id]);
      } else {
        await conn.runId(
          'INSERT INTO attendance (student_id, section_id, date, status, session, remarks, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [r.student_id, b.section_id, b.date, r.status, sess, r.remarks || null, req.user.id]);
      }
      n++;
    }
  });
  await audit(req, 'ATTENDANCE_BULK', 'attendance', b.section_id, { date: b.date, records: n });
  fireAttendanceAlerts(b.records, b.date);
  res.json({ ok: true, recorded: n });
}));

router.post('/:studentId/check', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  const date = b.date || new Date().toISOString().slice(0, 10);
  const student = await q('SELECT id FROM students WHERE id = ?', [req.params.studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (req.role === 'teacher') {
    const chk = await ensureTeacherSeesStudent(req.user, student.id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }
  const sess = b.session || null;
  const existing = await q(
    sess
      ? 'SELECT id FROM attendance WHERE student_id = ? AND date = ? AND session IS NOT DISTINCT FROM ?'
      : 'SELECT id FROM attendance WHERE student_id = ? AND date = ? AND session IS NULL',
    [req.params.studentId, date, sess]
  );
  const status = b.status || 'present';
  if (existing) {
    await qr('UPDATE attendance SET status = ?, session = ?, remarks = ?, recorded_by = ? WHERE id = ?',
      [status, sess, b.remarks || null, req.user.id, existing.id]);
  } else {
    await qi('INSERT INTO attendance (student_id, section_id, date, status, session, remarks, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.params.studentId, b.section_id || null, date, status, sess, b.remarks || null, req.user.id]);
  }
  await audit(req, 'ATTENDANCE_CHECK', 'attendance', req.params.studentId, { date, status });
  fireAttendanceAlerts([{ student_id: req.params.studentId, status, remarks: b.remarks }], date);
  res.json({ ok: true, date, status });
}));

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
  const params: (string | number)[] = [student.id];
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
  const out: any = { student, data: rows };
  if (summary === '1') out.summary = summarizeAttendance(rows);
  res.json(out);
}));

export const attendanceRoutes = router;