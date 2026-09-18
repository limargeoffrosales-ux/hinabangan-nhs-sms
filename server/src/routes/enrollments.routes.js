const express = require('express');
const { q, qa, qi, qr, bool, tx } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');
const { ensureTeacherSeesSection, ensureTeacherSeesStudent } = require('../scope');

const router = express.Router();
router.use(authenticate);
const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
const ENROLL_WRITE = [...WRITE, 'teacher'];
const DOC_TYPES = ['psa_birth', 'form_138', 'good_moral', 'report_card', 'other'];
const TERMS = ['first', 'second', 'third'];
const STATUSES = ['pre_registered', 'pending', 'provisional', 'conditional', 'enrolled'];
const isShs = (g) => /^Grade 1[12]$/.test(String(g || ''));

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
  for (const sid of ids) {
    await c.runId('INSERT INTO enrollment_subjects (enrollment_id, subject_id) VALUES (?, ?)', [enrollmentId, sid]);
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
  const row = await q('SELECT id FROM enrollments WHERE id = ?', [id]);
  if (!row) return res.status(404).json({ error: 'Enrollment not found' });
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
  const csvText = String(b.csv || '').trim();
  if (!csvText) return res.status(400).json({ error: 'CSV data is required' });
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) return res.status(400).json({ error: 'CSV must have a header row and at least one data row' });
  const header = lines[0].toLowerCase().split(',').map(h => h.trim());
  const lrnIdx = header.findIndex(h => h === 'lrn');
  const sectionIdx = header.findIndex(h => h === 'section_name' || h === 'section');
  const syIdx = header.findIndex(h => h === 'school_year');
  const glIdx = header.findIndex(h => h === 'grade_level' || h === 'grade');
  const termIdx = header.findIndex(h => h === 'term');
  if (lrnIdx === -1 || sectionIdx === -1) {
    return res.status(400).json({ error: 'CSV must have lrn and section_name columns' });
  }
  const fallbackSy = b.school_year || '2026-2027';
  let imported = 0;
  let skipped = 0;
  let subjectsAuto = 0;
  const errors = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const lrn = cols[lrnIdx];
    const sectionName = cols[sectionIdx];
    const sy = (syIdx >= 0 && cols[syIdx]) ? cols[syIdx] : fallbackSy;
    const gl = glIdx >= 0 ? cols[glIdx] : null;
    const term = normTerm((termIdx >= 0 && cols[termIdx]) ? cols[termIdx] : (b.term !== undefined ? b.term : null));
    if (!lrn || !sectionName) { skipped++; continue; }
    try {
      const student = await q('SELECT id FROM students WHERE lrn = ?', [lrn]);
      if (!student) { errors.push(`Row ${i + 1}: student LRN ${lrn} not found`); skipped++; continue; }
      const section = await q('SELECT id, grade_level, strand, school_year, capacity FROM sections WHERE name = ? AND (school_year = ? OR school_year IS NULL)', [sectionName, sy]);
      if (!section) { errors.push(`Row ${i + 1}: section "${sectionName}" not found`); skipped++; continue; }
      const gradeLevel = gl || section.grade_level;
      if (section.grade_level && gradeLevel !== section.grade_level) {
        errors.push(`Row ${i + 1}: grade_level "${gradeLevel}" does not match section "${sectionName}" (${section.grade_level})`);
        skipped++; continue;
      }
      if (isShs(gradeLevel) && !term) {
        errors.push(`Row ${i + 1}: LRN ${lrn} is SHS but has no valid term (first, second or third) — add a term column or set a default term`);
        skipped++; continue;
      }
      if (section.school_year && section.school_year !== sy) {
        errors.push(`Row ${i + 1}: section "${sectionName}" belongs to ${section.school_year}, not ${sy}`);
        skipped++; continue;
      }
      const existing = await q(
        `SELECT id FROM enrollments WHERE student_id = ? AND school_year = ? AND ${term ? 'term = ?' : 'term IS NULL'}`,
        term ? [student.id, sy, term] : [student.id, sy]);
      if (existing) { skipped++; continue; }
      const capacity = Number(section.capacity) || 40;
      if (capacity > 0) {
        const tally = await q(
          'SELECT COUNT(*) AS n FROM enrollments WHERE section_id = ? AND school_year = ? AND status = ?',
          [section.id, sy, 'enrolled']);
        if (Number(tally.n) >= capacity) {
          errors.push(`Row ${i + 1}: section "${sectionName}" is at full capacity (${capacity})`);
          skipped++; continue;
        }
      }
      const enrId = await qi(
        'INSERT INTO enrollments (student_id, section_id, school_year, grade_level, strand, term, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [student.id, section.id, sy, gradeLevel, section.strand || null, term, 'enrolled']
      );
      await qr('UPDATE students SET grade_level = ?, status = ? WHERE id = ?', [gradeLevel, 'enrolled', student.id]);
      // Auto-fill the standard subject set for SHS learners so a bulk paste
      // never produces subject-less enrollment records.
      if (isShs(gradeLevel)) {
        const defaults = await defaultSubjectIds(gradeLevel, section.strand || null, term);
        if (defaults.length) {
          await saveSubjects(null, enrId, defaults);
          subjectsAuto += defaults.length;
        }
      }
      imported++;
    } catch (e) {
      errors.push(`Row ${i + 1}: ${e.message}`);
      skipped++;
    }
  }
  await audit(req, 'ENROLL_IMPORT', 'enrollments', null, { imported, skipped, errors: errors.length, subjects_auto: subjectsAuto });
  res.json({ ok: true, imported, skipped, subjects_auto: subjectsAuto, errors: errors.slice(0, 20) });
}));

module.exports = router;
