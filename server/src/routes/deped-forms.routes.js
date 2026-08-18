const express = require('express');
const { q, qa } = require('../db');
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
  const students = await qa(
    `SELECT s.*, e.strand, e.enrolled_at
     FROM students s
     JOIN enrollments e ON e.student_id = s.id
     WHERE e.section_id = ? AND (e.school_year = ? OR ? IS NULL)
     ORDER BY s.last_name, s.first_name`,
    [section_id, school_year || null, school_year || null]
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
  const m = month || (new Date().getMonth() + 1);
  const y = year || new Date().getFullYear();
  const attendance = await qa(
    `SELECT a.student_id, a.date, a.status
     FROM attendance a
     WHERE a.section_id = ? AND EXTRACT(MONTH FROM a.date::timestamp) = ?
       AND EXTRACT(YEAR FROM a.date::timestamp) = ?`,
    [section_id, Number(m), Number(y)]
  );
  res.json({ students, attendance, month: Number(m), year: Number(y) });
}));

router.get('/sf5', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { section_id, term } = req.query;
  if (!section_id) return res.json({ students: [], subjects: [] });
  const section = await q('SELECT * FROM sections WHERE id = ?', [section_id]);
  const students = await qa(
    `SELECT DISTINCT s.id, s.last_name, s.first_name, s.middle_name, s.extension_name
     FROM students s
     JOIN enrollments e ON e.student_id = s.id
     WHERE e.section_id = ?
     ORDER BY s.last_name, s.first_name`,
    [section_id]
  );
  const subjects = await qa(
    `SELECT DISTINCT sub.id, sub.name
     FROM subjects sub
     JOIN class_assignments ca ON ca.subject_id = sub.id
     WHERE ca.section_id = ?
     ORDER BY sub.name`,
    [section_id]
  );
  const grades = await qa(
    `SELECT g.student_id, g.subject_id, g.term, g.computed_grade, g.remarks
     FROM grades g
     WHERE g.section_id = ? AND (g.term = ? OR ? IS NULL)`,
    [section_id, term || null, term || null]
  );
  res.json({ students, subjects, grades, section });
}));

router.get('/sf6', requireRole(...ADMIN_ONLY), asyncH(async (req, res) => {
  const { school_year } = req.query;
  const sections = await qa(
    `SELECT id, name, grade_level FROM sections WHERE (school_year = ? OR ? IS NULL) ORDER BY grade_level, name`,
    [school_year || null, school_year || null]
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
    result.push({
      section: sec,
      enrollments,
      promotion: grades[0] || { total: 0, promoted: 0, conditional: 0, retained: 0 },
    });
  }
  res.json(result);
}));

router.get('/sf7', requireRole(...ADMIN_ONLY), asyncH(async (_req, res) => {
  const teachers = await qa(
    `SELECT t.*, u.name as user_name
     FROM teachers t
     LEFT JOIN users u ON u.id = t.user_id
     ORDER BY u.name`
  );
  const assignments = await qa(
    `SELECT ca.teacher_id, sub.name as subject_name, sec.name as section_name, sec.grade_level,
            ca.schedule, ca.minutes_per_day
     FROM class_assignments ca
     JOIN subjects sub ON sub.id = ca.subject_id
     JOIN sections sec ON sec.id = ca.section_id
     ORDER BY ca.teacher_id, sub.name`
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
    const grades = await qa(
      `SELECT g.*, sub.name as subject_name
       FROM grades g
       JOIN subjects sub ON sub.id = g.subject_id
       WHERE g.student_id = ? AND (g.term = ? OR ? IS NULL)
       ORDER BY sub.name`,
      [student_id, term || null, term || null]
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
    return res.json({ learner: { student, enrollment, grades, attendance: attendance[0] } });
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
    `SELECT g.*, sub.name as subject_name, sec.name as section_name, sec.grade_level
     FROM grades g
     JOIN subjects sub ON sub.id = g.subject_id
     JOIN sections sec ON sec.id = g.section_id
     WHERE g.student_id = ?
     ORDER BY g.term, sub.name`,
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
    `SELECT DISTINCT sub.id, sub.name
     FROM subjects sub
     JOIN class_assignments ca ON ca.subject_id = sub.id
     WHERE ca.section_id = ?
     ORDER BY sub.name`,
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
