const express = require('express');
const db = require('../db');
const { q, qa, qi, qr, nowSql } = db;
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');
const { ensureTeacherSeesStudent, teacherScope, studentInScope } = require('../scope');

const router = express.Router();
router.use(authenticate);
const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'teacher'];
const ADMIN = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];

/* ── List certifications ──────────────────────────── */
router.get('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const { student_id, certification_type, status } = req.query;
  let sql = `
    SELECT c.*, st.first_name, st.last_name, st.grade_level
    FROM certifications c
    LEFT JOIN students st ON st.id = c.student_id`;
  const where = [];
  const params = [];
  if (student_id) { where.push('c.student_id = ?'); params.push(student_id); }
  if (certification_type) { where.push('c.certification_type = ?'); params.push(certification_type); }
  if (status) { where.push('c.status = ?'); params.push(status); }
  if (req.role === 'teacher') {
    const scope = await teacherScope(req.user);
    const frag = studentInScope(scope, 'st');
    where.push(frag.sql);
    params.push(...frag.params);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY c.created_at DESC';
  res.json({ data: await qa(sql, params) });
}));

/* ── Summary stats ────────────────────────────────── */
router.get('/summary', requireRole(...WRITE), asyncH(async (req, res) => {
  const totalRow = await q('SELECT COUNT(*) AS count FROM certifications');
  const totalCount = Number(totalRow?.count ?? totalRow?.total ?? 0);
  const byType = await qa('SELECT certification_type, COUNT(*) AS count FROM certifications GROUP BY certification_type');
  const byStatus = await qa('SELECT status, COUNT(*) AS count FROM certifications GROUP BY status');
  const expiringSql = db.dialect === 'pg'
    ? `SELECT COUNT(*) AS count FROM certifications WHERE expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + INTERVAL '30 days' AND status = 'active'`
    : `SELECT COUNT(*) AS count FROM certifications WHERE expiry_date IS NOT NULL AND expiry_date <= date('now', '+30 days') AND status = 'active'`;
  const expiring = await q(expiringSql);
  const exp = await q(expiringSql);
  res.json({
    total: totalCount,
    by_type: byType.map((x) => ({ certification_type: x.certification_type, count: Number(x.count) || 0 })),
    by_status: byStatus.map((x) => ({ status: x.status, count: Number(x.count) || 0 })),
    expiring_soon: Number(exp?.count ?? exp?.total ?? 0),
  });
}));

/* ── Get single certification ─────────────────────── */
router.get('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q(
    `SELECT c.*, st.first_name, st.last_name
     FROM certifications c
     LEFT JOIN students st ON st.id = c.student_id
     WHERE c.id = ?`, [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Certification not found' });
  if (req.role === 'teacher' && row.student_id) {
    const chk = await ensureTeacherSeesStudent(req.user, row.student_id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }
  res.json(row);
}));

/* ── Create certification ─────────────────────────── */
router.post('/', requireRole(...ADMIN), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.student_id || !b.certification_type || !b.cert_name) {
    return res.status(400).json({ error: 'student_id, certification_type, and cert_name are required' });
  }
  const id = await qi(
    `INSERT INTO certifications (student_id, certification_type, cert_name, specialization,
      date_acquired, expiry_date, status, issuing_body, certificate_no, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.student_id, b.certification_type, b.cert_name, b.specialization || null,
      b.date_acquired || null, b.expiry_date || null, b.status || 'active',
      b.issuing_body || null, b.certificate_no || null, b.notes || null]
  );
  await audit(req, 'CREATE_CERTIFICATION', 'certifications', id, { cert_name: b.cert_name });
  res.status(201).json({ id });
}));

/* ── Update certification ─────────────────────────── */
router.patch('/:id', requireRole(...ADMIN), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM certifications WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Certification not found' });
  const b = req.body || {};
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  await qr(
    `UPDATE certifications SET certification_type=?, cert_name=?, specialization=?,
      date_acquired=?, expiry_date=?, status=?, issuing_body=?, certificate_no=?, notes=?,
      updated_at=${nowSql()} WHERE id=?`,
    [f('certification_type', row.certification_type), f('cert_name', row.cert_name),
      f('specialization', row.specialization), f('date_acquired', row.date_acquired),
      f('expiry_date', row.expiry_date), f('status', row.status),
      f('issuing_body', row.issuing_body), f('certificate_no', row.certificate_no),
      f('notes', row.notes), row.id]
  );
  await audit(req, 'UPDATE_CERTIFICATION', 'certifications', row.id);
  res.json({ ok: true });
}));

/* ── Delete certification ─────────────────────────── */
router.delete('/:id', requireRole(...ADMIN), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM certifications WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Certification not found' });
  await qr('DELETE FROM certifications WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_CERTIFICATION', 'certifications', row.id);
  res.json({ ok: true });
}));

module.exports = router;
