const express = require('express');
const db = require('../db');
const { q, qa, qi, qr, nowSql } = db;
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, safeJsonParse } = require('../utils');
const { teacherScope } = require('../scope');
const { getCurrentSchoolYear } = require('../schoolYear');

const router = express.Router();
router.use(authenticate);
const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'teacher'];

/* ── Lesson summary ─────────────────────────────────── */
router.get('/summary/stats', requireRole(...WRITE), asyncH(async (req, res) => {
  const teacherId = req.user.teacher_id;
  if (!teacherId) return res.json({ total: 0, by_status: [], by_quarter: [] });
  const where = teacherId ? ' WHERE l.teacher_id = ?' : '';
  const params = teacherId ? [teacherId] : [];
  const totalRow = await q(`SELECT COUNT(*) AS count FROM lessons l${where}`, params);
  const totalCount = Number(totalRow?.count ?? totalRow?.total ?? 0);
  const byStatus = await qa(`SELECT status, COUNT(*) AS count FROM lessons l${where} GROUP BY status`, params);
  const byQuarter = await qa(`SELECT quarter, COUNT(*) AS count FROM lessons l${where ? where + ' AND' : ' WHERE'} quarter IS NOT NULL GROUP BY quarter`, params);
  const bySubmission = await qa(`SELECT submission_status, COUNT(*) AS count FROM lessons l${where} GROUP BY submission_status`, params);
  res.json({
    total: totalCount,
    by_status: byStatus.map((x) => ({ status: x.status, count: Number(x.count) || 0 })),
    by_quarter: byQuarter.map((x) => ({ quarter: x.quarter, count: Number(x.count) || 0 })),
    by_submission: bySubmission.map((x) => ({ submission_status: x.submission_status, count: Number(x.count) || 0 })),
  });
}));

/* ── List lessons ────────────────────────────────────── */
router.get('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const { subject_id, section_id, school_year, quarter, teacher_id, status } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 50), 500);
  const offset = (page - 1) * limit;
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
  if (req.role === 'teacher') {
    const scope = await teacherScope(req.user);
    if (scope) {
      where.push('l.teacher_id = ?');
      params.push(scope.teacherId);
      if (scope.sections.length) {
        where.push('l.section_id IN (' + scope.sections.map(() => '?').join(',') + ')');
        params.push(...scope.sections);
      }
    } else {
      where.push('0 = 1');
    }
  }
  const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const total = Number((await q(`SELECT COUNT(*) AS total FROM lessons l${whereClause}`, params)).total || 0);
  sql += `${whereClause} ORDER BY l.scheduled_date DESC, l.created_at DESC LIMIT ? OFFSET ?`;
  const rows = await qa(sql, [...params, limit, offset]);
  res.json({ data: rows, total, page, limit, totalPages: Math.ceil(total / limit) });
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
  if (req.role === 'teacher' && row.teacher_id !== req.user.teacher_id) {
    return res.status(403).json({ error: 'Can only manage your own lessons' });
  }
  const competencies = row.competency_ids ? safeJsonParse(row.competency_ids, []) : [];
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
    [teacherId, b.subject_id, b.section_id || null, b.school_year || (await getCurrentSchoolYear()),
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
  if (req.role === 'teacher' && row.teacher_id !== req.user.teacher_id) {
    return res.status(403).json({ error: 'Can only manage your own lessons' });
  }
  const b = req.body || {};
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  const compIds = b.competency_ids ? JSON.stringify(b.competency_ids) : row.competency_ids;
  await qr(
    `UPDATE lessons SET subject_id=?, section_id=?, school_year=?, quarter=?, title=?,
      objectives=?, content_outline=?, teaching_strategy=?, materials=?, assessment_plan=?,
      competency_ids=?, duration_minutes=?, scheduled_date=?, status=?, notes=?, updated_at=${nowSql()}
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
  const row = await q('SELECT id, teacher_id FROM lessons WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Lesson not found' });
  if (req.role === 'teacher' && row.teacher_id !== req.user.teacher_id) {
    return res.status(403).json({ error: 'Can only manage your own lessons' });
  }
  await qr('DELETE FROM lessons WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_LESSON', 'lessons', row.id);
  res.json({ ok: true });
}));

/* ── Submit lesson for review ─────────────────────── */
router.post('/:id/submit', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM lessons WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Lesson not found' });
  if (row.submission_status === 'approved') return res.status(400).json({ error: 'Already approved' });
  if (req.role === 'teacher' && row.teacher_id !== req.user.teacher_id) {
    return res.status(403).json({ error: 'Can only submit your own lessons' });
  }
  await qr(
    `UPDATE lessons SET submission_status = 'submitted', submitted_at = ${nowSql()}, updated_at = ${nowSql()} WHERE id = ?`,
    [row.id]
  );
  await audit(req, 'SUBMIT_LESSON', 'lessons', row.id);
  res.json({ ok: true });
}));

/* ── Review lesson (approve / return) ─────────────── */
router.post('/:id/review', requireRole(...WRITE), asyncH(async (req, res) => {
  const REVIEWERS = ['super_admin', 'school_admin', 'principal', 'assistant_principal'];
  if (!REVIEWERS.includes(req.role)) return res.status(403).json({ error: 'Only administrators can review lessons' });
  const row = await q('SELECT * FROM lessons WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Lesson not found' });
  if (row.submission_status !== 'submitted') return res.status(400).json({ error: 'Lesson must be submitted before review' });
  const { action, review_notes } = req.body || {};
  if (!['approve', 'return'].includes(action)) return res.status(400).json({ error: 'action must be "approve" or "return"' });
  const newStatus = action === 'approve' ? 'approved' : 'returned';
  await qr(
    `UPDATE lessons SET submission_status = ?, reviewed_by = ?, reviewed_at = ${nowSql()},
      review_notes = ?, updated_at = ${nowSql()} WHERE id = ?`,
    [newStatus, req.user.id, review_notes || null, row.id]
  );
  await audit(req, action === 'approve' ? 'APPROVE_LESSON' : 'RETURN_LESSON', 'lessons', row.id, { review_notes });
  res.json({ ok: true });
}));

/* ── Copy lesson as template ──────────────────────── */
router.post('/:id/copy', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM lessons WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Lesson not found' });
  const newId = await qi(
    `INSERT INTO lessons (teacher_id, subject_id, section_id, school_year, quarter, title,
      objectives, content_outline, teaching_strategy, materials, assessment_plan,
      competency_ids, duration_minutes, scheduled_date, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
    [row.teacher_id, row.subject_id, row.section_id, row.school_year, row.quarter,
      row.title + ' (Copy)', row.objectives, row.content_outline, row.teaching_strategy,
      row.materials, row.assessment_plan, row.competency_ids, row.duration_minutes,
      null, row.notes]
  );
  await audit(req, 'COPY_LESSON', 'lessons', newId, { source_id: row.id });
  res.status(201).json({ id: newId });
}));

router.get('/pacing-check', requireRole(...WRITE), asyncH(async (req, res) => {
  const { school_year, quarter } = req.query;
  const teacherId = req.user.teacher_id;
  const where = [];
  const params = [];
  if (school_year) { where.push('l.school_year = ?'); params.push(school_year); }
  if (quarter) { where.push('l.quarter = ?'); params.push(Number(quarter)); }
  if (req.role === 'teacher' && teacherId) { where.push('l.teacher_id = ?'); params.push(teacherId); }

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const lessons = await qa(`SELECT l.id, l.title, l.quarter, l.scheduled_date, l.status, l.submission_status, s.title AS subject_name FROM lessons l LEFT JOIN subjects s ON s.id = l.subject_id ${whereSql}`, params);

  const byQuarter = {};
  for (const l of lessons) {
    const qKey = l.quarter || 1;
    byQuarter[qKey] = (byQuarter[qKey] || 0) + 1;
  }

  const pacingAnalysis = Object.keys(byQuarter).map((qNum) => {
    const count = byQuarter[qNum];
    const status = count >= 8 ? 'on_track' : count >= 4 ? 'moderate' : 'lagging';
    return {
      quarter: Number(qNum),
      lessons_logged: count,
      status,
      alert: status === 'lagging' ? 'Instructional pacing is falling behind the DepEd quarterly schedule. Consider adding supplementary lesson modules.' : null,
    };
  });

  res.json({ data: pacingAnalysis, total_lessons: lessons.length });
}));

module.exports = router;
