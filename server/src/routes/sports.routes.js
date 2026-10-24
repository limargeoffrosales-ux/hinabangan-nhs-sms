const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');
const { broadcast } = require('../realtime');
const logger = require('../logger');
const { deleteFile, fileKeyFromUrl } = require('../storage');

const router = express.Router();
router.use(authenticate);

const CATEGORIES = ['announcement', 'news', 'results', 'schedule', 'gallery'];

router.get('/categories', asyncH(async (req, res) => {
  res.json({ data: CATEGORIES });
}));

router.get('/', asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const isPortal = req.role === 'student' || req.role === 'parent';
  const where = [];
  const params = [];
  if (req.query.q) {
    where.push('(p.title LIKE ? OR p.body LIKE ?)');
    params.push(`%${req.query.q}%`, `%${req.query.q}%`);
  }
  if (req.query.category) {
    where.push('p.category = ?');
    params.push(req.query.category);
  }
  if (isPortal) {
    where.push("p.status IN ('published','pinned')");
    where.push("(p.audience = 'all' OR p.audience = ?)");
    params.push(req.role);
  } else if (req.query.status) {
    if (req.query.status === 'pinned') where.push("p.status = 'pinned'");
    else { where.push('p.status = ?'); params.push(req.query.status); }
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = await qa(
    `SELECT p.*, u.name AS author_name FROM sports_posts p LEFT JOIN users u ON u.id = p.author_id ${whereSql}
     ORDER BY CASE WHEN p.status = 'pinned' THEN 0 ELSE 1 END, p.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]);
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
    const id = await qi(
      'INSERT INTO sports_posts (title, body, category, status, audience, author_id, media) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [b.title, b.body, b.category || 'announcement', b.status || 'published', b.audience || 'all', req.user.id, JSON.stringify(b.media || [])]);
    await audit(req, 'CREATE_SPORTS_POST', 'sports_posts', id, { title: b.title });
    broadcast('sports-news', { action: 'created', id });
    res.status(201).json({ id });
  }));

router.patch('/:id', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
    const row = await q('SELECT * FROM sports_posts WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Post not found' });
    if (row.author_id !== req.user.id && req.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only the author or a super admin may edit this post' });
    }
    const b = req.body || {};
    const f = (k, d) => b[k] !== undefined ? b[k] : d;
    const media = f('media', row.media);
    await qr(
      'UPDATE sports_posts SET title = ?, body = ?, category = ?, status = ?, audience = ?, media = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [f('title', row.title), f('body', row.body), f('category', row.category), f('status', row.status), f('audience', row.audience),
       typeof media === 'string' ? media : JSON.stringify(media), row.id]);
    await audit(req, 'UPDATE_SPORTS_POST', 'sports_posts', row.id);
    broadcast('sports-news', { action: 'updated', id: row.id });
    res.json({ ok: true });
  }));

router.delete('/:id', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
    const row = await q('SELECT * FROM sports_posts WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Post not found' });
    let media = row.media;
    if (typeof media === 'string') {
      try { media = JSON.parse(media); } catch { media = []; }
    }
    for (const m of media || []) {
      const key = fileKeyFromUrl(m.url);
      if (key) deleteFile(key).catch((err) => logger.error({ err: err?.message, stack: err?.stack, key }, '[SPORTS] failed to delete media'));
    }
    await qr('DELETE FROM sports_posts WHERE id = ?', [row.id]);
    await audit(req, 'DELETE_SPORTS_POST', 'sports_posts', row.id);
    broadcast('sports-news', { action: 'deleted', id: row.id });
    res.json({ ok: true });
  }));

module.exports = router;