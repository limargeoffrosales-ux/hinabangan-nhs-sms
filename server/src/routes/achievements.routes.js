const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');

const router = express.Router();
router.use(authenticate);

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'teacher'];

// ── List achievements (feed) ─────────────────────────────
router.get('/', asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const { category, search } = req.query;
  let sql = `SELECT a.*,
    u.name AS author_name, u.role AS author_role,
    (SELECT COUNT(*) FROM achievement_likes WHERE achievement_id = a.id) AS likes_count,
    (SELECT COUNT(*) FROM achievement_comments WHERE achievement_id = a.id) AS comments_count,
    (SELECT COUNT(*) FROM achievement_likes WHERE achievement_id = a.id AND user_id = ?) AS user_liked
    FROM achievements a
    LEFT JOIN users u ON a.author_id = u.id
    WHERE 1=1`;
  const params = [req.user.id];

  if (category && category !== 'all') {
    sql += ' AND a.category = ?';
    params.push(category);
  }
  if (search) {
    sql += ' AND (a.title ILIKE ? OR a.content ILIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY a.pinned DESC, a.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const data = await qa(sql, params);
  // Parse media JSON for each row
  for (const row of data) {
    if (typeof row.media === 'string') {
      try { row.media = JSON.parse(row.media); } catch { row.media = []; }
    }
  }
  res.json({ data, limit, offset });
}));

// ── Get single achievement ───────────────────────────────
router.get('/:id', asyncH(async (req, res) => {
  const row = await q(
    `SELECT a.*, u.name AS author_name, u.role AS author_role,
      (SELECT COUNT(*) FROM achievement_likes WHERE achievement_id = a.id) AS likes_count,
      (SELECT COUNT(*) FROM achievement_comments WHERE achievement_id = a.id) AS comments_count,
      (SELECT COUNT(*) FROM achievement_likes WHERE achievement_id = a.id AND user_id = ?) AS user_liked
     FROM achievements a LEFT JOIN users u ON a.author_id = u.id WHERE a.id = ?`,
    [req.user.id, req.params.id]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (typeof row.media === 'string') {
    try { row.media = JSON.parse(row.media); } catch { row.media = []; }
  }
  // Fetch comments
  row.comments = await qa(
    `SELECT c.*, u.name AS author_name FROM achievement_comments c
     LEFT JOIN users u ON c.author_id = u.id WHERE c.achievement_id = ? ORDER BY c.created_at`,
    [req.params.id]);
  res.json(row);
}));

// ── Create achievement ───────────────────────────────────
router.post('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.title.trim()) return res.status(400).json({ error: 'Title is required' });

  const title = b.title.trim();
  const content = (b.content || '').trim();
  const category = b.category || 'general';
  const visibility = b.visibility || 'school';
  const pinned = b.pinned ? true : false;
  const media = JSON.stringify(b.media || []);

  const id = await qi(
    `INSERT INTO achievements (title, content, author_id, category, media, visibility, pinned)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, content, req.user.id, category, media, visibility, pinned]);

  await audit(req, 'CREATE_ACHIEVEMENT', 'achievements', id, { title, category });
  res.status(201).json({ id });
}));

// ── Update achievement ───────────────────────────────────
router.patch('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const cur = await q('SELECT * FROM achievements WHERE id = ?', [req.params.id]);
  if (!cur) return res.status(404).json({ error: 'Not found' });

  const b = req.body || {};
  const title = b.title !== undefined ? b.title.trim() : cur.title;
  const content = b.content !== undefined ? b.content.trim() : cur.content;
  const category = b.category || cur.category;
  const visibility = b.visibility || cur.visibility;
  const pinned = b.pinned !== undefined ? b.pinned : cur.pinned;
  const media = b.media !== undefined ? JSON.stringify(b.media) : cur.media;

  await qr(
    `UPDATE achievements SET title = ?, content = ?, category = ?, media = ?, visibility = ?, pinned = ?, updated_at = NOW() WHERE id = ?`,
    [title, content, category, media, visibility, pinned, req.params.id]);

  await audit(req, 'UPDATE_ACHIEVEMENT', 'achievements', req.params.id, { title });
  res.json({ ok: true });
}));

// ── Delete achievement ───────────────────────────────────
router.delete('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const r = await qr('DELETE FROM achievements WHERE id = ?', [req.params.id]);
  if (!r.changes) return res.status(404).json({ error: 'Not found' });
  await audit(req, 'DELETE_ACHIEVEMENT', 'achievements', req.params.id);
  res.json({ ok: true });
}));

// ── Like / Unlike ────────────────────────────────────────
router.post('/:id/like', asyncH(async (req, res) => {
  const ach = await q('SELECT id FROM achievements WHERE id = ?', [req.params.id]);
  if (!ach) return res.status(404).json({ error: 'Not found' });

  const existing = await q(
    'SELECT id FROM achievement_likes WHERE achievement_id = ? AND user_id = ?',
    [req.params.id, req.user.id]);

  if (existing) {
    await qr('DELETE FROM achievement_likes WHERE id = ?', [existing.id]);
    await qr('UPDATE achievements SET likes_count = CASE WHEN likes_count > 0 THEN likes_count - 1 ELSE 0 END WHERE id = ?', [req.params.id]);
    res.json({ liked: false });
  } else {
    await qi('INSERT INTO achievement_likes (achievement_id, user_id) VALUES (?, ?)',
      [req.params.id, req.user.id]);
    await qr('UPDATE achievements SET likes_count = likes_count + 1 WHERE id = ?', [req.params.id]);
    res.json({ liked: true });
  }
}));

// ── Comments ─────────────────────────────────────────────
router.get('/:id/comments', asyncH(async (req, res) => {
  const data = await qa(
    `SELECT c.*, u.name AS author_name FROM achievement_comments c
     LEFT JOIN users u ON c.author_id = u.id
     WHERE c.achievement_id = ? ORDER BY c.created_at`,
    [req.params.id]);
  res.json({ data });
}));

router.post('/:id/comments', asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.content || !b.content.trim()) return res.status(400).json({ error: 'Comment is required' });

  const ach = await q('SELECT id FROM achievements WHERE id = ?', [req.params.id]);
  if (!ach) return res.status(404).json({ error: 'Not found' });

  const id = await qi(
    'INSERT INTO achievement_comments (achievement_id, author_id, content) VALUES (?, ?, ?)',
    [req.params.id, req.user.id, b.content.trim()]);

  await qr('UPDATE achievements SET comments_count = comments_count + 1 WHERE id = ?', [req.params.id]);
  await audit(req, 'COMMENT_ACHIEVEMENT', 'achievement_comments', id, { achievement_id: req.params.id });

  const comment = await q(
    `SELECT c.*, u.name AS author_name FROM achievement_comments c
     LEFT JOIN users u ON c.author_id = u.id WHERE c.id = ?`, [id]);
  res.status(201).json(comment);
}));

router.delete('/:id/comments/:commentId', asyncH(async (req, res) => {
  const c = await q('SELECT * FROM achievement_comments WHERE id = ? AND achievement_id = ?',
    [req.params.commentId, req.params.id]);
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (c.author_id !== req.user.id) {
    const isAdmin = await q('SELECT role FROM users WHERE id = ? AND role IN (?, ?)',
      [req.user.id, 'super_admin', 'school_admin']);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
  }
  await qr('DELETE FROM achievement_comments WHERE id = ?', [req.params.commentId]);
  await qr('UPDATE achievements SET comments_count = CASE WHEN comments_count > 0 THEN comments_count - 1 ELSE 0 END WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
