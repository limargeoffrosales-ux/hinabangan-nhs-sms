const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole, isAdminRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');

const router = express.Router();
router.use(authenticate);
const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'hr'];
const LINK_ROLES = ['super_admin', 'school_admin'];

// Column-level PII guard: only roles that may write teacher PII may read it.
// Everyone else (e.g. a plain teacher opening the staff directory) gets the
// record with direct identifiers removed rather than a 403, so the directory
// keeps working without exposing colleagues' contact details or PRC number.
const PII_FIELDS = ['email', 'contact', 'prc_no'];
function redactTeacherPII(row, role) {
  if (WRITE.includes(role)) return row;
  const copy = { ...row };
  for (const f of PII_FIELDS) delete copy[f];
  return copy;
}

async function resolveUserId(b, { ignoreId } = {}) {
  if (b.user_id === undefined || b.user_id === null || b.user_id === '') return null;
  const userId = Number(b.user_id);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  const u = await q('SELECT id FROM users WHERE id = ?', [userId]);
  if (!u) return { error: 'Linked login account not found' };
  const cond = ignoreId ? 'AND t.id != ?' : '';
  const used = await q(`SELECT id FROM teachers t WHERE t.user_id = ? ${cond}`, [userId, ...(ignoreId ? [ignoreId] : [])]);
  if (used) return { error: 'That login account is already linked to another teacher' };
  return userId;
}

router.get('/', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const q2 = req.query.q ? `%${req.query.q}%` : '%';
  const rows = await qa(
    'SELECT id, employee_no, first_name, middle_name, last_name, suffix, sex, position, prc_no, email, contact, room, status, user_id FROM teachers WHERE (last_name LIKE ? OR first_name LIKE ? OR employee_no LIKE ?) ORDER BY last_name, first_name LIMIT ? OFFSET ?',
    [q2, q2, q2, limit, offset]);
  if (isAdminRole(req.user.role)) {
    const linked = rows.filter((r) => r.user_id);
    if (linked.length) {
      const ids = linked.map((r) => r.user_id);
      const users = await qa('SELECT id, username FROM users WHERE id IN (' + ids.map(() => '?').join(',') + ')', ids);
      const um = Object.fromEntries(users.map((u) => [u.id, u.username]));
      for (const r of rows) r.username = r.user_id ? (um[r.user_id] || null) : null;
    }
  }
  res.json({ data: rows.map((r) => redactTeacherPII(r, req.user.role)), limit, offset });
}));

router.get('/:id', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM teachers WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Teacher not found' });
  if (isAdminRole(req.user.role) && row.user_id) {
    const u = await q('SELECT username FROM users WHERE id = ?', [row.user_id]);
    if (u) row.username = u.username;
  }
  res.json(redactTeacherPII(row, req.user.role));
}));

router.post('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.first_name || !b.last_name) return res.status(400).json({ error: 'first_name and last_name are required' });
  const userId = LINK_ROLES.includes(req.role) ? await resolveUserId(b) : null;
  if (userId && userId.error) return res.status(400).json({ error: userId.error });
  const id = await qi(
    'INSERT INTO teachers (employee_no, first_name, middle_name, last_name, suffix, sex, position, prc_no, email, contact, room, status, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [b.employee_no || null, b.first_name, b.middle_name || null, b.last_name, b.suffix || null,
      b.sex || null, b.position || null, b.prc_no || null, b.email || null, b.contact || null,
      b.room || null, b.status || 'active', userId || null]);
  await audit(req, 'CREATE_TEACHER', 'teachers', id, { name: `${b.last_name}, ${b.first_name}`, user_id: userId || null });
  res.status(201).json({ id });
}));

router.patch('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM teachers WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Teacher not found' });
  const b = req.body || {};
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  let userId = row.user_id;
  if (LINK_ROLES.includes(req.role) && b.user_id !== undefined) {
    const resolved = await resolveUserId(b, { ignoreId: row.id });
    if (resolved && resolved.error) return res.status(400).json({ error: resolved.error });
    userId = resolved;
  }
  await qr(
    'UPDATE teachers SET employee_no = ?, first_name = ?, middle_name = ?, last_name = ?, suffix = ?, sex = ?, position = ?, prc_no = ?, email = ?, contact = ?, room = ?, status = ?, user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [f('employee_no', row.employee_no), f('first_name', row.first_name), f('middle_name', row.middle_name),
      f('last_name', row.last_name), f('suffix', row.suffix), f('sex', row.sex), f('position', row.position),
      f('prc_no', row.prc_no), f('email', row.email), f('contact', row.contact), f('room', row.room),
      f('status', row.status), userId, row.id]);
  await audit(req, 'UPDATE_TEACHER', 'teachers', row.id);
  res.json({ ok: true });
}));

router.delete('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM teachers WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Teacher not found' });
  await qr('DELETE FROM teachers WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_TEACHER', 'teachers', row.id);
  res.json({ ok: true });
}));

router.get('/workload-summary', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  const { school_year } = req.query;
  const teachers = await qa('SELECT id, employee_no, first_name, last_name, position, room, status FROM teachers WHERE status = \'active\' ORDER BY last_name, first_name');
  const assignments = await qa(
    `SELECT ca.teacher_id, ca.meetings_per_week, ca.duration_minutes, sub.title AS subject_name, sec.name AS section_name
     FROM class_assignments ca
     JOIN subjects sub ON sub.id = ca.subject_id
     JOIN sections sec ON sec.id = ca.section_id
     ${school_year ? 'WHERE ca.school_year = ?' : ''}`,
    school_year ? [school_year] : []
  );

  const byTeacher = {};
  for (const t of teachers) {
    byTeacher[t.id] = {
      ...t,
      classes: [],
      total_meetings_per_week: 0,
      total_teaching_minutes_per_week: 0,
      teaching_hours_per_day: 0,
      is_overload: false,
      overload_hours: 0,
    };
  }

  for (const a of assignments) {
    if (!a.teacher_id || !byTeacher[a.teacher_id]) continue;
    const tData = byTeacher[a.teacher_id];
    tData.classes.push(a);
    const meetings = Number(a.meetings_per_week) || 1;
    const dur = Number(a.duration_minutes) || 60;
    tData.total_meetings_per_week += meetings;
    tData.total_teaching_minutes_per_week += meetings * dur;
  }

  for (const id of Object.keys(byTeacher)) {
    const tData = byTeacher[id];
    const hoursPerWeek = tData.total_teaching_minutes_per_week / 60;
    const hoursPerDay = hoursPerWeek / 5;
    tData.teaching_hours_per_day = Math.round(hoursPerDay * 10) / 10;
    if (tData.teaching_hours_per_day > 6) {
      tData.is_overload = true;
      tData.overload_hours = Math.round((tData.teaching_hours_per_day - 6) * 10) / 10;
    }
  }

  res.json({ data: Object.values(byTeacher) });
}));

module.exports = router;
