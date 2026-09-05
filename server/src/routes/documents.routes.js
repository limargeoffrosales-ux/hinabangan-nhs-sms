const express = require('express');
const db = require('../db');
const { q, qa, qi, qr, nowSql } = db;
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');

const router = express.Router();
router.use(authenticate);

const ADMIN_ROLES = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];

// ── Formats ──────────────────────────────────────────────────

router.get('/formats', asyncH(async (req, res) => {
  const rows = await qa('SELECT * FROM doc_formats ORDER BY created_at DESC');
  const decorated = rows.map((r) => {
    let fields = [];
    try { fields = JSON.parse(r.fields); } catch { fields = []; }
    return { ...r, fields };
  });
  res.json({ data: decorated });
}));

router.post('/formats', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const body = String(b.body || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!body) return res.status(400).json({ error: 'body is required' });
  const fields = Array.isArray(b.fields) ? JSON.stringify(b.fields) : typeof b.fields === 'string' ? b.fields : '[]';
  const id = await qi(
    'INSERT INTO doc_formats (name, body, fields, created_by) VALUES (?, ?, ?, ?)',
    [name, body, fields, req.user.id]);
  await audit(req, 'DOC_FORMAT_CREATE', 'doc_formats', id, { name });
  const row = await q('SELECT * FROM doc_formats WHERE id = ?', [id]);
  res.status(201).json(row);
}));

router.patch('/formats/:id', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const existing = await q('SELECT * FROM doc_formats WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Format not found' });
  const b = req.body || {};
  if (b.name !== undefined && !String(b.name || '').trim()) return res.status(400).json({ error: 'name is required' });
  if (b.body !== undefined && !String(b.body || '').trim()) return res.status(400).json({ error: 'body is required' });
  const name = b.name !== undefined ? String(b.name || '').trim() : existing.name;
  const body = b.body !== undefined ? String(b.body || '').trim() : existing.body;
  const fields = b.fields !== undefined
    ? (Array.isArray(b.fields) ? JSON.stringify(b.fields) : typeof b.fields === 'string' ? b.fields : existing.fields)
    : existing.fields;
  await qr(
    'UPDATE doc_formats SET name = ?, body = ?, fields = ? WHERE id = ?',
    [name, body, fields, existing.id]);
  await audit(req, 'DOC_FORMAT_UPDATE', 'doc_formats', existing.id, { name });
  const row = await q('SELECT * FROM doc_formats WHERE id = ?', [existing.id]);
  res.json(row);
}));

router.delete('/formats/:id', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const existing = await q('SELECT * FROM doc_formats WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Format not found' });
  await qr('DELETE FROM doc_formats WHERE id = ?', [existing.id]);
  await audit(req, 'DOC_FORMAT_DELETE', 'doc_formats', existing.id, { name: existing.name });
  res.json({ ok: true });
}));

// ── Generations ──────────────────────────────────────────────

router.get('/generations', asyncH(async (req, res) => {
  const rows = await qa(
    `SELECT dg.*, u.name AS created_by_name
     FROM doc_generations dg
     LEFT JOIN users u ON u.id = dg.created_by
     ORDER BY dg.created_at DESC`);
  res.json({ data: rows });
}));

router.get('/generations/stats', asyncH(async (req, res) => {
  const rows = await qa('SELECT kind, COUNT(*) AS n FROM doc_generations GROUP BY kind');
  res.json({ data: rows });
}));

router.post('/generations', requireRole(...ADMIN_ROLES, 'teacher'), asyncH(async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const body = String(b.body || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!body) return res.status(400).json({ error: 'body is required' });
  const kind = String(b.kind || 'template').trim();
  const source_id = b.source_id ? String(b.source_id).trim() : null;
  const id = await qi(
    'INSERT INTO doc_generations (name, kind, source_id, body, created_by) VALUES (?, ?, ?, ?, ?)',
    [name, kind, source_id, body, req.user.id]);
  await audit(req, 'DOC_GENERATION_CREATE', 'doc_generations', id, { name, kind });
  const row = await q('SELECT * FROM doc_generations WHERE id = ?', [id]);
  res.status(201).json(row);
}));

module.exports = router;
