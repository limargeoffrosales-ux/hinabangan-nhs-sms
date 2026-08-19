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

router.get('/summary', requireRole(...WRITE), asyncH(async (req, res) => {
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

router.get('/attendance-trend', requireRole(...WRITE), asyncH(async (req, res) => {
  const days = Number(req.query.days || 7);
  const cutoff = db.dialect === 'pg'
    ? `CURRENT_DATE - (? * INTERVAL '1 day')`
    : `date('now', '-' || ? || ' days')`;
  const rows = await qa(
    `SELECT date, status, COUNT(*) AS n FROM attendance WHERE date >= ${cutoff} GROUP BY date, status ORDER BY date`,
    [days]);
  res.json({ data: rows });
}));

router.get('/latest-activity', requireRole('super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'), asyncH(async (req, res) => {
  const { limit } = page(req);
  const rows = await qa('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?', [limit]);
  res.json({ data: rows });
}));

// ------------------------------------------------------------
// SHS Enrollment — Grade 11/12 per section, by gender (term-aware)
// ------------------------------------------------------------
router.get('/enrollment', requireRole(...WRITE), asyncH(async (req, res) => {
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
router.get('/attendance-groups', requireRole(...WRITE), asyncH(async (req, res) => {
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
router.get('/teacher-status', requireRole(...WRITE), asyncH(async (req, res) => {
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
router.get('/subject-enrollment', requireRole(...WRITE), asyncH(async (req, res) => {
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
router.get('/aral-summary', requireRole(...WRITE), asyncH(async (req, res) => {
  const sy = req.query.school_year || null;
  const term = (req.query.term || '').toLowerCase().trim();
  const params = [];
  let where = "e.is_aral = TRUE AND e.status = 'enrolled'";
  if (sy) { where += ' AND e.school_year = ?'; params.push(sy); }
  if (term) { where += ' AND e.term = ?'; params.push(term); }
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
router.get('/aral-attendance', requireRole(...WRITE), asyncH(async (req, res) => {
  const sy = req.query.school_year || null;
  const gradeLevel = req.query.grade_level || null;
  const sectionId = req.query.section_id || null;
  const area = req.query.subject_area || null;
  const where = [];
  const params = [];
  if (sy) { where.push('sess.school_year = ?'); params.push(sy); }
  if (area) { where.push('sess.subject_area = ?'); params.push(area); }
  if (sectionId) { where.push('sess.section_id = ?'); params.push(sectionId); }
  if (gradeLevel) {
    where.push('sect.grade_level = ?');
    params.push(gradeLevel);
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

router.get('/aral-progress', requireRole(...WRITE, 'teacher', 'guidance'), asyncH(async (req, res) => {
  const sy = req.query.school_year || null;
  const gradeLevel = req.query.grade_level || null;
  const sectionId = req.query.section_id || null;
  const area = req.query.subject_area || null;
  const where = ["e.is_aral = TRUE AND e.status = 'enrolled'"];
  const params = [];
  if (sy) { where.push('e.school_year = ?'); params.push(sy); }
  if (sectionId) { where.push('e.section_id = ?'); params.push(sectionId); }
  if (gradeLevel) { where.push('sect.grade_level = ?'); params.push(gradeLevel); }
  const learners = await qa(
    `SELECT DISTINCT st.id AS student_id, st.first_name, st.last_name, st.sex, st.grade_level,
       sect.id AS section_id, sect.name AS section_name
     FROM enrollments e
     JOIN students st ON st.id = e.student_id
     JOIN sections sect ON sect.id = e.section_id
     WHERE ${where.join(' AND ')}
     ORDER BY sect.name, st.last_name`, params);
  const startYear = sy ? Number(sy.slice(0, 4)) : null;
  const dateWhere = startYear
    ? ` AND la.date >= '${startYear}-07-01' AND la.date < '${startYear + 1}-07-01'`
    : '';
  const assessments = await qa(
    `SELECT la.student_id, la.kind, la.date, la.level, la.score
     FROM learner_assessments la
     WHERE la.student_id IN (${learners.length ? learners.map((l) => Number(l.student_id)).join(',') : 'NULL'})${dateWhere}
     ORDER BY la.date ASC, la.id ASC`);
  const attRows = await qa(
    `SELECT aa.student_id, COUNT(aa.id) AS sessions,
       SUM(CASE WHEN aa.status IN ('present', 'excused') THEN 1 ELSE 0 END) AS attended
     FROM aral_session_attendance aa
     JOIN aral_sessions sess ON sess.id = aa.session_id
     WHERE aa.student_id IN (${learners.length ? learners.map((l) => Number(l.student_id)).join(',') : 'NULL'})
     GROUP BY aa.student_id`);
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
  const sesId = await qi(
    `INSERT INTO aral_sessions (school_year, section_id, subject_area, session_date, session_no, tutor, remarks, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sy, b.section_id, area, b.session_date, b.session_no || null, b.tutor || null, b.remarks || null, req.user.id]);
  let recorded = 0;
  const valid = ['present', 'absent', 'excused'];
  for (const r of (b.attendance || [])) {
    if (!r.student_id || !valid.includes(r.status)) continue;
    await qr(
      'INSERT INTO aral_session_attendance (session_id, student_id, status, remarks) VALUES (?, ?, ?, ?)',
      [sesId, r.student_id, r.status, r.remarks || null]);
    recorded++;
  }
  await audit(req, 'ARAL_SESSION', 'aral_sessions', sesId, { section_id: b.section_id, subject_area: area, session_date: b.session_date, recorded });
  res.status(201).json({ id: sesId, recorded });
}));

// ------------------------------------------------------------
// Aral Program — learners currently tagged in ARAL
// ------------------------------------------------------------
router.get('/aral-enrolled', requireRole(...WRITE), asyncH(async (req, res) => {
  const sy = req.query.school_year || null;
  const params = [];
  let where = 'e.is_aral = TRUE';
  if (sy) { where += ' AND e.school_year = ?'; params.push(sy); }
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
router.get('/student-progress', requireRole(...WRITE, 'teacher', 'guidance'), asyncH(async (req, res) => {
  const sy = req.query.school_year || null;
  const term = (req.query.term || '').toLowerCase().trim();
  const params = [];
  let where = "e.status = 'enrolled'";
  if (sy) { where += ' AND e.school_year = ?'; params.push(sy); }
  if (term) { where += ' AND e.term = ?'; params.push(term); }
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
// Work Immersion summary — by batch, program, partner, status
// ------------------------------------------------------------
router.get('/immersion-summary', requireRole(...WRITE), asyncH(async (req, res) => {
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
router.get('/jdvp-summary', requireRole(...WRITE), asyncH(async (req, res) => {
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