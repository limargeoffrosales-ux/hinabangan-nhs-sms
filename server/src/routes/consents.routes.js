const express = require('express');
const db = require('../db');
const { q, qa, qi, qr, nowSql } = db;
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');

const router = express.Router();
router.use(authenticate);

const ADMIN = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
const FORM_TYPES = ['custom', 'data_privacy', 'photo_video', 'ai_usage'];
// Forms that grant rights over a MINOR's data/image must be tied to a single
// student, signed by that student's parent/guardian (or recorded by the school).
const STUDENT_BOUND_TYPES = ['data_privacy', 'photo_video'];
// These roles may record a consent on behalf of a student (e.g. paper consent
// collected at enrollment, encoded by the registrar).
const RECORD_ROLES = ADMIN;

function isAdult(birthDate) {
  if (!birthDate) return false;
  const b = new Date(String(birthDate).slice(0, 10));
  if (isNaN(b.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 18;
}

const STUDENT_SELECT = 'SELECT id, lrn, first_name, last_name FROM students';

// Students this account may validly sign for (parents -> their linked children,
// student accounts -> themselves). Staff get none (they acknowledge as individuals).
async function eligibleStudents(user) {
  if (user.role === 'parent') {
    return (await qa(
      `SELECT s.id, s.lrn, s.first_name, s.last_name
       FROM parent_students ps JOIN students s ON s.id = ps.student_id
       WHERE ps.parent_user_id = ? ORDER BY s.last_name, s.first_name`, [user.id]))
      .map((s) => ({ id: Number(s.id), name: [s.first_name, s.last_name].filter(Boolean).join(' '), lrn: s.lrn }));
  }
  if (user.role === 'student') {
    return (await qa(`${STUDENT_SELECT} WHERE user_id = ?`, [user.id]))
      .map((s) => ({ id: Number(s.id), name: [s.first_name, s.last_name].filter(Boolean).join(' '), lrn: s.lrn }));
  }
  return [];
}

const formListBase = `SELECT cf.*,
      (SELECT COUNT(*) FROM consent_responses cr WHERE cr.form_id = cf.id) AS response_count,
      (SELECT COUNT(*) FROM consent_responses cr2 WHERE cr2.form_id = cf.id AND cr2.user_id = ?) AS signed_by_me
     FROM consent_forms cf`;

router.get('/forms', asyncH(async (req, res) => {
  const rows = await qa(formListBase + ' ORDER BY cf.created_at DESC', [req.user.id]);
  const myStudents = await eligibleStudents(req.user);
  res.json({ data: rows.map((r) => ({ ...r, response_count: Number(r.response_count), signed_by_me: Number(r.signed_by_me), eligible_students: myStudents })) });
}));

router.get('/forms/active', asyncH(async (req, res) => {
  const rows = await qa(formListBase + ' WHERE cf.is_active = TRUE ORDER BY cf.created_at DESC', [req.user.id]);
  const myStudents = await eligibleStudents(req.user);
  res.json({ data: rows.map((r) => ({ ...r, response_count: Number(r.response_count), signed_by_me: Number(r.signed_by_me), eligible_students: myStudents })) });
}));

router.post('/forms', requireRole(...ADMIN), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.title || !String(b.title).trim()) return res.status(400).json({ error: 'title is required' });
  if (!b.content || !String(b.content).trim()) return res.status(400).json({ error: 'content is required' });
  if (b.form_type !== undefined && !FORM_TYPES.includes(b.form_type)) return res.status(400).json({ error: 'invalid form_type' });
  const id = await qi(
    'INSERT INTO consent_forms (title, description, content, form_type, is_active, require_sign, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      String(b.title).trim(),
      b.description || null,
      String(b.content).trim(),
      b.form_type || 'custom',
      b.is_active !== undefined ? !!b.is_active : true,
      b.require_sign !== undefined ? !!b.require_sign : true,
      req.user.id,
    ]);
  await audit(req, 'CONSENT_FORM_CREATE', 'consent_forms', id, { title: b.title });
  res.status(201).json({ id });
}));

router.patch('/forms/:id', requireRole(...ADMIN), asyncH(async (req, res) => {
  const existing = await q('SELECT * FROM consent_forms WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Form not found' });
  const b = req.body || {};
  if (b.title !== undefined && !String(b.title).trim()) return res.status(400).json({ error: 'title is required' });
  if (b.content !== undefined && !String(b.content).trim()) return res.status(400).json({ error: 'content is required' });
  if (b.form_type !== undefined && !FORM_TYPES.includes(b.form_type)) return res.status(400).json({ error: 'invalid form_type' });
  const title = b.title !== undefined ? String(b.title).trim() : existing.title;
  const description = b.description !== undefined ? b.description : existing.description;
  const content = b.content !== undefined ? String(b.content).trim() : existing.content;
  const form_type = b.form_type !== undefined ? b.form_type : existing.form_type;
  const is_active = b.is_active !== undefined ? !!b.is_active : existing.is_active;
  const require_sign = b.require_sign !== undefined ? !!b.require_sign : existing.require_sign;
  await qr(
    'UPDATE consent_forms SET title = ?, description = ?, content = ?, form_type = ?, is_active = ?, require_sign = ?, updated_at = ' + nowSql() + ' WHERE id = ?',
    [title, description, content, form_type, is_active, require_sign, existing.id]);
  await audit(req, 'CONSENT_FORM_UPDATE', 'consent_forms', existing.id, { title });
  const row = await q('SELECT * FROM consent_forms WHERE id = ?', [existing.id]);
  res.json(row);
}));

router.delete('/forms/:id', requireRole(...ADMIN), asyncH(async (req, res) => {
  const existing = await q('SELECT * FROM consent_forms WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Form not found' });
  await qr('DELETE FROM consent_forms WHERE id = ?', [existing.id]);
  await audit(req, 'CONSENT_FORM_DELETE', 'consent_forms', existing.id, { title: existing.title });
  res.json({ ok: true });
}));

router.post('/forms/:id/sign', asyncH(async (req, res) => {
  const form = await q('SELECT * FROM consent_forms WHERE id = ?', [req.params.id]);
  if (!form) return res.status(404).json({ error: 'Form not found' });
  if (!form.is_active) return res.status(400).json({ error: 'Form is not active' });

  const user = req.user;
  const isBoundType = STUDENT_BOUND_TYPES.includes(form.form_type);
  const raw = req.body && req.body.student_id;
  const providedStudent = raw === undefined || raw === null || raw === '' ? null : Number(raw);
  if (providedStudent !== null && !Number.isInteger(providedStudent)) {
    return res.status(400).json({ error: 'invalid student_id' });
  }
  let studentId = providedStudent;

  // Required for minor-bound forms; otherwise resolved from the account.
  if (isBoundType && !studentId) {
    return res.status(400).json({ error: 'student_id is required for this consent form (it covers a specific student)' });
  }
  if (!studentId && user.role === 'parent') {
    const kids = await qa('SELECT student_id FROM parent_students WHERE parent_user_id = ?', [user.id]);
    if (kids.length === 1) studentId = Number(kids[0].student_id);
  } else if (!studentId && user.role === 'student') {
    const self = await q('SELECT id FROM students WHERE user_id = ?', [user.id]);
    studentId = self ? Number(self.id) : null;
  }

  if (studentId) {
    const st = await q('SELECT id, birth_date FROM students WHERE id = ?', [studentId]);
    if (!st) return res.status(404).json({ error: 'Student not found' });
    if (user.role === 'parent') {
      const link = await q('SELECT id FROM parent_students WHERE parent_user_id = ? AND student_id = ?', [user.id, st.id]);
      if (!link) {
        return res.status(403).json({ error: 'You are not linked as a guardian of this student. Ask the registrar to claim/verify your child before signing.' });
      }
    } else if (user.role === 'student') {
      const self = await q('SELECT id FROM students WHERE id = ? AND user_id = ?', [st.id, user.id]);
      if (!self) return res.status(403).json({ error: 'You can only sign for your own student record' });
      if (isBoundType && !isAdult(st.birth_date)) {
        return res.status(403).json({ error: 'A parent or legal guardian must sign for a minor student' });
      }
    } else if (!RECORD_ROLES.includes(user.role)) {
      return res.status(403).json({ error: 'Only a parent/guardian or an authorized school officer may sign this consent for a student' });
    }
  }

  const existing = await q(
    'SELECT id FROM consent_responses WHERE form_id = ? AND user_id = ? AND ((student_id IS NULL AND ? IS NULL) OR student_id = ?)',
    [form.id, user.id, studentId, studentId]);
  if (existing) return res.json({ ok: true, alreadySigned: true });
  const signatureName = req.body?.signature_name || null;
  const id = await qi(
    'INSERT INTO consent_responses (form_id, user_id, student_id, signature_name, ip_address) VALUES (?, ?, ?, ?, ?)',
    [form.id, user.id, studentId, signatureName, req.ip]);
  await audit(req, 'CONSENT_RESPONSE_SIGN', 'consent_responses', id, { form_id: form.id, student_id: studentId });
  res.json({ ok: true, signed: true });
}));

router.get('/responses', requireRole(...ADMIN), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const conditions = [];
  const params = [];
  if (req.query.form_id) { conditions.push('cr.form_id = ?'); params.push(Number(req.query.form_id)); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const rows = await qa(
    `SELECT cr.*, u.name AS user_name, u.username, f.title AS form_title,
       st.lrn AS student_lrn, st.first_name || ' ' || st.last_name AS student_name
     FROM consent_responses cr
     LEFT JOIN users u ON u.id = cr.user_id
     LEFT JOIN consent_forms f ON f.id = cr.form_id
     LEFT JOIN students st ON st.id = cr.student_id
     ${where}
     ORDER BY cr.signed_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]);
  const totalRow = (await qa(
    `SELECT COUNT(*) AS n FROM consent_responses cr ${where}`, params))[0];
  res.json({ data: rows, total: Number(totalRow.n || 0), limit, offset });
}));

router.get('/responses/counts', requireRole(...ADMIN), asyncH(async (req, res) => {
  const rows = await qa(
    `SELECT f.id, f.title, COUNT(cr.id) AS n
     FROM consent_forms f
     LEFT JOIN consent_responses cr ON cr.form_id = f.id
     GROUP BY f.id, f.title
     ORDER BY f.title`);
  res.json({ data: rows.map((r) => ({ ...r, n: Number(r.n) })) });
}));

module.exports = router;
