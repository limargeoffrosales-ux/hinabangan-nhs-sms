const express = require('express');
const db = require('../db');
const { q, qa, qi, qr, nowSql } = db;
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');
const { getCurrentSchoolYear } = require('../schoolYear');

const router = express.Router();
router.use(authenticate);
const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'guidance'];

/* ── List cases ─────────────────────────────────────── */
router.get('/cases', requireRole(...WRITE), asyncH(async (req, res) => {
  const { status, case_type, student_id, school_year } = req.query;
  let sql = `SELECT gc.*,
    st.first_name || ' ' || st.last_name AS student_name, st.grade_level,
    sec.name AS section_name,
    ou.name AS opened_by_name,
    au.name AS assigned_to_name
    FROM guidance_cases gc
    LEFT JOIN students st ON st.id = gc.student_id
    LEFT JOIN enrollments e ON e.student_id = st.id AND e.status = 'enrolled'
    LEFT JOIN sections sec ON sec.id = e.section_id
    LEFT JOIN users ou ON ou.id = gc.opened_by
    LEFT JOIN users au ON au.id = gc.assigned_to`;
  const where = [];
  const params = [];
  if (status) { where.push('gc.status = ?'); params.push(status); }
  if (case_type) { where.push('gc.case_type = ?'); params.push(case_type); }
  if (student_id) { where.push('gc.student_id = ?'); params.push(student_id); }
  if (school_year) { where.push('gc.school_year = ?'); params.push(school_year); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY gc.opened_at DESC';
  res.json({ data: await qa(sql, params) });
}));

/* ── Case summary ──────────────────────────────────── */
router.get('/cases/summary', requireRole(...WRITE), asyncH(async (req, res) => {
  const sy = req.query.school_year || await getCurrentSchoolYear();
const total = await q('SELECT COUNT(*) AS count FROM guidance_cases WHERE school_year = ?',
    [sy]);
  const totalCount = Number(total?.count ?? total?.total ?? 0);
  const byStatus = await qa('SELECT status, COUNT(*) AS count FROM guidance_cases WHERE school_year = ? GROUP BY status', [sy]);
  const byType = await qa('SELECT case_type, COUNT(*) AS count FROM guidance_cases WHERE school_year = ? GROUP BY case_type', [sy]);
  const byPriority = await qa('SELECT priority, COUNT(*) AS count FROM guidance_cases WHERE school_year = ? GROUP BY priority', [sy]);
  res.json({ total: totalCount, by_status: byStatus, by_type: byType, by_priority: byPriority });
}));

/* ── Get single case with sessions ─────────────────── */
router.get('/cases/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q(
    `SELECT gc.*, st.first_name || ' ' || st.last_name AS student_name, st.grade_level,
      sec.name AS section_name
     FROM guidance_cases gc
     LEFT JOIN students st ON st.id = gc.student_id
     LEFT JOIN enrollments e ON e.student_id = st.id AND e.status = 'enrolled'
     LEFT JOIN sections sec ON sec.id = e.section_id
     WHERE gc.id = ?`, [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Case not found' });
  const sessions = await qa(
    `SELECT gs.*, u.name AS conducted_by_name
     FROM guidance_sessions gs LEFT JOIN users u ON u.id = gs.conducted_by
     WHERE gs.case_id = ? ORDER BY gs.session_date DESC`, [row.id]);
  res.json({ ...row, sessions });
}));

/* ── Create case ───────────────────────────────────── */
router.post('/cases', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.student_id || !b.case_type) return res.status(400).json({ error: 'student_id and case_type required' });
  const schoolYear = b.school_year || await getCurrentSchoolYear();
  const id = await qi(
    `INSERT INTO guidance_cases (student_id, case_type, priority, status, opened_by, assigned_to, summary, school_year)
     VALUES (?, ?, ?, 'open', ?, ?, ?, ?)`,
    [b.student_id, b.case_type, b.priority || 'normal', req.user.id,
      b.assigned_to || null, b.summary || null, schoolYear]
  );
  await audit(req, 'CREATE_GUIDANCE_CASE', 'guidance_cases', id);
  res.status(201).json({ id });
}));

/* ── Update case ───────────────────────────────────── */
router.patch('/cases/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM guidance_cases WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Case not found' });
  const b = req.body || {};
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  const newStatus = f('status', row.status);
  const closedAt = (newStatus === 'resolved' || newStatus === 'closed') && !row.closed_at ? new Date().toISOString() : row.closed_at;
  await qr(
    `UPDATE guidance_cases SET case_type=?, priority=?, status=?, assigned_to=?,
      summary=?, closed_at=?, updated_at=${nowSql()} WHERE id=?`,
    [f('case_type', row.case_type), f('priority', row.priority), newStatus,
      f('assigned_to', row.assigned_to), f('summary', row.summary), closedAt, row.id]
  );
  await audit(req, 'UPDATE_GUIDANCE_CASE', 'guidance_cases', row.id);
  res.json({ ok: true });
}));

/* ── Add session to case ───────────────────────────── */
router.post('/cases/:id/sessions', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM guidance_cases WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Case not found' });
  const b = req.body || {};
  if (!b.session_type || !b.notes) return res.status(400).json({ error: 'session_type and notes required' });
  const id = await qi(
    `INSERT INTO guidance_sessions (case_id, session_date, session_type, notes, action_items, conducted_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [row.id, b.session_date || new Date().toISOString(), b.session_type,
      b.notes, b.action_items || null, req.user.id]
  );
  await audit(req, 'CREATE_GUIDANCE_SESSION', 'guidance_sessions', id);
  res.status(201).json({ id });
}));

/* ── Delete case ───────────────────────────────────── */
router.delete('/cases/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM guidance_cases WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Case not found' });
  await db.tx(async (conn) => {
    await conn.qr('DELETE FROM guidance_sessions WHERE case_id = ?', [row.id]);
    await conn.qr('DELETE FROM guidance_cases WHERE id = ?', [row.id]);
  });
  await audit(req, 'DELETE_GUIDANCE_CASE', 'guidance_cases', row.id);
  res.json({ ok: true });
}));

module.exports = router;
