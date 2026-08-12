const express = require('express');
const db = require('../db');
const { q, qa, qi, qr } = db;
const { authenticate, requireRole } = require('../auth');
const { asyncH, page, audit } = require('../utils');

const router = express.Router();
router.use(authenticate);

function today() {
  return new Date().toISOString().slice(0, 10);
}

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
const SHS_GRADES = ['Grade 11', 'Grade 12'];

router.get('/summary', asyncH(async (req, res) => {
  const [students, teachers, sections, subjects, enrollments] = await Promise.all([
    qa('SELECT grade_level, sex, COUNT(*) AS n FROM students GROUP BY grade_level, sex'),
    qa('SELECT COUNT(*) AS n FROM teachers WHERE status = \'active\''),
    qa('SELECT COUNT(*) AS n FROM sections WHERE status = \'active\''),
    qa('SELECT COUNT(*) AS n FROM subjects'),
    qa('SELECT school_year, COUNT(*) AS n FROM enrollments GROUP BY school_year ORDER BY school_year DESC LIMIT 5'),
  ]);
  const t = today();
  const attendance = await qa(
    `SELECT a.status, COUNT(*) AS n FROM attendance a WHERE a.date = ? GROUP BY a.status`, [t]);
  const totalStudents = students.reduce((a, r) => a + Number(r.n), 0);
  const present = attendance.find((r) => r.status === 'present')?.n || 0;
  const absences = await qa(
    'SELECT COUNT(*) AS n FROM attendance WHERE date = ? AND status = \'absent\'', [t]);
  res.json({
    students: totalStudents,
    teachers: Number(teachers[0]?.n || 0),
    sections: Number(sections[0]?.n || 0),
    subjects: Number(subjects[0]?.n || 0),
    attendance_rate: totalStudents ? Math.round(present / totalStudents * 100) : 0,
    absences_today: Number(absences[0]?.n || 0),
    by_grade_level: students.reduce((m, r) => {
      if (!m[r.grade_level]) m[r.grade_level] = { male: 0, female: 0 };
      m[r.grade_level][r.sex === 'Male' ? 'male' : 'female'] += Number(r.n);
      return m;
    }, {}),
    by_sex: {
      male: students.filter((r) => r.sex === 'Male').reduce((a, r) => a + Number(r.n), 0),
      female: students.filter((r) => r.sex === 'Female').reduce((a, r) => a + Number(r.n), 0),
    },
    enrollment_by_year: enrollments,
    date: t,
  });
}));

router.get('/attendance-trend', asyncH(async (req, res) => {
  const days = Number(req.query.days || 7);
  const cutoff = db.dialect === 'pg'
    ? `CURRENT_DATE - (? * INTERVAL '1 day')`
    : `date('now', '-' || ? || ' days')`;
  const rows = await qa(
    `SELECT date, status, COUNT(*) AS n FROM attendance WHERE date >= ${cutoff} GROUP BY date, status ORDER BY date`,
    [days]);
  res.json({ data: rows });
}));

router.get('/latest-activity', requireRole('super_admin', 'school_admin', 'principal'), asyncH(async (req, res) => {
  const { limit } = page(req);
  const rows = await qa('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?', [limit]);
  res.json({ data: rows });
}));

// ------------------------------------------------------------
// SHS Enrollment — Grade 11/12 per section, by gender
// ------------------------------------------------------------
router.get('/enrollment', asyncH(async (req, res) => {
  const sy = req.query.school_year || null;
  const params = [...SHS_GRADES];
  let syWhere = '';
  if (sy) { syWhere = ' AND e.school_year = ?'; params.push(sy); }
  const rows = await qa(
    `SELECT s.grade_level, s.name AS section_name, s.strand,
       SUM(CASE WHEN st.sex = 'Male' THEN 1 ELSE 0 END) AS male,
       SUM(CASE WHEN st.sex = 'Female' THEN 1 ELSE 0 END) AS female,
       COUNT(*) AS total
     FROM enrollments e
     JOIN sections s ON s.id = e.section_id
     JOIN students st ON st.id = e.student_id
     WHERE e.status = 'enrolled' AND s.grade_level IN (?, ?) ${syWhere}
     GROUP BY s.grade_level, s.name, s.strand
     ORDER BY s.grade_level, s.name`,
    params);
  const by_grade = {};
  let grand = { male: 0, female: 0, total: 0 };
  for (const r of rows) {
    const g = r.grade_level;
    by_grade[g] = by_grade[g] || { male: 0, female: 0, total: 0, sections: [] };
    const male = Number(r.male), female = Number(r.female);
    by_grade[g].male += male; by_grade[g].female += female; by_grade[g].total += male + female;
    by_grade[g].sections.push({ name: r.section_name, strand: r.strand, male, female, total: male + female });
    grand.male += male; grand.female += female; grand.total += male + female;
  }
  res.json({ school_year: sy, grades: SHS_GRADES, by_grade, by_section: rows, totals: grand });
}));

// ------------------------------------------------------------
// Attendance by grade level + section (for a date)
// ------------------------------------------------------------
router.get('/attendance-groups', asyncH(async (req, res) => {
  const d = req.query.date || today();
  const by_section = await qa(
    `SELECT s.grade_level, s.name AS section_name,
       SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present,
       SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late,
       SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent,
       COUNT(*) AS logged
     FROM attendance a JOIN sections s ON s.id = a.section_id
     WHERE a.date = ?
     GROUP BY s.grade_level, s.name ORDER BY s.grade_level, s.name`,
    [d]);
  const by_grade = [];
  const map = {};
  for (const r of by_section) {
    if (!map[r.grade_level]) {
      map[r.grade_level] = { grade_level: r.grade_level, present: 0, late: 0, absent: 0, logged: 0 };
      by_grade.push(map[r.grade_level]);
    }
    const g = map[r.grade_level];
    g.present += Number(r.present); g.late += Number(r.late); g.absent += Number(r.absent); g.logged += Number(r.logged);
  }
  res.json({ date: d, by_grade, by_section });
}));

// ------------------------------------------------------------
// Teacher status for the day — present / absent / on leave
// ------------------------------------------------------------
router.get('/teacher-status', asyncH(async (req, res) => {
  const d = req.query.date || today();
  const teachers = await qa(
    `SELECT t.id, t.first_name, t.last_name, t.position,
       ta.status AS status_today, ta.remarks
     FROM teachers t
     LEFT JOIN teacher_attendance ta ON ta.teacher_id = t.id AND ta.date = ?
     WHERE t.status = 'active'
     ORDER BY t.last_name, t.first_name`,
    [d]);
  const counts = { present: 0, absent: 0, on_leave: 0, unmarked: 0 };
  for (const t of teachers) {
    if (t.status_today) counts[t.status_today] = (counts[t.status_today] || 0) + 1;
    else counts.unmarked += 1;
  }
  res.json({ date: d, teachers, counts });
}));

router.post('/teacher-status', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  const teacher = await q('SELECT id FROM teachers WHERE id = ? AND status = \'active\'', [b.teacher_id]);
  if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
  const status = String(b.status || 'present').toLowerCase().replace(/\s+/g, '_');
  if (!['present', 'absent', 'on_leave'].includes(status)) {
    return res.status(400).json({ error: 'status must be present, absent or on_leave' });
  }
  const d = b.date || today();
  const exists = await q('SELECT id FROM teacher_attendance WHERE teacher_id = ? AND date = ?', [b.teacher_id, d]);
  if (exists) {
    await qr('UPDATE teacher_attendance SET status = ?, remarks = ?, recorded_by = ? WHERE id = ?',
      [status, b.remarks || null, req.user.id, exists.id]);
  } else {
    await qi('INSERT INTO teacher_attendance (teacher_id, date, status, remarks, recorded_by) VALUES (?, ?, ?, ?, ?)',
      [b.teacher_id, d, status, b.remarks || null, req.user.id]);
  }
  await audit(req, 'TEACHER_STATUS', 'teacher_attendance', b.teacher_id, { date: d, status });
  res.json({ ok: true, date: d, status });
}));

// ------------------------------------------------------------
// Students enrolled per subject — core vs electives
// ------------------------------------------------------------
router.get('/subject-enrollment', asyncH(async (req, res) => {
  const sy = req.query.school_year || null;
  const params = [...SHS_GRADES];
  let syOn = '';
  if (sy) { syOn = ' AND ca.school_year = ?'; params.push(sy); }
  const rows = await qa(
    `SELECT sub.id, sub.code, sub.title, sub.track, sub.term, sub.units,
       COUNT(DISTINCT e.student_id) AS enrolled
     FROM subjects sub
     LEFT JOIN class_assignments ca ON ca.subject_id = sub.id ${syOn}
     LEFT JOIN enrollments e ON e.section_id = ca.section_id
        AND e.status = 'enrolled' AND e.school_year = ca.school_year
     WHERE sub.grade_level IN (?, ?)
     GROUP BY sub.id, sub.code, sub.title, sub.track, sub.term, sub.units
     ORDER BY sub.term, sub.title`,
    params);
  const isCore = (r) => r.term === 'all' || r.track === 'general' || String(r.code).startsWith('CORE-');
  const core = rows.filter(isCore);
  const core_ids = new Set(core.map((r) => r.id));
  const electives = rows.filter((r) => !core_ids.has(r.id));
  res.json({ school_year: sy, core, electives });
}));

// ------------------------------------------------------------
// Work Immersion summary — by batch, program, partner, status
// ------------------------------------------------------------
router.get('/immersion-summary', asyncH(async (req, res) => {
  const rows = await qa(
    `SELECT wi.batch, wi.program, wi.partner_institution, wi.status,
       COUNT(*) AS learners,
       SUM(CASE WHEN st.sex = 'Male' THEN 1 ELSE 0 END) AS male,
       SUM(CASE WHEN st.sex = 'Female' THEN 1 ELSE 0 END) AS female
     FROM work_immersion wi JOIN students st ON st.id = wi.student_id
     GROUP BY wi.batch, wi.program, wi.partner_institution, wi.status
     ORDER BY wi.batch, wi.program, wi.partner_institution, wi.status`);
  const batches = {};
  for (const r of rows) {
    const b = batches[r.batch] = batches[r.batch] || { batch: r.batch, programs: {}, statuses: {}, learners: 0, male: 0, female: 0 };
    b.programs[r.program] = (b.programs[r.program] || 0) + Number(r.learners);
    b.statuses[r.status] = (b.statuses[r.status] || 0) + Number(r.learners);
    b.learners += Number(r.learners);
    b.male += Number(r.male); b.female += Number(r.female);
  }
  res.json({ batches: Object.values(batches), rows });
}));

// ------------------------------------------------------------
// JDVP summary — by batch, gender
// ------------------------------------------------------------
router.get('/jdvp-summary', asyncH(async (req, res) => {
  const rows = await qa(
    `SELECT j.batch, j.program, j.status, st.sex, COUNT(*) AS n
     FROM jdvp_recipients j JOIN students st ON st.id = j.student_id
     GROUP BY j.batch, j.program, j.status, st.sex
     ORDER BY j.batch, j.program, j.status`);
  const batches = {};
  for (const r of rows) {
    const b = batches[r.batch] = batches[r.batch] || { batch: r.batch, programs: {}, statuses: {}, male: 0, female: 0, total: 0 };
    b.programs[r.program || 'General'] = (b.programs[r.program || 'General'] || 0) + Number(r.n);
    b.statuses[r.status] = (b.statuses[r.status] || 0) + Number(r.n);
    if (r.sex === 'Male') b.male += Number(r.n); else if (r.sex === 'Female') b.female += Number(r.n);
    b.total += Number(r.n);
  }
  res.json({ batches: Object.values(batches), rows });
}));

module.exports = router;