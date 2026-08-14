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

module.exports = router;
