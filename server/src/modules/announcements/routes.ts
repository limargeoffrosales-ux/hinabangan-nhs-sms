// Announcements feature module
import { Router } from 'express';
import { q, qa, qi, qr } from '../../db';
import { authenticate, requireRole } from '../../auth';
import { asyncH, audit, page } from '../../utils';
import { broadcast } from '../../realtime';
import { WRITE } from '../../constants';

const router = Router();
router.use(authenticate);

router.get('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const { audience, priority } = req.query;
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (audience) { where.push('audience = ?'); params.push(String(audience)); }
  if (priority) { where.push('priority = ?'); params.push(String(priority)); }
  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = Number((await q(`SELECT COUNT(*) AS total FROM announcements${whereClause}`, params)).total || 0);
  const rows = await qa(
    `SELECT a.*, u.name AS author_name FROM announcements a LEFT JOIN users u ON u.id = a.author_id ${whereClause} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]);
  res.json({ data: rows, total, limit, offset, totalPages: Math.ceil(total / limit) });
}));

router.post('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const { title, body, audience, priority } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'title and body are required' });
  const id = await qi(
    'INSERT INTO announcements (title, body, audience, priority, author_id) VALUES (?, ?, ?, ?, ?)',
    [title, body, audience || 'all', priority || 'normal', req.user.id]);
  await audit(req, 'CREATE_ANNOUNCEMENT', 'announcements', id, { title });
  broadcast('announcement', { action: 'created', id });
  res.status(201).json({ id, title, body, audience: audience || 'all', priority: priority || 'normal', author_id: req.user.id });
}));

router.patch('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Announcement not found' });
  const b = req.body || {};
  const f = (k: string, d: any) => b[k] !== undefined ? b[k] : d;
  await qr(
    'UPDATE announcements SET title = ?, body = ?, audience = ?, priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [f('title', row.title), f('body', row.body), f('audience', row.audience), f('priority', row.priority), row.id]);
  await audit(req, 'UPDATE_ANNOUNCEMENT', 'announcements', row.id, { title: row.title });
  broadcast('announcement', { action: 'updated', id: Number(req.params.id) });
  res.json({ ok: true });
}));

router.delete('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Announcement not found' });
  await qr('DELETE FROM announcements WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_ANNOUNCEMENT', 'announcements', row.id, { title: row.title });
  broadcast('announcement', { action: 'deleted', id: row.id });
  res.json({ ok: true });
}));

export const announcementsRoutes = router;