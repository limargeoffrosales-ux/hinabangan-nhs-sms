const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');
const { GRADE_WEIGHTS } = require('../config');

const router = express.Router();
router.use(authenticate);
const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'teacher'];

function compute(w, p, qe) {
  if (w == null || p == null || qe == null) return null;
  const total = Number(w) * GRADE_WEIGHTS.written_work / 100 +
    Number(p) * GRADE_WEIGHTS.performance_task / 100 +
    Number(qe) * GRADE_WEIGHTS.quarterly_exam / 100;
  return Math.round(total * 10) / 10;
}

router.get('/class', requireRole(...WRITE, 'registrar'), asyncH(async (req, res) => {
  const { section_id, subject_id, school_year } = req.query;
  const period = (req.query.term || req.query.quarter || '').toString().trim();
  if (!section_id || !subject_id || !school_year || !period) {
    return res.status(400).json({ error: 'section_id, subject_id, school_year, term are required' });
  }
  if (!/[1-3]/.test(period)) return res.status(400).json({ error: 'term must be 1, 2 or 3' });
  const students = await qa(
    `SELECT st.id, st.lrn, st.first_name, st.last_name,
       g.written_work, g.performance_task, g.quarterly_exam, g.computed_grade, g.remarks
     FROM enrollments e JOIN students st ON st.id = e.student_id
     LEFT JOIN grades g ON g.student_id = st.id AND g.subject_id = ? AND g.school_year = ? AND g.quarter = ?
     WHERE e.section_id = ? AND e.status = 'enrolled' ORDER BY st.last_name, st.first_name`,
    [subject_id, school_year, period, section_id]);
  res.json({ data: students, weights: GRADE_WEIGHTS, term: period });
}));

router.post('/class', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  const period = b.term !== undefined && b.term !== '' ? b.term : b.quarter;
  if (!b.section_id || !b.subject_id || !b.school_year || !period || !Array.isArray(b.rows)) {
    return res.status(400).json({ error: 'section_id, subject_id, school_year, term, rows are required' });
  }
  if (Number(period) < 1 || Number(period) > 3) return res.status(400).json({ error: 'term must be 1-3' });
  let n = 0;
  for (const r of b.rows) {
    if (!r.student_id) continue;
    const w = r.written_work != null && r.written_work !== '' ? Number(r.written_work) : null;
    const p = r.performance_task != null && r.performance_task !== '' ? Number(r.performance_task) : null;
    const qe = r.quarterly_exam != null && r.quarterly_exam !== '' ? Number(r.quarterly_exam) : null;
    if ([w, p, qe].some((v) => v != null && (v < 0 || v > 100))) continue;
    const grade = compute(w, p, qe);
    const remarks = grade != null ? (grade >= 75 ? 'PASSED' : 'FAILED') : null;
    const existing = await q(
      'SELECT id FROM grades WHERE student_id = ? AND subject_id = ? AND school_year = ? AND quarter = ?',
      [r.student_id, b.subject_id, b.school_year, period]);
    if (existing) {
      await qr('UPDATE grades SET written_work = ?, performance_task = ?, quarterly_exam = ?, computed_grade = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [w, p, qe, grade, remarks, existing.id]);
    } else {
      await qi('INSERT INTO grades (student_id, subject_id, section_id, school_year, quarter, written_work, performance_task, quarterly_exam, computed_grade, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [r.student_id, b.subject_id, b.section_id, b.school_year, period, w, p, qe, grade, remarks]);
    }
    n++;
  }
  await audit(req, 'GRADES_SAVE', 'grades', null, { section_id: b.section_id, subject_id: b.subject_id, term: period, rows: n });
  res.json({ ok: true, saved: n });
}));

router.get('/report-card/:studentId', requireRole(...WRITE, 'registrar', 'student', 'parent'), asyncH(async (req, res) => {
  const { school_year } = req.query;
  const period = (req.query.term || req.query.quarter || '').toString().trim();
  if (!school_year || !period) return res.status(400).json({ error: 'school_year and term are required' });
  if (!/[1-3]/.test(period)) return res.status(400).json({ error: 'term must be 1, 2 or 3' });
  const student = await q('SELECT * FROM students WHERE id = ?', [req.params.studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const rows = await qa(
    `SELECT su.code, su.title, g.written_work, g.performance_task, g.quarterly_exam, g.computed_grade, g.remarks
     FROM grades g JOIN subjects su ON su.id = g.subject_id
     WHERE g.student_id = ? AND g.school_year = ? AND g.quarter = ? ORDER BY su.code`,
    [req.params.studentId, school_year, period]);
  const withGrades = rows.filter((r) => r.computed_grade != null);
  const average = withGrades.length
    ? Math.round(withGrades.reduce((a, r) => a + Number(r.computed_grade), 0) / withGrades.length * 100) / 100
    : null;
  res.json({ student, school_year, term: Number(period), quarter: Number(period), subjects: rows, general_average: average });
}));

router.get('/years/:studentId', requireRole(...WRITE, 'registrar', 'student', 'parent'), asyncH(async (req, res) => {
  const rows = await qa(
    `SELECT school_year, COUNT(DISTINCT quarter) AS terms, COUNT(DISTINCT subject_id) AS subjects
     FROM grades
     WHERE student_id = ? AND computed_grade IS NOT NULL
     GROUP BY school_year ORDER BY school_year`,
    [req.params.studentId]);
  res.json({ data: rows });
}));

module.exports = router;
