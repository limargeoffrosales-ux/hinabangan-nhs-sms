const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const { q, qa, qi, qr, bool } = require('../db');
const db = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, auditWithDiff, page, logAccess, maskPII, softDelete, restoreDeleted } = require('../utils');
const { teacherScope, studentInScope, ensureTeacherSeesStudent } = require('../scope');
const { getCurrentSchoolYear } = require('../schoolYear');
const { notifyEvent } = require('../notify');
const { APP_URL } = require('../config');
const { sendSpreadsheet } = require('../export');

const router = express.Router();
router.use(authenticate);

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
const ACCOUNT_ROLES = ['super_admin', 'school_admin'];
// Self-registered student accounts are ALWAYS decided by the super admin.
const LINK_APPROVE_ROLES = ['super_admin'];

async function normalizeLrn(raw, excludeId) {
  if (!raw || !String(raw).trim()) return null;
  const lrn = String(raw).trim();
  if (!/^\d{12}$/.test(lrn)) {
    const err = new Error('LRN must be exactly 12 digits');
    err.status = 400;
    throw err;
  }
  const dup = await q('SELECT id FROM students WHERE lrn = ?', [lrn]);
  if (dup && String(dup.id) !== String(excludeId || '')) {
    const err = new Error('LRN already in use by another student');
    err.status = 409;
    throw err;
  }
  return lrn;
}

async function uniqueLrn() {
  for (let i = 0; i < 20; i++) {
    const lrn = String(1 + Math.floor(Math.random() * 9)) +
      String(Math.floor(Math.random() * 1e11)).padStart(11, '0');
    const exists = await q('SELECT id FROM students WHERE lrn = ?', [lrn]);
    if (!exists) return lrn;
  }
  throw new Error('Could not allocate a unique LRN');
}

router.get('/', requireRole(...WRITE, 'teacher', 'guidance'), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const q2 = req.query.q ? `%${req.query.q}%` : '%';
  const gradeLevel = req.query.grade_level ? req.query.grade_level : null;
  // "Has subjects this year" is the signal Enroll uses to tell enrolled vs
  // not-yet-enrolled learners apart. Scope it to the current school year so a
  // returner whose subjects belong to a past year is still enrollable.
  const sy = await getCurrentSchoolYear();
  const subjectCountSql = (stuAlias) =>
    `(SELECT COUNT(*) FROM enrollment_subjects es JOIN enrollments en ON en.id = es.enrollment_id
      WHERE en.student_id = ${stuAlias}.id AND en.school_year = ?)`;
  if (req.query.sort === 'recent_enrolled') {
    // Recency-order: learners with the most recent enrollment first, newest
    // sign-up next, then name as a tie-breaker. Uses an aggregate subquery so
    // one student with several enrollments only counts once.
    const params = [sy, q2, q2, q2];
    let sql = `SELECT st.id, st.lrn, st.first_name, st.middle_name, st.last_name, st.suffix, st.sex, st.birth_date, st.religion, st.address, st.contact, st.guardian_name, st.guardian_contact, st.guardian_relation, st.grade_level, st.track_strand, st.status, st.photo_url,
      ${subjectCountSql('st')} AS subject_count
      FROM students st
      LEFT JOIN (SELECT student_id, MAX(COALESCE(enrolled_at, created_at)) AS last_enrolled_at FROM enrollments GROUP BY student_id) e ON e.student_id = st.id
      WHERE (st.last_name LIKE ? OR st.first_name LIKE ? OR st.lrn LIKE ?)`;
    if (req.role === 'teacher') {
      const scope = await teacherScope(req.user);
      const f = studentInScope(scope, 'st');
      if (!f.sql) return res.json({ data: [], limit, offset });
      sql += ' AND ' + f.sql;
      params.push(...f.params);
    }
    if (gradeLevel) {
      sql += ' AND st.grade_level = ?';
      params.push(gradeLevel);
    }
    sql += ' ORDER BY e.last_enrolled_at DESC NULLS LAST, st.last_name, st.first_name LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = await qa(sql, params);
    for (const r of rows) r.has_subjects = bool(r.subject_count) > 0;
    if (req.role === 'teacher' || req.role === 'guidance') {
      rows.forEach((r, i, arr) => { arr[i] = maskPII(r, ['contact', 'guardian_contact', 'guardian_name', 'guardian_relation', 'address', 'birth_place', 'religion']); });
    }
    return res.json({ data: rows, limit, offset });
  }
  const params = [sy, q2, q2, q2];
  let sql = `SELECT id, lrn, first_name, middle_name, last_name, suffix, sex, birth_date, religion, address, contact, guardian_name, guardian_contact, guardian_relation, grade_level, track_strand, status, photo_url, ${subjectCountSql('students')} AS subject_count
     FROM students WHERE (last_name LIKE ? OR first_name LIKE ? OR lrn LIKE ?)`;
  if (req.role === 'teacher') {
    const scope = await teacherScope(req.user);
    const f = studentInScope(scope, 'students');
    if (!f.sql) return res.json({ data: [], limit, offset });
    sql += ' AND ' + f.sql;
    params.push(...f.params);
  }
  if (gradeLevel) {
    sql += ' AND grade_level = ?';
    params.push(gradeLevel);
  }
  sql += ' ORDER BY last_name, first_name LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const rows = await qa(sql, params);
  for (const r of rows) r.has_subjects = bool(r.subject_count) > 0;
  if (req.role === 'teacher' || req.role === 'guidance') {
    rows.forEach((r, i, arr) => { arr[i] = maskPII(r, ['contact', 'guardian_contact', 'guardian_name', 'guardian_relation', 'address', 'birth_place', 'religion']); });
  }
  res.json({ data: rows, limit, offset });
}));

// GET /export — same filters as the list endpoint but without pagination; the
// result downloads as .xlsx (default) or .csv. Registered before /:id so the
// literal "/export" path wins.
router.get('/export', requireRole(...WRITE, 'teacher', 'guidance'), asyncH(async (req, res) => {
  const q2 = req.query.q ? `%${req.query.q}%` : '%';
  const gradeLevel = req.query.grade_level ? req.query.grade_level : null;
  const sy = await getCurrentSchoolYear();
  const subjectCountSql = (stuAlias) =>
    `(SELECT COUNT(*) FROM enrollment_subjects es JOIN enrollments en ON en.id = es.enrollment_id
      WHERE en.student_id = ${stuAlias}.id AND en.school_year = ?)`;
  const params = [sy, q2, q2, q2];
  let sql = `SELECT st.lrn, st.first_name, st.middle_name, st.last_name, st.suffix, st.sex, st.birth_date,
      st.religion, st.address, st.contact, st.guardian_name, st.guardian_contact, st.guardian_relation,
      st.grade_level, st.track_strand, st.status, ${subjectCountSql('st')} AS subject_count
      FROM students st WHERE (st.last_name LIKE ? OR st.first_name LIKE ? OR st.lrn LIKE ?)`;
  if (req.role === 'teacher') {
    const scope = await teacherScope(req.user);
    const f = studentInScope(scope, 'st');
    if (!f.sql) return res.status(403).json({ error: 'No students are in your scope' });
    sql += ' AND ' + f.sql;
    params.push(...f.params);
  }
  if (gradeLevel) {
    sql += ' AND st.grade_level = ?';
    params.push(gradeLevel);
  }
  sql += ' ORDER BY st.last_name, st.first_name';
  const rows = await qa(sql, params);
  for (const r of rows) {
    r.age = computeAge(r.birth_date);
    r.subject_count = bool(r.subject_count) > 0 ? Number(r.subject_count) : 0;
  }
  if (req.role === 'teacher' || req.role === 'guidance') {
    // maskPII is pure — it returns a NEW object, so the result must be
    // assigned back. A bare forEach call silently exported unmasked PII.
    for (let i = 0; i < rows.length; i++) {
      rows[i] = maskPII(rows[i], ['contact', 'guardian_contact', 'guardian_name', 'guardian_relation', 'address', 'religion']);
    }
  }
  const columns = [
    { key: 'lrn', header: 'LRN', width: 16 },
    { key: 'last_name', header: 'Last Name', width: 18 },
    { key: 'first_name', header: 'First Name', width: 18 },
    { key: 'middle_name', header: 'Middle Name', width: 16 },
    { key: 'suffix', header: 'Suffix', width: 8 },
    { key: 'sex', header: 'Sex', width: 6 },
    { key: 'birth_date', header: 'Birth Date', width: 12 },
    { key: 'age', header: 'Age', width: 6 },
    { key: 'grade_level', header: 'Grade Level', width: 10 },
    { key: 'track_strand', header: 'Track/Strand', width: 14 },
    { key: 'status', header: 'Status', width: 10 },
    { key: 'subject_count', header: 'Subjects This SY', width: 12 },
    { key: 'religion', header: 'Religion', width: 14 },
    { key: 'address', header: 'Address', width: 30 },
    { key: 'contact', header: 'Contact No.', width: 16 },
    { key: 'guardian_name', header: 'Guardian', width: 22 },
    { key: 'guardian_contact', header: 'Guardian Contact', width: 16 },
  ];
  const format = String(req.query.format || 'xlsx');
  const fname = `students${gradeLevel ? `-grade-${gradeLevel}` : ''}`;
  await sendSpreadsheet(res, format, { columns, rows, sheetName: 'Students', filename: fname });
}));

function computeAge(birthdate) {
  if (!birthdate) return null;
  const birth = new Date(birthdate + 'T00:00:00');
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// --- Self-registration approval --------------------------------------------------
// Students create their own portal logins (POST /auth/register); the learner
// link only ACTIVATES once a registrar/school_admin approves the request here.
// Registered BEFORE GET /:id so the literal "/link-requests" path wins.

router.get('/link-requests', requireRole(...LINK_APPROVE_ROLES), asyncH(async (req, res) => {
  const status = String(req.query.status || '').trim();
  const params = [];
  let where = '';
  if (status === 'pending' || status === 'approved' || status === 'rejected') {
    where = 'WHERE r.status = ?';
    params.push(status);
  }
  const rows = await qa(
    `SELECT r.id, r.student_id, r.user_id, r.status, r.verified, r.email, r.phone, r.notes, r.created_at,
            st.lrn, st.first_name, st.middle_name, st.last_name, st.sex, st.birth_date, st.grade_level, st.track_strand,
            u.username, u.name AS user_name
     FROM student_link_requests r
     JOIN students st ON st.id = r.student_id
     JOIN users u ON u.id = r.user_id
     ${where}
     ORDER BY (r.status = 'pending') DESC, r.created_at DESC
     LIMIT 200`,
    params);
  res.json({ data: rows });
}));

router.post('/link-requests/:id/approve', requireRole(...LINK_APPROVE_ROLES), asyncH(async (req, res) => {
  const reqRow = await q('SELECT * FROM student_link_requests WHERE id = ?', [req.params.id]);
  if (!reqRow) return res.status(404).json({ error: 'Request not found' });
  if (reqRow.status !== 'pending') return res.status(409).json({ error: 'This request was already decided' });
  const student = await q('SELECT id, lrn, user_id FROM students WHERE id = ?', [reqRow.student_id]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (student.user_id) return res.status(409).json({ error: 'This learner is already linked to a portal account' });
  const u = await q('SELECT id, role, status FROM users WHERE id = ?', [reqRow.user_id]);
  if (!u) return res.status(404).json({ error: 'The applicant account no longer exists' });
if (u.role !== 'student') return res.status(400).json({ error: 'The applicant is not a student-role account' });
    // Self-registration creates the account as 'pending' so it cannot be used
    // before review. A request whose account is still 'active' is a legacy row
    // from before that change; anything else (suspended/expired) must not be
    // silently reactivated by an approval.
    if (!['pending', 'active'].includes(u.status)) {
      return res.status(400).json({ error: `The applicant account is not approvable (status: ${u.status})` });
    }

  await db.tx(async (conn) => {
    await conn.qr('UPDATE students SET user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [reqRow.user_id, student.id]);
    await conn.qr("UPDATE student_link_requests SET status = 'approved', decided_by = ?, decided_at = CURRENT_TIMESTAMP WHERE id = ?", [req.user.id, reqRow.id]);
    // Activate the account in the SAME transaction as the link, so a failure can
    // never leave an approved learner whose portal login still says pending.
    await conn.qr("UPDATE users SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [reqRow.user_id]);
  });
  await audit(req, 'STUDENT_LINK_APPROVE', 'students', student.id, { request_id: reqRow.id, user_id: reqRow.user_id });
  await notifyEvent('link_approved', { user_id: reqRow.user_id, data: { url: APP_URL ? APP_URL.replace(/\/+$/, '') : '' } });
  res.json({ ok: true });
}));

router.post('/link-requests/:id/reject', requireRole(...LINK_APPROVE_ROLES), asyncH(async (req, res) => {
  const reqRow = await q('SELECT * FROM student_link_requests WHERE id = ?', [req.params.id]);
  if (!reqRow) return res.status(404).json({ error: 'Request not found' });
  if (reqRow.status !== 'pending') return res.status(409).json({ error: 'This request was already decided' });
  const note = String((req.body && req.body.note) || '').trim().slice(0, 500) || null;
  await qr("UPDATE student_link_requests SET status = 'rejected', notes = ?, decided_by = ?, decided_at = CURRENT_TIMESTAMP WHERE id = ?",
    [note, req.user.id, reqRow.id]);
  await audit(req, 'STUDENT_LINK_REJECT', 'students', reqRow.student_id, { request_id: reqRow.id, user_id: reqRow.user_id, note });
  await notifyEvent('link_rejected', { user_id: reqRow.user_id, data: { url: APP_URL ? APP_URL.replace(/\/+$/, '') : '', note: note ? ` (${note})` : '' } });
  res.json({ ok: true });
}));

router.get('/:id', requireRole(...WRITE, 'teacher', 'guidance'), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM students WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Student not found' });
  if (req.role === 'teacher') {
    const chk = await ensureTeacherSeesStudent(req.user, row.id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }
  logAccess(req, row.id);
  row.enrollments = await qa('SELECT e.*, s.name AS section_name FROM enrollments e LEFT JOIN sections s ON s.id = e.section_id WHERE e.student_id = ? ORDER BY e.school_year DESC', [row.id]);
  row.age = computeAge(row.birth_date);
  if (req.role === 'teacher' || req.role === 'guidance') {
    return res.json(maskPII(row, ['contact', 'guardian_contact', 'guardian_name', 'guardian_relation', 'address', 'birth_place', 'religion']));
  }
  res.json(row);
}));

router.post('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.first_name || !b.last_name || !b.sex || !b.grade_level) {
    return res.status(400).json({ error: 'first_name, last_name, sex, grade_level are required' });
  }
  const lrn = await normalizeLrn(b.lrn) || await uniqueLrn();
  const id = await qi(
    'INSERT INTO students (lrn, first_name, middle_name, last_name, suffix, sex, birth_date, birth_place, religion, address, contact, guardian_name, guardian_contact, guardian_relation, father_name, mother_name, mother_tongue, learner_status, learner_type, remarks, grade_level, track_strand, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [lrn, b.first_name, b.middle_name || null, b.last_name, b.suffix || null, b.sex, b.birth_date || null,
      b.birth_place || null, b.religion || null, b.address || null, b.contact || null,
      b.guardian_name || null, b.guardian_contact || null, b.guardian_relation || null,
      b.father_name || null, b.mother_name || null, b.mother_tongue || null,
      b.learner_status || null, b.learner_type || null, b.remarks || null,
      b.grade_level, b.track_strand || null, b.status || 'enrolled']);
  await audit(req, 'CREATE_STUDENT', 'students', id, { lrn, name: `${b.last_name}, ${b.first_name}` });
  res.status(201).json({ id, lrn });
}));

router.patch('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM students WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Student not found' });
  const b = req.body || {};
  if (b.lrn !== undefined) await normalizeLrn(b.lrn, row.id);
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  const oldRow = { ...row };
  await qr(
    'UPDATE students SET lrn = ?, first_name = ?, middle_name = ?, last_name = ?, suffix = ?, sex = ?, birth_date = ?, birth_place = ?, religion = ?, address = ?, contact = ?, guardian_name = ?, guardian_contact = ?, guardian_relation = ?, father_name = ?, mother_name = ?, mother_tongue = ?, learner_status = ?, learner_type = ?, remarks = ?, grade_level = ?, track_strand = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [f('lrn', row.lrn), f('first_name', row.first_name), f('middle_name', row.middle_name), f('last_name', row.last_name),
      f('suffix', row.suffix), f('sex', row.sex), f('birth_date', row.birth_date), f('birth_place', row.birth_place),
      f('religion', row.religion), f('address', row.address), f('contact', row.contact),
      f('guardian_name', row.guardian_name), f('guardian_contact', row.guardian_contact),
      f('guardian_relation', row.guardian_relation), f('father_name', row.father_name),
      f('mother_name', row.mother_name), f('mother_tongue', row.mother_tongue),
      f('learner_status', row.learner_status), f('learner_type', row.learner_type), f('remarks', row.remarks),
      f('grade_level', row.grade_level),
      f('track_strand', row.track_strand), f('status', row.status), row.id]);
  const newRow = await q('SELECT * FROM students WHERE id = ?', [row.id]);
  await auditWithDiff(req, 'UPDATE_STUDENT', 'students', row.id, oldRow, newRow, { lrn: row.lrn });
  res.json({ ok: true });
}));

router.delete('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT id, lrn FROM students WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Student not found' });
  const ok = await softDelete('students', row.id, req.user.id);
  if (!ok) return res.status(409).json({ error: 'Already deleted' });
  await audit(req, 'DELETE_STUDENT', 'students', row.id, { lrn: row.lrn });
  res.json({ ok: true, softDeleted: true });
}));

// Restore a soft-deleted student (recycle bin)
router.post('/:id/restore', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT id, lrn FROM students WHERE id = ? AND deleted_at IS NOT NULL', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Deleted student not found' });
  const ok = await restoreDeleted('students', row.id);
  if (!ok) return res.status(409).json({ error: 'Not deleted or already restored' });
  await audit(req, 'RESTORE_STUDENT', 'students', row.id, { lrn: row.lrn });
  res.json({ ok: true });
}));

// --- Portal account linking -------------------------------------------------

router.get('/:id/accounts', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT id, lrn, user_id FROM students WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Student not found' });
  const studentAccount = row.user_id
    ? await q('SELECT id, username, name, role, status FROM users WHERE id = ?', [row.user_id])
    : null;
  const parents = await qa(
    `SELECT ps.student_id, ps.relation, u.id AS user_id, u.username, u.name, u.status
     FROM parent_students ps JOIN users u ON u.id = ps.parent_user_id
     WHERE ps.student_id = ? ORDER BY u.name`,
    [row.id]);
  res.json({ student_account: studentAccount, parents });
}));

// PUT /:id/account { user_id } — link (or unlink with null) a student-role login.
router.put('/:id/account', requireRole(...ACCOUNT_ROLES), asyncH(async (req, res) => {
  const row = await q('SELECT id, lrn FROM students WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Student not found' });
  const raw = req.body && req.body.user_id;
  const userId = raw === undefined || raw === null || raw === '' ? null : Number(raw);
  if (userId) {
    const u = await q('SELECT id, role, status FROM users WHERE id = ?', [userId]);
    if (!u) return res.status(400).json({ error: 'User not found' });
    if (u.role !== 'student') return res.status(400).json({ error: 'Only student-role accounts can be the student portal login' });
    if (u.status !== 'active') return res.status(400).json({ error: 'The account is not active' });
    const taken = await q('SELECT id FROM students WHERE user_id = ? AND id != ?', [userId, row.id]);
    if (taken) return res.status(400).json({ error: 'That account is already linked to another student' });
  }
  await qr('UPDATE students SET user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [userId, row.id]);
  await audit(req, 'STUDENT_ACCOUNT_LINK', 'students', row.id, { user_id: userId });
  res.json({ ok: true, user_id: userId });
}));

// POST /:id/parents { user_id, relation } — link a parent-role login to this student.
router.post('/:id/parents', requireRole(...ACCOUNT_ROLES), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM students WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Student not found' });
  const userId = Number(req.body && req.body.user_id);
  if (!userId) return res.status(400).json({ error: 'user_id is required' });
  const relation = String((req.body && req.body.relation) || 'Parent').trim().slice(0, 60) || 'Parent';
  const u = await q('SELECT id, role, status FROM users WHERE id = ?', [userId]);
  if (!u) return res.status(400).json({ error: 'User not found' });
  if (u.role !== 'parent') return res.status(400).json({ error: 'Only parent-role accounts can be linked as guardians' });
  if (u.status !== 'active') return res.status(400).json({ error: 'The account is not active' });
  const exists = await q('SELECT id FROM parent_students WHERE parent_user_id = ? AND student_id = ?', [userId, row.id]);
  if (exists) return res.status(400).json({ error: 'This parent is already linked to the student' });
  const id = await qi('INSERT INTO parent_students (parent_user_id, student_id, relation) VALUES (?, ?, ?)', [userId, row.id, relation]);
  await audit(req, 'STUDENT_PARENT_LINK', 'students', row.id, { parent_user_id: userId, relation });
  res.status(201).json({ id, relation });
}));

// DELETE /:id/parents/:parentUserId — remove a parent link.
router.delete('/:id/parents/:parentUserId', requireRole(...ACCOUNT_ROLES), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM students WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Student not found' });
  await qr('DELETE FROM parent_students WHERE parent_user_id = ? AND student_id = ?', [Number(req.params.parentUserId), row.id]);
  await audit(req, 'STUDENT_PARENT_UNLINK', 'students', row.id, { parent_user_id: Number(req.params.parentUserId) });
  res.json({ ok: true });
}));

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// POST /upload-sf1 — Direct DepEd LIS SF1 Excel/CSV file upload & student registration
router.post('/upload-sf1', requireRole(...WRITE, 'teacher'), uploadMemory.single('file'), asyncH(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No Excel or CSV file uploaded' });

  const workbook = new ExcelJS.Workbook();
  let worksheet;

  try {
    if (req.file.originalname.toLowerCase().endsWith('.csv')) {
      const stream = require('stream');
      const bufferStream = new stream.PassThrough();
      bufferStream.end(req.file.buffer);
      worksheet = await workbook.csv.read(bufferStream);
    } else {
      await workbook.xlsx.load(req.file.buffer);
      worksheet = workbook.worksheets[0];
    }
  } catch (err) {
    return res.status(400).json({ error: 'Failed to parse Excel/CSV file: ' + err.message });
  }

  if (!worksheet) return res.status(400).json({ error: 'Worksheet is empty' });

  let headerRowIdx = -1;
  let colMap = { lrn: -1, name: -1, sex: -1, birthdate: -1, address: -1, guardian: -1, contact: -1 };

  worksheet.eachRow((row, rowNumber) => {
    if (headerRowIdx !== -1) return;
    const values = row.values || [];
    for (let c = 1; c < values.length; c++) {
      const val = String(values[c] || '').toUpperCase().trim();
      if (val.includes('LRN') || val.includes('LEARNER')) {
        headerRowIdx = rowNumber;
        break;
      }
    }
  });

  if (headerRowIdx === -1) headerRowIdx = 1;

  const headerValues = worksheet.getRow(headerRowIdx).values || [];
  for (let c = 1; c < headerValues.length; c++) {
    const val = String(headerValues[c] || '').toUpperCase().trim();
    if (val.includes('LRN')) colMap.lrn = c;
    else if (val.includes('NAME') || val.includes('LEARNER')) colMap.name = c;
    else if (val.includes('SEX') || val.includes('GENDER')) colMap.sex = c;
    else if (val.includes('BIRTH') || val.includes('DOB')) colMap.birthdate = c;
    else if (val.includes('ADDRESS') || val.includes('BARANGAY') || val.includes('STREET')) colMap.address = c;
    else if (val.includes('GUARDIAN') || val.includes('PARENT')) colMap.guardian = c;
    else if (val.includes('CONTACT') || val.includes('MOBILE') || val.includes('TEL')) colMap.contact = c;
  }

  if (colMap.lrn === -1) colMap.lrn = 1;
  if (colMap.name === -1) colMap.name = 2;
  if (colMap.sex === -1) colMap.sex = 3;
  if (colMap.birthdate === -1) colMap.birthdate = 4;

  const sectionId = req.query.section_id || req.body.section_id || null;
  const activeSy = await getCurrentSchoolYear();

  let createdCount = 0;
  let updatedCount = 0;
  let errors = [];
  const rowPromises = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIdx) return;
    const vals = row.values || [];

    let rawLrn = vals[colMap.lrn];
    if (typeof rawLrn === 'object' && rawLrn && rawLrn.result) rawLrn = rawLrn.result;
    const lrnStr = String(rawLrn || '').replace(/\D/g, '');
    if (!lrnStr || lrnStr.length < 10) return;

    let rawName = String(vals[colMap.name] || '').trim();
    if (typeof vals[colMap.name] === 'object' && vals[colMap.name]?.result) {
      rawName = String(vals[colMap.name].result).trim();
    }
    if (!rawName) return;

    let lastName = '';
    let firstName = '';
    let middleName = '';

    if (rawName.includes(',')) {
      const parts = rawName.split(',');
      lastName = parts[0].trim();
      const given = (parts[1] || '').trim().split(' ');
      firstName = given[0] || 'Learner';
      middleName = given.slice(1).join(' ') || '';
    } else {
      const parts = rawName.split(' ');
      firstName = parts[0] || 'Learner';
      lastName = parts.slice(1).join(' ') || 'Student';
    }

    let rawSex = String(vals[colMap.sex] || '').toUpperCase().trim();
    let sex = rawSex.startsWith('M') ? 'Male' : (rawSex.startsWith('F') ? 'Female' : 'Male');

    let rawDob = vals[colMap.birthdate];
    let birthDate = null;
    if (rawDob instanceof Date) {
      birthDate = rawDob.toISOString().split('T')[0];
    } else if (rawDob) {
      birthDate = String(rawDob).trim();
    }

    const address = colMap.address !== -1 ? String(vals[colMap.address] || '').trim() || null : null;
    const guardianName = colMap.guardian !== -1 ? String(vals[colMap.guardian] || '').trim() || null : null;
    const guardianContact = colMap.contact !== -1 ? String(vals[colMap.contact] || '').trim() || null : null;

    rowPromises.push((async () => {
      try {
        const existing = await q('SELECT id FROM students WHERE lrn = ?', [lrnStr]);
        let studentId;

        if (existing) {
          studentId = existing.id;
          await qr(
            `UPDATE students SET first_name = ?, middle_name = ?, last_name = ?, sex = ?,
                    birth_date = COALESCE(?, birth_date), address = COALESCE(?, address),
                    guardian_name = COALESCE(?, guardian_name), guardian_contact = COALESCE(?, guardian_contact)
             WHERE id = ?`,
            [firstName, middleName, lastName, sex, birthDate, address, guardianName, guardianContact, studentId]
          );
          updatedCount++;
        } else {
          studentId = await qi(
            `INSERT INTO students (lrn, first_name, middle_name, last_name, sex, birth_date, address, guardian_name, guardian_contact, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
            [lrnStr, firstName, middleName, lastName, sex, birthDate, address, guardianName, guardianContact]
          );
          createdCount++;
        }

        if (sectionId && studentId) {
          const enExists = await q('SELECT id FROM enrollments WHERE student_id = ? AND school_year = ?', [studentId, activeSy]);
          if (!enExists) {
            await qi(
              `INSERT INTO enrollments (student_id, section_id, school_year, status) VALUES (?, ?, ?, 'enrolled')`,
              [studentId, Number(sectionId), activeSy]
            );
          }
        }
      } catch (e) {
        errors.push(`Row ${rowNumber} (LRN ${lrnStr}): ${e.message}`);
      }
    })());
  });

  await Promise.all(rowPromises);

  await audit(req, 'UPLOAD_SF1_IMPORT', 'students', null, { createdCount, updatedCount, section_id: sectionId });
  res.json({ success: true, created: createdCount, updated: updatedCount, totalProcessed: createdCount + updatedCount, errors });
}));

module.exports = router;
