const express = require('express');
const db = require('../db');
const { q, qa } = db;
const { authenticate, requireRole } = require('../auth');
const { asyncH } = require('../utils');

const router = express.Router();
router.use(authenticate);

const ADMIN_ONLY = ['super_admin', 'school_admin', 'registrar'];

router.get('/school-info', requireRole(...ADMIN_ONLY), asyncH(async (_req, res) => {
  const rows = await qa("SELECT key, value FROM app_settings WHERE key IN ('school_name','school_id','region','division','district','school_year')");
  const info = {};
  for (const r of rows) info[r.key] = r.value;
  res.json(info);
}));

router.get('/sf1', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { section_id, school_year } = req.query;
  if (!section_id) return res.json({ students: [], section: null });
  const section = await q('SELECT * FROM sections WHERE id = ?', [section_id]);
  const syCond = school_year ? 'AND e.school_year = $2::text' : '';
  const students = await qa(
    `SELECT s.*, e.strand, e.enrolled_at
     FROM students s
     JOIN enrollments e ON e.student_id = s.id
     WHERE e.section_id = $1::bigint ${syCond}
     ORDER BY s.last_name, s.first_name`,
    [section_id, ...(school_year ? [school_year] : [])]
  );
  res.json({ students, section });
}));

router.get('/sf2', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { section_id, month, year } = req.query;
  if (!section_id) return res.json({ students: [], attendance: [] });
  const students = await qa(
    `SELECT s.id, s.last_name, s.first_name, s.middle_name, s.extension_name
     FROM students s
     JOIN enrollments e ON e.student_id = s.id
     WHERE e.section_id = ?
     ORDER BY s.last_name, s.first_name`,
    [section_id]
  );
  const m = Number(month || (new Date().getMonth() + 1));
  const y = Number(year || new Date().getFullYear());
  const attendance = await qa(
    db.dialect === 'pg'
      ? `SELECT a.student_id, a.date, a.status
         FROM attendance a
         WHERE a.section_id = $1::bigint AND EXTRACT(MONTH FROM a.date::timestamp) = $2::int
           AND EXTRACT(YEAR FROM a.date::timestamp) = $3::int`
      : `SELECT a.student_id, a.date, a.status
         FROM attendance a
         WHERE a.section_id = ? AND CAST(strftime('%m', a.date) AS INTEGER) = ?
           AND CAST(strftime('%Y', a.date) AS INTEGER) = ?`,
    [Number(section_id), m, y]
  );
  res.json({ students, attendance, month: Number(m), year: Number(y) });
}));

router.get('/sf5', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { section_id, term } = req.query;
  if (!section_id) return res.json({ students: [], subjects: [] });
  const section = await q('SELECT * FROM sections WHERE id = ?', [section_id]);
  const students = await qa(
    `SELECT DISTINCT s.id, s.lrn, s.last_name, s.first_name, s.middle_name, s.extension_name, s.sex
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
  const termCond = term ? 'AND g.term = $2::text' : '';
  const grades = await qa(
    `SELECT g.student_id, g.subject_id, g.term, g.computed_grade, g.remarks
     FROM grades g
     WHERE g.section_id = $1::bigint ${termCond}`,
    [section_id, ...(term ? [term] : [])]
  );
  res.json({ students, subjects, grades, section });
}));

router.get('/sf6', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { school_year } = req.query;
  const syCond = school_year ? 'AND sec.school_year = $1::text' : '';
  const sections = await qa(
    `SELECT id, name, grade_level FROM sections sec WHERE 1=1 ${syCond} ORDER BY grade_level, name`,
    school_year ? [school_year] : []
  );
  const result = [];
  for (const sec of sections) {
    const enrollments = await qa(
      `SELECT e.status, COUNT(*) as cnt
       FROM enrollments e
       WHERE e.section_id = ?
       GROUP BY e.status`,
      [sec.id]
    );
    const enrolled = enrollments.find(r => r.status === 'enrolled')?.cnt || 0;
    const transferred_out = enrollments.find(r => r.status === 'transferred_out')?.cnt || 0;
    const dropped = enrollments.find(r => r.status === 'dropped')?.cnt || 0;
    const grades = await qa(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN g.computed_grade >= 75 THEN 1 ELSE 0 END) as promoted,
         SUM(CASE WHEN g.computed_grade < 75 AND g.computed_grade >= 60 THEN 1 ELSE 0 END) as conditional,
         SUM(CASE WHEN g.computed_grade < 60 THEN 1 ELSE 0 END) as retained
       FROM grades g
       WHERE g.section_id = ? AND g.term = 'Final'`,
      [sec.id]
    );
    const lwd = await qa(
      `SELECT COUNT(*) as cnt FROM students s
       JOIN enrollments e ON e.student_id = s.id
       WHERE e.section_id = ? AND (s.indigenous_people = 'Yes' OR s.special_needs IS NOT NULL AND s.special_needs != '')`,
      [sec.id]
    );
    result.push({
      section: sec,
      enrolled,
      transferred_out,
      dropped,
      lwd_count: Number(lwd[0]?.cnt || 0),
      promotion: grades[0] || { total: 0, promoted: 0, conditional: 0, retained: 0 },
    });
  }
  res.json(result);
}));

router.get('/sf7', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { school_year } = req.query;
  const teachers = await qa(
    `SELECT t.*, u.name as user_name,
            (SELECT sec.name FROM sections sec
             WHERE sec.adviser_teacher_id = t.id
               AND (sec.school_year = $1::text OR $1::text IS NULL)
             LIMIT 1) as advisory_class
     FROM teachers t
     LEFT JOIN users u ON u.id = t.user_id
     WHERE t.status = 'active'
     ORDER BY u.name`,
    [school_year || null]
  );
  const assignments = await qa(
    `SELECT ca.teacher_id, sub.title as subject_name, sec.name as section_name, sec.grade_level,
            ca.room, ca.meetings_per_week, ca.duration_minutes as minutes_per_day
     FROM class_assignments ca
     JOIN subjects sub ON sub.id = ca.subject_id
     JOIN sections sec ON sec.id = ca.section_id
     WHERE (ca.school_year = $1::text OR $1::text IS NULL)
     ORDER BY ca.teacher_id, sub.title`,
    [school_year || null]
  );
  const byTeacher = {};
  for (const a of assignments) {
    if (!byTeacher[a.teacher_id]) byTeacher[a.teacher_id] = [];
    byTeacher[a.teacher_id].push(a);
  }
  res.json({ teachers, assignments: byTeacher });
}));

router.get('/sf8', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { section_id, school_year } = req.query;
  if (!section_id) return res.json({ students: [], section: null });
  const section = await q('SELECT * FROM sections WHERE id = ?', [section_id]);
  const students = await qa(
    `SELECT s.id, s.lrn, s.last_name, s.first_name, s.middle_name, s.suffix, s.sex,
            sh.height_cm, sh.weight_kg, sh.bmi, sh.nutritional_status, sh.cct
     FROM students s
     JOIN enrollments e ON e.student_id = s.id
     LEFT JOIN student_health sh ON sh.student_id = s.id
       AND (sh.school_year = $1::text OR $1::text IS NULL)
     WHERE e.section_id = $2::bigint
     ORDER BY s.last_name, s.first_name`,
    [school_year || null, section_id]
  );
  res.json({ students, section });
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
    const termCond = term ? 'AND g.term = $2::text' : '';
    const grades = await qa(
      `SELECT g.*, sub.title as subject_name
       FROM grades g
       JOIN subjects sub ON sub.id = g.subject_id
       WHERE g.student_id = $1::bigint ${termCond}
       ORDER BY sub.title`,
      [student_id, ...(term ? [term] : [])]
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
    return res.json({ learner: { student, enrollment, grades, attendance: attendance[0], days_enrolled: daysEnrolled?.days_enrolled || 0 } });
  }
  const learners = await qa(
    `SELECT s.id, s.last_name, s.first_name, s.middle_name, s.extension_name
     FROM students s
     JOIN enrollments e ON e.student_id = s.id
     WHERE e.section_id = ?
     ORDER BY s.last_name, s.first_name`,
    [section_id]
  );
  res.json({ learners });
}));

router.get('/sf9/batch', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { section_id, term } = req.query;
  if (!section_id) return res.json({ learners: [] });
  const learners = await qa(
    `SELECT s.id, s.last_name, s.first_name, s.middle_name, s.extension_name, s.lrn
     FROM students s
     JOIN enrollments e ON e.student_id = s.id
     WHERE e.section_id = ?
     ORDER BY s.last_name, s.first_name`,
    [section_id]
  );
  const result = [];
  for (const lr of learners) {
    const student = await q('SELECT * FROM students WHERE id = ?', [lr.id]);
    const enrollment = await q(
      `SELECT e.*, sec.name as section_name, sec.grade_level, u.name as adviser_name
       FROM enrollments e
       JOIN sections sec ON sec.id = e.section_id
       LEFT JOIN users u ON u.id = sec.adviser_user_id
       WHERE e.student_id = ? AND e.section_id = ?
       ORDER BY e.enrolled_at DESC LIMIT 1`,
      [lr.id, section_id]
    );
    const termCond = term ? 'AND g.term = $2::text' : '';
    const grades = await qa(
      `SELECT g.*, sub.title as subject_name
       FROM grades g
       JOIN subjects sub ON sub.id = g.subject_id
       WHERE g.student_id = $1::bigint AND g.section_id = $3::bigint ${termCond}
       ORDER BY sub.title`,
      [lr.id, ...(term ? [term] : []), section_id]
    );
    const attendance = await qa(
      `SELECT
         COUNT(*) as total_days,
         SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as days_present,
         SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as days_absent,
         SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as days_late
       FROM attendance a
       WHERE a.student_id = ? AND a.section_id = ?`,
      [lr.id, section_id]
    );
    const daysEnrolled = await q(
      `SELECT COUNT(*) as days_enrolled FROM attendance a WHERE a.student_id = ? AND a.section_id = ?`,
      [lr.id, section_id]
    );
    result.push({ student, enrollment, grades, attendance: attendance[0], days_enrolled: daysEnrolled?.days_enrolled || 0 });
  }
  res.json({ learners: result });
}));

router.get('/attendance-summary', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { section_id, start_date, end_date } = req.query;
  if (!section_id) return res.json({ students: [], months: [] });
  const students = await qa(
    `SELECT s.id, s.last_name, s.first_name, s.middle_name, s.extension_name
     FROM students s
     JOIN enrollments e ON e.student_id = s.id
     WHERE e.section_id = ?
     ORDER BY s.last_name, s.first_name`,
    [section_id]
  );
  const dateCond = start_date && end_date
    ? 'AND a.date BETWEEN $2::date AND $3::date'
    : '';
  const attendance = await qa(
    db.dialect === 'pg'
      ? `SELECT a.student_id, EXTRACT(MONTH FROM a.date::timestamp) as month,
                EXTRACT(YEAR FROM a.date::timestamp) as year,
                a.status
         FROM attendance a
         WHERE a.section_id = $1::int ${dateCond}`
      : `SELECT a.student_id, CAST(strftime('%m', a.date) AS INTEGER) as month,
                CAST(strftime('%Y', a.date) AS INTEGER) as year,
                a.status
         FROM attendance a
         WHERE a.section_id = ? ${dateCond}`,
    section_id ? [Number(section_id), ...(start_date && end_date ? [start_date, end_date] : [])] : []
  );
  res.json({ students, attendance });
}));

router.get('/student-id', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { student_id } = req.query;
  if (!student_id) return res.json({ student: null });
  const student = await q(
    `SELECT s.*, e.grade_level, sec.name as section_name, sec.adviser_user_id
     FROM students s
     LEFT JOIN enrollments e ON e.student_id = s.id
     LEFT JOIN sections sec ON sec.id = e.section_id
     WHERE s.id = ?
     ORDER BY e.enrolled_at DESC LIMIT 1`,
    [student_id]
  );
  res.json({ student });
}));

router.get('/sf10', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { student_id } = req.query;
  if (!student_id) return res.json({ learners: [] });
  const student = await q('SELECT * FROM students WHERE id = ?', [student_id]);
  if (!student) return res.json({ learner: null });
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
     ORDER BY g.term, sub.title`,
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
  res.json({ learner: { student, enrollments, grades: allGrades, attendance: allAttendance } });
}));

router.get('/summary-of-grades', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { section_id } = req.query;
  if (!section_id) return res.json({ learners: [], subjects: [], grades: [], section: null });
  const section = await q('SELECT * FROM sections WHERE id = ?', [section_id]);
  const learners = await qa(
    `SELECT s.id, s.last_name, s.first_name, s.middle_name, s.extension_name
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
      `SELECT g.student_id, g.subject_id, g.term, g.computed_grade
       FROM grades g
       WHERE g.section_id = ?`,
      [section_id]
    );
  }
  res.json({ learners, subjects, grades, section });
}));

module.exports = router;
