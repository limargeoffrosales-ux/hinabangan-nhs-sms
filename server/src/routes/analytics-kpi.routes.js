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
function fcDistinct(col, cond) { return isPg ? `COUNT(DISTINCT ${col}) FILTER (WHERE ${cond})` : `COUNT(DISTINCT CASE WHEN ${cond} THEN ${col} END)`; }

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

  const gradeCase = `CASE WHEN g.computed_grade >= 90 THEN '90-100' WHEN g.computed_grade >= 85 THEN '85-89' WHEN g.computed_grade >= 80 THEN '80-84' WHEN g.computed_grade >= 75 THEN '75-79' ELSE 'Below 75' END`;
  const rows = await qa(`
    SELECT
      ${gradeCase} AS band,
      COUNT(*) AS n,
      ROUND(AVG(g.computed_grade), 2) AS avg_grade
    FROM grades g
    JOIN students s ON s.id = g.student_id
    WHERE ${where.join(' AND ')} AND g.computed_grade IS NOT NULL
    GROUP BY ${gradeCase}
    ORDER BY
      CASE ${gradeCase}
        WHEN '90-100' THEN 1 WHEN '85-89' THEN 2
        WHEN '80-84' THEN 3 WHEN '75-79' THEN 4 ELSE 5
      END
  `, params);

  const totals = await qa(`
    SELECT
      COUNT(*) AS total,
      ${fc('g.computed_grade >= 75')} AS passing,
      ${fc('g.computed_grade < 75')} AS failing,
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
  const { school_year, start_date, end_date } = req.query;
  const startDate = start_date || (school_year ? `${school_year.split('-')[0]}-06-01` : null);
  const endDate = end_date || new Date().toISOString().slice(0, 10);

  if (!startDate) return res.status(400).json({ error: 'start_date or school_year is required' });

  // Monthly attendance rates
  const monthExpr = db.dialect === 'pg' ? `TO_CHAR(a.date, 'YYYY-MM')` : `strftime('%Y-%m', a.date)`;
  const monthly = await qa(`
    SELECT
      ${monthExpr} AS month,
      ${fc("a.status = 'present'")} AS present,
      ${fc("a.status = 'late'")} AS late,
      ${fc("a.status = 'absent'")} AS absent,
      COUNT(*) AS total,
      ROUND(${fc("a.status IN ('present', 'late')")} * 1.0 / NULLIF(COUNT(*), 0) * 100, 1) AS rate
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
      ${fc("a.status = 'present'")} AS present,
      ${fc("a.status = 'late'")} AS late,
      ${fc("a.status = 'absent'")} AS absent,
      COUNT(*) AS total,
      ROUND(${fc("a.status IN ('present', 'late')")} * 1.0 / NULLIF(COUNT(*), 0) * 100, 1) AS rate
    FROM attendance a
    WHERE a.date >= ${dailyCutoff}
    GROUP BY a.date ORDER BY a.date
  `);

  // By grade level
  const byGrade = await qa(`
    SELECT
      st.grade_level,
      ${fc("a.status IN ('present', 'late')")} AS present_count,
      COUNT(*) AS total,
      ROUND(${fc("a.status IN ('present', 'late')")} * 1.0 / NULLIF(COUNT(*), 0) * 100, 1) AS rate
    FROM attendance a
    JOIN students st ON st.id = a.student_id
    WHERE a.date >= ? AND a.date <= ?
    GROUP BY st.grade_level ORDER BY st.grade_level
  `, [startDate, endDate]);

  // Overall summary
  const overall = await qa(`
    SELECT
      COUNT(*) AS total_records,
      ${fc("a.status IN ('present', 'late')")} AS present_late,
      ${fc("a.status = 'absent'")} AS absent_count,
      ROUND(${fc("a.status IN ('present', 'late')")} * 1.0 / NULLIF(COUNT(*), 0) * 100, 1) AS overall_rate
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
      ${fc("e.status = 'enrolled'")} AS enrolled,
      COUNT(*) AS total,
      ROUND(${fc("e.status = 'enrolled'")} * 1.0 / NULLIF(COUNT(*), 0) * 100, 1) AS retention_rate
    FROM enrollments e
    WHERE e.school_year = ?
    GROUP BY e.grade_level ORDER BY e.grade_level
  `, [school_year]);

  // Year-over-year comparison (last 3 years)
  const yoy = await qa(`
    SELECT school_year,
      COUNT(*) AS total,
      ${fc("status = 'enrolled'")} AS enrolled,
      ROUND(${fc("status = 'enrolled'")} * 1.0 / NULLIF(COUNT(*), 0) * 100, 1) AS retention_rate
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
      ${fcDistinct('g.student_id', 'g.computed_grade >= 75')} AS passing,
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
  const csvGradeCase = `CASE WHEN g.computed_grade >= 90 THEN '90-100' WHEN g.computed_grade >= 85 THEN '85-89' WHEN g.computed_grade >= 80 THEN '80-84' WHEN g.computed_grade >= 75 THEN '75-79' ELSE 'Below 75' END`;
  const grades = await qa(`
    SELECT
      ${csvGradeCase} AS band, COUNT(*) AS n, ROUND(AVG(g.computed_grade), 2) AS avg_grade
    FROM grades g JOIN students s ON s.id = g.student_id
    WHERE ${whereStr} AND g.computed_grade IS NOT NULL
    GROUP BY ${csvGradeCase}
    ORDER BY CASE ${csvGradeCase} WHEN '90-100' THEN 1 WHEN '85-89' THEN 2 WHEN '80-84' THEN 3 WHEN '75-79' THEN 4 ELSE 5 END
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
  `, quarter ? [school_year, Number(quarter), school_year, Number(quarter)] : [school_year, school_year]);
  for (const r of passData) lines.push(`${r.grade_level},${r.total},${r.passing},${r.total - r.passing},${r.total ? Math.round(r.passing / r.total * 1000) / 10 : 0}`);
  lines.push('');

  // Attendance summary
  const syStart = school_year.split('-')[0] + '-06-01';
  const syEnd = (Number(school_year.split('-')[0]) + 1) + '-03-31';
  lines.push('ATTENDANCE SUMMARY');
  lines.push('Total Records,Present/Late,Absent,Attendance Rate %');
  const att = await qa(`
    SELECT COUNT(*) AS total,
      ${fc("a.status IN ('present', 'late')")} AS present_late,
      ${fc("a.status = 'absent'")} AS absent_count,
      ROUND(${fc("a.status IN ('present', 'late')")} * 1.0 / NULLIF(COUNT(*), 0) * 100, 1) AS rate
    FROM attendance a WHERE a.date >= ? AND a.date <= ?
  `, [syStart, syEnd > new Date().toISOString().slice(0, 10) ? new Date().toISOString().slice(0, 10) : syEnd]);
  if (att[0]) lines.push(`${att[0].total},${att[0].present_late},${att[0].absent_count},${att[0].rate}`);

  lines.push('');
  lines.push('ENROLLMENT RETENTION');
  const enr = await qa(`
    SELECT COUNT(*) AS total, ${fc("status = 'enrolled'")} AS enrolled
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
           ${fc('g.computed_grade >= 75')} AS passing,
           ${fc('g.computed_grade < 75')} AS failing
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

// ── Competency Mastery Analytics ─────────────────────────────────
// School-wide competency performance heatmap across subjects.
router.get('/competency-mastery', requireRole(...READ), asyncH(async (req, res) => {
  const { school_year, grade_level, quarter } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });

  const where = ["scs.school_year = ?"];
  const params = [school_year];
  if (quarter) { where.push('scs.quarter = ?'); params.push(Number(quarter)); }
  if (grade_level) { where.push('st.grade_level = ?'); params.push(grade_level); }

  const whereStr = where.join(' AND ');

  // Per competency: average score, level distribution
  const byCompetency = await qa(`
    SELECT
      c.id AS competency_id, c.code, c.title, c.competency_type,
      COUNT(*) AS scored,
      ROUND(AVG(scs.score), 2) AS avg_score,
      ${fc('scs.level = \'Advanced\'')} AS advanced,
      ${fc('scs.level = \'Proficient\'')} AS proficient,
      ${fc('scs.level = \'Approaching Proficiency\'')} AS approaching,
      ${fc('scs.level = \'Developing\'')} AS developing,
      ${fc('scs.level = \'Beginning\'')} AS beginning,
      ROUND(${fc('scs.level IN (\'Advanced\', \'Proficient\')')} * 100.0 / NULLIF(COUNT(*), 0), 1) AS mastery_rate
    FROM student_competency_scores scs
    JOIN competencies c ON c.id = scs.competency_id
    JOIN students st ON st.id = scs.student_id
    WHERE ${whereStr}
    GROUP BY c.id, c.code, c.title, c.competency_type
    ORDER BY c.code
  `, params);

  // Per subject: aggregate competency mastery
  const bySubject = await qa(`
    SELECT
      s.id AS subject_id, s.code AS subject_code, s.title AS subject_title,
      COUNT(DISTINCT scs.competency_id) AS competencies,
      COUNT(DISTINCT scs.student_id) AS students,
      ROUND(AVG(scs.score), 2) AS avg_score,
      ROUND(${fc('scs.level IN (\'Advanced\', \'Proficient\')')} * 100.0 / NULLIF(COUNT(*), 0), 1) AS mastery_rate
    FROM student_competency_scores scs
    JOIN subjects s ON s.id = scs.subject_id
    JOIN students st ON st.id = scs.student_id
    WHERE ${whereStr}
    GROUP BY s.id, s.code, s.title
    ORDER BY s.code
  `, params);

  // Overall stats
  const overall = await qa(`
    SELECT
      COUNT(DISTINCT scs.competency_id) AS total_competencies,
      COUNT(DISTINCT scs.student_id) AS total_students,
      COUNT(DISTINCT scs.subject_id) AS total_subjects,
      COUNT(*) AS total_scores,
      ROUND(AVG(scs.score), 2) AS overall_avg,
      ${fc('scs.level IN (\'Advanced\', \'Proficient\')')} AS mastered,
      ${fc('scs.level = \'Developing\'')} AS developing,
      ${fc('scs.level = \'Beginning\'')} AS beginning
    FROM student_competency_scores scs
    JOIN students st ON st.id = scs.student_id
    WHERE ${whereStr}
  `, params);

  // Weakest competencies (lowest avg score, min 5 scores)
  const weakest = await qa(`
    SELECT
      c.code, c.title, c.competency_type,
      COUNT(*) AS scored,
      ROUND(AVG(scs.score), 2) AS avg_score,
      ${fc('scs.level IN (\'Advanced\', \'Proficient\')')} AS mastered_count
    FROM student_competency_scores scs
    JOIN competencies c ON c.id = scs.competency_id
    JOIN students st ON st.id = scs.student_id
    WHERE ${whereStr}
    GROUP BY c.code, c.title, c.competency_type
    HAVING COUNT(*) >= 5
    ORDER BY avg_score ASC
    LIMIT 10
  `, params);

  res.json({ by_competency: byCompetency, by_subject: bySubject, overall: overall[0] || {}, weakest });
}));

// ── Student Risk Prediction ──────────────────────────────────────
// Multi-factor risk scoring based on grades, attendance, competency levels, guidance cases.
router.get('/student-risk', requireRole(...READ), asyncH(async (req, res) => {
  const { school_year, grade_level, section_id, threshold } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });
  const minRisk = Number(threshold) || 0; // 0 = all, 30+ = medium+, 60+ = high+

  // ── Factor 1: Grades (40% weight) ──────────────────────────
  const gradeRows = await qa(`
    SELECT g.student_id, ROUND(AVG(g.computed_grade), 2) AS avg_grade,
           MIN(g.computed_grade) AS min_grade,
           COUNT(*) AS grade_count
    FROM grades g
    JOIN students st ON st.id = g.student_id
    WHERE g.school_year = ? AND g.computed_grade IS NOT NULL
    ${grade_level ? 'AND st.grade_level = ?' : ''}
    GROUP BY g.student_id
  `, grade_level ? [school_year, grade_level] : [school_year]);

  const gradeScores = new Map();
  for (const r of gradeRows) {
    // 0-100 risk score: high grade → low risk
    const below75 = r.avg_grade < 75 ? 80 + Math.min(20, (75 - r.avg_grade) * 2) : 0;
    const dropping = r.min_grade < 60 ? 50 : 0;
    gradeScores.set(r.student_id, Math.min(100, below75 || (100 - r.avg_grade) + dropping * 0.3));
  }

  // ── Factor 2: Attendance (30% weight) ───────────────────────
  const syStart = school_year.split('-')[0] + '-06-01';
  const today = new Date().toISOString().slice(0, 10);
  const syEnd = today < (Number(school_year.split('-')[0]) + 1) + '-03-31' ? today : (Number(school_year.split('-')[0]) + 1) + '-03-31';

  const attRows = await qa(`
    SELECT a.student_id,
           COUNT(*) AS total,
           ${fc("a.status = 'present'")} AS present,
           ${fc("a.status = 'late'")} AS late,
           ${fc("a.status = 'absent'")} AS absent
    FROM attendance a
    JOIN students st ON st.id = a.student_id
    WHERE a.date >= ? AND a.date <= ?
    ${grade_level ? 'AND st.grade_level = ?' : ''}
    GROUP BY a.student_id
  `, grade_level ? [syStart, syEnd, grade_level] : [syStart, syEnd]);

  const attScores = new Map();
  for (const r of attRows) {
    const rate = r.total ? (r.present + r.late) / r.total : 1;
    const absentRate = 1 - rate;
    // High absenteeism → high risk
    const base = absentRate >= 0.3 ? 90 : absentRate >= 0.2 ? 70 : absentRate >= 0.1 ? 40 : absentRate * 100;
    const latePenalty = r.late > r.total * 0.15 ? 15 : 0;
    attScores.set(r.student_id, Math.min(100, base + latePenalty));
  }

  // ── Factor 3: Competency Levels (20% weight) ────────────────
  const compRows = await qa(`
    SELECT scs.student_id,
           COUNT(*) AS scored,
           ROUND(AVG(scs.score), 2) AS avg_score,
           ${fc('scs.level = \'Beginning\'')} AS beginning,
           ${fc('scs.level = \'Developing\'')} AS developing
    FROM student_competency_scores scs
    JOIN students st ON st.id = scs.student_id
    WHERE scs.school_year = ?
    ${grade_level ? 'AND st.grade_level = ?' : ''}
    GROUP BY scs.student_id
  `, grade_level ? [school_year, grade_level] : [school_year]);

  const compScores = new Map();
  for (const r of compRows) {
    const beginningRate = r.scored ? r.beginning / r.scored : 0;
    const developingRate = r.scored ? r.developing / r.scored : 0;
    compScores.set(r.student_id, Math.min(100, beginningRate * 100 + developingRate * 40));
  }

  // ── Factor 4: Guidance Cases (10% weight) ───────────────────
  const guidanceRows = await qa(`
    SELECT gc.student_id, COUNT(*) AS cases,
           SUM(CASE WHEN gc.status IN ('open', 'in_progress') THEN 1 ELSE 0 END) AS active_cases
    FROM guidance_cases gc
    JOIN students st ON st.id = gc.student_id
    ${grade_level ? 'WHERE st.grade_level = ?' : ''}
    GROUP BY gc.student_id
  `, grade_level ? [grade_level] : []);

  const guidanceScores = new Map();
  for (const r of guidanceRows) {
    const active = Number(r.active_cases) || 0;
    const total = Number(r.cases) || 0;
    guidanceScores.set(r.student_id, Math.min(100, active * 40 + (total - active) * 10));
  }

  // ── Combine all students ─────────────────────────────────────
  const studentWhere = ["e.school_year = ?", "e.status = 'enrolled'"];
  const studentParams = [school_year];
  if (grade_level) { studentWhere.push('st.grade_level = ?'); studentParams.push(grade_level); }
  if (section_id) { studentWhere.push('e.section_id = ?'); studentParams.push(Number(section_id)); }

  const students = await qa(`
    SELECT st.id, st.first_name, st.middle_name, st.last_name, st.lrn, st.grade_level,
           sec.id AS section_id, sec.name AS section_name
    FROM enrollments e
    JOIN students st ON st.id = e.student_id
    JOIN sections sec ON sec.id = e.section_id
    WHERE ${studentWhere.join(' AND ')}
    ORDER BY st.last_name, st.first_name
  `, studentParams);

  const results = [];
  for (const st of students) {
    const gScore = gradeScores.get(st.id) || 0;
    const aScore = attScores.get(st.id) || 0;
    const cScore = compScores.get(st.id) || 0;
    const gcScore = guidanceScores.get(st.id) || 0;

    // Weighted composite: 40% grades, 30% attendance, 20% competency, 10% guidance
    const composite = gScore * 0.4 + aScore * 0.3 + cScore * 0.2 + gcScore * 0.1;

    // Factor labels for UI
    const factors = [];
    if (gScore > 60) factors.push({ factor: 'grades', score: Math.round(gScore), detail: 'Failing or near-failing average' });
    if (aScore > 60) factors.push({ factor: 'attendance', score: Math.round(aScore), detail: 'High absenteeism' });
    if (cScore > 60) factors.push({ factor: 'competency', score: Math.round(cScore), detail: 'Many Beginning-level competencies' });
    if (gcScore > 30) factors.push({ factor: 'guidance', score: Math.round(gcScore), detail: 'Active guidance cases' });

    results.push({
      student_id: st.id,
      name: `${st.last_name}, ${st.first_name}`,
      lrn: st.lrn,
      grade_level: st.grade_level,
      section_name: st.section_name,
      risk_score: Math.round(composite),
      risk_level: composite >= 70 ? 'high' : composite >= 40 ? 'medium' : 'low',
      factors,
      raw: { grades: Math.round(gScore), attendance: Math.round(aScore), competency: Math.round(cScore), guidance: Math.round(gcScore) },
    });
  }

  // Sort by risk descending
  results.sort((a, b) => b.risk_score - a.risk_score);

  const filtered = minRisk ? results.filter((r) => r.risk_score >= minRisk) : results;
  const summary = {
    total: results.length,
    high: results.filter((r) => r.risk_level === 'high').length,
    medium: results.filter((r) => r.risk_level === 'medium').length,
    low: results.filter((r) => r.risk_level === 'low').length,
  };

  res.json({ school_year, summary, data: filtered });
}));

// ── AI Insights (placeholder) ───────────────────────────────────
// Returns descriptive analytics with "coming soon" AI enhancement labels.
router.get('/ai-insights', requireRole(...READ), asyncH(async (req, res) => {
  const { school_year } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });

  // Descriptive stats we can compute now
  const stats = await qa(`
    SELECT
      ROUND(AVG(g.computed_grade), 2) AS mean_gwa,
      MIN(g.computed_grade) AS min_grade,
      MAX(g.computed_grade) AS max_grade,
      COUNT(DISTINCT g.student_id) AS students_graded
    FROM grades g
    WHERE g.school_year = ? AND g.computed_grade IS NOT NULL
  `, [school_year]);

  const attRate = await qa(`
    SELECT
      ROUND(${fc("a.status IN ('present', 'late')")} * 100.0 / NULLIF(COUNT(*), 0), 1) AS att_rate
    FROM attendance a
    WHERE a.date >= ? AND a.date <= ?
  `, [
    school_year.split('-')[0] + '-06-01',
    (Number(school_year.split('-')[0]) + 1) + '-03-31',
  ]);

  const insights = [];
  const s = stats[0] || {};
  const a = attRate[0] || {};

  if (s.mean_gwa) {
    insights.push({
      id: 'gwa_trend',
      title: 'School-wide Academic Performance',
      text: `Average grade is ${s.mean_gwa} across ${s.students_graded || 0} students.`,
      category: 'academic',
      ai_ready: true,
    });
  }
  if (a.att_rate) {
    insights.push({
      id: 'att_trend',
      title: 'Attendance Health',
      text: `Overall attendance rate is ${a.att_rate}%. ${a.att_rate >= 90 ? 'Excellent.' : a.att_rate >= 80 ? 'Needs improvement.' : 'Critical — consider school-wide intervention.'}`,
      category: 'attendance',
      ai_ready: true,
    });
  }
  // Placeholder AI enhancements
  insights.push({
    id: 'ai_dropout_prediction',
    title: 'Dropout Risk Prediction',
    text: 'AI-powered early warning system — coming soon.',
    category: 'prediction',
    ai_ready: false,
  });
  insights.push({
    id: 'ai_performance_forecast',
    title: 'Performance Forecast',
    text: 'Machine learning grade projection for next quarter — coming soon.',
    category: 'prediction',
    ai_ready: false,
  });
  insights.push({
    id: 'ai_anomaly_detection',
    title: 'Anomaly Detection',
    text: 'Automatic detection of unusual grade/attendance patterns — coming soon.',
    category: 'detection',
    ai_ready: false,
  });
  insights.push({
    id: 'ai_peer_comparison',
    title: 'Peer Comparison Engine',
    text: 'AI-generated peer benchmarking insights — coming soon.',
    category: 'comparison',
    ai_ready: false,
  });

  res.json({ insights });
}));

module.exports = router;
