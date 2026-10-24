const express = require('express');
const { q, qa, tx } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, logAccess } = require('../utils');
const { GRADE_WEIGHTS } = require('../config');
const { getDefaultScale, getScale, getScaleForSubject, convertGrade, gpaFrom } = require('../grading/scales');
const { teacherScope, ensureTeacherSeesStudent, ensurePortalSeesStudent } = require('../scope');
const { notifyEvent } = require('../notify');
const logger = require('../logger');
const { sendSpreadsheet, slug } = require('../export');

const router = express.Router();
router.use(authenticate);
const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'teacher'];

function compute(w, p, qe, weights) {
  if (w == null || p == null || qe == null) return null;
  const wt = weights || GRADE_WEIGHTS;
  const total = Number(w) * wt.written_work / 100 +
    Number(p) * wt.performance_task / 100 +
    Number(qe) * wt.quarterly_exam / 100;
  return Math.round(total * 10) / 10;
}

const scaleMeta = (s) => (s ? { id: s.id, code: s.code, name: s.name, scale_type: s.scale_type, passing_grade: s.passing_grade, weights: s.weights } : null);

async function convertRows(rows, defaultScale) {
  const subjectIds = [...new Set(rows.map((r) => r.subject_id).filter(Boolean))];
  const scaleFor = {};
  if (subjectIds.length) {
    const subs = await qa(`SELECT id, scale_id FROM subjects WHERE id IN (${subjectIds.map(() => '?').join(',')})`, subjectIds);
    const scaleIds = [...new Set(subs.map((s) => s.scale_id).filter(Boolean))];
    const loaded = {};
    for (const sid of scaleIds) {
      const sc = await getScale(sid);
      if (sc) loaded[sid] = sc;
    }
    for (const s of subs) {
      scaleFor[s.id] = s.scale_id && loaded[s.scale_id] && loaded[s.scale_id].active ? loaded[s.scale_id] : defaultScale;
    }
  }
  return rows.map((r) => {
    const scale = r.subject_id ? (scaleFor[r.subject_id] || defaultScale) : defaultScale;
    const conv = r.computed_grade != null ? convertGrade(r.computed_grade, scale) : null;
    return {
      ...r,
      letter: conv && conv.letter,
      points: conv && conv.points,
      proficiency: conv && conv.proficiency,
      passed: conv ? conv.passed : null,
      scale: scale.code,
    };
  });
}

router.get('/class', requireRole(...WRITE, 'registrar'), asyncH(async (req, res) => {
  const { section_id, subject_id, school_year } = req.query;
  const period = (req.query.term || req.query.quarter || '').toString().trim();
  if (!section_id || !subject_id || !school_year || !period) {
    return res.status(400).json({ error: 'section_id, subject_id, school_year, term are required' });
  }
  if (!/^[1-3]$/.test(period)) return res.status(400).json({ error: 'term must be 1, 2 or 3' });
  if (req.role === 'teacher') {
    const scope = await teacherScope(req.user);
    if (!scope) return res.status(403).json({ error: 'No teacher profile is linked to this account' });
    const sectionId = Number(section_id);
    const subjectId = Number(subject_id);
    if (!scope.sections.includes(sectionId)) {
      return res.status(403).json({ error: 'You can only access grades for your advisory or assigned sections' });
    }
    if (!scope.advisory.includes(sectionId) && !scope.hasClass(sectionId, subjectId)) {
      return res.status(403).json({ error: 'You can only view grades for your assigned subjects' });
    }
  }
  const scale = await getScaleForSubject(subject_id);
  const students = await qa(
    `SELECT st.id, st.lrn, st.first_name, st.last_name,
       g.written_work, g.performance_task, g.quarterly_exam, g.computed_grade, g.remarks
     FROM enrollments e JOIN students st ON st.id = e.student_id
     LEFT JOIN grades g ON g.student_id = st.id AND g.subject_id = ? AND g.school_year = ? AND g.quarter = ?
     WHERE e.section_id = ? AND e.status = 'enrolled' ORDER BY st.last_name, st.first_name`,
    [subject_id, school_year, period, section_id]);
  const converted = students.map((r) => {
    const conv = r.computed_grade != null ? convertGrade(r.computed_grade, scale) : null;
    return {
      ...r, subject_id: Number(subject_id),
      letter: conv && conv.letter, points: conv && conv.points, proficiency: conv && conv.proficiency,
    };
  });
  res.json({ data: converted, weights: scale.weights, scale: scaleMeta(scale), term: period });
}));

router.post('/class', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  const period = b.term !== undefined && b.term !== '' ? b.term : b.quarter;
  if (!b.section_id || !b.subject_id || !b.school_year || !period || !Array.isArray(b.rows)) {
    return res.status(400).json({ error: 'section_id, subject_id, school_year, term, rows are required' });
  }
  // Require an INTEGER 1-3. `Number(period)` alone let 'Q2', '2abc' and '' all
  // through as NaN, because every comparison against NaN is false.
  const termNum = Number(period);
  if (!Number.isInteger(termNum) || termNum < 1 || termNum > 3) {
    return res.status(400).json({ error: 'term must be 1, 2 or 3' });
  }
  if (req.role === 'teacher') {
    const scope = await teacherScope(req.user);
    if (!scope || !scope.hasClass(Number(b.section_id), Number(b.subject_id))) {
      return res.status(403).json({ error: 'You can only save grades for your assigned class' });
    }
  }
  const studentIds = b.rows.filter((r) => r.student_id).map((r) => r.student_id);
  if (studentIds.length) {
    const enrolled = await qa(
      `SELECT student_id FROM enrollments WHERE section_id = ? AND school_year = ? AND status = 'enrolled' AND student_id IN (${studentIds.map(() => '?').join(',')})`,
      [b.section_id, b.school_year, ...studentIds]);
    const enrolledSet = new Set(enrolled.map((r) => r.student_id));
    for (const r of b.rows) {
      if (r.student_id && !enrolledSet.has(r.student_id)) {
        return res.status(400).json({ error: `Student ${r.student_id} is not enrolled in this section` });
      }
    }
  }
  const scale = await getScaleForSubject(b.subject_id);
  const passing = Number(scale.passing_grade);
  let n = 0;
  const rejected = [];
  await tx(async (conn) => {
    for (const r of b.rows) {
      if (!r.student_id) continue;
      // Number('abc') is NaN, and NaN fails every comparison — the old
      // `v < 0 || v > 100` guard let NaN through and persisted it into a
      // numeric column, permanently corrupting the record. Validate the raw
      // input with Number.isFinite instead, and surface which rows were
      // dropped rather than reporting only how many saved.
      const parse = (v) => {
        if (v == null || v === '') return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : NaN;
      };
      const w = parse(r.written_work);
      const p = parse(r.performance_task);
      const qe = parse(r.quarterly_exam);
      if (![w, p, qe].every((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 100))) {
        rejected.push(r.student_id);
        continue;
      }
      const grade = compute(w, p, qe, scale.weights);
      const remarks = grade != null ? (grade >= passing ? 'PASSED' : 'FAILED') : null;
      if (grade != null && grade < 75) {
        notifyEvent('grade_alert', {
          student_id: r.student_id,
          data: {
            student: 'Student',
            subject: 'Subject',
            grade: String(grade),
            term: String(period),
          },
        }).catch(() => {});
      }
      const existing = await conn.get(
        'SELECT id FROM grades WHERE student_id = ? AND subject_id = ? AND school_year = ? AND quarter = ?',
        [r.student_id, b.subject_id, b.school_year, period]);
      if (existing) {
        await conn.run('UPDATE grades SET written_work = ?, performance_task = ?, quarterly_exam = ?, computed_grade = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [w, p, qe, grade, remarks, existing.id]);
      } else {
        await conn.runId('INSERT INTO grades (student_id, subject_id, section_id, school_year, quarter, written_work, performance_task, quarterly_exam, computed_grade, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [r.student_id, b.subject_id, b.section_id, b.school_year, period, w, p, qe, grade, remarks]);
      }
      n++;
    }
  });
  await audit(req, 'GRADES_SAVE', 'grades', null, { section_id: b.section_id, subject_id: b.subject_id, term: period, rows: n, rejected: rejected.length, scale: scale.code });
  notifyEvent('grade_posted', {
    section_id: b.section_id,
    school_year: b.school_year,
    data: {
      term: period, school_year: b.school_year,
      subject: (await q('SELECT title FROM subjects WHERE id = ?', [b.subject_id]))?.title || String(b.subject_id),
      section: (await q('SELECT name FROM sections WHERE id = ?', [b.section_id]))?.name || '',
    },
  }).catch((err) => logger.error({ err: err?.message, stack: err?.stack }, '[GRADES] notifyEvent(grades_saved) failed'));
  res.json({
    ok: true,
    saved: n,
    // Tell the teacher exactly which rows were skipped instead of silently
    // dropping them — a partial save used to look fully successful.
    rejected_student_ids: rejected,
    rejected_reason: 'grade values must be numbers between 0 and 100',
    scale: scaleMeta(scale),
  });
}));

// GET /export — class record for a section/subject/term as a downloadable
// .xlsx/.csv, using the same query + role scope as GET /class.
router.get('/export', requireRole(...WRITE, 'registrar'), asyncH(async (req, res) => {
  const { section_id, subject_id, school_year } = req.query;
  const period = (req.query.term || req.query.quarter || '').toString().trim();
  if (!section_id || !subject_id || !school_year || !period) {
    return res.status(400).json({ error: 'section_id, subject_id, school_year, term are required' });
  }
  if (!/^[1-3]$/.test(period)) return res.status(400).json({ error: 'term must be 1, 2 or 3' });
  if (req.role === 'teacher') {
    const scope = await teacherScope(req.user);
    if (!scope) return res.status(403).json({ error: 'No teacher profile is linked to this account' });
    const sectionId = Number(section_id);
    const subjectId = Number(subject_id);
    if (!scope.sections.includes(sectionId)) {
      return res.status(403).json({ error: 'You can only access grades for your advisory or assigned sections' });
    }
    if (!scope.advisory.includes(sectionId) && !scope.hasClass(sectionId, subjectId)) {
      return res.status(403).json({ error: 'You can only view grades for your assigned subjects' });
    }
  }
  const scale = await getScaleForSubject(subject_id);
  const rows = await qa(
    `SELECT st.lrn, st.last_name, st.first_name,
        g.written_work, g.performance_task, g.quarterly_exam, g.computed_grade, g.remarks,
        su.code AS subject_code, su.title AS subject_title, sec.name AS section_name
     FROM enrollments e JOIN students st ON st.id = e.student_id
     JOIN subjects su ON su.id = ?
     JOIN sections sec ON sec.id = ?
     LEFT JOIN grades g ON g.student_id = st.id AND g.subject_id = ? AND g.school_year = ? AND g.quarter = ?
     WHERE e.section_id = ? AND e.status = 'enrolled' ORDER BY st.last_name, st.first_name`,
    [subject_id, section_id, subject_id, school_year, period, section_id]);
  const out = rows.map((r) => {
    const conv = r.computed_grade != null ? convertGrade(r.computed_grade, scale) : null;
    return {
      lrn: r.lrn, last_name: r.last_name, first_name: r.first_name,
      subject_code: r.subject_code, subject_title: r.subject_title, section_name: r.section_name,
      term: period, school_year,
      written_work: r.written_work, performance_task: r.performance_task, quarterly_exam: r.quarterly_exam,
      computed_grade: r.computed_grade,
      letter: conv && conv.letter, points: conv && conv.points, proficiency: conv && conv.proficiency,
      remarks: r.remarks || (conv ? (conv.passed ? 'PASSED' : 'FAILED') : ''),
    };
  });
  const columns = [
    { key: 'lrn', header: 'LRN', width: 16 },
    { key: 'last_name', header: 'Last Name', width: 18 },
    { key: 'first_name', header: 'First Name', width: 18 },
    { key: 'subject_code', header: 'Subject Code', width: 12 },
    { key: 'subject_title', header: 'Subject', width: 28 },
    { key: 'section_name', header: 'Section', width: 18 },
    { key: 'term', header: 'Term', width: 8 },
    { key: 'school_year', header: 'School Year', width: 12 },
    { key: 'written_work', header: 'Written Work', width: 12 },
    { key: 'performance_task', header: 'Performance Task', width: 14 },
    { key: 'quarterly_exam', header: 'Quarterly Exam', width: 12 },
    { key: 'computed_grade', header: 'Computed Grade', width: 13 },
    { key: 'letter', header: 'Letter', width: 8 },
    { key: 'points', header: 'Grade Points', width: 12 },
    { key: 'proficiency', header: 'Proficiency', width: 14 },
    { key: 'remarks', header: 'Remarks', width: 10 },
  ];
  const fname = `class-record-term-${period}${school_year ? `-${slug(school_year)}` : ''}`;
  await sendSpreadsheet(res, String(req.query.format || 'xlsx'), { columns, rows: out, sheetName: 'Class Record', filename: fname });
}));

router.get('/report-card/:studentId', requireRole(...WRITE, 'registrar', 'student', 'parent'), asyncH(async (req, res) => {
  const { school_year } = req.query;
  const period = (req.query.term || req.query.quarter || '').toString().trim();
  if (!school_year || !period) return res.status(400).json({ error: 'school_year and term are required' });
  if (!/^[1-3]$/.test(period)) return res.status(400).json({ error: 'term must be 1, 2 or 3' });
  const student = await q('SELECT * FROM students WHERE id = ?', [req.params.studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (req.role === 'teacher') {
    const chk = await ensureTeacherSeesStudent(req.user, student.id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  } else if (req.role === 'student' || req.role === 'parent') {
    const chk = await ensurePortalSeesStudent(req.user, student.id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }
  logAccess(req, student.id);
  const rows = await qa(
    `SELECT g.subject_id, su.code, su.title, g.written_work, g.performance_task, g.quarterly_exam, g.computed_grade, g.remarks
     FROM grades g JOIN subjects su ON su.id = g.subject_id
     WHERE g.student_id = ? AND g.school_year = ? AND g.quarter = ? ORDER BY su.code`,
    [req.params.studentId, school_year, period]);
  const scale = await getDefaultScale();
  const converted = await convertRows(rows, scale);
  const withGrades = converted.filter((r) => r.computed_grade != null);
  const average = withGrades.length
    ? Math.round(withGrades.reduce((a, r) => a + Number(r.computed_grade), 0) / withGrades.length * 100) / 100
    : null;
  const gpa = gpaFrom(withGrades);
  res.json({
    student, school_year, term: Number(period), quarter: Number(period),
    subjects: converted, general_average: average, gpa,
    scale: scaleMeta(scale),
  });
}));

router.get('/years/:studentId', requireRole(...WRITE, 'registrar', 'student', 'parent'), asyncH(async (req, res) => {
  if (req.role === 'teacher') {
    const chk = await ensureTeacherSeesStudent(req.user, req.params.studentId);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  } else if (req.role === 'student' || req.role === 'parent') {
    const chk = await ensurePortalSeesStudent(req.user, req.params.studentId);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }
  logAccess(req, req.params.studentId);
  const rows = await qa(
    `SELECT school_year, COUNT(DISTINCT quarter) AS terms, COUNT(DISTINCT subject_id) AS subjects
     FROM grades
     WHERE student_id = ? AND computed_grade IS NOT NULL
     GROUP BY school_year ORDER BY school_year`,
    [req.params.studentId]);
  res.json({ data: rows });
}));

module.exports = router;
