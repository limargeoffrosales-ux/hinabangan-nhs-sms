const express = require('express');
const db = require('../db');
const { q, qa, qi, qr, nowSql } = db;
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');

const router = express.Router();
router.use(authenticate);

const ADMIN = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
const FORM_TYPES = ['custom', 'data_privacy', 'photo_video', 'ai_usage'];

router.get('/forms', asyncH(async (req, res) => {
  const rows = await qa(
    `SELECT cf.*,
      (SELECT COUNT(*) FROM consent_responses cr WHERE cr.form_id = cf.id) AS response_count
     FROM consent_forms cf
     ORDER BY cf.created_at DESC`);
  res.json({ data: rows });
}));

router.get('/forms/active', asyncH(async (req, res) => {
  const rows = await qa(
    `SELECT cf.*,
      (SELECT COUNT(*) FROM consent_responses cr WHERE cr.form_id = cf.id) AS response_count
     FROM consent_forms cf
     WHERE cf.is_active = TRUE
     ORDER BY cf.created_at DESC`);
  res.json({ data: rows });
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
  const existing = await q('SELECT id FROM consent_responses WHERE form_id = ? AND user_id = ?', [form.id, req.user.id]);
  if (existing) return res.json({ ok: true, alreadySigned: true });
  const signatureName = req.body?.signature_name || null;
  const id = await qi(
    'INSERT INTO consent_responses (form_id, user_id, signature_name, ip_address) VALUES (?, ?, ?, ?)',
    [form.id, req.user.id, signatureName, req.ip]);
  await audit(req, 'CONSENT_RESPONSE_SIGN', 'consent_responses', id, { form_id: form.id });
  res.json({ ok: true, signed: true });
}));

router.get('/responses', requireRole(...ADMIN), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const conditions = [];
  const params = [];
  if (req.query.form_id) { conditions.push('cr.form_id = ?'); params.push(Number(req.query.form_id)); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const rows = await qa(
    `SELECT cr.*, u.name AS user_name, u.username, f.title AS form_title
     FROM consent_responses cr
     LEFT JOIN users u ON u.id = cr.user_id
     LEFT JOIN consent_forms f ON f.id = cr.form_id
     ${where}
     ORDER BY cr.signed_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]);
  const totalRow = (await qa(
    `SELECT COUNT(*) AS n FROM consent_responses cr ${where}`, params))[0];
  res.json({ data: rows, total: totalRow.n, limit, offset });
}));

router.get('/responses/counts', requireRole(...ADMIN), asyncH(async (req, res) => {
  const rows = await qa(
    `SELECT f.id, f.title, COUNT(cr.id) AS n
     FROM consent_forms f
     LEFT JOIN consent_responses cr ON cr.form_id = f.id
     GROUP BY f.id, f.title
     ORDER BY f.title`);
  res.json({ data: rows });
}));

module.exports = router;
