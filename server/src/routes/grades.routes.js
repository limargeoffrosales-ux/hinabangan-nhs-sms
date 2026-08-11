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
  const { section_id, subject_id, school_year, quarter } = req.query;
  if (!section_id || !subject_id || !school_year || !quarter) {
    return res.status(400).json({ error: 'section_id, subject_id, school_year, quarter are required' });
  }
  const students = await qa(
    `SELECT st.id, st.lrn, st.first_name, st.last_name,
       g.written_work, g.performance_task, g.quarterly_exam, g.computed_grade, g.remarks
     FROM enrollments e JOIN students st ON st.id = e.student_id
     LEFT JOIN grades g ON g.student_id = st.id AND g.subject_id = ? AND g.school_year = ? AND g.quarter = ?
     WHERE e.section_id = ? AND e.status = 'enrolled' ORDER BY st.last_name, st.first_name`,
    [subject_id, school_year, quarter, section_id]);
  res.json({ data: students, weights: GRADE_WEIGHTS });
}));

router.post('/class', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.section_id || !b.subject_id || !b.school_year || !b.quarter || !Array.isArray(b.rows)) {
    return res.status(400).json({ error: 'section_id, subject_id, school_year, quarter, rows are required' });
  }
  if (Number(b.quarter) < 1 || Number(b.quarter) > 4) return res.status(400).json({ error: 'quarter must be 1-4' });
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
      [r.student_id, b.subject_id, b.school_year, b.quarter]);
    if (existing) {
      await qr('UPDATE grades SET written_work = ?, performance_task = ?, quarterly_exam = ?, computed_grade = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [w, p, qe, grade, remarks, existing.id]);
    } else {
      await qi('INSERT INTO grades (student_id, subject_id, section_id, school_year, quarter, written_work, performance_task, quarterly_exam, computed_grade, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [r.student_id, b.subject_id, b.section_id, b.school_year, b.quarter, w, p, qe, grade, remarks]);
    }
    n++;
  }
  await audit(req, 'GRADES_SAVE', 'grades', null, { section_id: b.section_id, subject_id: b.subject_id, quarter: b.quarter, rows: n });
  res.json({ ok: true, saved: n });
}));

router.get('/report-card/:studentId', requireRole(...WRITE, 'registrar', 'student', 'parent'), asyncH(async (req, res) => {
  const { school_year, quarter } = req.query;
  if (!school_year || !quarter) return res.status(400).json({ error: 'school_year and quarter are required' });
  const student = await q('SELECT * FROM students WHERE id = ?', [req.params.studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const rows = await qa(
    `SELECT su.code, su.title, g.written_work, g.performance_task, g.quarterly_exam, g.computed_grade, g.remarks
     FROM grades g JOIN subjects su ON su.id = g.subject_id
     WHERE g.student_id = ? AND g.school_year = ? AND g.quarter = ? ORDER BY su.code`,
    [req.params.studentId, school_year, quarter]);
  const withGrades = rows.filter((r) => r.computed_grade != null);
  const average = withGrades.length
    ? Math.round(withGrades.reduce((a, r) => a + Number(r.computed_grade), 0) / withGrades.length * 100) / 100
    : null;
  res.json({ student, school_year, quarter, subjects: rows, general_average: average });
}));

module.exports = router;
