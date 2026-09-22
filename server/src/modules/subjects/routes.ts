// Subjects feature module
import { Router } from 'express';
import { q, qa, qi, qr, bool } from '../../db';
import { authenticate, requireRole } from '../../auth';
import { asyncH, audit, page } from '../../utils';
import { WRITE_ROLES } from '../../constants';

const router = Router();
router.use(authenticate);

const TERMS = ['first', 'second', 'third', 'all'] as const;

router.get('/', requireRole(...WRITE_ROLES, 'teacher', 'registrar'), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const gradeLevel = req.query.grade_level ? String(req.query.grade_level) : null;
  const term = TERMS.includes(String(req.query.term)) ? String(req.query.term) : null;
  const offeredOnly = req.query.offered === '1' || req.query.offered === 'true';
  let sql = 'SELECT * FROM subjects';
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (gradeLevel) where.push('grade_level = ?');
  if (term) {
    if (term === 'all') where.push('term = ?');
    else where.push('(term = ? OR term = \'all\' OR term IS NULL)');
  }
  if (offeredOnly) where.push('is_offered = TRUE');
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY grade_level, term, code LIMIT ? OFFSET ?';
  if (gradeLevel) params.push(gradeLevel);
  if (term) params.push(term);
  params.push(limit, offset);
  res.json({ data: await qa(sql, params), limit, offset });
}));

router.post('/', requireRole(...WRITE_ROLES), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.code || !b.title || !b.grade_level) {
    return res.status(400).json({ error: 'code, title, grade_level are required' });
  }
  const term = b.term == null || b.term === '' ? null : (TERMS.includes(b.term) ? b.term : null);
  const exists = await q('SELECT id FROM subjects WHERE code = ?', [String(b.code).trim()]);
  if (exists) return res.status(409).json({ error: 'Subject code already exists' });
  const id = await qi('INSERT INTO subjects (code, title, description, grade_level, track, units, term, category, is_offered) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [String(b.code).trim(), String(b.title), b.description || null, String(b.grade_level), String(b.track) || 'general', Number(b.units) || 0, term,
      b.category || null, b.is_offered === undefined ? true : bool(b.is_offered)]);
  await audit(req, 'CREATE_SUBJECT', 'subjects', id, { code: b.code });
  res.status(201).json({ id });
}));

router.patch('/:id', requireRole(...WRITE_ROLES), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM subjects WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Subject not found' });
  const b = req.body || {};
  const f = (k: string, d: any) => b[k] !== undefined ? b[k] : d;
  const term = b.term !== undefined && b.term !== null && b.term !== ''
    ? (TERMS.includes(b.term) ? b.term : row.term)
    : row.term;
  if (b.code !== undefined) {
    const dup = await q('SELECT id FROM subjects WHERE code = ? AND id != ?', [String(b.code).trim(), row.id]);
    if (dup) return res.status(409).json({ error: 'Subject code already exists' });
  }
  await qr('UPDATE subjects SET code = ?, title = ?, description = ?, grade_level = ?, track = ?, units = ?, term = ?, category = ?, is_offered = ? WHERE id = ?',
    [f('code', row.code), f('title', row.title), f('description', row.description), f('grade_level', row.grade_level),
      f('track', row.track), f('units', row.units), term,
      b.category !== undefined ? b.category : row.category,
      b.is_offered !== undefined ? bool(b.is_offered) : row.is_offered, row.id]);
  await audit(req, 'UPDATE_SUBJECT', 'subjects', row.id);
  res.json({ ok: true });
}));

router.delete('/:id', requireRole(...WRITE_ROLES), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM subjects WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Subject not found' });
  await qr('DELETE FROM subjects WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_SUBJECT', 'subjects', row.id);
  res.json({ ok: true });
}));

export const subjectsRoutes = router;