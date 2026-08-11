const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole, ADMIN_ROLES, isAdminRole } = require('../auth');
const { asyncH, audit } = require('../utils');

const router = express.Router();
router.use(authenticate);

const WRITE = [...ADMIN_ROLES, 'teacher', 'librarian', 'ict'];

function canManage(req, row) {
  return row.user_id === req.user.id || isAdminRole(req.user.role);
}

router.get('/', asyncH(async (req, res) => {
  const rows = await qa(
    `SELECT p.*, u.name AS user_name FROM research_projects p JOIN users u ON u.id = p.user_id
     ORDER BY p.updated_at DESC`);
  for (const r of rows) {
    r.versions = await qa('SELECT id, version_no, note, created_at FROM research_versions WHERE project_id = ? ORDER BY version_no DESC', [r.id]);
    r.milestones = await qa('SELECT id, milestone, target_date, status, note FROM research_milestones WHERE project_id = ? ORDER BY target_date', [r.id]);
  }
  res.json({ data: rows });
}));

router.get('/:id', asyncH(async (req, res) => {
  const row = await q('SELECT * FROM research_projects WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Project not found' });
  row.versions = await qa('SELECT * FROM research_versions WHERE project_id = ? ORDER BY version_no DESC', [row.id]);
  row.milestones = await qa('SELECT * FROM research_milestones WHERE project_id = ? ORDER BY target_date', [row.id]);
  res.json({ detail: row });
}));

router.post('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.title) return res.status(400).json({ error: 'title is required' });
  const id = await qi(
    `INSERT INTO research_projects (user_id, title, research_type, status, abstract, methodology, findings, conclusion, funding_source, timeline_start, timeline_end)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, b.title, b.research_type || 'Action Research', b.status || 'draft',
      b.abstract || null, b.methodology || null, b.findings || null, b.conclusion || null,
      b.funding_source || null, b.timeline_start || null, b.timeline_end || null]);
  await audit(req, 'CREATE_RESEARCH', 'research_projects', id, { title: b.title });
  res.status(201).json({ id, detail: await q('SELECT * FROM research_projects WHERE id = ?', [id]) });
}));

router.patch('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM research_projects WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Project not found' });
  if (!canManage(req, row)) return res.status(403).json({ error: 'Only the owner or an admin can edit' });
  const b = req.body || {};
  const f = (k) => b[k] !== undefined ? b[k] : row[k];
  await qr(
    `UPDATE research_projects SET title = ?, research_type = ?, status = ?, abstract = ?, methodology = ?,
     findings = ?, conclusion = ?, funding_source = ?, timeline_start = ?, timeline_end = ?, updated_at = datetime('now') WHERE id = ?`,
    [f('title'), f('research_type'), f('status'), f('abstract'), f('methodology'),
      f('findings'), f('conclusion'), f('funding_source'), f('timeline_start'), f('timeline_end'), row.id]);
  await audit(req, 'UPDATE_RESEARCH', 'research_projects', row.id);
  res.json({ detail: await q('SELECT * FROM research_projects WHERE id = ?', [row.id]) });
}));

router.delete('/:id', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM research_projects WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Project not found' });
  if (!canManage(req, row)) return res.status(403).json({ error: 'Not allowed' });
  await qr('DELETE FROM research_projects WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_RESEARCH', 'research_projects', row.id);
  res.json({ ok: true });
}));

router.post('/:id/versions', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM research_projects WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Project not found' });
  if (!canManage(req, row)) return res.status(403).json({ error: 'Not allowed' });
  const b = req.body || {};
  const last = await q('SELECT MAX(version_no) AS m FROM research_versions WHERE project_id = ?', [row.id]);
  const vno = Number(last && last.m) + 1 || 1;
  const id = await qi(
    'INSERT INTO research_versions (project_id, version_no, content, note, created_by) VALUES (?, ?, ?, ?, ?)',
    [row.id, vno, b.content || null, b.note || `Version ${vno}`, req.user.id]);
  await audit(req, 'SAVE_RESEARCH_VERSION', 'research_versions', id, { project: row.id, version: vno });
  res.status(201).json({ id, version_no: vno });
}));

router.post('/:id/milestones', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM research_projects WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Project not found' });
  if (!canManage(req, row)) return res.status(403).json({ error: 'Not allowed' });
  const b = req.body || {};
  if (!b.milestone) return res.status(400).json({ error: 'milestone is required' });
  const id = await qi(
    'INSERT INTO research_milestones (project_id, milestone, target_date, status, note) VALUES (?, ?, ?, ?, ?)',
    [row.id, b.milestone, b.target_date || null, b.status || 'pending', b.note || null]);
  await audit(req, 'ADD_RESEARCH_MILESTONE', 'research_milestones', id, { project: row.id });
  res.status(201).json({ id });
}));

router.patch('/milestones/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM research_milestones WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Milestone not found' });
  const proj = await q('SELECT * FROM research_projects WHERE id = ?', [row.project_id]);
  if (!canManage(req, proj)) return res.status(403).json({ error: 'Not allowed' });
  const b = req.body || {};
  const f = (k) => b[k] !== undefined ? b[k] : row[k];
  await qr('UPDATE research_milestones SET milestone = ?, target_date = ?, status = ?, note = ? WHERE id = ?',
    [f('milestone'), f('target_date'), f('status'), f('note'), row.id]);
  res.json({ ok: true });
}));

router.post('/ai/title', asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.topic) return res.status(400).json({ error: 'topic is required' });
  const t = b.topic.trim();
  const n = b.school || 'Hinabangan National High School';
  const titles = [
    `Enhancing ${n}: ${t} Among Senior High School Learners`,
    `A Study on ${t} in ${n}: Basis for an Intervention Program`,
    `${t} in the Senior High School: Challenges, Practices, and Interventions`,
    `Improving ${t} Through Contextualized Instructional Materials at ${n}`,
    `Learners' Perspectives on ${t}: A Basis for Policy Enhancement`,
    `Effectiveness of Remedial Strategies in Addressing ${t} at ${n}`,
  ];
  res.json({ titles });
}));

router.post('/ai/citation', asyncH(async (req, res) => {
  const b = req.body || {};
  const author = b.author || 'Author, A. A.';
  const year = b.year || '2026';
  const title = b.title || 'Title of the Work';
  const venue = b.venue || 'Journal Name, Volume(Issue), pages';
  res.json({
    apa7: `${author} (${year}). ${title}. ${venue}.`,
    intext: `(${author.split(',').reverse().join(' ')}, ${year})`,
  });
}));

module.exports = router;
