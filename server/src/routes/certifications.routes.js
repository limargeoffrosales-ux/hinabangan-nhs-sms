const express = require('express');
const db = require('../db');
const { q, qa, qi, qr, nowSql } = db;
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');

const router = express.Router();
router.use(authenticate);
const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'teacher'];
const ADMIN = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];

/* ── List certifications ──────────────────────────── */
router.get('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const { student_id, certification_type, status, school_year } = req.query;
  let sql = `
    SELECT c.*, st.first_name, st.last_name, st.grade_level, sec.name AS section_name
    FROM certifications c
    LEFT JOIN students st ON st.id = c.student_id
    LEFT JOIN enrollments e ON e.student_id = st.id AND e.school_year = c.created_at::text
    LEFT JOIN sections sec ON sec.id = e.section_id`;
  const where = [];
  const params = [];
  if (student_id) { where.push('c.student_id = ?'); params.push(student_id); }
  if (certification_type) { where.push('c.certification_type = ?'); params.push(certification_type); }
  if (status) { where.push('c.status = ?'); params.push(status); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY c.created_at DESC';
  res.json({ data: await qa(sql, params) });
}));

/* ── Summary stats ────────────────────────────────── */
router.get('/summary', requireRole(...WRITE), asyncH(async (req, res) => {
  const total = await q('SELECT COUNT(*) AS count FROM certifications');
  const byType = await qa('SELECT certification_type, COUNT(*) AS count FROM certifications GROUP BY certification_type');
  const byStatus = await qa('SELECT status, COUNT(*) AS count FROM certifications GROUP BY status');
  const expiring = await q(`SELECT COUNT(*) AS count FROM certifications WHERE expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + INTERVAL '30 days' AND status = 'active'`);
  res.json({ total: total.count, by_type: byType, by_status: byStatus, expiring_soon: expiring.count });
}));

/* ── Get single certification ─────────────────────── */
router.get('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q(
    `SELECT c.*, st.first_name, st.last_name
     FROM certifications c
     LEFT JOIN students st ON st.id = c.student_id
     WHERE c.id = ?`, [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Certification not found' });
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
