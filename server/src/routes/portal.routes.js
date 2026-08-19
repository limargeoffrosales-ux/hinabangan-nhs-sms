const express = require('express');
const { q, qa } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH } = require('../utils');
const { linkedStudentIds } = require('../scope');
const { studentSummary, round2 } = require('../grading/analytics');

const router = express.Router();
router.use(authenticate);
const PORTAL = ['student', 'parent'];

const STUDENT_FIELDS = 'id, lrn, first_name, middle_name, last_name, suffix, grade_level, track_strand, status';

async function loadStudentRow(id) {
  return q(`SELECT ${STUDENT_FIELDS} FROM students WHERE id = ?`, [id]);
}

async function loadSection(id, schoolYear) {
  return q(
    `SELECT sec.id AS section_id, sec.name AS section_name, sec.grade_level
     FROM enrollments e JOIN sections sec ON sec.id = e.section_id
     WHERE e.student_id = ? AND e.school_year = ? AND e.status = 'enrolled' LIMIT 1`,
    [id, schoolYear]);
}

async function attendanceSummary(id, schoolYear) {
  const rows = await qa(
    'SELECT status FROM attendance WHERE student_id = ? AND substr(CAST(date AS TEXT), 1, 4) = ?',
    [id, String(schoolYear).slice(0, 4)]);
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const a of rows) counts[a.status] = (counts[a.status] || 0) + 1;
  const total = rows.length;
  const rate = total ? round2(((counts.present + counts.late) / total) * 100) : null;
  return { counts, total, rate };
}

// GET /me — portal user identity + linked students (with current section).
router.get('/me', requireRole(...PORTAL), asyncH(async (req, res) => {
  const ids = await linkedStudentIds(req.user);
  const students = [];
  for (const id of ids) {
    const st = await loadStudentRow(id);
    if (!st) continue;
    const enr = await q(
      `SELECT sec.id AS section_id, sec.name AS section_name, e.school_year
       FROM enrollments e JOIN sections sec ON sec.id = e.section_id
       WHERE e.student_id = ? AND e.status = 'enrolled'
       ORDER BY e.school_year DESC LIMIT 1`,
      [id]);
    students.push({ ...st, section: enr || null });
  }
  res.json({
    user: { id: req.user.id, username: req.user.username, name: req.user.name, role: req.user.role },
    students,
  });
}));

// GET /overview?school_year= — at-a-glance data for the portal home:
// per linked student (section, GWA, GPA, credits, attendance) + latest announcements.
router.get('/overview', requireRole(...PORTAL), asyncH(async (req, res) => {
  const { school_year } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });
  const announcements = await qa(
    `SELECT a.id, a.title, a.body, a.created_at, u.name AS author_name
     FROM announcements a LEFT JOIN users u ON u.id = a.author_id
     ORDER BY a.created_at DESC LIMIT 3`);
  const ids = await linkedStudentIds(req.user);
  const students = [];
  for (const id of ids) {
    const st = await loadStudentRow(id);
    if (!st) continue;
    const section = await loadSection(id, school_year);
    const summary = await studentSummary(id, school_year);
    const attendance = await attendanceSummary(id, school_year);
    students.push({
      ...st,
      section,
      gwa: summary.gwa,
      gpa: summary.gpa,
      weighted_gpa: summary.weighted_gpa,
      credits: { earned: summary.credits_earned, total: summary.credits_total },
      attendance,
    });
  }
  res.json({ school_year, announcements, students });
}));

router.get('/my-immersion', requireRole(...PORTAL), asyncH(async (req, res) => {
  const ids = await linkedStudentIds(req.user);
  const studentId = ids[0];
  if (!studentId) return res.json({ data: [] });
  const rows = await qa(
    `SELECT wi.* FROM work_immersion wi WHERE wi.student_id = ? ORDER BY wi.batch DESC, wi.program`,
    [studentId]);
  res.json({ data: rows });
}));

router.get('/today-schedule', requireRole(...PORTAL), asyncH(async (req, res) => {
  const ids = await linkedStudentIds(req.user);
  const studentId = ids[0];
  if (!studentId) return res.json({ data: [] });
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = dayNames[new Date().getDay()];
  const { school_year } = req.query;
  const rows = await qa(
    `SELECT se.*, sub.code AS subject_code, sub.title AS subject_title,
            t.first_name || ' ' || t.last_name AS teacher_name, sec.name AS section_name
     FROM schedule_entries se
     JOIN class_assignments ca ON ca.id = se.assignment_id
     JOIN subjects sub ON sub.id = ca.subject_id
     JOIN teachers t ON t.id = ca.teacher_id
     JOIN sections sec ON sec.id = ca.section_id
     JOIN enrollments e ON e.section_id = sec.id AND e.school_year = se.school_year AND e.status = 'enrolled'
     WHERE e.student_id = ? AND se.day = ? ${school_year ? 'AND se.school_year = ?' : ''}
     ORDER BY se.start_time`,
    school_year ? [studentId, today, school_year] : [studentId, today]);
  res.json({ data: rows });
}));

router.get('/upcoming-assignments', requireRole(...PORTAL), asyncH(async (req, res) => {
  const ids = await linkedStudentIds(req.user);
  const studentId = ids[0];
  if (!studentId) return res.json({ data: [] });
  const { school_year } = req.query;
  const rows = await qa(
    `SELECT a.id, a.title, a.due_date, a.description, sub.code AS subject_code, sub.title AS subject_title,
            asub.status AS submission_status
     FROM assignments a
     JOIN class_assignments ca ON ca.id = a.class_assignment_id
     JOIN subjects sub ON sub.id = ca.subject_id
     JOIN enrollments e ON e.section_id = ca.section_id AND e.school_year = a.school_year AND e.status = 'enrolled'
     LEFT JOIN assignment_submissions asub ON asub.assignment_id = a.id AND asub.student_id = ?
     WHERE e.student_id = ? ${school_year ? 'AND a.school_year = ?' : ''}
       AND (a.due_date IS NULL OR a.due_date >= CURRENT_DATE)
       AND asub.id IS NULL
     ORDER BY a.due_date IS NULL, a.due_date ASC
     LIMIT 10`,
    school_year ? [studentId, studentId, school_year] : [studentId, studentId]);
  res.json({ data: rows });
}));

module.exports = router;
