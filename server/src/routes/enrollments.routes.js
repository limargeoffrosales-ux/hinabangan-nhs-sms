const express = require('express');
const { q, qa, qi, qr, bool, tx } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');
const { ensureTeacherSeesSection, ensureTeacherSeesStudent, linkedStudentIds } = require('../scope');
const { getCurrentSchoolYear } = require('../schoolYear');
const { notifyEvent } = require('../notify');
const { APP_URL } = require('../config');

const router = express.Router();
router.use(authenticate);
const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
const ENROLL_WRITE = [...WRITE, 'teacher'];
const DOC_TYPES = ['psa_birth', 'form_138', 'good_moral', 'report_card', 'other'];
const TERMS = ['first', 'second', 'third'];
const STATUSES = ['pre_registered', 'pending', 'provisional', 'conditional', 'enrolled'];
const isShs = (g) => /^Grade 1[12]$/.test(String(g || ''));

// A blank LRN in a bulk-import row means "new student, allocate a number for
// me" — the students.lrn column is NOT NULL, so mirror POST /students and
// generate a unique 12-digit LRN instead of inserting null.
async function uniqueLrn() {
  for (let i = 0; i < 20; i++) {
    const lrn = String(1 + Math.floor(Math.random() * 9)) +
      String(Math.floor(Math.random() * 1e11)).padStart(11, '0');
    const exists = await q('SELECT id FROM students WHERE lrn = ?', [lrn]);
    if (!exists) return lrn;
  }
  throw new Error('Could not allocate a unique LRN');
}

function normStatus(s) {
  if (s === undefined || s === null) return null;
  const v = String(s).trim().toLowerCase().replace(/[-\s]+/g, '_');
  return STATUSES.includes(v) ? v : null;
}

// The app pre-checks for duplicate enrollments, but a concurrent double-submit
// (or a direct DB collision) still trips the unique index. Both drivers raise a
// unique-violation error that would otherwise surface as a generic 500 — map it
// back to the same friendly 409 the pre-check uses.
function isUniqueViolation(e) {
  return e && (e.code === '23505' || /unique constraint/i.test(e.message || ''));
}

// Map the school's official strand picker labels to their catalog category
// so the enrollment form can pre-tick the right sector subjects. Academic and
// unknown strands only pre-tick the core curriculum subjects.
const STRAND_CATEGORIES = {
  'TechPro - Electrical Installation and Maintenance': 'tvl-industrial',
  'TechPro - Computer System and Servicing': 'tvl-ict',
  'TechPro - Garment Artisanry': 'tvl-artisanry',
};

// The "standard" subject set for an SHS enrollment: the grade's mandatory core
// subjects (category core / track general / CORE-* / SSHS-* codes) plus, when a
// TechPro strand is chosen, that strand's sector electives — filtered by term.
async function defaultSubjectIds(gradeLevel, strand, term) {
  const termOk = TERMS.includes(term) || term === 'all';
  const termClause = termOk ? "AND (term = ? OR term = 'all' OR term IS NULL)" : '';
  const termParam = termOk ? term : null;
  const ids = new Set();
  const core = await qa(
    `SELECT id FROM subjects
     WHERE grade_level = ? AND is_offered = TRUE
       AND (category = 'core' OR track = 'general' OR code LIKE 'CORE-%' OR code LIKE 'SSHS-%')
       ${termClause}`,
    termOk ? [gradeLevel, termParam] : [gradeLevel]);
  for (const r of core) ids.add(Number(r.id));
  const category = STRAND_CATEGORIES[strand] || null;
  if (category) {
    const sector = await qa(
      `SELECT id FROM subjects
       WHERE grade_level = ? AND is_offered = TRUE AND category = ?
         ${termClause}`,
      termOk ? [gradeLevel, category, termParam] : [gradeLevel, category]);
    for (const r of sector) ids.add(Number(r.id));
  }
  return [...ids];
}

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
  if (ids.length) {
    const values = ids.map(() => '(?, ?)').join(', ');
    const params = ids.flatMap((sid) => [enrollmentId, sid]);
    await c.run(`INSERT INTO enrollment_subjects (enrollment_id, subject_id) VALUES ${values}`, params);
  }
  return ids.length;
}

// Validate the checklist before persisting: every subject must exist and the
// enrollment must be at the same grade level as the subject. Prevents linking
// a Grade 11 learner to Grade 12 (or stale/foreign) subject ids via the API.
async function validateSubjects(gradeLevel, subjectIds) {
  const ids = Array.isArray(subjectIds) ? [...new Set(subjectIds.map(Number).filter(Boolean))] : [];
  if (!ids.length) return { ok: true, ids: [] };
  const rows = await qa(`SELECT id, code, title, grade_level FROM subjects WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  if (rows.length !== ids.length) return { ok: false, error: 'One or more selected subjects do not exist in the catalog' };
  const bad = rows.filter((r) => r.grade_level && r.grade_level !== gradeLevel);
  if (bad.length) {
    const names = bad.map((r) => r.code || `${r.title} (${r.id})`).join(', ');
    return { ok: false, error: `Selected subjects do not match ${gradeLevel}: ${names}. Pick the checklist for the correct grade level or tap "Refill curriculum defaults".` };
  }
  return { ok: true, ids };
}

async function loadSubjects(studentId) {
  const rows = await qa(
    `SELECT es.enrollment_id, s.id AS subject_id, s.code, s.title, s.track, s.units, s.term
     FROM enrollment_subjects es
     JOIN subjects s ON s.id = es.subject_id
     JOIN enrollments e ON e.id = es.enrollment_id
     WHERE e.student_id = ?
     ORDER BY s.grade_level, s.track, s.title`,
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
  const status = b.status === undefined || b.status === null || b.status === ''
    ? 'enrolled'
    : normStatus(b.status);
  if (status === null) {
    return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
  }
  const student = await q('SELECT id FROM students WHERE id = ?', [b.student_id]);
  const section = await q('SELECT id, school_year, grade_level, strand, capacity FROM sections WHERE id = ?', [b.section_id]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (!section) return res.status(404).json({ error: 'Section not found' });
  if (section.school_year && section.school_year !== b.school_year) {
    return res.status(400).json({ error: `Section ${section.school_year} does not match the enrollment school year ${b.school_year}` });
  }
  if (b.grade_level && section.grade_level && b.grade_level !== section.grade_level) {
    return res.status(400).json({ error: `Grade level ${b.grade_level} does not match the section (${section.grade_level})` });
  }
  const gradeLevel = section.grade_level || b.grade_level;
  const strand = b.strand || section.strand || null;
  if (req.role === 'teacher') {
    const chk = await ensureTeacherSeesSection(req.user, section.id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
    const outside = await q(
      `SELECT e.id FROM enrollments e JOIN sections s ON s.id = e.section_id
       WHERE e.student_id = ? AND e.status = 'enrolled'
         AND s.id NOT IN (${chk.scope.sections.map(() => '?').join(',')}) LIMIT 1`,
      [b.student_id, ...chk.scope.sections]);
    if (outside) {
      return res.status(403).json({ error: 'This student is currently enrolled in a class outside your scope — contact an administrator to transfer or admit them.' });
    }
  }
  const capacity = Number(section.capacity) || 40;
  if (capacity > 0) {
    const tally = await q(
      'SELECT COUNT(*) AS n FROM enrollments WHERE section_id = ? AND school_year = ? AND status = ?',
      [section.id, b.school_year, 'enrolled']);
    if (Number(tally.n) >= capacity) {
      return res.status(409).json({ error: `Section is at full capacity (${capacity} learners)` });
    }
  }
  const existing = await q(
    `SELECT id FROM enrollments WHERE student_id = ? AND school_year = ? AND ${term ? 'term = ?' : 'term IS NULL'}`,
    term ? [b.student_id, b.school_year, term] : [b.student_id, b.school_year]);
  if (existing) return res.status(409).json({ error: `Student already enrolled for ${b.school_year}${term ? ` (${term} term)` : ''}` });
  const subChk = await validateSubjects(gradeLevel, b.subject_ids);
  if (!subChk.ok) return res.status(400).json({ error: subChk.error });
  const isAral = bool(b.is_aral);
  let id;
  let subjects;
  try {
    subjects = await tx(async (conn) => {
      id = await conn.runId(
        'INSERT INTO enrollments (student_id, section_id, school_year, grade_level, strand, term, is_aral, status, enrolled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [b.student_id, section.id, b.school_year, gradeLevel, strand, term, isAral, status, b.enrolled_at || null]);
      await conn.run('UPDATE students SET grade_level = ?, status = ? WHERE id = ?', [gradeLevel, 'enrolled', b.student_id]);
      return await saveSubjects(conn, id, subChk.ids);
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return res.status(409).json({ error: `Student already enrolled for ${b.school_year}${term ? ` (${term} term)` : ''}` });
    }
    throw e;
  }
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

// ── Student self-service enrollment (portal) ────────────────────────────────
// A portal student applies for the NEXT school year themselves; the record is
// created as 'pending' and the registrar finalizes it through the normal flow.
// Current-year transfers/re-enrollment stay registrar-only.

async function portalStudentFor(req) {
  const ids = await linkedStudentIds(req.user);
  if (!ids || !ids.length) return null;
  const raw = req.body && req.body.student_id != null ? req.body.student_id : (req.query && req.query.student_id);
  if (raw != null && raw !== '') {
    const n = Number(raw);
    if (!ids.includes(n)) return null;
    return { id: n };
  }
  return { id: ids[0] };
}

router.post('/self-apply', requireRole('student', 'parent'), asyncH(async (req, res) => {
  const portal = await portalStudentFor(req);
  if (!portal) return res.status(403).json({ error: "You do not have access to this learner's records" });
  const studentId = portal.id;
  const b = req.body || {};
  if (!b.section_id || !b.school_year) {
    return res.status(400).json({ error: 'section_id and school_year are required' });
  }
  const currentSy = await getCurrentSchoolYear();
  if (String(b.school_year).trim() === String(currentSy).trim()) {
    return res.status(400).json({ error: 'Self-service applications are for an upcoming school year. For the current school year, contact the registrar to enroll you.' });
  }
  const section = await q('SELECT id, school_year, grade_level, strand, capacity FROM sections WHERE id = ?', [b.section_id]);
  if (!section) return res.status(404).json({ error: 'Section not found' });
  if (section.school_year && String(section.school_year) !== String(b.school_year)) {
    return res.status(400).json({ error: `Section belongs to ${section.school_year}, not ${b.school_year}` });
  }
  const gradeLevel = section.grade_level || String(b.grade_level || '').trim();
  if (!gradeLevel) return res.status(400).json({ error: 'grade_level is required' });
  const term = normTerm(b.term);
  if (isShs(gradeLevel) && !TERMS.includes(term)) {
    return res.status(400).json({ error: 'term is required for SHS enrollment (first, second or third)' });
  }
  const student = await q('SELECT id, lrn, first_name, last_name FROM students WHERE id = ?', [studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const existing = await q(
    `SELECT id, status FROM enrollments WHERE student_id = ? AND school_year = ? AND ${term ? 'term = ?' : 'term IS NULL'}`,
    term ? [studentId, b.school_year, term] : [studentId, b.school_year]);
  if (existing) {
    return res.status(409).json({ error: 'An application for this school year already exists' });
  }
  const capacity = Number(section.capacity) || 40;
  if (capacity > 0) {
    const tally = await q(
      'SELECT COUNT(*) AS n FROM enrollments WHERE section_id = ? AND school_year = ? AND status = ?',
      [section.id, b.school_year, 'enrolled']);
    if (Number(tally.n) >= capacity) {
      return res.status(409).json({ error: `Section is at full capacity (${capacity} learners)` });
    }
  }
  const strand = b.strand || section.strand || null;
  const isAral = bool(b.is_aral);
  // Resolve auto-fill subjects OUTSIDE the transaction: on SQLite every query
  // (including tx contents) runs on one serialized queue, so awaiting a module
  // query inside the tx callback would deadlock.
  const defaults = isShs(gradeLevel) ? await defaultSubjectIds(gradeLevel, strand, term) : [];
  let id;
  try {
    await tx(async (conn) => {
      id = await conn.runId(
        'INSERT INTO enrollments (student_id, section_id, school_year, grade_level, strand, term, is_aral, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [studentId, section.id, b.school_year, gradeLevel, strand, term, isAral, 'pending']);
      // Do NOT touch students.grade_level/status — the learner's current-year
      // record must keep reflecting reality until the registrar confirms.
      if (defaults.length) await saveSubjects(conn, id, defaults);
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return res.status(409).json({ error: 'An application for this school year already exists' });
    }
    throw e;
  }
  await audit(req, 'ENROLL_SELF_APPLY', 'enrollments', id, { student_id: studentId, section_id: section.id, school_year: b.school_year, term });
  await notifyEvent('enrollment_applied', {
    data: {
      student: `${student.last_name}, ${student.first_name}`,
      lrn: student.lrn,
      school_year: b.school_year,
      grade_level: gradeLevel,
      strand: strand ? ` (${strand})` : '',
    },
  });
  res.status(201).json({ id, status: 'pending' });
}));

router.get('/self-apply', requireRole('student', 'parent'), asyncH(async (req, res) => {
  const portal = await portalStudentFor(req);
  if (!portal) return res.status(403).json({ error: "You do not have access to this learner's records" });
  const rows = await qa(
    `SELECT e.*, s.name AS section_name FROM enrollments e LEFT JOIN sections s ON s.id = e.section_id
     WHERE e.student_id = ? ORDER BY e.school_year DESC, e.id DESC`,
    [portal.id]);
  res.json({ data: rows });
}));

// Auto-fill the SHS subject checklist from the curriculum. Returns the subject
// ids that should be pre-ticked for a grade level + strand + term so the
// registrar only has to adjust, not re-tick every core.
router.get('/default-subjects', requireRole(...WRITE), asyncH(async (req, res) => {
  const gradeLevel = String(req.query.grade_level || '').trim();
  if (!gradeLevel) return res.status(400).json({ error: 'grade_level is required' });
  const strand = String(req.query.strand || '').trim() || null;
  const term = normTerm(req.query.term);
  const ids = await defaultSubjectIds(gradeLevel, strand, term);
  res.json({ data: ids });
}));

// ── Requirement documents (PSA birth cert, Form 138/SF9, Good Moral, ...) ──
// Files are uploaded first via POST /uploads/file?folder=enrollment_docs; the
// returned key/url are then linked to an enrollment here.

router.get('/:id/documents', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  const id = Number(req.params.id);
  const row = await q('SELECT id, student_id FROM enrollments WHERE id = ?', [id]);
  if (!row) return res.status(404).json({ error: 'Enrollment not found' });
  if (req.role === 'teacher') {
    const stuChk = await ensureTeacherSeesStudent(req.user, row.student_id);
    if (!stuChk.ok) return res.status(403).json({ error: stuChk.reason });
  }
  const rows = await qa(
    `SELECT d.*, u.name AS uploaded_by_name
     FROM enrollment_documents d
     LEFT JOIN users u ON u.id = d.uploaded_by
     WHERE d.enrollment_id = ?
     ORDER BY d.id DESC`,
    [id]);
  res.json({ data: rows });
}));

router.post('/:id/documents', requireRole(...WRITE), asyncH(async (req, res) => {
  const id = Number(req.params.id);
  const row = await q('SELECT id FROM enrollments WHERE id = ?', [id]);
  if (!row) return res.status(404).json({ error: 'Enrollment not found' });
  const b = req.body || {};
  const docType = String(b.doc_type || 'other').toLowerCase().replace(/\s+/g, '_');
  if (!DOC_TYPES.includes(docType)) {
    return res.status(400).json({ error: `doc_type must be one of: ${DOC_TYPES.join(', ')}` });
  }
  const url = String(b.url || '').trim();
  if (!url) return res.status(400).json({ error: 'url is required — upload the file first via /uploads/file' });
  const docId = await qi(
    'INSERT INTO enrollment_documents (enrollment_id, doc_type, file_key, file_url, file_name, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
    [id, docType, b.key ? String(b.key) : null, url, b.name ? String(b.name).slice(0, 255) : null, req.user.id]);
  await audit(req, 'ENROLL_DOC_ADD', 'enrollments', id, { doc_type: docType });
  res.status(201).json({ id: docId });
}));

router.delete('/documents/:docId', requireRole(...WRITE), asyncH(async (req, res) => {
  const doc = await q('SELECT * FROM enrollment_documents WHERE id = ?', [req.params.docId]);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  await qr('DELETE FROM enrollment_documents WHERE id = ?', [doc.id]);
  await audit(req, 'ENROLL_DOC_DELETE', 'enrollments', doc.enrollment_id, { doc_id: doc.id });
  res.json({ ok: true });
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
  let newSection = null;
  if (b.section_id !== undefined && Number(b.section_id) !== Number(row.section_id)) {
    newSection = await q('SELECT id, school_year, grade_level, capacity FROM sections WHERE id = ?', [b.section_id]);
    if (!newSection) return res.status(404).json({ error: 'Section not found' });
    if (newSection.school_year && newSection.school_year !== row.school_year) {
      return res.status(400).json({ error: `Section ${newSection.school_year} does not match the enrollment school year ${row.school_year}` });
    }
    if (newSection.grade_level && newSection.grade_level !== row.grade_level) {
      return res.status(400).json({ error: `Moving between grade levels is not supported here (section is ${newSection.grade_level}, enrollment is ${row.grade_level})` });
    }
    const capacity = Number(newSection.capacity) || 40;
    if (capacity > 0) {
      const tally = await q(
        'SELECT COUNT(*) AS n FROM enrollments WHERE section_id = ? AND school_year = ? AND status = ? AND id != ?',
        [newSection.id, row.school_year, 'enrolled', row.id]);
      if (Number(tally.n) >= capacity) {
        return res.status(409).json({ error: `Target section is at full capacity (${capacity} learners)` });
      }
    }
  }
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  let term = row.term;
  if (b.term !== undefined) {
    const nt = normTerm(b.term);
    if (nt === null && String(b.term).trim() !== '') {
      return res.status(400).json({ error: 'term must be first, second or third' });
    }
    if (nt === null && isShs(row.grade_level)) {
      return res.status(400).json({ error: 'term is required for SHS enrollment (first, second or third)' });
    }
    term = nt;
  }
  const dup = await q(
    `SELECT id FROM enrollments WHERE student_id = ? AND school_year = ? AND ${term ? 'term = ?' : 'term IS NULL'} AND id != ?`,
    term ? [row.student_id, row.school_year, term, row.id] : [row.student_id, row.school_year, row.id]);
  if (dup) return res.status(409).json({ error: 'Another enrollment already exists for this student, school year and term' });
  let checkedSubjectIds = null;
  if (b.subject_ids !== undefined) {
    const subChk = await validateSubjects(row.grade_level, b.subject_ids);
    if (!subChk.ok) return res.status(400).json({ error: subChk.error });
    checkedSubjectIds = subChk.ids;
  }
  const newStatus = b.status === undefined ? row.status : normStatus(b.status);
  if (newStatus === null) {
    return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
  }
  const isAral = bool(b.is_aral !== undefined ? b.is_aral : row.is_aral);
  try {
    await tx(async (conn) => {
      await conn.run('UPDATE enrollments SET section_id = ?, status = ?, strand = ?, term = ?, is_aral = ?, enrolled_at = ? WHERE id = ?',
        [f('section_id', row.section_id), newStatus, f('strand', row.strand), term, isAral, f('enrolled_at', row.enrolled_at), row.id]);
      if (b.subject_ids !== undefined) await saveSubjects(conn, row.id, checkedSubjectIds);
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return res.status(409).json({ error: 'Another enrollment already exists for this student, school year and term' });
    }
    throw e;
  }
  await audit(req, 'UPDATE_ENROLLMENT', 'enrollments', row.id, { status: b.status, term, is_aral: isAral });
  if (row.status !== 'enrolled' && newStatus === 'enrolled') {
    // Confirmation email/SMS to the learner's portal account holder.
    const stu = await q('SELECT user_id FROM students WHERE id = ?', [row.student_id]);
    if (stu && stu.user_id) {
      await notifyEvent('enrollment_approved', {
        user_id: stu.user_id,
        data: { school_year: row.school_year, grade_level: row.grade_level, section: '' },
      });
    }
  }
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
  // Trace-back: restore the student's grade_level/status from their most recent
  // remaining enrollment so a corrected deletion does not leave stale metadata.
  const prev = await q(
    'SELECT grade_level, status FROM enrollments WHERE student_id = ? ORDER BY school_year DESC, created_at DESC, id DESC LIMIT 1',
    [row.student_id]);
  if (prev) await qr('UPDATE students SET grade_level = ?, status = ? WHERE id = ?', [prev.grade_level, prev.status || 'enrolled', row.student_id]);
  await audit(req, 'DELETE_ENROLLMENT', 'enrollments', row.id);
  res.json({ ok: true });
}));

router.get('/recent', requireRole(...WRITE), asyncH(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 50);
  const rows = await qa(
    `SELECT e.id, e.student_id, e.school_year, e.grade_level, e.term, e.status, e.enrolled_at, e.created_at,
            st.last_name, st.first_name, st.lrn, s.name AS section_name
     FROM enrollments e
     JOIN students st ON st.id = e.student_id
     LEFT JOIN sections s ON s.id = e.section_id
     ORDER BY e.id DESC
     LIMIT ?`,
    [limit]);
  res.json({ data: rows });
}));

router.post('/import', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  const rows = Array.isArray(b.rows) ? b.rows : null;
  if (!rows || !rows.length) return res.status(400).json({ error: 'rows array is required' });

  const fallbackSy = b.school_year || '2026-2027';
  const fallbackTerm = b.term || null;
  let imported = 0;
  let enrolled = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 for 1-indexed + header
    try {
      const lrn = String(row.lrn || '').trim();
      const firstName = String(row.first_name || '').trim();
      const lastName = String(row.last_name || '').trim();
      if (!firstName || !lastName) {
        errors.push(`Row ${rowNum}: first name and last name are required`);
        skipped++; continue;
      }
      if (lrn && !/^\d{12}$/.test(lrn)) {
        errors.push(`Row ${rowNum}: LRN "${lrn}" must be exactly 12 digits`);
        skipped++; continue;
      }
      const middleName = String(row.middle_name || '').trim() || null;
      const suffix = String(row.suffix || '').trim() || null;
      const sex = String(row.sex || 'Male').trim();
      const birthDate = String(row.birth_date || '').trim() || null;
      const address = String(row.address || '').trim() || null;
      const guardianName = String(row.guardian_name || '').trim() || null;
      const guardianContact = String(row.guardian_contact || '').trim() || null;
      const gradeLevel = String(row.grade_level || '').trim() || null;
      const sectionName = String(row.section || '').trim() || null;
      const sy = String(row.school_year || '').trim() || fallbackSy;
      const trackStrand = String(row.track_strand || '').trim() || null;
      const term = normTerm(String(row.term || '').trim() || fallbackTerm);

      // --- Find or create student ---
      let student = lrn ? await q('SELECT * FROM students WHERE lrn = ?', [lrn]) : null;
      if (student) {
        // Update existing student
        const updates = [];
        const params = [];
        if (middleName != null) { updates.push('middle_name = ?'); params.push(middleName); }
        if (suffix != null) { updates.push('suffix = ?'); params.push(suffix); }
        if (sex) { updates.push('sex = ?'); params.push(sex); }
        if (birthDate) { updates.push('birth_date = ?'); params.push(birthDate); }
        if (address) { updates.push('address = ?'); params.push(address); }
        if (guardianName) { updates.push('guardian_name = ?'); params.push(guardianName); }
        if (guardianContact) { updates.push('guardian_contact = ?'); params.push(guardianContact); }
        if (trackStrand) { updates.push('track_strand = ?'); params.push(trackStrand); }
        if (gradeLevel) { updates.push('grade_level = ?'); params.push(gradeLevel); }
        if (updates.length) {
          params.push(student.id);
          await qr(`UPDATE students SET ${updates.join(', ')} WHERE id = ?`, params);
        }
      } else {
        // Create new student
        const finalLrn = lrn || await uniqueLrn();
        const newId = await qi(
          'INSERT INTO students (lrn, first_name, middle_name, last_name, suffix, sex, birth_date, address, guardian_name, guardian_contact, grade_level, track_strand, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [finalLrn, firstName, middleName, lastName, suffix, sex, birthDate, address, guardianName, guardianContact, gradeLevel, trackStrand, 'enrolled']
        );
        student = { id: newId };
      }
      imported++;

      // --- Find or create section ---
      if (sectionName && gradeLevel) {
        let section = await q('SELECT * FROM sections WHERE name = ? AND (school_year = ? OR school_year IS NULL)', [sectionName, sy]);
        if (!section) {
          const secId = await qi(
            'INSERT INTO sections (name, grade_level, school_year, strand, capacity) VALUES (?, ?, ?, ?, ?)',
            [sectionName, gradeLevel, sy, trackStrand, 40]
          );
          section = { id: secId, grade_level: gradeLevel, strand: trackStrand, school_year: sy, capacity: 40 };
        }

        // --- Create enrollment ---
        const termCol = isShs(gradeLevel) ? (term || 'first') : null;
        const existing = await q(
          `SELECT id FROM enrollments WHERE student_id = ? AND school_year = ? AND ${termCol ? 'term = ?' : 'term IS NULL'}`,
          termCol ? [student.id, sy, termCol] : [student.id, sy]
        );
        if (existing) { skipped++; continue; }

        // Check capacity
        const capacity = Number(section.capacity) || 40;
        if (capacity > 0) {
          const tally = await q(
            'SELECT COUNT(*) AS n FROM enrollments WHERE section_id = ? AND school_year = ? AND status = ?',
            [section.id, sy, 'enrolled']
          );
          if (Number(tally.n) >= capacity) {
            errors.push(`Row ${rowNum}: section "${sectionName}" is at full capacity (${capacity})`);
            skipped++; continue;
          }
        }

        const enrId = await qi(
          'INSERT INTO enrollments (student_id, section_id, school_year, grade_level, strand, term, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [student.id, section.id, sy, gradeLevel, section.strand || trackStrand || null, termCol, 'enrolled']
        );
        await qr('UPDATE students SET grade_level = ?, status = ? WHERE id = ?', [gradeLevel, 'enrolled', student.id]);

        // Auto-fill SHS subjects
        if (isShs(gradeLevel)) {
          const defaults = await defaultSubjectIds(gradeLevel, section.strand || trackStrand || null, termCol);
          if (defaults.length) {
            await saveSubjects(null, enrId, defaults);
          }
        }
        enrolled++;
      }
    } catch (e) {
      errors.push(`Row ${rowNum}: ${e.message}`);
      skipped++;
    }
  }

  await audit(req, 'ENROLL_IMPORT', 'enrollments', null, { imported, enrolled, skipped, errors: errors.length });
  res.json({ ok: true, imported, enrolled, skipped, errors: errors.slice(0, 30) });
}));

module.exports = router;
