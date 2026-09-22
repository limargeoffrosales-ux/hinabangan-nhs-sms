// Sections feature module
import { Router } from 'express';
import { q, qa, qi, qr } from '../../db';
import { authenticate, requireRole } from '../../auth';
import { asyncH, audit, page } from '../../utils';
import { teacherScope, sectionInScope, ensureTeacherSeesSection } from '../../scope';
import { WRITE_ROLES } from '../../constants';

const router = Router();
router.use(authenticate);

router.get('/', requireRole(...WRITE_ROLES, 'teacher', 'guidance'), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const schoolYear = req.query.school_year ? String(req.query.school_year) : null;
  let sql = 'SELECT s.*, t.first_name || \' \' || t.last_name AS adviser_name FROM sections s LEFT JOIN teachers t ON t.id = s.adviser_teacher_id';
  const params: (string | number)[] = [];
  const where: string[] = [];
  if (schoolYear) { where.push('s.school_year = ?'); params.push(schoolYear); }
  if (req.role === 'teacher') {
    const scope = await teacherScope(req.user);
    const f = sectionInScope(scope, 's');
    if (!f.sql) return res.json({ data: [], limit, offset });
    where.push(f.sql);
    params.push(...f.params);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY s.school_year DESC, s.grade_level, s.name LIMIT ? OFFSET ?';
  params.push(limit, offset);
  res.json({ data: await qa(sql, params), limit, offset });
}));

router.get('/:id/students', requireRole(...WRITE_ROLES, 'teacher', 'guidance'), asyncH(async (req, res) => {
  if (req.role === 'teacher') {
    const chk = await ensureTeacherSeesSection(req.user, req.params.id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }
  const rows = await qa(
    `SELECT st.id, st.lrn, st.first_name, st.middle_name, st.last_name, st.suffix, st.sex, st.grade_level
     FROM enrollments e JOIN students st ON st.id = e.student_id
     WHERE e.section_id = ? AND e.status = 'enrolled' ORDER BY st.last_name, st.first_name`,
    [req.params.id]);
  res.json({ data: rows });
}));

router.post('/', requireRole(...WRITE_ROLES), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.grade_level || !b.school_year) {
    return res.status(400).json({ error: 'name, grade_level, school_year are required' });
  }
  const exists = await q('SELECT id FROM sections WHERE name = ? AND school_year = ?', [String(b.name).trim(), String(b.school_year)]);
  if (exists) return res.status(409).json({ error: 'Section already exists for this school year' });
  const id = await qi(
    'INSERT INTO sections (name, grade_level, strand, adviser_teacher_id, room, capacity, school_year, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [String(b.name).trim(), String(b.grade_level), b.strand || null, b.adviser_teacher_id || null, b.room || null,
      b.capacity || 40, String(b.school_year), b.status || 'active']);
  await audit(req, 'CREATE_SECTION', 'sections', id, { name: b.name, school_year: b.school_year });
  res.status(201).json({ id });
}));

router.patch('/:id', requireRole(...WRITE_ROLES), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM sections WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Section not found' });
  const b = req.body || {};
  const f = (k: string, d: any) => b[k] !== undefined ? b[k] : d;
  await qr(
    'UPDATE sections SET name = ?, grade_level = ?, strand = ?, adviser_teacher_id = ?, room = ?, capacity = ?, school_year = ?, status = ? WHERE id = ?',
    [f('name', row.name), f('grade_level', row.grade_level), f('strand', row.strand),
      f('adviser_teacher_id', row.adviser_teacher_id), f('room', row.room), f('capacity', row.capacity),
      f('school_year', row.school_year), f('status', row.status), row.id]);
  await audit(req, 'UPDATE_SECTION', 'sections', row.id);
  res.json({ ok: true });
}));

router.delete('/:id', requireRole(...WRITE_ROLES), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM sections WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Section not found' });
  await qr('DELETE FROM sections WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_SECTION', 'sections', row.id);
  res.json({ ok: true });
}));

export const sectionsRoutes = router;