const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');

const router = express.Router();
router.use(authenticate);
const WRITE = ['super_admin', 'school_admin'];

/* ── Tracks ────────────────────────────────────────────── */

router.get('/tracks', requireRole(...WRITE), asyncH(async (req, res) => {
  let sql = 'SELECT * FROM tracks';
  const params = [];
  if (req.query.active === '1') {
    sql += ' WHERE active = TRUE';
  }
  sql += ' ORDER BY code';
  res.json({ data: await qa(sql, params) });
}));

router.post('/tracks', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.code || !b.name) {
    return res.status(400).json({ error: 'code and name are required' });
  }
  const exists = await q('SELECT id FROM tracks WHERE code = ?', [b.code.trim()]);
  if (exists) return res.status(409).json({ error: 'Track code already exists' });
  const id = await qi(
    'INSERT INTO tracks (code, name, description, grade_levels) VALUES (?, ?, ?, ?)',
    [b.code.trim(), b.name, b.description || null, b.grade_levels || null]
  );
  await audit(req, 'CREATE_TRACK', 'tracks', id, { code: b.code });
  res.status(201).json({ id });
}));

router.patch('/tracks/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM tracks WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Track not found' });
  const b = req.body || {};
  if (b.code !== undefined) {
    const dup = await q('SELECT id FROM tracks WHERE code = ? AND id != ?', [b.code.trim(), row.id]);
    if (dup) return res.status(409).json({ error: 'Track code already exists' });
  }
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  await qr(
    'UPDATE tracks SET code = ?, name = ?, description = ?, grade_levels = ? WHERE id = ?',
    [f('code', row.code), f('name', row.name), f('description', row.description), f('grade_levels', row.grade_levels), row.id]
  );
  await audit(req, 'UPDATE_TRACK', 'tracks', row.id);
  res.json({ ok: true });
}));

router.delete('/tracks/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM tracks WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Track not found' });
  const ref = await q('SELECT id FROM strands WHERE track_id = ? LIMIT 1', [row.id]);
  if (ref) return res.status(409).json({ error: 'Cannot delete track: strands still reference it' });
  await qr('DELETE FROM tracks WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_TRACK', 'tracks', row.id);
  res.json({ ok: true });
}));

/* ── Strands ───────────────────────────────────────────── */

router.get('/strands', requireRole(...WRITE), asyncH(async (req, res) => {
  let sql =
    `SELECT st.*, tr.name AS track_name
     FROM strands st
     LEFT JOIN tracks tr ON tr.id = st.track_id`;
  const params = [];
  const where = [];
  if (req.query.track_id) {
    where.push('st.track_id = ?');
    params.push(req.query.track_id);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY tr.code, st.code';
  res.json({ data: await qa(sql, params) });
}));

router.post('/strands', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.track_id || !b.code || !b.name) {
    return res.status(400).json({ error: 'track_id, code and name are required' });
  }
  const track = await q('SELECT id FROM tracks WHERE id = ?', [b.track_id]);
  if (!track) return res.status(404).json({ error: 'Track not found' });
  const exists = await q('SELECT id FROM strands WHERE code = ?', [b.code.trim()]);
  if (exists) return res.status(409).json({ error: 'Strand code already exists' });
  const id = await qi(
    'INSERT INTO strands (track_id, code, name, description) VALUES (?, ?, ?, ?)',
    [b.track_id, b.code.trim(), b.name, b.description || null]
  );
  await audit(req, 'CREATE_STRAND', 'strands', id, { code: b.code, track_id: b.track_id });
  res.status(201).json({ id });
}));

router.patch('/strands/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM strands WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Strand not found' });
  const b = req.body || {};
  if (b.code !== undefined) {
    const dup = await q('SELECT id FROM strands WHERE code = ? AND id != ?', [b.code.trim(), row.id]);
    if (dup) return res.status(409).json({ error: 'Strand code already exists' });
  }
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  await qr(
    'UPDATE strands SET track_id = ?, code = ?, name = ?, description = ? WHERE id = ?',
    [f('track_id', row.track_id), f('code', row.code), f('name', row.name), f('description', row.description), row.id]
  );
  await audit(req, 'UPDATE_STRAND', 'strands', row.id);
  res.json({ ok: true });
}));

router.delete('/strands/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM strands WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Strand not found' });
  const enr = await q('SELECT id FROM enrollments WHERE strand = (SELECT code FROM strands WHERE id = ?) LIMIT 1', [row.id]);
  if (enr) return res.status(409).json({ error: 'Cannot delete strand: enrollments reference it' });
  const sec = await q('SELECT id FROM sections WHERE strand = (SELECT code FROM strands WHERE id = ?) LIMIT 1', [row.id]);
  if (sec) return res.status(409).json({ error: 'Cannot delete strand: sections reference it' });
  await qr('DELETE FROM strands WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_STRAND', 'strands', row.id);
  res.json({ ok: true });
}));

/* ── Competencies ──────────────────────────────────────── */

router.get('/competencies', requireRole(...WRITE), asyncH(async (req, res) => {
  let sql =
    `SELECT c.*, st.name AS strand_name, tr.name AS track_name
     FROM competencies c
     LEFT JOIN strands st ON st.id = c.strand_id
     LEFT JOIN tracks tr ON tr.id = c.track_id`;
  const where = [];
  const params = [];
  if (req.query.strand_id) { where.push('c.strand_id = ?'); params.push(req.query.strand_id); }
  if (req.query.track_id) { where.push('c.track_id = ?'); params.push(req.query.track_id); }
  if (req.query.grade_level) { where.push('c.grade_level = ?'); params.push(req.query.grade_level); }
  if (req.query.quarter) { where.push('c.quarter = ?'); params.push(req.query.quarter); }
  if (req.query.competency_type) { where.push('c.competency_type = ?'); params.push(req.query.competency_type); }
  if (req.query.subject_area) { where.push('c.subject_area = ?'); params.push(req.query.subject_area); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY c.code';
  res.json({ data: await qa(sql, params) });
}));

router.post('/competencies', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.code || !b.title) {
    return res.status(400).json({ error: 'code and title are required' });
  }
  const exists = await q('SELECT id FROM competencies WHERE code = ?', [b.code.trim()]);
  if (exists) return res.status(409).json({ error: 'Competency code already exists' });
  const id = await qi(
    `INSERT INTO competencies (code, title, description, strand_id, track_id, grade_level, quarter, subject_area, competency_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.code.trim(), b.title, b.description || null, b.strand_id || null, b.track_id || null,
      b.grade_level || null, b.quarter || null, b.subject_area || null, b.competency_type || null]
  );
  await audit(req, 'CREATE_COMPETENCY', 'competencies', id, { code: b.code });
  res.status(201).json({ id });
}));

router.patch('/competencies/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM competencies WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Competency not found' });
  const b = req.body || {};
  if (b.code !== undefined) {
    const dup = await q('SELECT id FROM competencies WHERE code = ? AND id != ?', [b.code.trim(), row.id]);
    if (dup) return res.status(409).json({ error: 'Competency code already exists' });
  }
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  await qr(
    `UPDATE competencies SET code = ?, title = ?, description = ?, strand_id = ?, track_id = ?,
     grade_level = ?, quarter = ?, subject_area = ?, competency_type = ? WHERE id = ?`,
    [f('code', row.code), f('title', row.title), f('description', row.description),
      f('strand_id', row.strand_id), f('track_id', row.track_id), f('grade_level', row.grade_level),
      f('quarter', row.quarter), f('subject_area', row.subject_area), f('competency_type', row.competency_type), row.id]
  );
  await audit(req, 'UPDATE_COMPETENCY', 'competencies', row.id);
  res.json({ ok: true });
}));

router.delete('/competencies/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM competencies WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Competency not found' });
  await qr('DELETE FROM competencies WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_COMPETENCY', 'competencies', row.id);
  res.json({ ok: true });
}));

/* ── Subject-Competency mapping ────────────────────────── */

router.get('/subject-competencies', requireRole(...WRITE), asyncH(async (req, res) => {
  const subjectId = req.query.subject_id;
  if (!subjectId) return res.status(400).json({ error: 'subject_id is required' });
  const data = await qa(
    `SELECT sc.*, c.code AS competency_code, c.title AS competency_title, c.competency_type
     FROM subject_competencies sc
     JOIN competencies c ON c.id = sc.competency_id
     WHERE sc.subject_id = ?
     ORDER BY sc.quarter, sc.sort_order`,
    [subjectId]
  );
  res.json({ data });
}));

router.post('/subject-competencies', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.subject_id || !b.competency_id) {
    return res.status(400).json({ error: 'subject_id and competency_id are required' });
  }
  const exists = await q(
    'SELECT id FROM subject_competencies WHERE subject_id = ? AND competency_id = ?',
    [b.subject_id, b.competency_id]
  );
  if (exists) return res.status(409).json({ error: 'Mapping already exists' });
  const id = await qi(
    'INSERT INTO subject_competencies (subject_id, competency_id, quarter, sort_order) VALUES (?, ?, ?, ?)',
    [b.subject_id, b.competency_id, b.quarter || null, b.sort_order || 0]
  );
  await audit(req, 'CREATE_SUBJECT_COMPETENCY', 'subject_competencies', id, {
    subject_id: b.subject_id, competency_id: b.competency_id,
  });
  res.status(201).json({ id });
}));

router.delete('/subject-competencies/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM subject_competencies WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Mapping not found' });
  await qr('DELETE FROM subject_competencies WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_SUBJECT_COMPETENCY', 'subject_competencies', row.id);
  res.json({ ok: true });
}));

/* ── Subject Prerequisites ─────────────────────────────── */

router.get('/prerequisites', requireRole(...WRITE), asyncH(async (req, res) => {
  const subjectId = req.query.subject_id;
  if (!subjectId) return res.status(400).json({ error: 'subject_id is required' });
  const data = await qa(
    `SELECT sp.*, s.code AS prerequisite_code, s.title AS prerequisite_title
     FROM subject_prerequisites sp
     JOIN subjects s ON s.id = sp.prerequisite_id
     WHERE sp.subject_id = ?
     ORDER BY sp.required_grade`,
    [subjectId]
  );
  res.json({ data });
}));

router.post('/prerequisites', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.subject_id || !b.prerequisite_id) {
    return res.status(400).json({ error: 'subject_id and prerequisite_id are required' });
  }
  const exists = await q(
    'SELECT id FROM subject_prerequisites WHERE subject_id = ? AND prerequisite_id = ?',
    [b.subject_id, b.prerequisite_id]
  );
  if (exists) return res.status(409).json({ error: 'Prerequisite already exists' });
  const id = await qi(
    'INSERT INTO subject_prerequisites (subject_id, prerequisite_id, required_grade) VALUES (?, ?, ?)',
    [b.subject_id, b.prerequisite_id, b.required_grade || null]
  );
  await audit(req, 'CREATE_PREREQUISITE', 'subject_prerequisites', id, {
    subject_id: b.subject_id, prerequisite_id: b.prerequisite_id,
  });
  res.status(201).json({ id });
}));

router.delete('/prerequisites/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM subject_prerequisites WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Prerequisite not found' });
  await qr('DELETE FROM subject_prerequisites WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_PREREQUISITE', 'subject_prerequisites', row.id);
  res.json({ ok: true });
}));

/* ── Summary / Dashboard ───────────────────────────────── */

router.get('/summary', requireRole(...WRITE), asyncH(async (req, res) => {
  const [tracks] = await qa('SELECT COUNT(*) AS count FROM tracks');
  const [strands] = await qa('SELECT COUNT(*) AS count FROM strands');
  const [competencies] = await qa('SELECT COUNT(*) AS count FROM competencies');
  const byType = await qa(
    'SELECT competency_type, COUNT(*) AS count FROM competencies GROUP BY competency_type ORDER BY competency_type'
  );
  res.json({
    total_tracks: tracks.count,
    total_strands: strands.count,
    total_competencies: competencies.count,
    competencies_by_type: byType,
  });
}));

module.exports = router;
