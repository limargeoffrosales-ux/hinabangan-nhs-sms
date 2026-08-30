const express = require('express');
const { q, qa, qi, qr, nowSql } = require('../db');
const db = require('../db');
const { authenticate, requireRole, ADMIN_ROLES, isAdminRole } = require('../auth');
const { asyncH, audit, esc } = require('../utils');
const { paginate } = require('../pagination');
const { getCurrentSchoolYear } = require('../schoolYear');
const { ensureTeacherSeesStudent } = require('../scope');

const router = express.Router();
router.use(authenticate);

const WRITE = [...ADMIN_ROLES, 'teacher', 'guidance', 'nurse'];

const CATEGORIES = [
  'academic_recovery', 'remediation', 'enrichment', 'attendance', 'behavior',
  'guidance', 'health', 'reading', 'numeracy', 'home_visitation',
];

function withStudent(row, ctx) {
  if (!row) return null;
  return { ...row, student_name: ctx ? `${ctx.first_name} ${ctx.last_name}` : null };
}

router.get('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const { status, student_id } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 25), 500);
  const offset = (page - 1) * limit;
  const sy = req.query.school_year || await getCurrentSchoolYear();
  const baseSql = `SELECT p.*, s.first_name, s.last_name, s.grade_level, sec.name AS section_name, u.name AS recorder_name
             FROM intervention_plans p
             JOIN students s ON s.id = p.student_id
             LEFT JOIN sections sec ON sec.id = (SELECT section_id FROM enrollments e WHERE e.student_id = p.student_id AND e.school_year = ?)
             LEFT JOIN users u ON u.id = p.recorded_by`;
  const where = [];
  const params = [sy];
  if (status) { where.push('p.status = ?'); params.push(status); }
  if (student_id) { where.push('p.student_id = ?'); params.push(student_id); }
  const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const totalResult = await q(`SELECT COUNT(*) AS total FROM intervention_plans p${whereClause}`, where.length ? params.slice(1) : []);
  const total = Number(totalResult?.total || 0);
  const rows = await qa(`${baseSql}${whereClause} ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  const contacts = rows.length ? await qa(
    `SELECT * FROM intervention_contacts WHERE plan_id IN (${rows.map(() => '?').join(',')}) ORDER BY contact_date DESC`,
    rows.map((r) => r.id)) : [];
  const contactsByPlan = {};
  for (const c of contacts) (contactsByPlan[c.plan_id] = contactsByPlan[c.plan_id] || []).push(c);
  for (const r of rows) r.contacts = contactsByPlan[r.id] || [];
  res.json({ data: rows, total, page, limit, totalPages: Math.ceil(total / limit), categories: CATEGORIES });
}));

router.get('/stats', requireRole(...WRITE), asyncH(async (_req, res) => {
  const byCat = await qa('SELECT category, COUNT(*) AS n FROM intervention_plans GROUP BY category');
  const byStatus = await qa('SELECT status, COUNT(*) AS n FROM intervention_plans GROUP BY status');
  res.json({
    by_category: byCat, by_status: byStatus,
    active: Number((await q("SELECT COUNT(*) AS n FROM intervention_plans WHERE status = 'active'")).n),
    total: Number((await q('SELECT COUNT(*) AS n FROM intervention_plans')).n),
  });
}));

router.get('/at-risk', requireRole(...WRITE), asyncH(async (req, res) => {
  const sy = req.query.school_year || await getCurrentSchoolYear();

  // Batch all independent queries in parallel
  const [gradeRows, att, readLast, existing] = await Promise.all([
    qa(
      `SELECT g.student_id, s.first_name, s.last_name, s.grade_level, sec.name AS section_name, s.sex,
              AVG(g.computed_grade) AS avg_grade
       FROM grades g JOIN students s ON s.id = g.student_id
       LEFT JOIN sections sec ON sec.id = g.section_id
       WHERE g.school_year = ? GROUP BY g.student_id, s.first_name, s.last_name, s.grade_level, s.sex, sec.name`, [sy]),
    qa(
      `SELECT student_id, SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absents, COUNT(*) AS days
       FROM attendance GROUP BY student_id`),
    qa(
      `SELECT la.student_id, la.level FROM learner_assessments la
       WHERE la.kind = 'reading' AND la.level IS NOT NULL
         AND la.id = (SELECT MAX(l2.id) FROM learner_assessments l2 WHERE l2.student_id = la.student_id AND l2.kind = 'reading')`),
    qa('SELECT DISTINCT student_id FROM intervention_plans'),
  ]);

  const attMap = {};
  for (const a of att) attMap[a.student_id] = { absents: Number(a.absents || 0), days: Number(a.days || 0) };
  const readMap = {};
  for (const r of readLast) readMap[r.student_id] = r.level;
  const existingSet = new Set(existing.map((e) => e.student_id));

  const out = gradeRows.map((g) => {
    const a = attMap[g.student_id] || { absents: 0, days: 0 };
    const attRate = a.days ? Math.round(((a.days - a.absents) / a.days) * 100) : 100;
    let risk = 0;
    const indicators = [];
    if (g.avg_grade < 75) { risk += 2; indicators.push(`Avg grade ${Math.round(g.avg_grade * 10) / 10}`); }
    else if (g.avg_grade < 80) { risk += 1; indicators.push(`Avg grade ${Math.round(g.avg_grade * 10) / 10}`); }
    if (a.absents >= 3) { risk += 1; indicators.push(`${a.absents} absences`); }
    const rl = readMap[g.student_id];
    if (rl && (rl === 'Frustration' || rl === 'Non-Reader')) { risk += 1; indicators.push(`Reading: ${rl}`); }
    return {
      ...g, name: `${g.first_name} ${g.last_name}`, avg_grade: Math.round(g.avg_grade * 10) / 10, attendance_rate: attRate,
      reading_level: rl || null, indicators,
      risk: risk >= 3 ? 'High' : risk === 2 ? 'Moderate' : risk === 1 ? 'Low' : 'None',
      has_plan: existingSet.has(g.student_id),
    };
  }).sort((a, b) => {
    const rk = { High: 3, Moderate: 2, Low: 1, None: 0 };
    return rk[b.risk] - rk[a.risk];
  });
  res.json({ data: out });
}));

router.post('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.student_id || !b.title) return res.status(400).json({ error: 'student_id and title are required' });
  const student = await q('SELECT * FROM students WHERE id = ?', [b.student_id]);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  // Teacher scope check: teachers can only create interventions for students in their classes
  if (req.user.role === 'teacher') {
    const scopeCheck = await ensureTeacherSeesStudent(req.user, b.student_id);
    if (!scopeCheck.ok) return res.status(403).json({ error: scopeCheck.reason });
  }

  const id = await qi(
    `INSERT INTO intervention_plans (student_id, title, category, strategy, frequency, start_date, end_date, status, progress_notes, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.student_id, b.title, b.category || 'academic_recovery', b.strategy || null,
      b.frequency || null, b.start_date || null, b.end_date || null,
      b.status || 'active', b.progress_notes || null, req.user.id]);
  await audit(req, 'CREATE_INTERVENTION', 'intervention_plans', id, { student: b.student_id, category: b.category });
  res.status(201).json({ id, detail: withStudent(await q('SELECT * FROM intervention_plans WHERE id = ?', [id]), student) });
}));

router.patch('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM intervention_plans WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Plan not found' });

  // Teacher scope check: teachers can only update interventions for students in their classes
  if (req.user.role === 'teacher') {
    const scopeCheck = await ensureTeacherSeesStudent(req.user, row.student_id);
    if (!scopeCheck.ok) return res.status(403).json({ error: scopeCheck.reason });
  }

  const b = req.body || {};
  const f = (k) => b[k] !== undefined ? b[k] : row[k];
  await qr(
    `UPDATE intervention_plans SET title = ?, category = ?, strategy = ?, frequency = ?, start_date = ?, end_date = ?,
     status = ?, progress_notes = ?, updated_at = ${nowSql()} WHERE id = ?`,
    [f('title'), f('category'), f('strategy'), f('frequency'), f('start_date'), f('end_date'),
      f('status'), f('progress_notes'), row.id]);
  await audit(req, 'UPDATE_INTERVENTION', 'intervention_plans', row.id);
  res.json({ ok: true, detail: await q('SELECT * FROM intervention_plans WHERE id = ?', [row.id]) });
}));

router.delete('/:id', requireRole(...ADMIN_ROLES, 'teacher', 'guidance'), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM intervention_plans WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Plan not found' });

  // Teacher scope check: teachers can only delete interventions for students in their classes
  if (req.user.role === 'teacher') {
    const scopeCheck = await ensureTeacherSeesStudent(req.user, row.student_id);
    if (!scopeCheck.ok) return res.status(403).json({ error: scopeCheck.reason });
  }

  if (row.recorded_by !== req.user.id && !isAdminRole(req.user.role)) {
    return res.status(403).json({ error: 'Only the recorder or an admin can delete' });
  }
  await db.tx(async (conn) => {
    await conn.qr('DELETE FROM intervention_contacts WHERE plan_id = ?', [row.id]);
    await conn.qr('DELETE FROM intervention_plans WHERE id = ?', [row.id]);
  });
  res.json({ ok: true });
}));

router.post('/:id/contacts', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM intervention_plans WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Plan not found' });

  // Teacher scope check: teachers can only add contacts for students in their classes
  if (req.user.role === 'teacher') {
    const scopeCheck = await ensureTeacherSeesStudent(req.user, row.student_id);
    if (!scopeCheck.ok) return res.status(403).json({ error: scopeCheck.reason });
  }

  const b = req.body || {};
  if (!b.contact_date) return res.status(400).json({ error: 'contact_date is required' });
  const id = await qi(
    'INSERT INTO intervention_contacts (plan_id, mode, summary, contact_date, recorded_by) VALUES (?, ?, ?, ?, ?)',
    [row.id, b.mode || 'meeting', b.summary || null, b.contact_date, req.user.id]);
  res.status(201).json({ id });
}));

router.post('/ai/parent-notice', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  const sid = b.student_id;
  const pupil = sid
    ? await q('SELECT first_name, last_name, guardian_name FROM students WHERE id = ?', [sid])
    : null;
  const guardian = esc((pupil && pupil.guardian_name) || b.guardian || 'Parent/Guardian');
  const studentName = esc(pupil ? `${pupil.first_name} ${pupil.last_name}` : b.student || 'your child');
  const reason = esc(b.reason || 'academic progress and the school intervention program for the learner');
  const meetingDate = b.meeting_date ? esc(b.meeting_date) : null;
  const preparer = esc(req.user.name);
  const body = `<h2>Notification Letter</h2>
<p>Dear ${guardian},</p>
<p>We are writing to inform you about <strong>${studentName}</strong>'s ${reason}.</p>
${meetingDate ? `<p>Please be informed that a meeting is scheduled on <strong>${meetingDate}</strong>.</p>` : ''}
<p>We look forward to your cooperation.</p>
<p>Prepared by: <strong>${preparer}</strong></p>`;
  await audit(req, 'AI_PARENT_NOTICE', 'intervention_plans', sid || null);
  res.json({ body });
}));

module.exports = router;