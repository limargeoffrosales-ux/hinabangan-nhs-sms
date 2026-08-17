const express = require('express');
const { qa } = require('../db');
const db = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH } = require('../utils');

const router = express.Router();
router.use(authenticate);

const READ = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];

// ── Grade Distribution KPI ────────────────────────────────────────
// Returns histogram buckets of computed grades for a given school year + quarter.
router.get('/grade-distribution', requireRole(...READ), asyncH(async (req, res) => {
  const { school_year, quarter, section_id, grade_level } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });

  const where = ["g.school_year = ?"];
  const params = [school_year];
  if (quarter) { where.push('g.quarter = ?'); params.push(Number(quarter)); }
  if (section_id) { where.push('g.section_id = ?'); params.push(Number(section_id)); }
  if (grade_level) { where.push('s.grade_level = ?'); params.push(grade_level); }

  const rows = await qa(`
    SELECT
      CASE
        WHEN g.computed_grade >= 90 THEN '90-100'
        WHEN g.computed_grade >= 85 THEN '85-89'
        WHEN g.computed_grade >= 80 THEN '80-84'
        WHEN g.computed_grade >= 75 THEN '75-79'
        ELSE 'Below 75'
      END AS band,
      COUNT(*) AS n,
      ROUND(AVG(g.computed_grade), 2) AS avg_grade
    FROM grades g
    JOIN students s ON s.id = g.student_id
    WHERE ${where.join(' AND ')} AND g.computed_grade IS NOT NULL
    GROUP BY band
    ORDER BY
      CASE band
        WHEN '90-100' THEN 1 WHEN '85-89' THEN 2
        WHEN '80-84' THEN 3 WHEN '75-79' THEN 4 ELSE 5
      END
  `, params);

  const totals = await qa(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE g.computed_grade >= 75) AS passing,
      COUNT(*) FILTER (WHERE g.computed_grade < 75) AS failing,
      ROUND(AVG(g.computed_grade), 2) AS mean
    FROM grades g
    JOIN students s ON s.id = g.student_id
    WHERE ${where.join(' AND ')} AND g.computed_grade IS NOT NULL
  `, params);

  res.json({ buckets: rows, summary: totals[0] || { total: 0, passing: 0, failing: 0, mean: 0 } });
}));

// ── Attendance KPI ────────────────────────────────────────────────
// Returns attendance rates over time for specified period.
router.get('/attendance-kpi', requireRole(...READ), asyncH(async (req, res) => {
  const { school_year, start_date, end_date, group_by } = req.query;
  const startDate = start_date || (school_year ? `${school_year.split('-')[0]}-06-01` : null);
  const endDate = end_date || new Date().toISOString().slice(0, 10);

  if (!startDate) return res.status(400).json({ error: 'start_date or school_year is required' });

  // Monthly attendance rates
  const monthExpr = db.dialect === 'pg' ? `TO_CHAR(a.date, 'YYYY-MM')` : `strftime('%Y-%m', a.date)`;
  const monthly = await qa(`
    SELECT
      ${monthExpr} AS month,
      COUNT(*) FILTER (WHERE a.status = 'present') AS present,
      COUNT(*) FILTER (WHERE a.status = 'late') AS late,
      COUNT(*) FILTER (WHERE a.status = 'absent') AS absent,
      COUNT(*) AS total,
      ROUND(COUNT(*) FILTER (WHERE a.status IN ('present', 'late'))::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS rate
    FROM attendance a
    WHERE a.date >= ? AND a.date <= ?
    GROUP BY ${monthExpr}
    ORDER BY month
  `, [startDate, endDate]);

  // Daily trend (last 30 days for chart)
  const dailyCutoff = db.dialect === 'pg'
    ? `CURRENT_DATE - INTERVAL '30 days'`
    : `date('now', '-30 days')`;
  const daily = await qa(`
    SELECT
      a.date,
      COUNT(*) FILTER (WHERE a.status = 'present') AS present,
      COUNT(*) FILTER (WHERE a.status = 'late') AS late,
      COUNT(*) FILTER (WHERE a.status = 'absent') AS absent,
      COUNT(*) AS total,
      ROUND(COUNT(*) FILTER (WHERE a.status IN ('present', 'late'))::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS rate
    FROM attendance a
    WHERE a.date >= ${dailyCutoff}
    GROUP BY a.date ORDER BY a.date
  `);

  // By grade level
  const byGrade = await qa(`
    SELECT
      st.grade_level,
      COUNT(*) FILTER (WHERE a.status IN ('present', 'late')) AS present_count,
      COUNT(*) AS total,
      ROUND(COUNT(*) FILTER (WHERE a.status IN ('present', 'late'))::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS rate
    FROM attendance a
    JOIN students st ON st.id = a.student_id
    WHERE a.date >= ? AND a.date <= ?
    GROUP BY st.grade_level ORDER BY st.grade_level
  `, [startDate, endDate]);

  // Overall summary
  const overall = await qa(`
    SELECT
      COUNT(*) AS total_records,
      COUNT(*) FILTER (WHERE a.status IN ('present', 'late')) AS present_late,
      COUNT(*) FILTER (WHERE a.status = 'absent') AS absent_count,
      ROUND(COUNT(*) FILTER (WHERE a.status IN ('present', 'late'))::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS overall_rate
    FROM attendance a
    WHERE a.date >= ? AND a.date <= ?
  `, [startDate, endDate]);

  res.json({ monthly, daily, by_grade: byGrade, overall: overall[0] || {} });
}));

// ── Enrollment Retention KPI ──────────────────────────────────────
// Compares enrollment at start of year vs current to compute retention.
router.get('/enrollment-retention', requireRole(...READ), asyncH(async (req, res) => {
  const { school_year } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });

  // Total enrolled this year
  const current = await qa(`
    SELECT COUNT(*) AS n FROM enrollments WHERE school_year = ? AND status = 'enrolled'
  `, [school_year]);

  // Students who enrolled this year but are now dropped/transferred/graduated
  const withdrawn = await qa(`
    SELECT status, COUNT(*) AS n FROM enrollments
    WHERE school_year = ? AND status != 'enrolled'
    GROUP BY status
  `, [school_year]);

  // By grade level
  const byGrade = await qa(`
    SELECT
      e.grade_level,
      COUNT(*) FILTER (WHERE e.status = 'enrolled') AS enrolled,
      COUNT(*) AS total,
      ROUND(COUNT(*) FILTER (WHERE e.status = 'enrolled')::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS retention_rate
    FROM enrollments e
    WHERE e.school_year = ?
    GROUP BY e.grade_level ORDER BY e.grade_level
  `, [school_year]);

  // Year-over-year comparison (last 3 years)
  const yoy = await qa(`
    SELECT school_year,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'enrolled') AS enrolled,
      ROUND(COUNT(*) FILTER (WHERE status = 'enrolled')::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS retention_rate
    FROM enrollments
    GROUP BY school_year ORDER BY school_year DESC LIMIT 5
  `);

  const totalN = Number(current[0]?.n || 0) + withdrawn.reduce((a, r) => a + Number(r.n), 0);
  const enrolledN = Number(current[0]?.n || 0);

  res.json({
    total: totalN,
    enrolled: enrolledN,
    withdrawn: withdrawn,
    retention_rate: totalN ? Math.round(enrolledN / totalN * 1000) / 10 : 0,
    by_grade: byGrade,
    year_over_year: yoy,
  });
}));

// ── Pass/Fail Rate KPI ───────────────────────────────────────────
// School-wide and per-section pass/fail rates for a school year.
router.get('/pass-rate', requireRole(...READ), asyncH(async (req, res) => {
  const { school_year, quarter } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });

  const where = ["g.school_year = ?"];
  const params = [school_year];
  if (quarter) { where.push('g.quarter = ?'); params.push(Number(quarter)); }

  // Per student: avg computed_grade → pass/fail
  const studentGrades = await qa(`
    SELECT
      s.id AS student_id,
      s.first_name || ' ' || s.last_name AS name,
      s.grade_level,
      ROUND(AVG(g.computed_grade), 2) AS gwa,
      CASE WHEN AVG(g.computed_grade) >= 75 THEN 'pass' ELSE 'fail' END AS status
    FROM grades g
    JOIN students s ON s.id = g.student_id
    WHERE ${where.join(' AND ')} AND g.computed_grade IS NOT NULL
    GROUP BY s.id, s.first_name, s.last_name, s.grade_level
    ORDER BY s.grade_level, s.last_name
  `, params);

  const total = studentGrades.length;
  const passing = studentGrades.filter((s) => s.status === 'pass').length;
  const failing = total - passing;

  // By grade level
  const byGrade = {};
  for (const s of studentGrades) {
    if (!byGrade[s.grade_level]) byGrade[s.grade_level] = { total: 0, passing: 0, failing: 0 };
    byGrade[s.grade_level].total++;
    if (s.status === 'pass') byGrade[s.grade_level].passing++;
    else byGrade[s.grade_level].failing++;
  }
  const gradeRates = Object.entries(byGrade).map(([gl, v]) => ({
    grade_level: gl, ...v,
    pass_rate: v.total ? Math.round(v.passing / v.total * 1000) / 10 : 0,
  })).sort((a, b) => a.grade_level.localeCompare(b.grade_level));

  // By section
  const sectionGrades = await qa(`
    SELECT
      sec.name AS section_name,
      sec.grade_level,
      COUNT(DISTINCT g.student_id) AS total,
      COUNT(DISTINCT g.student_id) FILTER (WHERE g.computed_grade >= 75) AS passing,
      ROUND(AVG(g.computed_grade), 2) AS avg_grade
    FROM grades g
    JOIN sections sec ON sec.id = g.section_id
    WHERE ${where.join(' AND ')} AND g.computed_grade IS NOT NULL
    GROUP BY sec.name, sec.grade_level
    ORDER BY sec.grade_level, sec.name
  `, params);

  // Top at-risk students (lowest GWA)
  const atRisk = studentGrades.filter((s) => s.status === 'fail').slice(0, 20);

  res.json({
    total, passing, failing,
    pass_rate: total ? Math.round(passing / total * 1000) / 10 : 0,
    mean_gwa: total ? Math.round(studentGrades.reduce((a, s) => a + Number(s.gwa), 0) / total * 100) / 100 : 0,
    by_grade: gradeRates,
    by_section: sectionGrades,
    at_risk: atRisk,
  });
}));

// ── BI Report Export (CSV) ────────────────────────────────────────
router.get('/report/csv', requireRole(...READ), asyncH(async (req, res) => {
  const { school_year, quarter } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });

  // Gather all KPIs into a single CSV
  const lines = ['MERIDIANED BI REPORT'];
  lines.push(`School Year,${school_year}`);
  lines.push(`Quarter,${quarter || 'All'}`);
  lines.push(`Generated,${new Date().toISOString()}`);
  lines.push('');

  // Grade distribution
  const where = ["g.school_year = ?"];
  const params = [school_year];
  if (quarter) { where.push('g.quarter = ?'); params.push(Number(quarter)); }
  const whereStr = where.join(' AND ');

  lines.push('GRADE DISTRIBUTION');
  lines.push('Band,Count,Average Grade');
  const grades = await qa(`
    SELECT
      CASE
        WHEN g.computed_grade >= 90 THEN '90-100'
        WHEN g.computed_grade >= 85 THEN '85-89'
        WHEN g.computed_grade >= 80 THEN '80-84'
        WHEN g.computed_grade >= 75 THEN '75-79'
        ELSE 'Below 75'
      END AS band, COUNT(*) AS n, ROUND(AVG(g.computed_grade), 2) AS avg_grade
    FROM grades g JOIN students s ON s.id = g.student_id
    WHERE ${whereStr} AND g.computed_grade IS NOT NULL
    GROUP BY band ORDER BY CASE band WHEN '90-100' THEN 1 WHEN '85-89' THEN 2 WHEN '80-84' THEN 3 WHEN '75-79' THEN 4 ELSE 5 END
  `, params);
  for (const r of grades) lines.push(`${r.band},${r.n},${r.avg_grade}`);
  lines.push('');

  // Pass rate by grade
  lines.push('PASS RATE BY GRADE LEVEL');
  lines.push('Grade Level,Total,Passing,Failing,Pass Rate %');
  const passData = await qa(`
    SELECT s.grade_level, COUNT(DISTINCT g.student_id) AS total,
      COUNT(DISTINCT CASE WHEN sub.avg_grade >= 75 THEN g.student_id END) AS passing
    FROM grades g
    JOIN students s ON s.id = g.student_id
    JOIN (
      SELECT student_id, AVG(computed_grade) AS avg_grade
      FROM grades WHERE school_year = ? ${quarter ? 'AND quarter = ?' : ''}
      GROUP BY student_id
    ) sub ON sub.student_id = g.student_id
    WHERE ${whereStr} AND g.computed_grade IS NOT NULL
    GROUP BY s.grade_level ORDER BY s.grade_level
  `, quarter ? [school_year, Number(quarter)] : [school_year]);
  for (const r of passData) lines.push(`${r.grade_level},${r.total},${r.passing},${r.total - r.passing},${r.total ? Math.round(r.passing / r.total * 1000) / 10 : 0}`);
  lines.push('');

  // Attendance summary
  const syStart = school_year.split('-')[0] + '-06-01';
  const syEnd = school_year.split('-')[0].replace(/\d$/, '') + (Number(school_year.split('-')[0].slice(-1)) + 1) + '-03-31';
  lines.push('ATTENDANCE SUMMARY');
  lines.push('Total Records,Present/Late,Absent,Attendance Rate %');
  const att = await qa(`
    SELECT COUNT(*) AS total,
      COUNT(*) FILTER (WHERE a.status IN ('present', 'late')) AS present_late,
      COUNT(*) FILTER (WHERE a.status = 'absent') AS absent_count,
      ROUND(COUNT(*) FILTER (WHERE a.status IN ('present', 'late'))::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS rate
    FROM attendance a WHERE a.date >= ? AND a.date <= ?
  `, [syStart, syEnd > new Date().toISOString().slice(0, 10) ? new Date().toISOString().slice(0, 10) : syEnd]);
  if (att[0]) lines.push(`${att[0].total},${att[0].present_late},${att[0].absent_count},${att[0].rate}`);

  lines.push('');
  lines.push('ENROLLMENT RETENTION');
  const enr = await qa(`
    SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'enrolled') AS enrolled
    FROM enrollments WHERE school_year = ?
  `, [school_year]);
  if (enr[0]) {
    const r = enr[0];
    lines.push(`Total Enrolled,Currently Enrolled,Retention Rate %`);
    lines.push(`${r.total},${r.enrolled},${r.total ? Math.round(r.enrolled / r.total * 1000) / 10 : 0}`);
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="bi-report-${school_year}.csv"`);
  res.send(lines.join('\n'));
}));

// ── School Years List ─────────────────────────────────────────────
router.get('/school-years', requireRole(...READ), asyncH(async (req, res) => {
  const rows = await qa(`
    SELECT DISTINCT school_year FROM enrollments ORDER BY school_year DESC
  `);
  res.json({ data: rows.map((r) => r.school_year) });
}));

// ── Strand Grade Comparison ────────────────────────────────────────
// Grade distribution comparison across strands per quarter.
router.get('/strand-grade-comparison', requireRole(...READ), asyncH(async (req, res) => {
  const { school_year } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });

  const rows = await qa(`
    SELECT COALESCE(sec.strand, 'Unassigned') AS strand, g.quarter,
           COUNT(*) AS n, ROUND(AVG(g.computed_grade), 2) AS mean,
           COUNT(*) FILTER (WHERE g.computed_grade >= 75) AS passing,
           COUNT(*) FILTER (WHERE g.computed_grade < 75) AS failing
    FROM grades g
    JOIN sections sec ON sec.id = g.section_id
    WHERE g.school_year = ? AND g.computed_grade IS NOT NULL
    GROUP BY sec.strand, g.quarter
    ORDER BY sec.strand, g.quarter
  `, [school_year]);

  res.json({ data: rows });
}));

// ── Enrollment Trend by Strand ─────────────────────────────────────
// Enrollment trend over years for each strand.
router.get('/enrollment-trend-by-strand', requireRole(...READ), asyncH(async (req, res) => {
  const rows = await qa(`
    SELECT e.school_year, sec.strand, COUNT(DISTINCT e.student_id) AS students
    FROM enrollments e
    JOIN sections sec ON sec.id = e.section_id
    WHERE e.status = 'enrolled'
    GROUP BY e.school_year, sec.strand
    ORDER BY e.school_year DESC, sec.strand
  `);

  res.json({ data: rows });
}));

module.exports = router;
