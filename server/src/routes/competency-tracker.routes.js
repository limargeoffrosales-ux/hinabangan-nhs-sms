const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');
const { linkedStudentIds } = require('../scope');

const router = express.Router();
router.use(authenticate);
const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'teacher'];

/* ── Get competencies for a subject ─────────────────── */
router.get('/competencies', requireRole(...WRITE), asyncH(async (req, res) => {
  const { subject_id, quarter, grade_level } = req.query;
  let sql = `
    SELECT c.*, sc.sort_order, sc.quarter AS map_quarter
    FROM competencies c
    LEFT JOIN subject_competencies sc ON sc.competency_id = c.id`;
  const where = [];
  const params = [];
  if (subject_id) { where.push('sc.subject_id = ?'); params.push(subject_id); }
  if (quarter) { where.push('sc.quarter = ?'); params.push(Number(quarter)); }
  if (grade_level) { where.push('c.grade_level = ?'); params.push(grade_level); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY sc.sort_order, c.code';
  res.json({ data: await qa(sql, params) });
}));

/* ── Get student competency scores ──────────────────── */
router.get('/scores', requireRole(...WRITE), asyncH(async (req, res) => {
  const { section_id, subject_id, school_year, quarter, student_id } = req.query;
  let sql = `
    SELECT scs.*, c.code AS competency_code, c.title AS competency_title, c.competency_type,
           st.first_name || ' ' || st.last_name AS student_name, st.lrn
    FROM student_competency_scores scs
    JOIN competencies c ON c.id = scs.competency_id
    JOIN students st ON st.id = scs.student_id`;
  const where = [];
  const params = [];
  if (section_id) { where.push('scs.section_id = ?'); params.push(section_id); }
  if (subject_id) { where.push('scs.subject_id = ?'); params.push(subject_id); }
  if (school_year) { where.push('scs.school_year = ?'); params.push(school_year); }
  if (quarter) { where.push('scs.quarter = ?'); params.push(Number(quarter)); }
  if (student_id) { where.push('scs.student_id = ?'); params.push(student_id); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY st.last_name, st.first_name, c.code';
  res.json({ data: await qa(sql, params) });
}));

/* ── Upsert student competency score ────────────────── */
router.post('/scores', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.student_id || !b.competency_id || !b.school_year) {
    return res.status(400).json({ error: 'student_id, competency_id, and school_year are required' });
  }
  const level = scoreToLevel(b.score);
  const existing = await q(
    'SELECT id FROM student_competency_scores WHERE student_id = ? AND competency_id = ? AND subject_id IS NOT DISTINCT FROM ? AND school_year = ? AND quarter IS NOT DISTINCT FROM ?',
    [b.student_id, b.competency_id, b.subject_id || null, b.school_year, b.quarter || null]
  );
  if (existing) {
    await qr(
      `UPDATE student_competency_scores SET score=?, level=?, evidence=?, assessed_by=?, assessed_at=NOW(), updated_at=NOW()
       WHERE id=?`,
      [b.score || null, level, b.evidence || null, req.user.teacher_id || null, existing.id]
    );
    await audit(req, 'UPDATE_COMPETENCY_SCORE', 'student_competency_scores', existing.id);
  } else {
    const id = await qi(
      `INSERT INTO student_competency_scores (student_id, competency_id, subject_id, section_id, school_year, quarter, score, level, evidence, assessed_by, assessed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [b.student_id, b.competency_id, b.subject_id || null, b.section_id || null,
        b.school_year, b.quarter || null, b.score || null, level, b.evidence || null, req.user.teacher_id || null]
    );
    await audit(req, 'CREATE_COMPETENCY_SCORE', 'student_competency_scores', id);
  }
  res.json({ ok: true, level });
}));

/* ── Batch upsert scores ────────────────────────────── */
router.post('/scores/batch', requireRole(...WRITE), asyncH(async (req, res) => {
  const { scores, school_year, quarter, subject_id, section_id } = req.body || {};
  if (!scores || !Array.isArray(scores) || !school_year) {
    return res.status(400).json({ error: 'scores array and school_year are required' });
  }
  let saved = 0;
  for (const s of scores) {
    if (!s.student_id || !s.competency_id) continue;
    const level = scoreToLevel(s.score);
    const existing = await q(
      'SELECT id FROM student_competency_scores WHERE student_id = ? AND competency_id = ? AND subject_id IS NOT DISTINCT FROM ? AND school_year = ? AND quarter IS NOT DISTINCT FROM ?',
      [s.student_id, s.competency_id, subject_id || null, school_year, quarter || null]
    );
    if (existing) {
      await qr('UPDATE student_competency_scores SET score=?, level=?, assessed_by=?, assessed_at=NOW(), updated_at=NOW() WHERE id=?',
        [s.score || null, level, req.user.teacher_id || null, existing.id]);
    } else {
      await qi(
        `INSERT INTO student_competency_scores (student_id, competency_id, subject_id, section_id, school_year, quarter, score, level, assessed_by, assessed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [s.student_id, s.competency_id, subject_id || null, section_id || null,
          school_year, quarter || null, s.score || null, level, req.user.teacher_id || null]
      );
    }
    saved++;
  }
  await audit(req, 'BATCH_COMPETENCY_SCORES', 'student_competency_scores', null, { count: saved });
  res.json({ ok: true, saved });
}));

/* ── Class competency overview ──────────────────────── */
router.get('/class-overview', requireRole(...WRITE), asyncH(async (req, res) => {
  const { section_id, subject_id, school_year, quarter } = req.query;
  if (!section_id || !subject_id || !school_year) {
    return res.status(400).json({ error: 'section_id, subject_id, and school_year are required' });
  }

  const competencies = await qa(
    `SELECT c.id, c.code, c.title, c.competency_type, sc.quarter
     FROM subject_competencies sc
     JOIN competencies c ON c.id = sc.competency_id
     WHERE sc.subject_id = ? ${quarter ? 'AND sc.quarter = ?' : ''}
     ORDER BY sc.sort_order, c.code`,
    quarter ? [subject_id, Number(quarter)] : [subject_id]
  );

  const students = await qa(
    `SELECT e.student_id, st.first_name || ' ' || st.last_name AS name, st.lrn
     FROM enrollments e
     JOIN students st ON st.id = e.student_id
     WHERE e.section_id = ? AND e.status = 'enrolled'
     ORDER BY st.last_name, st.first_name`,
    [section_id]
  );

  const scores = await qa(
    `SELECT scs.student_id, scs.competency_id, scs.score, scs.level
     FROM student_competency_scores scs
     WHERE scs.section_id = ? AND scs.subject_id = ? AND scs.school_year = ? ${quarter ? 'AND scs.quarter = ?' : ''}`,
    quarter ? [section_id, subject_id, school_year, Number(quarter)] : [section_id, subject_id, school_year]
  );

  const scoreMap = {};
  for (const s of scores) {
    const key = `${s.student_id}-${s.competency_id}`;
    scoreMap[key] = { score: s.score, level: s.level };
  }

  const summary = competencies.map((c) => {
    const compScores = students.map((st) => scoreMap[`${st.student_id}-${c.id}`] || { score: null, level: null });
    const scored = compScores.filter((s) => s.score != null);
    return {
      competency_id: c.id, code: c.code, title: c.title, type: c.competency_type, quarter: c.quarter,
      avg_score: scored.length ? Math.round(scored.reduce((a, s) => a + Number(s.score), 0) / scored.length * 100) / 100 : null,
      scored_count: scored.length,
      total_students: students.length,
      levels: {
        Advanced: scored.filter((s) => s.level === 'Advanced').length,
        Proficient: scored.filter((s) => s.level === 'Proficient').length,
        'Approaching Proficiency': scored.filter((s) => s.level === 'Approaching Proficiency').length,
        Developing: scored.filter((s) => s.level === 'Developing').length,
        Beginning: scored.filter((s) => s.level === 'Beginning').length,
      },
    };
  });

  res.json({ competencies, students, summary });
}));

/* ── Student competency summary ─────────────────────── */
router.get('/student-summary', requireRole(...WRITE, 'student', 'parent'), asyncH(async (req, res) => {
  const { student_id, school_year } = req.query;
  if (!student_id || !school_year) {
    return res.status(400).json({ error: 'student_id and school_year are required' });
  }
  if (req.role === 'student' || req.role === 'parent') {
    const ids = await linkedStudentIds(req.user);
    if (!ids.includes(Number(student_id))) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }
  const rows = await qa(
    `SELECT scs.*, c.code AS competency_code, c.title AS competency_title, c.competency_type,
            s.code AS subject_code, s.title AS subject_title
     FROM student_competency_scores scs
     JOIN competencies c ON c.id = scs.competency_id
     LEFT JOIN subjects s ON s.id = scs.subject_id
     WHERE scs.student_id = ? AND scs.school_year = ?
     ORDER BY s.code, scs.quarter, c.code`,
    [student_id, school_year]
  );
  res.json({ data: rows });
}));

function scoreToLevel(score) {
  if (score == null) return null;
  const n = Number(score);
  if (n >= 90) return 'Advanced';
  if (n >= 85) return 'Proficient';
  if (n >= 80) return 'Approaching Proficiency';
  if (n >= 75) return 'Developing';
  return 'Beginning';
}

module.exports = router;
