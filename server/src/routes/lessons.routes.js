const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');

const router = express.Router();
router.use(authenticate);
const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'teacher'];

/* ── List lessons ────────────────────────────────────── */
router.get('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const { subject_id, section_id, school_year, quarter, teacher_id, status } = req.query;
  let sql = `
    SELECT l.*, s.code AS subject_code, s.title AS subject_title,
           sec.name AS section_name, sec.grade_level,
           t.first_name || ' ' || t.last_name AS teacher_name
    FROM lessons l
    LEFT JOIN subjects s ON s.id = l.subject_id
    LEFT JOIN sections sec ON sec.id = l.section_id
    LEFT JOIN teachers t ON t.id = l.teacher_id`;
  const where = [];
  const params = [];
  if (subject_id) { where.push('l.subject_id = ?'); params.push(subject_id); }
  if (section_id) { where.push('l.section_id = ?'); params.push(section_id); }
  if (school_year) { where.push('l.school_year = ?'); params.push(school_year); }
  if (quarter) { where.push('l.quarter = ?'); params.push(Number(quarter)); }
  if (teacher_id) { where.push('l.teacher_id = ?'); params.push(teacher_id); }
  if (status) { where.push('l.status = ?'); params.push(status); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY l.scheduled_date DESC, l.created_at DESC';
  res.json({ data: await qa(sql, params) });
}));

/* ── Get single lesson ──────────────────────────────── */
router.get('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q(
    `SELECT l.*, s.code AS subject_code, s.title AS subject_title,
            sec.name AS section_name, sec.grade_level,
            t.first_name || ' ' || t.last_name AS teacher_name
     FROM lessons l
     LEFT JOIN subjects s ON s.id = l.subject_id
     LEFT JOIN sections sec ON sec.id = l.section_id
     LEFT JOIN teachers t ON t.id = l.teacher_id
     WHERE l.id = ?`, [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Lesson not found' });
  const competencies = row.competency_ids ? JSON.parse(row.competency_ids) : [];
  if (competencies.length) {
    const comps = await qa('SELECT id, code, title FROM competencies WHERE id IN (' + competencies.map(() => '?').join(',') + ')', competencies);
    row.competency_list = comps;
  } else {
    row.competency_list = [];
  }
  res.json(row);
}));

/* ── Create lesson ──────────────────────────────────── */
router.post('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.subject_id) {
    return res.status(400).json({ error: 'title and subject_id are required' });
  }
  const teacherId = req.user.teacher_id || b.teacher_id;
  if (!teacherId) return res.status(400).json({ error: 'teacher_id is required' });
  const compIds = Array.isArray(b.competency_ids) ? JSON.stringify(b.competency_ids) : '[]';
  const id = await qi(
    `INSERT INTO lessons (teacher_id, subject_id, section_id, school_year, quarter, title,
      objectives, content_outline, teaching_strategy, materials, assessment_plan,
      competency_ids, duration_minutes, scheduled_date, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [teacherId, b.subject_id, b.section_id || null, b.school_year || '2026-2027',
      b.quarter || null, b.title, b.objectives || null, b.content_outline || null,
      b.teaching_strategy || null, b.materials || null, b.assessment_plan || null,
      compIds, b.duration_minutes || 60, b.scheduled_date || null, b.status || 'draft', b.notes || null]
  );
  await audit(req, 'CREATE_LESSON', 'lessons', id, { title: b.title });
  res.status(201).json({ id });
}));

/* ── Update lesson ──────────────────────────────────── */
router.patch('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM lessons WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Lesson not found' });
  const b = req.body || {};
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  const compIds = b.competency_ids ? JSON.stringify(b.competency_ids) : row.competency_ids;
  await qr(
    `UPDATE lessons SET subject_id=?, section_id=?, school_year=?, quarter=?, title=?,
      objectives=?, content_outline=?, teaching_strategy=?, materials=?, assessment_plan=?,
      competency_ids=?, duration_minutes=?, scheduled_date=?, status=?, notes=?, updated_at=NOW()
     WHERE id=?`,
    [f('subject_id', row.subject_id), f('section_id', row.section_id), f('school_year', row.school_year),
      f('quarter', row.quarter), f('title', row.title), f('objectives', row.objectives),
      f('content_outline', row.content_outline), f('teaching_strategy', row.teaching_strategy),
      f('materials', row.materials), f('assessment_plan', row.assessment_plan),
      compIds, f('duration_minutes', row.duration_minutes), f('scheduled_date', row.scheduled_date),
      f('status', row.status), f('notes', row.notes), row.id]
  );
  await audit(req, 'UPDATE_LESSON', 'lessons', row.id);
  res.json({ ok: true });
}));

/* ── Delete lesson ──────────────────────────────────── */
router.delete('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM lessons WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Lesson not found' });
  await qr('DELETE FROM lessons WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_LESSON', 'lessons', row.id);
  res.json({ ok: true });
}));

/* ── Lesson summary ─────────────────────────────────── */
router.get('/summary/stats', requireRole(...WRITE), asyncH(async (req, res) => {
  const teacherId = req.user.teacher_id;
  if (!teacherId) return res.json({ total: 0, by_status: [], by_quarter: [] });
  const where = teacherId ? ' WHERE l.teacher_id = ?' : '';
  const params = teacherId ? [teacherId] : [];
  const total = await q(`SELECT COUNT(*) AS count FROM lessons l${where}`, params);
  const byStatus = await qa(`SELECT status, COUNT(*) AS count FROM lessons l${where} GROUP BY status`, params);
  const byQuarter = await qa(`SELECT quarter, COUNT(*) AS count FROM lessons l${where} AND quarter IS NOT NULL GROUP BY quarter`, params);
  res.json({ total: total.count, by_status: byStatus, by_quarter: byQuarter });
}));

module.exports = router;
