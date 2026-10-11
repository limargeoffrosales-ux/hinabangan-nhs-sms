const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page, auditWithDiff, softDelete, restoreDeleted } = require('../utils');
const { notifyEvent } = require('../notify');
const { broadcast } = require('../realtime');
const logger = require('../logger');

const { deleteFile, fileKeyFromUrl } = require('../storage');

const router = express.Router();
router.use(authenticate);

router.get('/', asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const isPortal = req.role === 'student' || req.role === 'parent';
  const audienceFilter = isPortal ? " AND (a.audience = 'all' OR a.audience = ?)" : '';
  const params = isPortal ? [req.role, limit, offset] : [limit, offset];
  const rows = await qa(
    `SELECT a.*, u.name AS author_name FROM announcements a LEFT JOIN users u ON u.id = a.author_id WHERE a.deleted_at IS NULL ${audienceFilter} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
    params);
  // Parse media JSON for each row (pg driver auto-parses JSONB; SQLite returns text)
  for (const row of rows) {
    if (typeof row.media === 'string') {
      try { row.media = JSON.parse(row.media); } catch { row.media = []; }
    }
  }
  res.json({ data: rows, limit, offset });
}));

router.post('/', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
    const b = req.body || {};
    if (!b.title || !b.body) return res.status(400).json({ error: 'title and body are required' });
    const id = await qi('INSERT INTO announcements (title, body, audience, priority, author_id, media) VALUES (?, ?, ?, ?, ?, ?)',
      [b.title, b.body, b.audience || 'all', b.priority || 'normal', req.user.id, JSON.stringify(b.media || [])]);
    await audit(req, 'CREATE_ANNOUNCEMENT', 'announcements', id, { title: b.title });
    broadcast('announcement', { action: 'created', id });
    notifyEvent('announcement_posted', {
      audience: b.audience || 'all',
      data: { title: b.title, body: b.body, priority: b.priority || 'normal' },
    }).catch((err) => logger.error({ err: err.message }, '[ANNOUNCEMENTS] notifyEvent failed'));
    res.status(201).json({ id });
  }));

router.patch('/:id', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
    const row = await q('SELECT * FROM announcements WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Announcement not found' });
    if (row.author_id !== req.user.id && !['super_admin', 'school_admin'].includes(req.role)) {
      return res.status(403).json({ error: 'Only the author or a school admin may edit this' });
    }
    const b = req.body || {};
    const f = (k, d) => b[k] !== undefined ? b[k] : d;
    const media = f('media', row.media);
    const oldRow = { ...row };
    await qr('UPDATE announcements SET title = ?, body = ?, audience = ?, priority = ?, media = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [f('title', row.title), f('body', row.body), f('audience', row.audience), f('priority', row.priority),
       typeof media === 'string' ? media : JSON.stringify(media), row.id]);
    const newRow = await q('SELECT * FROM announcements WHERE id = ?', [row.id]);
    await auditWithDiff(req, 'UPDATE_ANNOUNCEMENT', 'announcements', row.id, oldRow, newRow);
    broadcast('announcement', { action: 'updated', id: row.id });
    res.json({ ok: true });
  }));

router.delete('/:id', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
    const row = await q('SELECT * FROM announcements WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Announcement not found' });
    // Soft delete instead of hard delete
    const ok = await softDelete('announcements', row.id, req.user.id);
    if (!ok) return res.status(409).json({ error: 'Already deleted' });
    await audit(req, 'DELETE_ANNOUNCEMENT', 'announcements', row.id, { title: row.title });
    broadcast('announcement', { action: 'deleted', id: row.id });
    res.json({ ok: true, softDeleted: true });
  }));

// Restore a soft-deleted announcement
router.post('/:id/restore', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
    const row = await q('SELECT id, title FROM announcements WHERE id = ? AND deleted_at IS NOT NULL', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Deleted announcement not found' });
    const ok = await restoreDeleted('announcements', row.id);
    if (!ok) return res.status(409).json({ error: 'Not deleted or already restored' });
    await audit(req, 'RESTORE_ANNOUNCEMENT', 'announcements', row.id, { title: row.title });
    broadcast('announcement', { action: 'restored', id: row.id });
    res.json({ ok: true });
  }));

module.exports = router;
