const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];

function studentSelect(alias) {
  return `${alias}.id, st.lrn, st.first_name || ' ' || st.last_name AS student_name, st.sex, st.grade_level`;
}

// ------------------------------------------------------------
// Work Immersion registry — /api/v1/immersion
// ------------------------------------------------------------
const immersion = express.Router();
immersion.use(authenticate);

immersion.get('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const where = [];
  const params = [];
  if (req.query.batch) { where.push('wi.batch = ?'); params.push(req.query.batch); }
  if (req.query.program) { where.push('wi.program = ?'); params.push(req.query.program); }
  if (req.query.status) { where.push('wi.status = ?'); params.push(req.query.status); }
  const filter = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = await qa(
    `SELECT wi.*, st.lrn, st.first_name || ' ' || st.last_name AS student_name, st.sex, st.grade_level
     FROM work_immersion wi JOIN students st ON st.id = wi.student_id
     ${filter} ORDER BY wi.batch DESC, wi.program, wi.partner_institution LIMIT ? OFFSET ?`,
    [...params, limit, offset]);
  res.json({ data: rows, limit, offset });
}));

immersion.post('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.student_id || !b.batch || !b.program) {
    return res.status(400).json({ error: 'student_id, batch and program are required' });
  }
  if (!(await q('SELECT id FROM students WHERE id = ?', [b.student_id]))) {
    return res.status(404).json({ error: 'Student not found' });
  }
  const exists = await q('SELECT id FROM work_immersion WHERE student_id = ? AND batch = ? AND program = ?',
    [b.student_id, String(b.batch).trim(), String(b.program).trim()]);
  if (exists) return res.status(409).json({ error: 'Student already has this program in this batch' });
  const id = await qi(
    `INSERT INTO work_immersion (student_id, batch, program, partner_institution, status, start_date, end_date, remarks, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.student_id, String(b.batch).trim(), String(b.program).trim(),
      b.partner_institution || null, b.status || 'ongoing', b.start_date || null, b.end_date || null,
      b.remarks || null, req.user.id]);
  await audit(req, 'CREATE_IMMERSION', 'work_immersion', id, { student_id: b.student_id, batch: b.batch, program: b.program });
  res.status(201).json({ id });
}));

immersion.patch('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (b.status && !['ongoing', 'completed', 'dropped'].includes(b.status)) return res.status(400).json({ error: 'Invalid status' });
  const cur = await q('SELECT * FROM work_immersion WHERE id = ?', [req.params.id]);
  if (!cur) return res.status(404).json({ error: 'Record not found' });
  await qr(
    `UPDATE work_immersion SET partner_institution = ?, status = ?, start_date = ?, end_date = ?, remarks = ? WHERE id = ?`,
    [b.partner_institution !== undefined ? b.partner_institution : cur.partner_institution,
      b.status !== undefined ? b.status : cur.status,
      b.start_date !== undefined ? b.start_date : cur.start_date,
      b.end_date !== undefined ? b.end_date : cur.end_date,
      b.remarks !== undefined ? b.remarks : cur.remarks,
      req.params.id]);
  await audit(req, 'UPDATE_IMMERSION', 'work_immersion', req.params.id, { status: b.status });
  res.json({ ok: true });
}));

immersion.delete('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const r = await qr('DELETE FROM work_immersion WHERE id = ?', [req.params.id]);
  if (!r.changes) return res.status(404).json({ error: 'Record not found' });
  await audit(req, 'DELETE_IMMERSION', 'work_immersion', req.params.id);
  res.json({ ok: true });
}));

// ------------------------------------------------------------
// JDVP recipient registry — /api/v1/jdvp
// ------------------------------------------------------------
const jdvp = express.Router();
jdvp.use(authenticate);

jdvp.get('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const where = [];
  const params = [];
  if (req.query.batch) { where.push('j.batch = ?'); params.push(req.query.batch); }
  if (req.query.status) { where.push('j.status = ?'); params.push(req.query.status); }
  const filter = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = await qa(
    `SELECT j.*, st.lrn, st.first_name || ' ' || st.last_name AS student_name, st.sex, st.grade_level
     FROM jdvp_recipients j JOIN students st ON st.id = j.student_id
     ${filter} ORDER BY j.batch DESC, st.last_name LIMIT ? OFFSET ?`,
    [...params, limit, offset]);
  res.json({ data: rows, limit, offset });
}));

jdvp.post('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.student_id || !b.batch) {
    return res.status(400).json({ error: 'student_id and batch are required' });
  }
  if (!(await q('SELECT id FROM students WHERE id = ?', [b.student_id]))) {
    return res.status(404).json({ error: 'Student not found' });
  }
  const exists = await q('SELECT id FROM jdvp_recipients WHERE student_id = ? AND batch = ?',
    [b.student_id, String(b.batch).trim()]);
  if (exists) return res.status(409).json({ error: 'Student already listed in this batch' });
  const id = await qi(
    `INSERT INTO jdvp_recipients (student_id, batch, program, status, remarks, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [b.student_id, String(b.batch).trim(), b.program || null, b.status || 'pending', b.remarks || null, req.user.id]);
  await audit(req, 'CREATE_JDVP', 'jdvp_recipients', id, { student_id: b.student_id, batch: b.batch });
  res.status(201).json({ id });
}));

jdvp.patch('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (b.status && !['ongoing', 'completed', 'dropped'].includes(b.status)) return res.status(400).json({ error: 'Invalid status' });
  const cur = await q('SELECT * FROM jdvp_recipients WHERE id = ?', [req.params.id]);
  if (!cur) return res.status(404).json({ error: 'Record not found' });
  await qr(
    'UPDATE jdvp_recipients SET program = ?, status = ?, remarks = ? WHERE id = ?',
    [b.program !== undefined ? b.program : cur.program,
      b.status !== undefined ? b.status : cur.status,
      b.remarks !== undefined ? b.remarks : cur.remarks,
      req.params.id]);
  await audit(req, 'UPDATE_JDVP', 'jdvp_recipients', req.params.id, { status: b.status });
  res.json({ ok: true });
}));

jdvp.delete('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const r = await qr('DELETE FROM jdvp_recipients WHERE id = ?', [req.params.id]);
  if (!r.changes) return res.status(404).json({ error: 'Record not found' });
  await audit(req, 'DELETE_JDVP', 'jdvp_recipients', req.params.id);
  res.json({ ok: true });
}));

module.exports = { immersion, jdvp };