const express = require('express');
const { qa } = require('../db');
const db = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH } = require('../utils');

const router = express.Router();
router.use(authenticate);

const READ = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];

const isPg = db.dialect === 'pg';
function fc(cond) { return isPg ? `COUNT(*) FILTER (WHERE ${cond})` : `SUM(CASE WHEN ${cond} THEN 1 ELSE 0 END)`; }

// ── Strand Distribution ────────────────────────────────────────────
// Returns enrollment counts grouped by strand for a school year.
router.get('/strand-distribution', requireRole(...READ), asyncH(async (req, res) => {
  const { school_year } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });

  const where = ["e.school_year = ?", "e.status = 'enrolled'"];
  const params = [school_year];

  // sections.grade_level is TEXT and stores "Grade 11" / "Grade 12", so the
  // chart series must compare against that literal — not the integer 11/12.
  // Comparing to a bare number silently returned 0 for every strand and the
  // "Enrollment by Strand" bars rendered empty while the table below showed
  // real numbers.
  const isGrade = (n) => `sec.grade_level = 'Grade ${n}'`;
  const rows = await qa(`
    SELECT COALESCE(sec.strand, 'Unassigned') AS strand,
           ${fc(isGrade(11))} AS grade_11,
           ${fc(isGrade(12))} AS grade_12,
           COUNT(DISTINCT e.student_id) AS students,
           COUNT(DISTINCT e.section_id) AS sections
    FROM enrollments e
    JOIN sections sec ON sec.id = e.section_id
    WHERE ${where.join(' AND ')}
    GROUP BY sec.strand
    ORDER BY students DESC
  `, params);

  res.json({ data: rows });
}));

// ── Teacher Workload ──────────────────────────────────────────────
// Returns teacher workload: how many sections, subjects, total hours per week.
router.get('/teacher-workload', requireRole(...READ), asyncH(async (req, res) => {
  const { school_year } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });

  const rows = await qa(`
    SELECT t.id, t.first_name || ' ' || t.last_name AS name, t.position,
           COUNT(DISTINCT ca.section_id) AS sections,
           COUNT(DISTINCT ca.subject_id) AS subjects,
           SUM(ca.duration_minutes * ca.meetings_per_week) AS total_minutes_per_week
    FROM teachers t
    JOIN class_assignments ca ON ca.teacher_id = t.id
    WHERE ca.school_year = ? AND t.status = 'active'
    GROUP BY t.id
    ORDER BY total_minutes_per_week DESC
  `, [school_year]);

  res.json({ data: rows });
}));

// ── Grade Submission Status ───────────────────────────────────────
// Returns which subjects/sections have submitted grades vs not yet for a given quarter.
router.get('/grade-submission-status', requireRole(...READ), asyncH(async (req, res) => {
  const { school_year, quarter } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });
  if (!quarter) return res.status(400).json({ error: 'quarter is required' });

  const rows = await qa(`
    SELECT sec.name AS section_name, sec.grade_level, sec.strand,
           s.code AS subject_code, s.title AS subject_name,
           CASE WHEN EXISTS (
             SELECT 1 FROM grades g
             WHERE g.section_id = sec.id AND g.subject_id = s.id
               AND g.school_year = ? AND g.quarter = ?
           ) THEN 'submitted' ELSE 'pending' END AS status
    FROM class_assignments ca
    JOIN sections sec ON sec.id = ca.section_id
    JOIN subjects s ON s.id = ca.subject_id
    WHERE ca.school_year = ?
    ORDER BY sec.grade_level, sec.name, s.title
  `, [school_year, Number(quarter), school_year]);

  res.json({ data: rows });
}));

// ── At-Risk by Strand ─────────────────────────────────────────────
// Returns at-risk students grouped by strand.
router.get('/at-risk-by-strand', requireRole(...READ), asyncH(async (req, res) => {
  const { school_year, quarter } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });
  if (!quarter) return res.status(400).json({ error: 'quarter is required' });

  const rows = await qa(`
    SELECT COALESCE(sec.strand, 'Unassigned') AS strand,
           COUNT(DISTINCT g.student_id) AS at_risk_count,
           ROUND(AVG(g.computed_grade), 2) AS avg_grade
    FROM grades g
    JOIN sections sec ON sec.id = g.section_id
    WHERE g.school_year = ? AND g.quarter = ? AND g.computed_grade < 75
    GROUP BY sec.strand
    ORDER BY at_risk_count DESC
  `, [school_year, Number(quarter)]);

  res.json({ data: rows });
}));

// ── Strand Comparison ──────────────────────────────────────────────
// Grade distribution comparison across strands.
router.get('/strand-comparison', requireRole(...READ), asyncH(async (req, res) => {
  const { school_year } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });

  const where = ["g.school_year = ?", "g.computed_grade IS NOT NULL"];
  const params = [school_year];

  const rows = await qa(`
    SELECT COALESCE(sec.strand, 'Unassigned') AS strand,
           COUNT(*) AS total_grades,
           ROUND(AVG(g.computed_grade), 2) AS mean_grade,
           ${fc('g.computed_grade >= 75')} AS passing,
           ${fc('g.computed_grade < 75')} AS failing,
           ROUND(${fc('g.computed_grade >= 75')} * 100.0 / NULLIF(COUNT(*), 0), 1) AS pass_rate
    FROM grades g
    JOIN sections sec ON sec.id = g.section_id
    WHERE ${where.join(' AND ')}
    GROUP BY sec.strand
    ORDER BY mean_grade DESC
  `, params);

  res.json({ data: rows });
}));

// ── Teacher Performance ────────────────────────────────────────────
// Returns per-teacher grade stats: class average, pass rate, number of students.
router.get('/teacher-performance', requireRole(...READ), asyncH(async (req, res) => {
  const { school_year } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });

  const rows = await qa(`
    SELECT t.id, t.first_name || ' ' || t.last_name AS name,
           COUNT(DISTINCT g.student_id) AS students,
           ROUND(AVG(g.computed_grade), 2) AS avg_grade,
           ${fc('g.computed_grade >= 75')} AS passing,
           ${fc('g.computed_grade < 75')} AS failing
    FROM grades g
    JOIN class_assignments ca ON ca.section_id = g.section_id
      AND ca.subject_id = g.subject_id AND ca.school_year = g.school_year
    JOIN teachers t ON t.id = ca.teacher_id
    WHERE g.school_year = ? AND g.computed_grade IS NOT NULL
    GROUP BY t.id
    ORDER BY avg_grade DESC
  `, [school_year]);

  res.json({ data: rows });
}));

// ── Certification Readiness (TVL) ─────────────────────────────────
// For TVL strands, count students with competency status.
router.get('/certification-readiness', requireRole(...READ), asyncH(async (req, res) => {
  const { school_year } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });

  const rows = await qa(`
    SELECT strand, COUNT(*) AS students, ROUND(AVG(gwa), 2) AS avg_grade,
           ${fc('gwa >= 75')} AS ready
    FROM (
      SELECT g.student_id, sec.strand, AVG(g.computed_grade) AS gwa
      FROM grades g
      JOIN sections sec ON sec.id = g.section_id
      WHERE g.school_year = ? AND sec.strand LIKE 'TechPro%' AND g.computed_grade IS NOT NULL
      GROUP BY g.student_id, sec.strand
    ) sub
    GROUP BY strand
    ORDER BY avg_grade DESC
  `, [school_year]);

  res.json({ data: rows });
}));

module.exports = router;
