const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole, ADMIN_ROLES, isAdminRole } = require('../auth');
const { asyncH, audit } = require('../utils');

const router = express.Router();
router.use(authenticate);

const WRITE = [...ADMIN_ROLES, 'teacher', 'guidance'];

const LEVELS = ['Independent', 'Instructional', 'Frustration', 'Non-Reader'];
const LEVEL_ORDER = { Independent: 1, Instructional: 2, Frustration: 3, 'Non-Reader': 4 };
const NUM_LEVELS = ['Independent', 'Developing', 'Frustration', 'Non-Numerate'];
const FLUENCY = ['Fluent', 'Fairly Fluent', 'Slow', 'Non-Fluent'];

router.get('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const { kind, student_id } = req.query;
  let sql = `SELECT l.*, s.first_name, s.last_name, s.grade_level, sec.name AS section_name
             FROM learner_assessments l
             JOIN students s ON s.id = l.student_id
             LEFT JOIN sections sec ON sec.id = (SELECT section_id FROM enrollments e WHERE e.student_id = l.student_id AND e.school_year = ?)`;
  const params = [req.query.school_year || '2025-2026'];
  const where = [];
  if (kind) { where.push('l.kind = ?'); params.push(kind); }
  if (student_id) { where.push('l.student_id = ?'); params.push(student_id); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY l.date DESC, l.id DESC';
  const rows = await qa(sql, params);
  res.json({ data: rows });
}));

router.get('/students', requireRole(...WRITE), asyncH(async (req, res) => {
  const rows = await qa(
    `SELECT s.id, s.first_name, s.last_name, s.grade_level, s.sex, sec.name AS section_name,
            (SELECT level FROM learner_assessments la WHERE la.student_id = s.id AND la.kind = 'reading' AND la.level IS NOT NULL ORDER BY la.id DESC LIMIT 1) AS reading_level,
            (SELECT score FROM learner_assessments la WHERE la.student_id = s.id AND la.kind = 'reading' ORDER BY la.id DESC LIMIT 1) AS last_reading_score,
            (SELECT max_score FROM learner_assessments la WHERE la.student_id = s.id AND la.kind = 'reading' ORDER BY la.id DESC LIMIT 1) AS last_reading_max,
            (SELECT level FROM learner_assessments la WHERE la.student_id = s.id AND la.kind = 'numeracy' AND la.level IS NOT NULL ORDER BY la.id DESC LIMIT 1) AS numeracy_level
     FROM students s
     LEFT JOIN enrollments e ON e.student_id = s.id AND e.school_year = ?
     LEFT JOIN sections sec ON sec.id = e.section_id
     ORDER BY s.last_name`,
    [req.query.school_year || '2025-2026']);
  const out = rows.map((r) => {
    const lvl = LEVEL_ORDER[r.reading_level] || null;
    return {
      ...r,
      risk: lvl ? (lvl >= 3 ? 'At risk' : 'On track') : 'Not assessed',
    };
  });
  res.json({ data: out });
}));

router.get('/stats', requireRole(...WRITE), asyncH(async (req, res) => {
  const reading = await qa(
    "SELECT level, COUNT(*) AS n FROM learner_assessments WHERE kind = 'reading' AND level IS NOT NULL GROUP BY level");
  const numeracy = await qa(
    "SELECT level, COUNT(*) AS n FROM learner_assessments WHERE kind = 'numeracy' AND level IS NOT NULL GROUP BY level");
  const distribution = ['Independent', 'Instructional', 'Frustration', 'Non-Reader'].map((l) => {
    const r = reading.find((x) => x.level === l);
    return { name: l, value: Number(r ? r.n : 0) };
  });
  const growth = await qa(
    `SELECT date, AVG(1.0 * score / NULLIF(max_score, 0)) * 100 AS avg_pct
     FROM learner_assessments WHERE kind = 'reading' AND score IS NOT NULL AND max_score > 0
     GROUP BY date ORDER BY date LIMIT 10`);
  const riskCount = Number((await q(
    "SELECT COUNT(DISTINCT student_id) AS n FROM learner_assessments WHERE kind = 'reading' AND level IN ('Frustration','Non-Reader')")).n);
  res.json({
    distribution, growth: growth.map((g) => ({ date: g.date, pct: Math.round(g.avg_pct) })),
    risk_count: riskCount,
    assessed: Number((await q("SELECT COUNT(DISTINCT student_id) AS n FROM learner_assessments WHERE kind = 'reading'")).n),
    numeracy: numeracy,
  });
}));

router.post('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.student_id || !b.date) return res.status(400).json({ error: 'student_id and date are required' });
  const student = await q('SELECT id FROM students WHERE id = ?', [b.student_id]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const kind = b.kind === 'numeracy' ? 'numeracy' : 'reading';
  let level = b.level || null;
  if (!level) {
    const pct = b.score != null && b.max_score > 0 ? (b.score / b.max_score) * 100 : null;
    if (pct != null) {
      if (kind === 'reading') {
        level = pct >= 80 ? 'Independent' : pct >= 60 ? 'Instructional' : pct >= 40 ? 'Frustration' : 'Non-Reader';
      } else {
        level = pct >= 80 ? 'Independent' : pct >= 60 ? 'Developing' : pct >= 40 ? 'Frustration' : 'Non-Numerate';
      }
    }
  }
  const id = await qi(
    `INSERT INTO learner_assessments (student_id, kind, assessment_type, date, score, max_score, level, fluency, comprehension, remarks, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (student_id, kind, assessment_type, date) DO UPDATE SET
       score = excluded.score, max_score = excluded.max_score, level = excluded.level,
       fluency = excluded.fluency, comprehension = excluded.comprehension, remarks = excluded.remarks`,
    [b.student_id, kind, b.assessment_type || 'PHIL-IRI', b.date,
      b.score != null ? Number(b.score) : null, b.max_score != null ? Number(b.max_score) : null,
      level, b.fluency || null, b.comprehension || null, b.remarks || null, req.user.id]);
  await audit(req, 'SAVE_ASSESSMENT', 'learner_assessments', id, { student: b.student_id, kind, level });
  res.status(201).json({ id, level });
}));

router.patch('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM learner_assessments WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Record not found' });
  const b = req.body || {};
  const f = (k) => b[k] !== undefined ? b[k] : row[k];
  await qr(
    `UPDATE learner_assessments SET score = ?, max_score = ?, level = ?, fluency = ?, comprehension = ?, remarks = ? WHERE id = ?`,
    [f('score'), f('max_score'), f('level'), f('fluency'), f('comprehension'), f('remarks'), row.id]);
  await audit(req, 'UPDATE_ASSESSMENT', 'learner_assessments', row.id);
  res.json({ ok: true });
}));

router.delete('/:id', requireRole(...ADMIN_ROLES, 'teacher', 'guidance'), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM learner_assessments WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Record not found' });
  if (row.recorded_by !== req.user.id && !isAdminRole(req.user.role)) {
    return res.status(403).json({ error: 'Only the recorder or an admin can delete' });
  }
  await qr('DELETE FROM learner_assessments WHERE id = ?', [row.id]);
  res.json({ ok: true });
}));

module.exports = router;
