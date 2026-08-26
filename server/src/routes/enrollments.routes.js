const express = require('express');
const { q, qa, qi, qr, bool, tx } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');
const { ensureTeacherSeesSection, ensureTeacherSeesStudent } = require('../scope');

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
  const c = conn || { run: qr, runId: qi };
  await c.run('DELETE FROM enrollment_subjects WHERE enrollment_id = ?', [enrollmentId]);
  for (const sid of ids) {
    await c.runId('INSERT INTO enrollment_subjects (enrollment_id, subject_id) VALUES (?, ?)', [enrollmentId, sid]);
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
  if (req.role === 'teacher') {
    const chk = await ensureTeacherSeesSection(req.user, section.id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }
  const existing = await q(
    `SELECT id FROM enrollments WHERE student_id = ? AND school_year = ? AND ${term ? 'term = ?' : 'term IS NULL'}`,
    term ? [b.student_id, b.school_year, term] : [b.student_id, b.school_year]);
  if (existing) return res.status(409).json({ error: `Student already enrolled for ${b.school_year}${term ? ` (${term} term)` : ''}` });
  const isAral = bool(b.is_aral);
  let id;
  const subjects = await tx(async (conn) => {
    id = await conn.runId(
      'INSERT INTO enrollments (student_id, section_id, school_year, grade_level, strand, term, is_aral, status, enrolled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [b.student_id, b.section_id, b.school_year, b.grade_level, b.strand || null, term, isAral, b.status || 'enrolled', b.enrolled_at || null]);
    await conn.run('UPDATE students SET grade_level = ?, status = ? WHERE id = ?', [b.grade_level, b.status || 'enrolled', b.student_id]);
    return await saveSubjects(conn, id, b.subject_ids);
  });
  await audit(req, 'ENROLL_STUDENT', 'enrollments', id, { student_id: b.student_id, section_id: b.section_id, school_year: b.school_year, term, is_aral: isAral, subjects });
  res.status(201).json({ id });
}));

router.get('/student/:studentId', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  if (req.role === 'teacher') {
    const chk = await ensureTeacherSeesStudent(req.user, req.params.studentId);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }
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
  if (req.role === 'teacher') {
    const secChk = await ensureTeacherSeesSection(req.user, b.section_id !== undefined ? b.section_id : row.section_id);
    if (!secChk.ok) return res.status(403).json({ error: secChk.reason });
    const stuChk = await ensureTeacherSeesStudent(req.user, row.student_id);
    if (!stuChk.ok) return res.status(403).json({ error: stuChk.reason });
  }
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  const term = b.term !== undefined ? normTerm(b.term) : row.term;
  if (isShs(row.grade_level) && term && !TERMS.includes(term)) {
    return res.status(400).json({ error: 'term must be first, second or third' });
  }
  const dup = await q(
    `SELECT id FROM enrollments WHERE student_id = ? AND school_year = ? AND ${term ? 'term = ?' : 'term IS NULL'} AND id != ?`,
    term ? [row.student_id, row.school_year, term, row.id] : [row.student_id, row.school_year, row.id]);
  if (dup) return res.status(409).json({ error: 'Another enrollment already exists for this student, school year and term' });
  const isAral = bool(b.is_aral !== undefined ? b.is_aral : row.is_aral);
  await tx(async (conn) => {
    await conn.run('UPDATE enrollments SET section_id = ?, status = ?, strand = ?, term = ?, is_aral = ?, enrolled_at = ? WHERE id = ?',
      [f('section_id', row.section_id), f('status', row.status), f('strand', row.strand), term, isAral, f('enrolled_at', row.enrolled_at), row.id]);
    if (b.subject_ids !== undefined) await saveSubjects(conn, row.id, b.subject_ids);
  });
  await audit(req, 'UPDATE_ENROLLMENT', 'enrollments', row.id, { status: b.status, term, is_aral: isAral });
  res.json({ ok: true });
}));

router.delete('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM enrollments WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Enrollment not found' });
  if (req.role === 'teacher') {
    const secChk = await ensureTeacherSeesSection(req.user, row.section_id);
    if (!secChk.ok) return res.status(403).json({ error: secChk.reason });
    const stuChk = await ensureTeacherSeesStudent(req.user, row.student_id);
    if (!stuChk.ok) return res.status(403).json({ error: stuChk.reason });
  }
  await qr('DELETE FROM enrollments WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_ENROLLMENT', 'enrollments', row.id);
  res.json({ ok: true });
}));

router.post('/import', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  const csvText = String(b.csv || '').trim();
  if (!csvText) return res.status(400).json({ error: 'CSV data is required' });
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) return res.status(400).json({ error: 'CSV must have a header row and at least one data row' });
  const header = lines[0].toLowerCase().split(',').map(h => h.trim());
  const lrnIdx = header.findIndex(h => h === 'lrn');
  const sectionIdx = header.findIndex(h => h === 'section_name' || h === 'section');
  const syIdx = header.findIndex(h => h === 'school_year');
  const glIdx = header.findIndex(h => h === 'grade_level' || h === 'grade');
  if (lrnIdx === -1 || sectionIdx === -1) {
    return res.status(400).json({ error: 'CSV must have lrn and section_name columns' });
  }
  const schoolYear = syIdx >= 0 ? null : (b.school_year || '2026-2027');
  let imported = 0;
  let skipped = 0;
  const errors = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const lrn = cols[lrnIdx];
    const sectionName = cols[sectionIdx];
    const sy = syIdx >= 0 ? cols[syIdx] : schoolYear;
    const gl = glIdx >= 0 ? cols[glIdx] : null;
    if (!lrn || !sectionName) { skipped++; continue; }
    try {
      const student = await q('SELECT id FROM students WHERE lrn = ?', [lrn]);
      if (!student) { errors.push(`Row ${i + 1}: student LRN ${lrn} not found`); skipped++; continue; }
      const section = await q('SELECT id, grade_level FROM sections WHERE name = ? AND (school_year = ? OR school_year IS NULL)', [sectionName, sy]);
      if (!section) { errors.push(`Row ${i + 1}: section "${sectionName}" not found`); skipped++; continue; }
      const gradeLevel = gl || section.grade_level;
      const existing = await q(
        'SELECT id FROM enrollments WHERE student_id = ? AND school_year = ?',
        [student.id, sy]
      );
      if (existing) { skipped++; continue; }
      await qr(
        'INSERT INTO enrollments (student_id, section_id, school_year, grade_level, status) VALUES (?, ?, ?, ?, ?)',
        [student.id, section.id, sy, gradeLevel, 'enrolled']
      );
      await qr('UPDATE students SET grade_level = ?, status = ? WHERE id = ?', [gradeLevel, 'enrolled', student.id]);
      imported++;
    } catch (e) {
      errors.push(`Row ${i + 1}: ${e.message}`);
      skipped++;
    }
  }
  await audit(req, 'ENROLL_IMPORT', 'enrollments', null, { imported, skipped, errors: errors.length });
  res.json({ ok: true, imported, skipped, errors: errors.slice(0, 20) });
}));

module.exports = router;
