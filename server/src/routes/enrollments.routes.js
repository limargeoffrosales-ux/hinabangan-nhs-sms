const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');

const router = express.Router();
router.use(authenticate);
const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
const ENROLL_WRITE = [...WRITE, 'teacher'];
const TERMS = ['first', 'second', 'third'];
const isShs = (g) => /^Grade 1[12]$/.test(String(g || ''));

function normTerm(t) {
  if (!t) return null;
  const v = String(t).toLowerCase().replace(/\s+/g, '_');
  if (v === '1' || v === 'term_1' || v === 'first_term' || v === 'first') return 'first';
  if (v === '2' || v === 'term_2' || v === 'second_term' || v === 'second') return 'second';
  if (v === '3' || v === 'term_3' || v === 'third_term' || v === 'third') return 'third';
  return v === 'all' || v === 'full' ? 'all' : null;
}

async function saveSubjects(conn, enrollmentId, subjectIds) {
  const ids = Array.isArray(subjectIds) ? [...new Set(subjectIds.map(Number).filter(Boolean))] : [];
  await qr('DELETE FROM enrollment_subjects WHERE enrollment_id = ?', [enrollmentId]);
  for (const sid of ids) {
    await qi('INSERT INTO enrollment_subjects (enrollment_id, subject_id) VALUES (?, ?)', [enrollmentId, sid]);
  }
  return ids.length;
}

async function loadSubjects(studentId) {
  const rows = await qa(
    `SELECT es.enrollment_id, s.id AS subject_id, s.code, s.title, s.track, s.units, s.term
     FROM enrollment_subjects es
     JOIN subjects s ON s.id = es.subject_id
     JOIN enrollments e ON e.id = es.enrollment_id
     WHERE e.student_id = ?
     ORDER BY s.track, s.title`,
    [studentId]);
  const map = {};
  for (const r of rows) (map[r.enrollment_id] = map[r.enrollment_id] || []).push({
    subject_id: r.subject_id, code: r.code, title: r.title, track: r.track, units: r.units, term: r.term,
  });
  return map;
}

router.post('/', requireRole(...ENROLL_WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.student_id || !b.section_id || !b.school_year || !b.grade_level) {
    return res.status(400).json({ error: 'student_id, section_id, school_year, grade_level are required' });
  }
  const term = normTerm(b.term);
  if (isShs(b.grade_level) && !TERMS.includes(term)) {
    return res.status(400).json({ error: 'term is required for SHS enrollment (first, second or third)' });
  }
  const student = await q('SELECT id FROM students WHERE id = ?', [b.student_id]);
  const section = await q('SELECT id FROM sections WHERE id = ?', [b.section_id]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (!section) return res.status(404).json({ error: 'Section not found' });
  const existing = await q(
    `SELECT id FROM enrollments WHERE student_id = ? AND school_year = ? AND ${term ? 'term = ?' : 'term IS NULL'}`,
    term ? [b.student_id, b.school_year, term] : [b.student_id, b.school_year]);
  if (existing) return res.status(409).json({ error: `Student already enrolled for ${b.school_year}${term ? ` (${term} term)` : ''}` });
  const isAral = b.is_aral ? 1 : 0;
  const id = await qi(
    'INSERT INTO enrollments (student_id, section_id, school_year, grade_level, strand, term, is_aral, status, enrolled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [b.student_id, b.section_id, b.school_year, b.grade_level, b.strand || null, term, isAral, b.status || 'enrolled', b.enrolled_at || null]);
  await qr('UPDATE students SET grade_level = ?, status = ? WHERE id = ?', [b.grade_level, b.status || 'enrolled', b.student_id]);
  const subjects = await saveSubjects(null, id, b.subject_ids);
  await audit(req, 'ENROLL_STUDENT', 'enrollments', id, { student_id: b.student_id, section_id: b.section_id, school_year: b.school_year, term, is_aral: isAral, subjects });
  res.status(201).json({ id });
}));

router.get('/student/:studentId', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  const rows = await qa(
    'SELECT e.*, s.name AS section_name, s.school_year FROM enrollments e LEFT JOIN sections s ON s.id = e.section_id WHERE e.student_id = ? ORDER BY e.school_year DESC',
    [req.params.studentId]);
  const subjectMap = await loadSubjects(req.params.studentId);
  for (const r of rows) r.subjects = subjectMap[r.id] || [];
  res.json({ data: rows });
}));

router.patch('/:id', requireRole(...ENROLL_WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM enrollments WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Enrollment not found' });
  const b = req.body || {};
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  const term = b.term !== undefined ? normTerm(b.term) : row.term;
  if (isShs(row.grade_level) && term && !TERMS.includes(term)) {
    return res.status(400).json({ error: 'term must be first, second or third' });
  }
  const dup = await q(
    `SELECT id FROM enrollments WHERE student_id = ? AND school_year = ? AND ${term ? 'term = ?' : 'term IS NULL'} AND id != ?`,
    term ? [row.student_id, row.school_year, term, row.id] : [row.student_id, row.school_year, row.id]);
  if (dup) return res.status(409).json({ error: 'Another enrollment already exists for this student, school year and term' });
  const isAral = b.is_aral !== undefined ? (b.is_aral ? 1 : 0) : row.is_aral;
  await qr('UPDATE enrollments SET section_id = ?, status = ?, strand = ?, term = ?, is_aral = ?, enrolled_at = ? WHERE id = ?',
    [f('section_id', row.section_id), f('status', row.status), f('strand', row.strand), term, isAral, f('enrolled_at', row.enrolled_at), row.id]);
  if (b.subject_ids !== undefined) await saveSubjects(null, row.id, b.subject_ids);
  await audit(req, 'UPDATE_ENROLLMENT', 'enrollments', row.id, { status: b.status, term, is_aral: isAral });
  res.json({ ok: true });
}));

router.delete('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM enrollments WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Enrollment not found' });
  await qr('DELETE FROM enrollments WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_ENROLLMENT', 'enrollments', row.id);
  res.json({ ok: true });
}));

module.exports = router;
