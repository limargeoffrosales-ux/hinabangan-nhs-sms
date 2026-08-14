const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');

const router = express.Router();
router.use(authenticate);

router.get('/', asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const rows = await qa(
    'SELECT a.*, u.name AS author_name FROM announcements a LEFT JOIN users u ON u.id = a.author_id ORDER BY a.created_at DESC LIMIT ? OFFSET ?',
    [limit, offset]);
  res.json({ data: rows, limit, offset });
}));

router.post('/', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
    const b = req.body || {};
    if (!b.title || !b.body) return res.status(400).json({ error: 'title and body are required' });
    const id = await qi('INSERT INTO announcements (title, body, audience, priority, author_id) VALUES (?, ?, ?, ?, ?)',
      [b.title, b.body, b.audience || 'all', b.priority || 'normal', req.user.id]);
    await audit(req, 'CREATE_ANNOUNCEMENT', 'announcements', id, { title: b.title });
    res.status(201).json({ id });
  }));

router.patch('/:id', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
    const row = await q('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Announcement not found' });
    if (row.author_id !== req.user.id && !['super_admin', 'school_admin'].includes(req.role)) {
      return res.status(403).json({ error: 'Only the author or a school admin may edit this' });
    }
    const b = req.body || {};
    const f = (k, d) => b[k] !== undefined ? b[k] : d;
    await qr('UPDATE announcements SET title = ?, body = ?, audience = ?, priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [f('title', row.title), f('body', row.body), f('audience', row.audience), f('priority', row.priority), row.id]);
    await audit(req, 'UPDATE_ANNOUNCEMENT', 'announcements', row.id);
    res.json({ ok: true });
  }));

router.delete('/:id', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
    const row = await q('SELECT id FROM announcements WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Announcement not found' });
    await qr('DELETE FROM announcements WHERE id = ?', [row.id]);
    await audit(req, 'DELETE_ANNOUNCEMENT', 'announcements', row.id);
    res.json({ ok: true });
  }));

module.exports = router;
