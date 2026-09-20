const express = require('express');
const db = require('../db');
const { q, qa, qi, qr, tx } = db;
const { authenticate, requireRole } = require('../auth');
const { asyncH, page, audit } = require('../utils');
const { teacherScope } = require('../scope');

const router = express.Router();
router.use(authenticate);

const summaryCache = new Map();
const SUMMARY_TTL_MS = 30_000;

function today() {
  return new Date().toISOString().slice(0, 10);
}

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
const DASH_READ = [...WRITE, 'teacher', 'guidance', 'nurse', 'librarian', 'accounting', 'hr'];
const SHS_GRADES = ['Grade 11', 'Grade 12'];

// ARAL dashboard endpoints are shared with teachers (DASH_READ). Scope their
// results to the sections they actually teach/advis �?" other ARAL data is not
// visible to a teacher. Returns { sql ('' or a WHERE fragment), params, empty }.
async function teacherSectionScope(req) {
  if (req.role !== 'teacher') return { sql: '', params: [], empty: false };
  const scope = await teacherScope(req.user);
  const ids = scope ? scope.sections : [];
  if (!ids.length) return { sql: '0 = 1', params: [], empty: true };
  const holders = ids.map(() => '?').join(',');
  return { sql: `s.id IN (${holders})`, params: ids, empty: false };
}

router.get('/summary', requireRole(...DASH_READ), asyncH(async (req, res) => {
  const t = today();
  const sy = String(req.query.school_year || '').trim() ||
    ((await q('SELECT school_year FROM enrollments ORDER BY school_year DESC LIMIT 1'))?.school_year) || null;
  const cacheKey = `${sy || 'none'}:${req.user}:${t}`;
  const cached = summaryCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < SUMMARY_TTL_MS) {
    return res.json(cached.data);
  }
  const last7 = db.dialect === 'pg' ? `CURRENT_DATE - INTERVAL '7 days'` : `date('now', '-7 days')`;
  const [
    students, teachers, sections, subjects, enrollments,
    enrolledByGrade, gradeLearners, attendanceDays, teacherMarking,
    conductCount, aralTagged, aralSessions, assessments, immersion,
    jdvpCount, audit,
  ] = await Promise.all([
    qa('SELECT grade_level, sex, COUNT(*) AS n FROM students GROUP BY grade_level, sex'),
    qa('SELECT COUNT(*) AS n FROM teachers WHERE status = \'active\''),
    qa('SELECT COUNT(*) AS n FROM sections WHERE status = \'active\''),
    qa('SELECT COUNT(*) AS n FROM subjects'),
    qa('SELECT school_year, COUNT(*) AS n FROM enrollments GROUP BY school_year ORDER BY school_year DESC LIMIT 5'),
    sy ? qa(
      `SELECT sec.grade_level,
              COUNT(DISTINCT CASE WHEN st.sex = 'Male' THEN e.student_id END) AS male,
              COUNT(DISTINCT CASE WHEN st.sex = 'Female' THEN e.student_id END) AS female,
              COUNT(DISTINCT e.student_id) AS total
       FROM enrollments e
       JOIN sections sec ON sec.id = e.section_id
       JOIN students st ON st.id = e.student_id
       WHERE e.status = 'enrolled' AND e.school_year = ?
       GROUP BY sec.grade_level`, [sy]) : Promise.resolve([]),
    sy ? qa('SELECT COUNT(DISTINCT student_id) AS n FROM grades WHERE school_year = ?', [sy]) : Promise.resolve([]),
    qa('SELECT COUNT(DISTINCT date) AS days, COUNT(*) AS records FROM attendance'),
    qa(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN ta.date = ? THEN 1 ELSE 0 END) AS marked
       FROM teachers t
       LEFT JOIN teacher_attendance ta ON ta.teacher_id = t.id AND ta.date = ?
       WHERE t.status = 'active'`, [t, t]),
    qa('SELECT COUNT(*) AS n FROM student_conduct_records'),
    sy ? qa('SELECT COUNT(*) AS n FROM enrollments WHERE status = \'enrolled\' AND is_aral = TRUE AND school_year = ?', [sy]) : Promise.resolve([]),
    qa('SELECT COUNT(*) AS n FROM aral_sessions'),
    qa('SELECT COUNT(*) AS n FROM learner_assessments'),
    qa('SELECT status, COUNT(*) AS n FROM work_immersion GROUP BY status'),
    qa('SELECT COUNT(*) AS n FROM jdvp_recipients'),
    qa(`SELECT COUNT(*) AS last7 FROM audit_logs WHERE created_at >= ${last7}`),
  ]);
  const totalStudents = students.reduce((a, r) => a + Number(r.n), 0);
  const enrolled = enrolledByGrade.reduce((a, r) => a + Number(r.total || 0), 0);
  const attendance = await qa(
    `SELECT a.status, COUNT(*) AS n FROM attendance a WHERE a.date = ? GROUP BY a.status`, [t]);
  const present = attendance.find((r) => r.status === 'present')?.n || 0;
  const absences = await qa(
    'SELECT COUNT(*) AS n FROM attendance WHERE date = ? AND status = \'absent\'', [t]);
  const markedToday = Number(teacherMarking[0]?.marked || 0);
  const activeTeachers = Number(teacherMarking[0]?.total || teachers[0]?.n || 0);
  const immersionMap = {};
  for (const r of immersion) immersionMap[r.status] = Number(r.n);
  const immersionTotal = Object.values(immersionMap).reduce((a, b) => a + b, 0);
  res.json({
    students: totalStudents,
    enrolled,
    waitlisted: Math.max(0, totalStudents - enrolled),
    with_subjects: sy
      ? Number((await q(`SELECT COUNT(DISTINCT e.student_id) AS n FROM enrollment_subjects es JOIN enrollments e ON e.id = es.enrollment_id WHERE e.status = 'enrolled' AND e.school_year = ?`, [sy]))?.n || 0)
      : 0,
    teachers: activeTeachers,
    sections: Number(sections[0]?.n || 0),
    subjects: Number(subjects[0]?.n || 0),
    school_year: sy,
    attendance_rate: totalStudents ? Math.round(present / totalStudents * 100) : 0,
    absences_today: Number(absences[0]?.n || 0),
    attendance_logged_today: Number((await q('SELECT COUNT(*) AS n FROM attendance WHERE date = ?', [t]))?.n || 0),
    teacher_marked_today: markedToday,
    by_grade_level: students.reduce((m, r) => {
      if (!m[r.grade_level]) m[r.grade_level] = { male: 0, female: 0 };
      m[r.grade_level][r.sex === 'Male' ? 'male' : 'female'] += Number(r.n);
      return m;
    }, {}),
    enrolled_by_grade_level: enrolledByGrade.reduce((m, r) => {
      m[r.grade_level] = { male: Number(r.male || 0), female: Number(r.female || 0), total: Number(r.total || 0) };
      return m;
    }, {}),
    by_sex: {
      male: students.filter((r) => r.sex === 'Male').reduce((a, r) => a + Number(r.n), 0),
      female: students.filter((r) => r.sex === 'Female').reduce((a, r) => a + Number(r.n), 0),
    },
    enrollment_by_year: enrollments,
    readiness: {
      grades: { learners: Number(gradeLearners[0]?.n || 0), expected: enrolled },
      attendance: { days: Number(attendanceDays[0]?.days || 0), records: Number(attendanceDays[0]?.records || 0) },
      teacher_attendance: { marked: markedToday, total: activeTeachers },
      conduct: { records: Number(conductCount[0]?.n || 0) },
      aral: { tagged: Number(aralTagged[0]?.n || 0), sessions: Number(aralSessions[0]?.n || 0) },
      assessments: { records: Number(assessments[0]?.n || 0) },
      immersion: {
        total: immersionTotal,
        pending: immersionMap.pending || 0,
        ongoing: immersionMap.ongoing || 0,
        completed: immersionMap.completed || 0,
        withdrawn: immersionMap.withdrawn || 0,
      },
      jdvp: { total: Number(jdvpCount[0]?.n || 0) },
      audit: { last7: Number(audit[0]?.last7 || 0) },
    },
    date: t,
  };
  summaryCache.set(cacheKey, { data, ts: Date.now() });
  res.json(data);
}));

router.get('/attendance-trend', requireRole(...DASH_READ), asyncH(async (req, res) => {
  const daysRaw = Number(req.query.days || 7);
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(Math.floor(daysRaw), 365) : 7;
  const cutoff = db.dialect === 'pg'
    ? `CURRENT_DATE - (? * INTERVAL '1 day')`
    : `date('now', '-' || ? || ' days')`;
  const rows = await qa(
    `SELECT date, status, COUNT(*) AS n FROM attendance WHERE date >= ${cutoff} GROUP BY date, status ORDER BY date`,
    [days]);
  res.json({ data: rows });
}));

router.get('/latest-activity', requireRole(...DASH_READ), asyncH(async (req, res) => {
  const { limit } = page(req);
  const rows = await qa('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?', [limit]);
  res.json({ data: rows });
}));

// ------------------------------------------------------------
// SHS Enrollment — Grade 11/12 per section, by gender (term-aware)
// ------------------------------------------------------------
router.get('/enrollment', requireRole(...DASH_READ), asyncH(async (req, res) => {
  const sy = req.query.school_year || null;
  const term = (req.query.term || '').toLowerCase().trim();
  const params = [...SHS_GRADES];
  let syWhere = '';
  let termWhere = '';
  if (sy) { syWhere = ' AND e.school_year = ?'; params.push(sy); }
  if (term) { termWhere = ' AND e.term = ?'; params.push(term); }
  const rows = await qa(
    `SELECT s.grade_level, s.name AS section_name, s.strand,
       COUNT(DISTINCT e.student_id) AS total,
       COUNT(DISTINCT CASE WHEN st.sex = 'Male' THEN e.student_id END) AS male,
       COUNT(DISTINCT CASE WHEN st.sex = 'Female' THEN e.student_id END) AS female
     FROM enrollments e
     JOIN sections s ON s.id = e.section_id
     JOIN students st ON st.id = e.student_id
     WHERE e.status = 'enrolled' AND s.grade_level IN (?, ?) ${syWhere} ${termWhere}
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
  res.json({ school_year: sy, term: term || null, grades: SHS_GRADES, by_grade, by_section: rows, totals: grand });
}));

// ------------------------------------------------------------
// Attendance by grade level + section (for a date)
// ------------------------------------------------------------
router.get('/attendance-groups', requireRole(...DASH_READ), asyncH(async (req, res) => {
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
router.get('/teacher-status', requireRole(...DASH_READ), asyncH(async (req, res) => {
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
router.get('/subject-enrollment', requireRole(...DASH_READ), asyncH(async (req, res) => {
  const sy = req.query.school_year || null;
  const params = [];
  let syWhere = '';
  if (sy) { syWhere = ' AND e.school_year = ?'; params.push(sy); }
  params.push(...SHS_GRADES);
  const rows = await qa(
    `SELECT sub.id, sub.code, sub.title, sub.track, sub.term, sub.units,
       COUNT(DISTINCT e.student_id) AS enrolled
     FROM subjects sub
     LEFT JOIN enrollment_subjects es ON es.subject_id = sub.id
     LEFT JOIN enrollments e ON e.id = es.enrollment_id AND e.status = 'enrolled' ${syWhere}
     WHERE sub.grade_level IN (?, ?) AND sub.is_offered = TRUE
     GROUP BY sub.id, sub.code, sub.title, sub.track, sub.term, sub.units
     HAVING COUNT(DISTINCT e.student_id) > 0
     ORDER BY sub.term, sub.title`,
    params);
  const isCore = (r) => r.term === 'all' || r.track === 'general' || String(r.code).startsWith('CORE-');
  const core = rows.filter(isCore);
  const core_ids = new Set(core.map((r) => r.id));
  const electives = rows.filter((r) => !core_ids.has(r.id));
  res.json({ school_year: sy, core, electives });
}));

// ------------------------------------------------------------
// Aral Program — enrolled learners per section/term
// ------------------------------------------------------------
router.get('/aral-summary', requireRole(...DASH_READ), asyncH(async (req, res) => {
  const sy = req.query.school_year || null;
  const term = (req.query.term || '').toLowerCase().trim();
  const params = [];
  let where = "e.is_aral = TRUE AND e.status = 'enrolled'";
  if (sy) { where += ' AND e.school_year = ?'; params.push(sy); }
  if (term) { where += ' AND e.term = ?'; params.push(term); }
  const sscope = await teacherSectionScope(req);
  if (sscope.empty) return res.json({ school_year: sy, term: term || null, by_grade: {}, rows: [], totals: { male: 0, female: 0, total: 0 } });
  if (sscope.sql) { where += ' AND ' + sscope.sql; params.push(...sscope.params); }
  const rows = await qa(
    `SELECT s.grade_level, s.name AS section_name, s.strand,
       COUNT(*) AS aral,
       SUM(CASE WHEN st.sex = 'Male' THEN 1 ELSE 0 END) AS male,
       SUM(CASE WHEN st.sex = 'Female' THEN 1 ELSE 0 END) AS female
     FROM enrollments e
     JOIN sections s ON s.id = e.section_id
     JOIN students st ON st.id = e.student_id
     WHERE ${where}
     GROUP BY s.grade_level, s.name, s.strand
     ORDER BY s.grade_level, s.name`, params);
  const by_grade = {};
  let totals = { male: 0, female: 0, total: 0 };
  for (const r of rows) {
    const g = r.grade_level;
    by_grade[g] = by_grade[g] || { male: 0, female: 0, total: 0, sections: [] };
    const male = Number(r.male), female = Number(r.female);
    by_grade[g].male += male; by_grade[g].female += female; by_grade[g].total += male + female;
    by_grade[g].sections.push({ name: r.section_name, strand: r.strand, male, female, total: male + female });
    totals.male += male; totals.female += female; totals.total += male + female;
  }
  res.json({ school_year: sy, term: term || null, by_grade, rows, totals });
}));

// ------------------------------------------------------------
// Aral Program — remediation session attendance
// Filters: school_year, grade_level, section_id, subject_area
// ------------------------------------------------------------
router.get('/aral-attendance', requireRole(...DASH_READ), asyncH(async (req, res) => {
  const sy = req.query.school_year || null;
  const gradeLevel = req.query.grade_level || null;
  const sectionId = req.query.section_id || null;
  const area = req.query.subject_area || null;
  // Teacher-scoped: restrict to their sections. We must scope against section_id
  // matches on sess (alias differs from the summary endpoint), so derive ids directly.
  let allowedSectionIds = null;
  if (req.role === 'teacher') {
    const scope = await teacherScope(req.user);
    allowedSectionIds = scope ? scope.sections : [];
    if (!allowedSectionIds.length) {
      return res.json({ school_year: sy, subject_area: area, sessions: [], per_section: [], per_learner: [], totals: { sessions: 0, logged: 0, present: 0, absent: 0, excused: 0, rate: 0 } });
    }
  }
  const where = [];
  const params = [];
  if (sy) { where.push('sess.school_year = ?'); params.push(sy); }
  if (area) { where.push('sess.subject_area = ?'); params.push(area); }
  if (sectionId) { where.push('sess.section_id = ?'); params.push(sectionId); }
  if (gradeLevel) {
    where.push('sect.grade_level = ?');
    params.push(gradeLevel);
  }
  if (allowedSectionIds) {
    where.push(`sess.section_id IN (${allowedSectionIds.map(() => '?').join(',')})`);
    params.push(...allowedSectionIds);
  }
  const scope = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const sessions = await qa(
    `SELECT sess.id, sess.school_year, sess.section_id, sess.subject_area, sess.session_date, sess.session_no, sess.tutor,
       sect.name AS section_name, sect.grade_level,
       (SELECT COUNT(*) FROM aral_session_attendance aa WHERE aa.session_id = sess.id) AS logged,
       (SELECT COUNT(*) FROM aral_session_attendance aa WHERE aa.session_id = sess.id AND aa.status = 'present') AS present,
       (SELECT COUNT(*) FROM aral_session_attendance aa WHERE aa.session_id = sess.id AND aa.status = 'absent') AS absent,
       (SELECT COUNT(*) FROM aral_session_attendance aa WHERE aa.session_id = sess.id AND aa.status = 'excused') AS excused
     FROM aral_sessions sess JOIN sections sect ON sect.id = sess.section_id${scope}
     ORDER BY sess.session_date DESC, sess.id DESC`, params);
  const perLearner = await qa(
    `SELECT st.id AS student_id, st.first_name, st.last_name, st.sex, st.grade_level,
       sect.id AS section_id, sect.name AS section_name,
       COUNT(aa.id) AS sessions,
       SUM(CASE WHEN aa.status = 'present' THEN 1 ELSE 0 END) AS present,
       SUM(CASE WHEN aa.status = 'absent' THEN 1 ELSE 0 END) AS absent,
       SUM(CASE WHEN aa.status = 'excused' THEN 1 ELSE 0 END) AS excused
     FROM aral_session_attendance aa
     JOIN aral_sessions sess ON sess.id = aa.session_id
     JOIN students st ON st.id = aa.student_id
     JOIN sections sect ON sect.id = sess.section_id${scope}
     GROUP BY st.id, st.first_name, st.last_name, st.sex, st.grade_level, sect.id, sect.name
     ORDER BY sect.name, st.last_name`, params);
  const perLearnerOut = perLearner.map((r) => {
    const total = Number(r.sessions);
    const present = Number(r.present), absent = Number(r.absent), excused = Number(r.excused);
    return {
      ...r,
      present, absent, excused,
      rate: total ? Math.round((present + excused) / total * 100) : 0,
    };
  });
  const perSection = {};
  for (const r of perLearnerOut) {
    const k = `${r.section_id}`;
    perSection[k] = perSection[k] || { section_id: r.section_id, section_name: r.section_name, learners: 0, sessions: 0, present: 0, absent: 0, excused: 0 };
    perSection[k].learners++;
    perSection[k].sessions += r.sessions;
    perSection[k].present += r.present;
    perSection[k].absent += r.absent;
    perSection[k].excused += r.excused;
  }
  const perSectionOut = Object.values(perSection).map((r) => ({
    ...r,
    rate: r.sessions ? Math.round((r.present + r.excused) / r.sessions * 100) : 0,
  }));
  const totals = sessions.reduce((a, s) => {
    a.sessions++;
    a.logged += Number(s.logged); a.present += Number(s.present);
    a.absent += Number(s.absent); a.excused += Number(s.excused);
    return a;
  }, { sessions: 0, logged: 0, present: 0, absent: 0, excused: 0 });
  const rate = totals.logged ? Math.round((totals.present + totals.excused) / totals.logged * 100) : 0;
  res.json({ school_year: sy, subject_area: area, sessions, per_section: perSectionOut, per_learner: perLearnerOut, totals: { ...totals, rate } });
}));

// ------------------------------------------------------------
// Aral Program — learner progress (baseline vs latest assessment)
// Filters: school_year, grade_level, section_id, subject_area
// ------------------------------------------------------------
const LEVEL_ORDER = {
  reading: { Independent: 1, Instructional: 2, Frustration: 3, 'Non-Reader': 4 },
  numeracy: { Independent: 1, Developing: 2, Frustration: 3, 'Non-Numerate': 4 },
};
const ARAL_EXIT = { reading: ['Independent'], numeracy: ['Independent'] };

router.get('/aral-progress', requireRole(...DASH_READ), asyncH(async (req, res) => {
  const sy = req.query.school_year || null;
  const gradeLevel = req.query.grade_level || null;
  const sectionId = req.query.section_id || null;
  const area = req.query.subject_area || null;
  let allowedSectionIds = null;
  if (req.role === 'teacher') {
    const scope = await teacherScope(req.user);
    allowedSectionIds = scope ? scope.sections : [];
    if (!allowedSectionIds.length) {
      return res.json({ school_year: sy, subject_area: area, data: [], summary: { learners: 0, improved: 0, declined: 0, stable: 0, not_assessed: 0, exit_met: 0 } });
    }
  }
  const where = ["e.is_aral = TRUE AND e.status = 'enrolled'"];
  const params = [];
  if (sy) { where.push('e.school_year = ?'); params.push(sy); }
  if (sectionId) { where.push('e.section_id = ?'); params.push(sectionId); }
  if (gradeLevel) { where.push('sect.grade_level = ?'); params.push(gradeLevel); }
  if (allowedSectionIds) {
    where.push(`e.section_id IN (${allowedSectionIds.map(() => '?').join(',')})`);
    params.push(...allowedSectionIds);
  }
  const learners = await qa(
    `SELECT DISTINCT st.id AS student_id, st.first_name, st.last_name, st.sex, st.grade_level,
       sect.id AS section_id, sect.name AS section_name
     FROM enrollments e
     JOIN students st ON st.id = e.student_id
     JOIN sections sect ON sect.id = e.section_id
     WHERE ${where.join(' AND ')}
     ORDER BY sect.name, st.last_name`, params);
  const startYear = sy ? Number(sy.slice(0, 4)) : null;
  const assessmentParams = [];
  let dateFilterSql = '';
  if (startYear) {
    assessmentParams.push(`${startYear}-07-01`, `${startYear + 1}-07-01`);
    dateFilterSql = ' AND la.date >= ? AND la.date < ?';
  }
  const learnerIds = learners.map((l) => Number(l.student_id));
  let assessments;
  if (learnerIds.length) {
    const idPlaceholders = learnerIds.map(() => '?').join(',');
    assessments = await qa(
      `SELECT la.student_id, la.kind, la.date, la.level, la.score
       FROM learner_assessments la
       WHERE la.student_id IN (${idPlaceholders})${dateFilterSql}
       ORDER BY la.date ASC, la.id ASC`,
      [...learnerIds, ...assessmentParams]);
  } else {
    assessments = [];
  }
  let attRows;
  if (learnerIds.length) {
    const idPlaceholders = learnerIds.map(() => '?').join(',');
    attRows = await qa(
      `SELECT aa.student_id, COUNT(aa.id) AS sessions,
         SUM(CASE WHEN aa.status IN ('present', 'excused') THEN 1 ELSE 0 END) AS attended
       FROM aral_session_attendance aa
       JOIN aral_sessions sess ON sess.id = aa.session_id
       WHERE aa.student_id IN (${idPlaceholders})
       GROUP BY aa.student_id`,
      learnerIds);
  } else {
    attRows = [];
  }
  const attMap = {};
  for (const a of attRows) attMap[a.student_id] = { sessions: Number(a.sessions), attended: Number(a.attended) };
  const byLearner = {};
  for (const a of assessments) {
    (byLearner[a.student_id] = byLearner[a.student_id] || {})[a.kind] = byLearner[a.student_id][a.kind] || [];
    byLearner[a.student_id][a.kind].push(a);
  }
  const kinds = area ? [area] : ['reading', 'numeracy'];
  const data = [];
  for (const l of learners) {
    const att = attMap[l.student_id] || { sessions: 0, attended: 0 };
    for (const kind of kinds) {
      const list = (byLearner[l.student_id] || {})[kind] || [];
      const baseline = list[0] || null;
      const latest = list[list.length - 1] || null;
      let movement = 'not assessed';
      let exitMet = false;
      if (baseline && latest) {
        const order = LEVEL_ORDER[kind] || {};
        const bb = order[baseline.level] != null ? order[baseline.level] : null;
        const ll = order[latest.level] != null ? order[latest.level] : null;
        if (bb != null && ll != null) {
          if (ll < bb) movement = 'improved';
          else if (ll > bb) movement = 'declined';
          else movement = 'stable';
          exitMet = (ARAL_EXIT[kind] || []).includes(latest.level);
        }
      }
      data.push({
        student_id: l.student_id, first_name: l.first_name, last_name: l.last_name, sex: l.sex,
        grade_level: l.grade_level, section_id: l.section_id, section_name: l.section_name,
        kind, baseline, latest, movement, exit_met: exitMet,
        attendance_rate: att.sessions ? Math.round(att.attended / att.sessions * 100) : null,
      });
    }
  }
  const summary = {
    learners: new Set(data.map((d) => d.student_id)).size,
    improved: data.filter((d) => d.movement === 'improved').length,
    declined: data.filter((d) => d.movement === 'declined').length,
    stable: data.filter((d) => d.movement === 'stable').length,
    not_assessed: data.filter((d) => d.movement === 'not assessed').length,
    exit_met: data.filter((d) => d.exit_met).length,
  };
  res.json({ school_year: sy, subject_area: area, data, summary });
}));

// ------------------------------------------------------------
// Aral Program — record a remediation session
// ------------------------------------------------------------
router.post('/aral-sessions', requireRole(...WRITE, 'teacher', 'guidance'), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.section_id || !b.session_date || !b.subject_area) {
    return res.status(400).json({ error: 'section_id, session_date and subject_area are required' });
  }
  const area = ['reading', 'numeracy'].includes(b.subject_area) ? b.subject_area : 'reading';
  const section = await q('SELECT id FROM sections WHERE id = ?', [b.section_id]);
  if (!section) return res.status(404).json({ error: 'Section not found' });
  const sy = b.school_year || '2026-2027';
  let sesId;
  let recorded = 0;
  const valid = ['present', 'absent', 'excused'];
  await tx(async (conn) => {
    sesId = await conn.runId(
      `INSERT INTO aral_sessions (school_year, section_id, subject_area, session_date, session_no, tutor, remarks, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sy, b.section_id, area, b.session_date, b.session_no || null, b.tutor || null, b.remarks || null, req.user.id]);
    for (const r of (b.attendance || [])) {
      if (!r.student_id || !valid.includes(r.status)) continue;
      await conn.run(
        'INSERT INTO aral_session_attendance (session_id, student_id, status, remarks) VALUES (?, ?, ?, ?)',
        [sesId, r.student_id, r.status, r.remarks || null]);
      recorded++;
    }
  });
  await audit(req, 'ARAL_SESSION', 'aral_sessions', sesId, { section_id: b.section_id, subject_area: area, session_date: b.session_date, recorded });
  res.status(201).json({ id: sesId, recorded });
}));

// ------------------------------------------------------------
// Aral Program — learners currently tagged in ARAL
// ------------------------------------------------------------
router.get('/aral-enrolled', requireRole(...DASH_READ), asyncH(async (req, res) => {
  const sy = req.query.school_year || null;
  const params = [];
  let where = 'e.is_aral = TRUE';
  if (sy) { where += ' AND e.school_year = ?'; params.push(sy); }
  const secScope = await teacherSectionScope(req);
  if (secScope.empty) return res.json({ data: [] });
  if (secScope.sql) { where += ' AND ' + secScope.sql; params.push(...secScope.params); }
  const rows = await qa(
    `SELECT e.id AS enrollment_id, e.student_id, e.school_year, e.term, e.status,
       st.first_name, st.last_name, st.lrn, st.sex,
       s.id AS section_id, s.name AS section_name, s.grade_level
     FROM enrollments e
     JOIN students st ON st.id = e.student_id
     LEFT JOIN sections s ON s.id = e.section_id
     WHERE ${where}
     ORDER BY s.grade_level, s.name, st.last_name, st.first_name`, params);
  res.json({ data: rows });
}));

// ------------------------------------------------------------
// Aral Program — enroll a learner (teacher / admin / guidance)
// ------------------------------------------------------------
router.post('/aral-enroll', requireRole(...WRITE, 'teacher', 'guidance'), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.student_id) return res.status(400).json({ error: 'student_id is required' });
  const student = await q('SELECT id, first_name, last_name FROM students WHERE id = ?', [b.student_id]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const sy = b.school_year || '2026-2027';
  const term = String(b.term || '').toLowerCase();
  const norm = term === '1' || term === 'first' ? 'first' : term === '2' || term === 'second' ? 'second'
    : term === '3' || term === 'third' ? 'third' : null;
  const rows = norm
    ? await qa('SELECT id FROM enrollments WHERE student_id = ? AND school_year = ? AND term = ? ORDER BY created_at DESC LIMIT 1', [b.student_id, sy, norm])
    : await qa('SELECT id FROM enrollments WHERE student_id = ? AND school_year = ? ORDER BY created_at DESC LIMIT 1', [b.student_id, sy]);
  if (!rows.length) {
    return res.status(409).json({ error: 'This learner has no enrollment record for the selected school year. Enroll them to a section first, then tag them for ARAL.' });
  }
  await qr('UPDATE enrollments SET is_aral = TRUE WHERE id = ?', [rows[0].id]);
  await audit(req, 'ARAL_ENROLL', 'enrollments', rows[0].id, { student_id: b.student_id, school_year: sy, term: norm });
  res.json({ ok: true, enrollment_id: rows[0].id, is_aral: true });
}));

// ------------------------------------------------------------
// Aral Program — unenroll a learner from ARAL
// ------------------------------------------------------------
router.post('/aral-unenroll', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.enrollment_id) return res.status(400).json({ error: 'enrollment_id is required' });
  const row = await q('SELECT id, student_id FROM enrollments WHERE id = ?', [b.enrollment_id]);
  if (!row) return res.status(404).json({ error: 'Enrollment not found' });
  await qr('UPDATE enrollments SET is_aral = FALSE WHERE id = ?', [row.id]);
  await audit(req, 'ARAL_UNENROLL', 'enrollments', row.id, { student_id: row.student_id });
  res.json({ ok: true, is_aral: false });
}));

// ------------------------------------------------------------
// Student progress — computed grades per learner (SHS)
// ------------------------------------------------------------
router.get('/student-progress', requireRole(...DASH_READ), asyncH(async (req, res) => {
  const sy = req.query.school_year || null;
  const term = (req.query.term || '').toLowerCase().trim();
  const params = [];
  let where = "e.status = 'enrolled'";
  if (sy) { where += ' AND e.school_year = ?'; params.push(sy); }
  if (term) { where += ' AND e.term = ?'; params.push(term); }
  const secScope = await teacherSectionScope(req);
  if (secScope.empty) {
    return res.json({ school_year: sy, term: term || null, data: [], summary: { learners: 0, passing: 0, at_risk: 0, no_grades: 0, aral: 0 } });
  }
  if (secScope.sql) { where += ' AND ' + secScope.sql; params.push(...secScope.params); }
  const rows = await qa(
    `SELECT st.id AS student_id, st.first_name, st.last_name, st.sex,
       s.name AS section_name, s.grade_level, e.strand, e.term, e.is_aral,
       COUNT(DISTINCT g.subject_id) AS subjects,
       AVG(g.computed_grade) AS average,
       SUM(CASE WHEN g.computed_grade >= 75 THEN 1 ELSE 0 END) AS passed,
       SUM(CASE WHEN g.computed_grade < 75 THEN 1 ELSE 0 END) AS failed
     FROM enrollments e
     JOIN students st ON st.id = e.student_id
     JOIN sections s ON s.id = e.section_id
     LEFT JOIN grades g ON g.student_id = e.student_id AND g.school_year = e.school_year
     WHERE ${where}
     GROUP BY st.id, st.first_name, st.last_name, st.sex, s.name, s.grade_level, e.strand, e.term, e.is_aral
     ORDER BY s.grade_level, s.name, st.last_name, st.first_name`, params);
  const decorated = rows.map((r) => ({
    ...r,
    average: r.average == null ? null : Math.round(Number(r.average) * 100) / 100,
    passed: Number(r.passed), failed: Number(r.failed),
    status: r.average == null ? 'no grades' : (Number(r.average) >= 75 ? 'passing' : 'at risk'),
  }));
  const summary = {
    learners: decorated.length,
    passing: decorated.filter((r) => r.status === 'passing').length,
    at_risk: decorated.filter((r) => r.status === 'at risk').length,
    no_grades: decorated.filter((r) => r.status === 'no grades').length,
    aral: decorated.filter((r) => r.is_aral).length,
  };
  res.json({ school_year: sy, term: term || null, data: decorated, summary });
}));

// ------------------------------------------------------------
// Quarterly subject report — per-subject Mean, MPS, grade
// range, and below-75 count on the quarterly examination.
// ------------------------------------------------------------
router.get('/quarterly-report', requireRole(...DASH_READ), asyncH(async (req, res) => {
  const sy = String(req.query.school_year || '').trim();
  if (!sy) return res.status(400).json({ error: 'school_year is required' });
  const qtrNum = Number(req.query.quarter);
  if (!Number.isFinite(qtrNum) || qtrNum < 1 || qtrNum > 4) {
    return res.status(400).json({ error: 'quarter must be 1, 2, 3, or 4' });
  }
  const sectionId = String(req.query.section_id || '').trim();
  const scope = await teacherSectionScope(req);
  const where = ['g.school_year = ?', 'g.quarter = ?'];
  const params = [sy, qtrNum];
  if (sectionId) { where.push('g.section_id = ?'); params.push(sectionId); }
  if (scope.sql) { where.push(scope.sql); params.push(...scope.params); }
  const whereSql = where.join(' AND ');
  const rows = await qa(
    `SELECT g.subject_id, sub.code, sub.title,
            COUNT(DISTINCT g.student_id) AS students,
            AVG(CASE WHEN g.computed_grade > 0 THEN g.computed_grade END) AS mean,
            AVG(CASE WHEN g.quarterly_exam > 0 THEN g.quarterly_exam END) AS mps,
            MAX(CASE WHEN g.computed_grade > 0 THEN g.computed_grade END) AS highest,
            MIN(CASE WHEN g.computed_grade > 0 THEN g.computed_grade END) AS lowest,
            SUM(CASE WHEN g.quarterly_exam > 0 AND g.quarterly_exam < 75 THEN 1 ELSE 0 END) AS below_75
     FROM grades g
     JOIN subjects sub ON sub.id = g.subject_id
     WHERE ${whereSql}
     GROUP BY g.subject_id, sub.code, sub.title
     ORDER BY sub.title`, params);
  const fmt = (v) => v == null ? null : Number(v);
  const subjects = rows.map((r) => ({
    subject_id: Number(r.subject_id),
    code: r.code,
    title: r.title,
    students: Number(r.students || 0),
    mean: fmt(r.mean),
    mps: fmt(r.mps),
    highest: fmt(r.highest),
    lowest: fmt(r.lowest),
    below_75: Number(r.below_75 || 0),
  }));
  const means = subjects.map((s) => s.mean).filter((v) => v != null);
  const mpss = subjects.map((s) => s.mps).filter((v) => v != null);
  const below75Row = await q(
    `SELECT COUNT(DISTINCT g.student_id) AS n
     FROM grades g
     WHERE ${whereSql} AND g.quarterly_exam > 0 AND g.quarterly_exam < 75`, params);
  res.json({
    school_year: sy,
    quarter: qtrNum,
    section_id: sectionId || null,
    subjects,
    summary: {
      subjects: subjects.length,
      graded_subjects: subjects.filter((s) => s.mean != null || s.mps != null).length,
      overall_mean: means.length ? Math.round((means.reduce((a, b) => a + b, 0) / means.length) * 100) / 100 : null,
      overall_mps: mpss.length ? Math.round((mpss.reduce((a, b) => a + b, 0) / mpss.length) * 100) / 100 : null,
      below_75_total: subjects.reduce((a, s) => a + s.below_75, 0),
      below_75_learners: Number(below75Row?.n || 0),
    },
  });
}));

// ------------------------------------------------------------
// Work Immersion summary — by batch, program, partner, status
// ------------------------------------------------------------
router.get('/immersion-summary', requireRole(...DASH_READ), asyncH(async (req, res) => {
  const params = [];
  const where = [];
  if (req.query.batch) { where.push('wi.batch = ?'); params.push(req.query.batch); }
  const filter = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = await qa(
    `SELECT wi.batch, wi.program, wi.partner_institution, wi.status,
       COUNT(*) AS learners,
       SUM(CASE WHEN st.sex = 'Male' THEN 1 ELSE 0 END) AS male,
       SUM(CASE WHEN st.sex = 'Female' THEN 1 ELSE 0 END) AS female
     FROM work_immersion wi JOIN students st ON st.id = wi.student_id
     ${filter}
     GROUP BY wi.batch, wi.program, wi.partner_institution, wi.status
     ORDER BY wi.batch, wi.program, wi.partner_institution, wi.status`,
    params);
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
router.get('/jdvp-summary', requireRole(...DASH_READ), asyncH(async (req, res) => {
  const params = [];
  const where = [];
  if (req.query.batch) { where.push('j.batch = ?'); params.push(req.query.batch); }
  const filter = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = await qa(
    `SELECT j.batch, j.program, j.status, st.sex, COUNT(*) AS n
     FROM jdvp_recipients j JOIN students st ON st.id = j.student_id
     ${filter}
     GROUP BY j.batch, j.program, j.status, st.sex
     ORDER BY j.batch, j.program, j.status`,
    params);
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

// ------------------------------------------------------------
// Per-user dashboard view preferences — stored on the server so the
// data view (school year / term / date) survives page refreshes.
// ------------------------------------------------------------
const DASHBOARD_PREFS = ['dashboard_school_year', 'dashboard_term', 'dashboard_date'];

router.get('/preferences', asyncH(async (req, res) => {
  const rows = await qa('SELECT pref_key, pref_value FROM user_preferences WHERE user_id = ?', [req.user.id]);
  const prefs = {};
  for (const r of rows) prefs[r.pref_key] = r.pref_value;
  res.json(prefs);
}));

router.put('/preferences', asyncH(async (req, res) => {
  const b = req.body || {};
  for (const key of DASHBOARD_PREFS) {
    if (!(key in b)) continue;
    const v = b[key] == null ? null : String(b[key]);
    const exists = await q('SELECT id FROM user_preferences WHERE user_id = ? AND pref_key = ?', [req.user.id, key]);
    if (exists) {
      await qr(`UPDATE user_preferences SET pref_value = ?, updated_at = ${db.nowSql()} WHERE id = ?`, [v, exists.id]);
    } else {
      await qi('INSERT INTO user_preferences (user_id, pref_key, pref_value) VALUES (?, ?, ?)', [req.user.id, key, v]);
    }
  }
  res.json({ ok: true });
}));

module.exports = router;