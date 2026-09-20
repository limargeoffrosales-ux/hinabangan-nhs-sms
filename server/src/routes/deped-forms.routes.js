const express = require('express');
const db = require('../db');
const { q, qa, qr, qi, nowSql } = db;
const { authenticate, requireRole } = require('../auth');
const { asyncH, maskPII } = require('../utils');

const router = express.Router();
router.use(authenticate);

const ADMIN_ONLY = ['super_admin', 'school_admin', 'registrar'];

// Input validation helpers
function validateSectionId(id) {
  const num = Number(id);
  if (!Number.isInteger(num) || num < 1) {
    throw new Error('Invalid section_id: must be a positive integer');
  }
  return num;
}

function validateStudentId(id) {
  const num = Number(id);
  if (!Number.isInteger(num) || num < 1) {
    throw new Error('Invalid student_id: must be a positive integer');
  }
  return num;
}

function validateTerm(term) {
  if (!term) return term;
  const t = String(term).trim().toUpperCase();
  if (!['Q1', 'Q2', 'Q3', 'Q4', 'FIRST', 'SECOND', 'THIRD', 'FINAL'].includes(t) && isNaN(Number(t))) {
    throw new Error('Invalid term: must be Q1-Q4 or FIRST-SECOND-THIRD-FINAL');
  }
  return term;
}

function validateMonth(month) {
  const m = Number(month);
  if (!Number.isInteger(m) || m < 1 || m > 12) {
    throw new Error('Invalid month: must be 1-12');
  }
  return m;
}

function validateYear(year) {
  const y = Number(year);
  if (!Number.isInteger(y) || y < 1900 || y > new Date().getFullYear() + 1) {
    throw new Error('Invalid year: must be between 1900 and ' + (new Date().getFullYear() + 1));
  }
  return y;
}

function computeAge(birthdate) {
  if (!birthdate) return null;
  const birth = new Date(birthdate + 'T00:00:00');
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function withAge(rows) {
  if (!rows) return rows;
  const arr = Array.isArray(rows) ? rows : [rows];
  return arr.map((r) => ({ ...r, age: r.birthdate ? computeAge(r.birthdate) : null }));
}

function termToQuarter(term) {
  if (!term) return null;
  const m = String(term).match(/(\d)/);
  return m ? Number(m[1]) : null;
}

router.get('/school-info', requireRole(...ADMIN_ONLY), asyncH(async (_req, res) => {
  const rows = await qa("SELECT key, value FROM app_settings WHERE key IN ('school_name','school_id','region','division','district','address','school_year','school_head_name')");
  const info = {
    school_name: 'Hinabangan National High School',
    school_id: '303606',
    region: 'Region VIII (Eastern Visayas)',
    division: 'Schools Division of Samar',
    district: 'Hinabangan I District',
    address: 'Hinabangan, Samar',
  };
  for (const r of rows) if (r.value) info[r.key] = r.value;
  res.json(info);
}));

router.get('/sf3', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { section_id } = req.query;
  const secId = validateSectionId(section_id);
  if (!section_id) return res.json({ students: [], books: [], section: null });
  const section = await q('SELECT * FROM sections WHERE id = ?', [secId]);
  const students = await qa(
    `SELECT s.id, s.lrn, s.last_name, s.first_name, s.middle_name
     FROM students s
     JOIN enrollments e ON e.student_id = s.id
     WHERE e.section_id = ? AND e.status = 'enrolled'
     ORDER BY s.last_name, s.first_name`,
    [secId]
  );
  res.json({ students, section });
}));

router.get('/sf4', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { section_id, month, year } = req.query;
  const secId = validateSectionId(section_id);
  if (!section_id) return res.json({ movements: [], attendance: [] });
  const sec = await q('SELECT * FROM sections WHERE id = ?', [secId]);
  const m = validateMonth(month);
  const y = validateYear(year);
  const enrollments = await qa(
    db.dialect === 'pg'
      ? `SELECT e.*, s.first_name, s.last_name, s.sex,
              CASE
                WHEN e.enrolled_at IS NOT NULL AND EXTRACT(MONTH FROM e.enrolled_at::timestamp) = $2::int
                  AND EXTRACT(YEAR FROM e.enrolled_at::timestamp) = $3::int THEN 'new'
                ELSE 'old'
              END AS enrollment_type
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       WHERE e.section_id = $1::bigint`
      : `SELECT e.*, s.first_name, s.last_name, s.sex,
              CASE
                WHEN e.enrolled_at IS NOT NULL AND CAST(strftime('%m', e.enrolled_at) AS INTEGER) = ?
                  AND CAST(strftime('%Y', e.enrolled_at) AS INTEGER) = ? THEN 'new'
                ELSE 'old'
              END AS enrollment_type
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       WHERE e.section_id = ?`,
    [Number(section_id), m, y]
  );
const movements = await qa(
    db.dialect === 'pg'
      ? `SELECT e.student_id, s.first_name, s.last_name, e.status, e.enrolled_at
          FROM enrollments e
          JOIN students s ON s.id = e.student_id
          WHERE e.section_id = $1::bigint
            AND e.enrolled_at IS NOT NULL
            AND EXTRACT(MONTH FROM e.enrolled_at::timestamp) = $2::int
            AND EXTRACT(YEAR FROM e.enrolled_at::timestamp) = $3::int`
      : `SELECT e.student_id, s.first_name, s.last_name, e.status, e.enrolled_at
          FROM enrollments e
          JOIN students s ON s.id = e.student_id
          WHERE e.section_id = ?
            AND e.enrolled_at IS NOT NULL
            AND CAST(strftime('%m', e.enrolled_at) AS INTEGER) = ?
            AND CAST(strftime('%Y', e.enrolled_at) AS INTEGER) = ?`,
    [secId, m, y]
  );
const attendance = await qa(
    db.dialect === 'pg'
      ? `SELECT a.student_id, a.status,
                EXTRACT(DAY FROM a.date::timestamp) AS day_num
           FROM attendance a
          WHERE a.section_id = $1::bigint
            AND EXTRACT(MONTH FROM a.date::timestamp) = $2::int
            AND EXTRACT(YEAR FROM a.date::timestamp) = $3::int`
      : `SELECT a.student_id, a.status,
                CAST(strftime('%d', a.date) AS INTEGER) AS day_num
           FROM attendance a
          WHERE a.section_id = ?
            AND CAST(strftime('%m', a.date) AS INTEGER) = ?
            AND CAST(strftime('%Y', a.date) AS INTEGER) = ?`,
    [secId, m, y]
  );
  const enrolledCount = enrollments.filter(e => e.status === 'enrolled').length;
  const maleCount = enrollments.filter(e => e.status === 'enrolled' && e.sex === 'Male').length;
  const femaleCount = enrolledCount - maleCount;
  const totalDaysPresent = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const totalDaysAbsent = attendance.filter(a => a.status === 'absent').length;
  res.json({ section: sec, movements, enrolledCount, maleCount, femaleCount, totalDaysPresent, totalDaysAbsent, month: m, year: y });
}));

router.get('/sf1', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { section_id, school_year } = req.query;
  const secId = validateSectionId(section_id);
  if (!section_id) return res.json({ students: [], section: null });
  const section = await q('SELECT * FROM sections WHERE id = ?', [secId]);
  const students = await qa(
    db.dialect === 'pg'
      ? `SELECT s.*, e.strand, e.enrolled_at
         FROM students s
         JOIN enrollments e ON e.student_id = s.id
         WHERE e.section_id = $1::bigint ${school_year ? 'AND e.school_year = $2::text' : ''}
         ORDER BY s.last_name, s.first_name`
      : `SELECT s.*, e.strand, e.enrolled_at
         FROM students s
         JOIN enrollments e ON e.student_id = s.id
         WHERE e.section_id = ? ${school_year ? 'AND e.school_year = ?' : ''}
         ORDER BY s.last_name, s.first_name`,
    [section_id, ...(school_year ? [school_year] : [])]
  );
  res.json({ students, section });
}));

router.get('/sf2', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { section_id, month, year } = req.query;
  const secId = validateSectionId(section_id);
  if (!section_id) return res.json({ students: [], attendance: [] });
  const students = await qa(
    `SELECT s.id, s.last_name, s.first_name, s.middle_name, s.suffix
     FROM students s
     JOIN enrollments e ON e.student_id = s.id
     WHERE e.section_id = ?
     ORDER BY s.last_name, s.first_name`,
    [secId]
  );
  const m = validateMonth(month);
  const y = validateYear(year);
const attendance = await qa(
    db.dialect === 'pg'
      ? `SELECT a.student_id, a.date, a.status, a.session
          FROM attendance a
          WHERE a.section_id = $1::bigint AND EXTRACT(MONTH FROM a.date::timestamp) = $2::int
            AND EXTRACT(YEAR FROM a.date::timestamp) = $3::int`
      : `SELECT a.student_id, a.date, a.status, a.session
          FROM attendance a
          WHERE a.section_id = ? AND CAST(strftime('%m', a.date) AS INTEGER) = ?
            AND CAST(strftime('%Y', a.date) AS INTEGER) = ?`,
    [secId, m, y]
  );
  res.json({ students, attendance, month: Number(m), year: Number(y) });
}));

router.get('/sf5', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { section_id, term } = req.query;
  const secId = validateSectionId(section_id);
  if (!section_id) return res.json({ students: [], subjects: [] });
  const section = await q('SELECT * FROM sections WHERE id = ?', [section_id]);
const students = await qa(
    `SELECT DISTINCT s.id, s.lrn, s.last_name, s.first_name, s.middle_name, s.suffix, s.sex
     FROM students s
     JOIN enrollments e ON e.student_id = s.id
     WHERE e.section_id = ?`,
    [secId]
  );
  const subjects = await qa(
    `SELECT DISTINCT sub.id, sub.title
     FROM subjects sub
     JOIN class_assignments ca ON ca.subject_id = sub.id
     WHERE ca.section_id = ?`,
    [secId]
  );
  const qtr = termToQuarter(term);
  const grades = await qa(
    db.dialect === 'pg'
      ? `SELECT g.student_id, g.subject_id, g.quarter, g.computed_grade, g.quarterly_exam, g.remarks
         FROM grades g
         WHERE g.section_id = $1::bigint ${qtr ? 'AND g.quarter = $2::int' : ''}`
      : `SELECT g.student_id, g.subject_id, g.quarter, g.computed_grade, g.quarterly_exam, g.remarks
         FROM grades g
         WHERE g.section_id = ? ${qtr ? 'AND g.quarter = ?' : ''}`,
    [secId, ...(qtr ? [qtr] : [])]
  );
  // Per-subject analysis: Mean + MPS, Highest-Lowest range, below-75 count in the
  // (Final term = selected) quarter's Quarterly Examination. When no term is picked,
  // fall back to the latest quarter that has exam data.
  const knownQuarters = [...new Set(grades.map((g) => g.quarter).filter((q) => q != null && q !== '' && !isNaN(Number(q))))];
  const effQuarter = qtr || (knownQuarters.length ? Math.max(...knownQuarters.map((q) => Number(q))) : null);
  const analysisRows = effQuarter != null ? grades.filter((g) => Number(g.quarter) === Number(effQuarter)) : grades;
  const analysis = subjects.map((sub) => {
    const rows = analysisRows.filter((g) => Number(g.subject_id) === Number(sub.id));
    const finals = rows.map((g) => Number(g.computed_grade)).filter((v) => Number.isFinite(v) && v > 0);
    const exams = rows.map((g) => Number(g.quarterly_exam)).filter((v) => Number.isFinite(v) && v > 0);
    return {
      subject_id: sub.id,
      mean: finals.length ? finals.reduce((a, b) => a + b, 0) / finals.length : null,
      mps: exams.length ? exams.reduce((a, b) => a + b, 0) / exams.length : null,
      highest: finals.length ? Math.max(...finals) : null,
      lowest: finals.length ? Math.min(...finals) : null,
      below_75_count: exams.filter((v) => v < 75).length,
      exam_count: exams.length,
    };
  });
  res.json({ students, subjects, grades, section, term: effQuarter, analysis });
}));

router.get('/sf6', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { school_year } = req.query;
  const sections = await qa(
    db.dialect === 'pg'
      ? `SELECT id, name, grade_level FROM sections sec WHERE 1=1 ${school_year ? 'AND sec.school_year = $1::text' : ''} ORDER BY grade_level, name`
      : `SELECT id, name, grade_level FROM sections sec WHERE 1=1 ${school_year ? 'AND sec.school_year = ?' : ''} ORDER BY grade_level, name`,
    school_year ? [school_year] : []
  );
  const sectionIds = sections.map((s) => s.id);
  const marks = sectionIds.map(() => '?').join(',');
  const [enrollRows, gradeRows, lwdRows] = await Promise.all(sectionIds.length ? [
    qa(
      `SELECT e.section_id, e.status, COUNT(*) AS cnt
       FROM enrollments e
       WHERE e.section_id IN (${marks})
       GROUP BY e.section_id, e.status`,
      sectionIds
    ),
    qa(
      db.dialect === 'pg'
        ? `SELECT g.section_id,
              COUNT(*) AS total,
              SUM(CASE WHEN g.computed_grade >= 75 THEN 1 ELSE 0 END) AS promoted,
              SUM(CASE WHEN g.computed_grade < 75 AND g.computed_grade >= 60 THEN 1 ELSE 0 END) AS conditional,
              SUM(CASE WHEN g.computed_grade < 60 THEN 1 ELSE 0 END) AS retained
           FROM grades g
           WHERE g.section_id IN (${marks})
             AND g.quarter = (SELECT MAX(g2.quarter) FROM grades g2 WHERE g2.student_id = g.student_id AND g2.section_id = g.section_id)
           GROUP BY g.section_id`
        : `SELECT g.section_id,
              COUNT(*) AS total,
              SUM(CASE WHEN g.computed_grade >= 75 THEN 1 ELSE 0 END) AS promoted,
              SUM(CASE WHEN g.computed_grade < 75 AND g.computed_grade >= 60 THEN 1 ELSE 0 END) AS conditional,
              SUM(CASE WHEN g.computed_grade < 60 THEN 1 ELSE 0 END) AS retained
           FROM grades g
           WHERE g.section_id IN (${marks})
             AND g.quarter = (SELECT MAX(g2.quarter) FROM grades g2 WHERE g2.student_id = g.student_id AND g2.section_id = g.section_id)
           GROUP BY g.section_id`,
      sectionIds
    ),
    qa(
      `SELECT e.section_id, COUNT(*) AS cnt FROM students s
       JOIN enrollments e ON e.student_id = s.id
       WHERE e.section_id IN (${marks})
         AND (s.indigenous_people = 'Yes' OR (s.special_needs IS NOT NULL AND s.special_needs != ''))
       GROUP BY e.section_id`,
      sectionIds
    ),
  ] : [[], [], []]);
  const enrollMap = new Map();
  for (const r of enrollRows) {
    const key = String(r.section_id);
    if (!enrollMap.has(key)) enrollMap.set(key, {});
    enrollMap.get(key)[r.status] = Number(r.cnt);
  }
  const gradeMap = new Map(gradeRows.map((g) => [String(g.section_id), g]));
  const lwdMap = new Map(lwdRows.map((l) => [String(l.section_id), Number(l.cnt)]));
  const result = sections.map((sec) => {
    const en = enrollMap.get(String(sec.id)) || {};
    const grades = gradeMap.get(String(sec.id)) || { total: 0, promoted: 0, conditional: 0, retained: 0 };
    return {
      section: sec,
      enrolled: en.enrolled || 0,
      transferred_out: en.transferred_out || 0,
      dropped: en.dropped || 0,
      lwd_count: lwdMap.get(String(sec.id)) || 0,
      promotion: grades,
    };
  });
  res.json(result);
}));

router.get('/sf7', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { school_year } = req.query;
  const sy = school_year ? validateYear(school_year) : null;
  const teachers = await qa(
    db.dialect === 'pg'
      ? `SELECT t.*, u.name as user_name,
              (SELECT sec.name FROM sections sec
               WHERE sec.adviser_teacher_id = t.id
                 AND (sec.school_year = $1::text OR $1::text IS NULL)
               LIMIT 1) as advisory_class
       FROM teachers t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.status = 'active'
       ORDER BY u.name`
      : `SELECT t.*, u.name as user_name,
              (SELECT sec.name FROM sections sec
               WHERE sec.adviser_teacher_id = t.id
                 AND (sec.school_year = ? OR ? IS NULL)
               LIMIT 1) as advisory_class
       FROM teachers t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.status = 'active'
       ORDER BY u.name`,
    [sy, sy]
  );
  const assignments = await qa(
    db.dialect === 'pg'
      ? `SELECT ca.teacher_id, sub.title as subject_name, sec.name as section_name, sec.grade_level,
              ca.room, ca.meetings_per_week, ca.duration_minutes as minutes_per_day
       FROM class_assignments ca
       JOIN subjects sub ON sub.id = ca.subject_id
       JOIN sections sec ON sec.id = ca.section_id
       WHERE (ca.school_year = $1::text OR $1::text IS NULL)
       ORDER BY ca.teacher_id, sub.title`
      : `SELECT ca.teacher_id, sub.title as subject_name, sec.name as section_name, sec.grade_level,
              ca.room, ca.meetings_per_week, ca.duration_minutes as minutes_per_day
       FROM class_assignments ca
       JOIN subjects sub ON sub.id = ca.subject_id
       JOIN sections sec ON sec.id = ca.section_id
       WHERE (ca.school_year = ? OR ? IS NULL)
       ORDER BY ca.teacher_id, sub.title`,
    [sy, sy]
  );
  const byTeacher = {};
  for (const a of assignments) {
    if (!byTeacher[a.teacher_id]) byTeacher[a.teacher_id] = [];
    byTeacher[a.teacher_id].push(a);
  }
  res.json({ teachers, assignments: byTeacher });
}));

router.get('/sf9', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { student_id, section_id, term } = req.query;
  if (!student_id && !section_id) return res.json({ learners: [] });
  if (student_id) {
    const student = await q('SELECT * FROM students WHERE id = ?', [student_id]);
    if (!student) return res.json({ learner: null });
    const enrollment = await q(
      `SELECT e.*, sec.name as section_name, sec.grade_level
       FROM enrollments e
       JOIN sections sec ON sec.id = e.section_id
       WHERE e.student_id = ?
       ORDER BY e.enrolled_at DESC LIMIT 1`,
      [student_id]
    );
const qtr = termToQuarter(validateTerm(term));
    const grades = await qa(
      db.dialect === 'pg'
        ? `SELECT g.*, sub.title as subject_name
           FROM grades g
           JOIN subjects sub ON sub.id = g.subject_id
           WHERE g.student_id = $1::bigint ${qtr ? 'AND g.quarter = $2::int' : ''}
           ORDER BY sub.title`
        : `SELECT g.*, sub.title as subject_name
           FROM grades g
           JOIN subjects sub ON sub.id = g.subject_id
           WHERE g.student_id = ? ${qtr ? 'AND g.quarter = ?' : ''}
           ORDER BY sub.title`,
      [student_id, ...(qtr ? [qtr] : [])]
    );
    const attendance = await qa(
      `SELECT
         COUNT(*) as total_days,
         SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as days_present,
         SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as days_absent,
         SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as days_late
       FROM attendance a
       WHERE a.student_id = ?`,
      [student_id]
    );
    const daysEnrolled = await q(
      `SELECT COUNT(*) as days_enrolled FROM attendance a WHERE a.student_id = ?`,
      [student_id]
    );
    const conduct = await q(
      'SELECT * FROM student_conduct_ratings WHERE student_id = ? AND school_year = ? AND term = ?',
      [student_id, enrollment?.school_year || '', term || '']
    );
    return res.json({ learner: { student, enrollment, grades, attendance: attendance[0], days_enrolled: daysEnrolled?.days_enrolled || 0, conduct: conduct || null } });
  }
  const learners = await qa(
    `SELECT s.id, s.last_name, s.first_name, s.middle_name, s.suffix
     FROM students s
     JOIN enrollments e ON e.student_id = s.id
     WHERE e.section_id = ?
     ORDER BY s.last_name, s.first_name`,
    [section_id]
  );
  res.json({ learners });
}));

router.get('/sf9/full', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { student_id, section_id } = req.query;
  if (!student_id && !section_id) return res.json({ learners: [] });
  if (student_id) {
    const student = await q('SELECT * FROM students WHERE id = ?', [student_id]);
    if (!student) return res.json({ learner: null });
    const enrollment = await q(
      `SELECT e.*, sec.name as section_name, sec.grade_level
       FROM enrollments e
       JOIN sections sec ON sec.id = e.section_id
       WHERE e.student_id = ?
       ORDER BY e.enrolled_at DESC LIMIT 1`,
      [student_id]
    );
    const sy = enrollment?.school_year || '';
    const allGrades = await qa(
      `SELECT g.*, sub.title as subject_name
       FROM grades g
       JOIN subjects sub ON sub.id = g.subject_id
       WHERE g.student_id = ?
       ORDER BY g.quarter, sub.title`,
      [student_id]
    );
    const monthlyAttendance = await qa(
      db.dialect === 'pg'
        ? `SELECT EXTRACT(MONTH FROM a.date::timestamp) as month,
                  EXTRACT(YEAR FROM a.date::timestamp) as year,
                  COUNT(*) as total_days,
                  SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as days_present,
                  SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as days_absent
           FROM attendance a WHERE a.student_id = $1
           GROUP BY EXTRACT(YEAR FROM a.date::timestamp), EXTRACT(MONTH FROM a.date::timestamp)
           ORDER BY year, month`
        : `SELECT CAST(strftime('%m', a.date) AS INTEGER) as month,
                  CAST(strftime('%Y', a.date) AS INTEGER) as year,
                  COUNT(*) as total_days,
                  SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as days_present,
                  SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as days_absent
           FROM attendance a WHERE a.student_id = ?
           GROUP BY strftime('%Y-%m', a.date)
           ORDER BY year, month`,
      [student_id]
    );
    const allConduct = await qa(
      'SELECT * FROM student_conduct_ratings WHERE student_id = ? AND school_year = ? ORDER BY term',
      [student_id, sy]
    );
    return res.json({ learner: { student: withAge(student), enrollment, grades: allGrades, monthlyAttendance, conduct: allConduct } });
  }
  const learners = await qa(
    `SELECT s.id, s.last_name, s.first_name, s.middle_name, s.suffix, s.lrn
     FROM students s
     JOIN enrollments e ON e.student_id = s.id
     WHERE e.section_id = ?
     ORDER BY s.last_name, s.first_name`,
    [section_id]
  );
  const ids = learners.map((lr) => lr.id);
  const marks = ids.map(() => '?').join(',');
  const [studentRowsRaw, enrollRows, gradeRows, attRows, conductRows] = await Promise.all(ids.length ? [
    qa(`SELECT * FROM students WHERE id IN (${marks})`, ids),
    qa(
      `SELECT e.*, sec.name as section_name, sec.grade_level
       FROM enrollments e
       JOIN sections sec ON sec.id = e.section_id
       WHERE e.student_id IN (${marks}) AND e.section_id = ?`,
      [...ids, section_id]
    ),
    qa(
      db.dialect === 'pg'
        ? `SELECT g.*, sub.title as subject_name
           FROM grades g
           JOIN subjects sub ON sub.id = g.subject_id
           WHERE g.student_id = ANY($1::bigint[]) AND g.section_id = $2
           ORDER BY g.quarter, sub.title`
        : `SELECT g.*, sub.title as subject_name
           FROM grades g
           JOIN subjects sub ON sub.id = g.subject_id
           WHERE g.student_id IN (${marks}) AND g.section_id = ?
           ORDER BY g.quarter, sub.title`,
      db.dialect === 'pg' ? [ids, section_id] : [...ids, section_id]
    ),
    qa(
      db.dialect === 'pg'
        ? `SELECT a.student_id,
                  EXTRACT(MONTH FROM a.date::timestamp) as month,
                  EXTRACT(YEAR FROM a.date::timestamp) as year,
                  COUNT(*) as total_days,
                  SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as days_present,
                  SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as days_absent
           FROM attendance a WHERE a.student_id = ANY($1::bigint[]) AND a.section_id = $2
           GROUP BY a.student_id, EXTRACT(YEAR FROM a.date::timestamp), EXTRACT(MONTH FROM a.date::timestamp)
           ORDER BY a.student_id, year, month`
        : `SELECT a.student_id,
                  CAST(strftime('%m', a.date) AS INTEGER) as month,
                  CAST(strftime('%Y', a.date) AS INTEGER) as year,
                  COUNT(*) as total_days,
                  SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as days_present,
                  SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as days_absent
           FROM attendance a WHERE a.student_id IN (${marks}) AND a.section_id = ?
           GROUP BY a.student_id, strftime('%Y-%m', a.date)
           ORDER BY a.student_id, year, month`,
      db.dialect === 'pg' ? [ids, section_id] : [...ids, section_id]
    ),
    qa(
      db.dialect === 'pg'
        ? `SELECT * FROM student_conduct_ratings WHERE student_id = ANY($1::bigint[]) ORDER BY student_id, school_year, term`
        : `SELECT * FROM student_conduct_ratings WHERE student_id IN (${marks}) ORDER BY student_id, school_year, term`,
      ids
    ),
  ] : [[], [], [], [], []]);
  const studentRows = withAge(studentRowsRaw);
  const stMap = new Map(studentRows.map((r) => [String(r.id), r]));
  const enrIdMap = new Map();
  for (const e of enrollRows) {
    const sid = String(e.student_id);
    if (!enrIdMap.has(sid) || (e.enrolled_at || '') > (enrIdMap.get(sid).enrolled_at || '')) enrIdMap.set(sid, e);
  }
  const gradeById = {};
  for (const g of gradeRows) (gradeById[String(g.student_id)] = gradeById[String(g.student_id)] || []).push(g);
  const attById = {};
  for (const a of attRows) (attById[String(a.student_id)] = attById[String(a.student_id)] || []).push(a);
  const conductById = {};
  for (const c of conductRows) (conductById[String(c.student_id)] = conductById[String(c.student_id)] || []).push(c);
  const result = learners.map((lr) => {
    const sid = String(lr.id);
    const enrollment = enrIdMap.get(sid) || null;
    const sy = enrollment?.school_year || '';
    const monthlyAttendance = attById[sid]?.sort((a, b) => (a.year - b.year) || (a.month - b.month)) || [];
    const conduct = (conductById[sid] || []).filter((c) => c.school_year === sy);
    return { student: stMap.get(sid) || null, enrollment, grades: gradeById[sid] || [], monthlyAttendance, conduct };
  });
  res.json({ learners: result });
}));

router.get('/sf9/batch', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { section_id, term, school_year } = req.query;
  if (!section_id) return res.json({ learners: [] });
  const pageSize = Math.min(Math.max(parseInt(req.query.page_size, 10) || 50, 1), 200);
  const pageNum = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const offset = (pageNum - 1) * pageSize;
  const totalRow = await q(
    `SELECT COUNT(*) AS total
     FROM students s
     JOIN enrollments e ON e.student_id = s.id
     WHERE e.section_id = ?`,
    [section_id]
  );
  const total = Number(totalRow?.total || 0);
  const learners = await qa(
    `SELECT s.id, s.last_name, s.first_name, s.middle_name, s.suffix, s.lrn
     FROM students s
     JOIN enrollments e ON e.student_id = s.id
     WHERE e.section_id = ?
     ORDER BY s.last_name, s.first_name
     LIMIT ? OFFSET ?`,
    [section_id, pageSize, offset]
  );
  const ids = learners.map((lr) => lr.id);
  const marks = ids.map(() => '?').join(',');
  const qtr = termToQuarter(term);
  const [studentRowsRaw, enrollRows, gradeRows, attRows, conductRows] = await Promise.all(ids.length ? [
    qa(`SELECT * FROM students WHERE id IN (${marks})`, ids),
    qa(
      `SELECT e.*, sec.name as section_name, sec.grade_level, u.name as adviser_name
       FROM enrollments e
       JOIN sections sec ON sec.id = e.section_id
       LEFT JOIN teachers adv_t ON adv_t.id = sec.adviser_teacher_id
       LEFT JOIN users u ON u.id = adv_t.user_id
       WHERE e.student_id IN (${marks}) AND e.section_id = ?`,
      [...ids, section_id]
    ),
    qa(
      db.dialect === 'pg'
        ? `SELECT g.*, sub.title as subject_name
           FROM grades g
           JOIN subjects sub ON sub.id = g.subject_id
           WHERE g.student_id = ANY($1::bigint[]) AND g.section_id = $2::bigint ${qtr ? 'AND g.quarter = $3::int' : ''}
           ORDER BY g.student_id, sub.title`
        : `SELECT g.*, sub.title as subject_name
           FROM grades g
           JOIN subjects sub ON sub.id = g.subject_id
           WHERE g.student_id IN (${marks}) AND g.section_id = ? ${qtr ? 'AND g.quarter = ?' : ''}
           ORDER BY g.student_id, sub.title`,
      db.dialect === 'pg'
        ? [ids, section_id, ...(qtr ? [qtr] : [])]
        : [...ids, section_id, ...(qtr ? [qtr] : [])]
    ),
    qa(
      db.dialect === 'pg'
        ? `SELECT a.student_id,
                  COUNT(*) as total_days,
                  SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as days_present,
                  SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as days_absent,
                  SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as days_late
           FROM attendance a
           WHERE a.student_id = ANY($1::bigint[]) AND a.section_id = $2
           GROUP BY a.student_id`
        : `SELECT a.student_id,
                  COUNT(*) as total_days,
                  SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as days_present,
                  SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as days_absent,
                  SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as days_late
           FROM attendance a
           WHERE a.student_id IN (${marks}) AND a.section_id = ?
           GROUP BY a.student_id`,
      db.dialect === 'pg' ? [ids, section_id] : [...ids, section_id]
    ),
    term
      ? qa(
          db.dialect === 'pg'
            ? `SELECT * FROM student_conduct_ratings WHERE student_id = ANY($1::bigint[]) AND term = $2`
            : `SELECT * FROM student_conduct_ratings WHERE student_id IN (${marks}) AND term = ?`,
          db.dialect === 'pg' ? [ids, term] : [...ids, term]
        )
      : Promise.resolve([]),
  ] : [[], [], [], [], []]);
  const studentRows = withAge(studentRowsRaw);
  const stMap = new Map(studentRows.map((r) => [String(r.id), r]));
  const enrIdMap = new Map();
  for (const e of enrollRows) {
    const sid = String(e.student_id);
    if (!enrIdMap.has(sid) || (e.enrolled_at || '') > (enrIdMap.get(sid).enrolled_at || '')) enrIdMap.set(sid, e);
  }
  const gradeById = {};
  for (const g of gradeRows) (gradeById[String(g.student_id)] = gradeById[String(g.student_id)] || []).push(g);
  const attById = new Map(attRows.map((a) => [String(a.student_id), a]));
  const conductById = {};
  for (const c of conductRows) (conductById[String(c.student_id)] = conductById[String(c.student_id)] || []).push(c);
  const result = learners.map((lr) => {
    const sid = String(lr.id);
    const enrollment = enrIdMap.get(sid) || null;
    const sy = school_year || enrollment?.school_year || '';
    const grades = gradeById[sid] || [];
    const attendance = attById.get(sid) || null;
    const daysEnrolled = Number(attendance?.total_days || 0);
    const conductRows = conductById[sid] || [];
    const conduct = conductRows.find((c) => c.school_year === sy) || conductRows[0] || null;
    return { student: stMap.get(sid) || null, enrollment, grades, attendance, days_enrolled: daysEnrolled, conduct };
  });
  res.json({
    learners: result,
    pagination: { page: pageNum, page_size: pageSize, total, total_pages: Math.max(Math.ceil(total / pageSize), 1) },
  });
}));

router.get('/attendance-summary', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { section_id, start_date, end_date } = req.query;
  if (!section_id) return res.json({ students: [], months: [] });
  const students = await qa(
    `SELECT s.id, s.last_name, s.first_name, s.middle_name, s.suffix
     FROM students s
     JOIN enrollments e ON e.student_id = s.id
     WHERE e.section_id = ?
     ORDER BY s.last_name, s.first_name`,
    [section_id]
  );
  const hasDates = start_date && end_date;
  const attendance = await qa(
    db.dialect === 'pg'
      ? `SELECT a.student_id, EXTRACT(MONTH FROM a.date::timestamp) as month,
                EXTRACT(YEAR FROM a.date::timestamp) as year,
                a.status
         FROM attendance a
         WHERE a.section_id = $1::int ${hasDates ? 'AND a.date BETWEEN $2::date AND $3::date' : ''}`
      : `SELECT a.student_id, CAST(strftime('%m', a.date) AS INTEGER) as month,
                CAST(strftime('%Y', a.date) AS INTEGER) as year,
                a.status
         FROM attendance a
         WHERE a.section_id = ? ${hasDates ? 'AND a.date BETWEEN ? AND ?' : ''}`,
    section_id ? [Number(section_id), ...(hasDates ? [start_date, end_date] : [])] : []
  );
  res.json({ students, attendance });
}));

router.get('/student-id', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { student_id } = req.query;
  if (!student_id) return res.json({ student: null });
  const student = await q(
    `SELECT s.*, e.grade_level, sec.name as section_name, u.name AS adviser_name
     FROM students s
     LEFT JOIN enrollments e ON e.student_id = s.id
     LEFT JOIN sections sec ON sec.id = e.section_id
     LEFT JOIN teachers adv_t ON adv_t.id = sec.adviser_teacher_id
     LEFT JOIN users u ON u.id = adv_t.user_id
     WHERE s.id = ?
     ORDER BY e.enrolled_at DESC LIMIT 1`,
    [student_id]
  );
  res.json({ student: withAge(student) });
}));

router.get('/sf10', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { student_id } = req.query;
  const stuId = validateStudentId(student_id);
  if (!student_id) return res.json({ learners: [] });
  const student = await q('SELECT * FROM students WHERE id = ?', [stuId]);
  if (!student) return res.json({ learner: null });
  const maskedStudent = maskPII(student);
  const enrollments = await qa(
    `SELECT e.*, sec.name as section_name, sec.grade_level
     FROM enrollments e
     JOIN sections sec ON sec.id = e.section_id
     WHERE e.student_id = ?
     ORDER BY e.enrolled_at`,
    [student_id]
  );
  const allGrades = await qa(
    `SELECT g.*, sub.title as subject_name, sec.name as section_name, sec.grade_level
     FROM grades g
     JOIN subjects sub ON sub.id = g.subject_id
     JOIN sections sec ON sec.id = g.section_id
     WHERE g.student_id = ?
     ORDER BY g.quarter, sub.title`,
    [student_id]
  );
  const allAttendance = await qa(
    `SELECT
       a.section_id,
       sec.name as section_name,
       sec.grade_level,
       COUNT(*) as total_days,
       SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as days_present,
       SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as days_absent
     FROM attendance a
     JOIN sections sec ON sec.id = a.section_id
     WHERE a.student_id = ?
     GROUP BY a.section_id, sec.name, sec.grade_level
     ORDER BY sec.grade_level`,
    [student_id]
  );
  res.json({ learner: { student: withAge(maskedStudent), enrollments, grades: allGrades, attendance: allAttendance } });
}));

router.get('/sf11', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { student_id } = req.query;
  const stuId = validateStudentId(student_id);
  if (!student_id) return res.json({ learner: null });
  const student = await q('SELECT * FROM students WHERE id = ?', [stuId]);
  if (!student) return res.json({ learner: null });
  const maskedStudent = maskPII(student);
  const enrollments = await qa(
    `SELECT e.*, sec.name as section_name, sec.grade_level
     FROM enrollments e
     JOIN sections sec ON sec.id = e.section_id
     WHERE e.student_id = ?
     ORDER BY e.enrolled_at`,
    [student_id]
  );
  const allGrades = await qa(
    `SELECT g.*, sub.title as subject_name, sec.name as section_name, sec.grade_level
     FROM grades g
     JOIN subjects sub ON sub.id = g.subject_id
     JOIN sections sec ON sec.id = g.section_id
     WHERE g.student_id = ?
     ORDER BY g.school_year, g.quarter, sub.title`,
    [student_id]
  );
  const allAttendance = await qa(
    `SELECT
       a.section_id,
       sec.name as section_name,
       sec.grade_level,
       COUNT(*) as total_days,
       SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as days_present,
       SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as days_absent
     FROM attendance a
     JOIN sections sec ON sec.id = a.section_id
     WHERE a.student_id = ?
     GROUP BY a.section_id, sec.name, sec.grade_level
     ORDER BY sec.grade_level`,
    [student_id]
  );
  res.json({ learner: { student: withAge(student), enrollments, grades: allGrades, attendance: allAttendance } });
}));

router.get('/summary-of-grades', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { section_id } = req.query;
  if (!section_id) return res.json({ learners: [], subjects: [], grades: [], section: null });
  const section = await q('SELECT * FROM sections WHERE id = ?', [section_id]);
  const learners = await qa(
    `SELECT s.id, s.last_name, s.first_name, s.middle_name, s.suffix
     FROM students s
     JOIN enrollments e ON e.student_id = s.id
     WHERE e.section_id = ?
     ORDER BY s.last_name, s.first_name`,
    [section_id]
  );
  const subjects = await qa(
    `SELECT DISTINCT sub.id, sub.title
     FROM subjects sub
     JOIN class_assignments ca ON ca.subject_id = sub.id
     WHERE ca.section_id = ?
     ORDER BY sub.title`,
    [section_id]
  );
  const learnerIds = learners.map(lr => lr.id);
  let grades = [];
  if (learnerIds.length) {
    grades = await qa(
      `SELECT g.student_id, g.subject_id, g.quarter, g.computed_grade
       FROM grades g
       WHERE g.section_id = ?`,
      [section_id]
    );
  }
  res.json({ learners, subjects, grades, section });
}));

router.get('/sf9/conduct', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { student_id, school_year, term } = req.query;
  if (!student_id || !school_year || !term) return res.json({ rating: null });
  const rating = await q(
    'SELECT * FROM student_conduct_ratings WHERE student_id = ? AND school_year = ? AND term = ?',
    [student_id, school_year, term]
  );
  res.json({ rating: rating || null });
}));

router.get('/sf9/conduct/batch', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { section_id, school_year, term } = req.query;
  if (!section_id || !school_year || !term) return res.json({ ratings: [] });
  const ratings = await qa(
    `SELECT cr.* FROM student_conduct_ratings cr
     JOIN enrollments e ON e.student_id = cr.student_id
     WHERE e.section_id = ? AND cr.school_year = ? AND cr.term = ?`,
    [section_id, school_year, term]
  );
  res.json({ ratings });
}));

router.put('/sf9/conduct', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { student_id, school_year, term, makadiyos, makatao, makakalikasan, makabansa, remarks } = req.body;
  if (!student_id || !school_year || !term) return res.status(400).json({ error: 'student_id, school_year, term required' });
  const valid = ['ao', 'so', 'ro', 'no', null];
  for (const v of [makadiyos, makatao, makakalikasan, makabansa]) {
    if (!valid.includes(v)) return res.status(400).json({ error: 'Invalid conduct rating value' });
  }
  const existing = await q(
    'SELECT id FROM student_conduct_ratings WHERE student_id = ? AND school_year = ? AND term = ?',
    [student_id, school_year, term]
  );
  if (existing) {
    await qr(
      `UPDATE student_conduct_ratings SET makadiyos=?, makatao=?, makakalikasan=?, makabansa=?, remarks=?, updated_at=${nowSql()}
       WHERE id=?`,
      [makadiyos || null, makatao || null, makakalikasan || null, makabansa || null, remarks || null, existing.id]
    );
  } else {
    await qi(
      `INSERT INTO student_conduct_ratings (student_id, school_year, term, makadiyos, makatao, makakalikasan, makabansa, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [student_id, school_year, term, makadiyos || null, makatao || null, makakalikasan || null, makabansa || null, remarks || null]
    );
  }
  res.json({ ok: true });
}));

module.exports = router;
