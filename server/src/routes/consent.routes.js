const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');

const router = express.Router();
router.use(authenticate);

// GET /consent/forms — list all forms (admin) or active unsigned forms (portal)
router.get('/forms', asyncH(async (req, res) => {
  const isAdmin = ['super_admin', 'school_admin'].includes(req.user.role);
  if (isAdmin) {
    const rows = await qa(
      `SELECT cf.*, (SELECT COUNT(*) FROM consent_responses cr WHERE cr.form_id = cf.id) AS response_count
       FROM consent_forms cf ORDER BY cf.created_at DESC`);
    return res.json({ data: rows });
  }
  const rows = await qa(
    `SELECT cf.id, cf.title, cf.description, cf.content, cf.form_type, cf.require_sign,
            (SELECT cr.status FROM consent_responses cr WHERE cr.form_id = cf.id AND cr.user_id = ?) AS my_status
     FROM consent_forms cf WHERE cf.is_active = TRUE
     ORDER BY cf.created_at DESC`, [req.user.id]);
  res.json({ data: rows });
}));

// GET /consent/forms/:id — single form detail
router.get('/forms/:id', asyncH(async (req, res) => {
  const row = await q(
    `SELECT cf.*, (SELECT cr.status FROM consent_responses cr WHERE cr.form_id = cf.id AND cr.user_id = ?) AS my_status
     FROM consent_forms cf WHERE cf.id = ?`, [req.user.id, req.params.id]);
  if (!row) return res.status(404).json({ error: 'Form not found' });
  res.json(row);
}));

// POST /consent/forms — create new consent form (admin only)
router.post('/forms', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
  const b = req.body || {};
  const title = String(b.title || '').trim();
  const content = String(b.content || '').trim();
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (!content) return res.status(400).json({ error: 'content is required' });
  const id = await qi(
    `INSERT INTO consent_forms (title, description, content, form_type, is_active, require_sign, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, String(b.description || '').trim() || null, content,
      b.form_type || 'custom', b.is_active !== false, b.require_sign !== false, req.user.id]);
  await audit(req, 'CONSENT_FORM_CREATE', 'consent_forms', id, { title });
  const row = await q('SELECT * FROM consent_forms WHERE id = ?', [id]);
  res.status(201).json(row);
}));

// PUT /consent/forms/:id — update consent form (admin only)
router.put('/forms/:id', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
  const existing = await q('SELECT * FROM consent_forms WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Form not found' });
  const b = req.body || {};
  const title = b.title !== undefined ? String(b.title).trim() : existing.title;
  const content = b.content !== undefined ? String(b.content).trim() : existing.content;
  if (!title || !content) return res.status(400).json({ error: 'title and content are required' });
  await qr(
    `UPDATE consent_forms SET title = ?, description = ?, content = ?, form_type = ?,
     is_active = ?, require_sign = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [title, b.description !== undefined ? String(b.description).trim() || null : existing.description,
      content, b.form_type || existing.form_type,
      b.is_active !== undefined ? b.is_active : existing.is_active,
      b.require_sign !== undefined ? b.require_sign : existing.require_sign, req.params.id]);
  await audit(req, 'CONSENT_FORM_UPDATE', 'consent_forms', req.params.id, { title });
  const row = await q('SELECT * FROM consent_forms WHERE id = ?', [req.params.id]);
  res.json(row);
}));

// DELETE /consent/forms/:id — delete (admin only)
router.delete('/forms/:id', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
  const existing = await q('SELECT * FROM consent_forms WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Form not found' });
  await qr('DELETE FROM consent_forms WHERE id = ?', [req.params.id]);
  await audit(req, 'CONSENT_FORM_DELETE', 'consent_forms', req.params.id, { title: existing.title });
  res.json({ ok: true });
}));

// POST /consent/sign/:id — sign a consent form
router.post('/sign/:id', asyncH(async (req, res) => {
  const form = await q('SELECT * FROM consent_forms WHERE id = ?', [req.params.id]);
  if (!form) return res.status(404).json({ error: 'Form not found' });
  if (!form.is_active) return res.status(400).json({ error: 'This form is no longer active' });
  const existing = await q('SELECT id FROM consent_responses WHERE form_id = ? AND user_id = ?', [form.id, req.user.id]);
  if (existing) return res.status(409).json({ error: 'You have already signed this form' });
  const signatureName = String((req.body || {}).signature_name || req.user.name || '').trim();
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  const rid = await qi(
    `INSERT INTO consent_responses (form_id, user_id, status, signature_name, ip_address) VALUES (?, ?, 'signed', ?, ?)`,
    [form.id, req.user.id, signatureName, ip]);
  await audit(req, 'CONSENT_SIGN', 'consent_responses', rid, { form_id: form.id, form_title: form.title });
  const row = await q('SELECT * FROM consent_responses WHERE id = ?', [rid]);
  res.status(201).json(row);
}));

// GET /consent/responses — list responses (admin: all; portal: own)
router.get('/responses', asyncH(async (req, res) => {
  const isAdmin = ['super_admin', 'school_admin'].includes(req.user.role);
  if (isAdmin) {
    const rows = await qa(
      `SELECT cr.*, u.name AS user_name, cf.title AS form_title
       FROM consent_responses cr
       JOIN users u ON u.id = cr.user_id
       JOIN consent_forms cf ON cf.id = cr.form_id
       ORDER BY cr.signed_at DESC`);
    return res.json({ data: rows });
  }
  const rows = await qa(
    `SELECT cr.*, cf.title AS form_title
     FROM consent_responses cr JOIN consent_forms cf ON cf.id = cr.form_id
     WHERE cr.user_id = ? ORDER BY cr.signed_at DESC`, [req.user.id]);
  res.json({ data: rows });
}));

module.exports = router;
