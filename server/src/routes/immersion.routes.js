const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
const IMMERSION_STATUSES = ['pending', 'ongoing', 'completed', 'withdrawn'];
const JDVP_STATUSES = ['pending', 'served', 'withdrawn'];

// Normalize an optional numeric lat/lng field.
// undefined -> fallback (used on PATCH), ''/null -> null, otherwise a finite number.
function numOrNull(v, fallback) {
  if (v === undefined) return fallback;
  if (v === null || v === '' ) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw Object.assign(new Error('Latitude/longitude must be a number'), { status: 400 });
  return n;
}

// Validate + align optional placement location fields for INSERT.
function locForInsert(b) {
  const address = b.address == null || String(b.address).trim() === '' ? null : String(b.address).trim();
  const lat = numOrNull(b.lat, null);
  const lng = numOrNull(b.lng, null);
  if (lat != null && (lat < -90 || lat > 90)) throw Object.assign(new Error('Latitude must be between -90 and 90'), { status: 400 });
  if (lng != null && (lng < -180 || lng > 180)) throw Object.assign(new Error('Longitude must be between -180 and 180'), { status: 400 });
  return { address, lat, lng };
}

// Validate + align optional placement location fields for UPDATE (falls back to current row).
function locForUpdate(b, cur) {
  const address = b.address !== undefined
    ? (b.address == null || String(b.address).trim() === '' ? null : String(b.address).trim())
    : cur.address;
  const lat = numOrNull(b.lat, cur.lat);
  const lng = numOrNull(b.lng, cur.lng);
  if (lat != null && (lat < -90 || lat > 90)) throw Object.assign(new Error('Latitude must be between -90 and 90'), { status: 400 });
  if (lng != null && (lng < -180 || lng > 180)) throw Object.assign(new Error('Longitude must be between -180 and 180'), { status: 400 });
  return { address, lat, lng };
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

// Map tracing data — all placements that have coordinates (WRITE roles only).
immersion.get('/map', requireRole(...WRITE), asyncH(async (req, res) => {
  const where = ['wi.lat IS NOT NULL AND wi.lng IS NOT NULL'];
  const params = [];
  if (req.query.batch) { where.push('wi.batch = ?'); params.push(req.query.batch); }
  const rows = await qa(
    `SELECT wi.id, wi.student_id, wi.batch, wi.program, wi.partner_institution, wi.status,
            wi.start_date, wi.end_date, wi.remarks, wi.address, wi.lat, wi.lng,
            st.lrn, st.first_name || ' ' || st.last_name AS student_name, st.grade_level
     FROM work_immersion wi JOIN students st ON st.id = wi.student_id
     WHERE ${where.join(' AND ')} ORDER BY wi.batch DESC, st.last_name`,
    params);
  res.json({ data: rows });
}));

immersion.post('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.student_id || !b.batch || !b.program) {
    return res.status(400).json({ error: 'student_id, batch and program are required' });
  }
  if (!(await q('SELECT id FROM students WHERE id = ?', [b.student_id]))) {
    return res.status(404).json({ error: 'Student not found' });
  }
  if (b.status && !IMMERSION_STATUSES.includes(b.status)) return res.status(400).json({ error: 'Invalid status' });
  const exists = await q('SELECT id FROM work_immersion WHERE student_id = ? AND batch = ? AND program = ?',
    [b.student_id, String(b.batch).trim(), String(b.program).trim()]);
  if (exists) return res.status(409).json({ error: 'Student already has this program in this batch' });
  const status = b.status || 'ongoing';
  const loc = locForInsert(b);
  const id = await qi(
    `INSERT INTO work_immersion (student_id, batch, program, partner_institution, status, start_date, end_date, remarks, address, lat, lng, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.student_id, String(b.batch).trim(), String(b.program).trim(),
      b.partner_institution || null, status, b.start_date || null, b.end_date || null,
      b.remarks || null, loc.address, loc.lat, loc.lng, req.user.id]);
  await audit(req, 'CREATE_IMMERSION', 'work_immersion', id, { student_id: b.student_id, batch: b.batch, program: b.program, has_location: !!loc.lat });
  res.status(201).json({ id });
}));

immersion.patch('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (b.status && !IMMERSION_STATUSES.includes(b.status)) return res.status(400).json({ error: 'Invalid status' });
  const cur = await q('SELECT * FROM work_immersion WHERE id = ?', [req.params.id]);
  if (!cur) return res.status(404).json({ error: 'Record not found' });
  const loc = locForUpdate(b, cur);
  await qr(
    `UPDATE work_immersion SET partner_institution = ?, status = ?, start_date = ?, end_date = ?, remarks = ?,
          address = ?, lat = ?, lng = ? WHERE id = ?`,
    [b.partner_institution !== undefined ? b.partner_institution : cur.partner_institution,
      b.status !== undefined ? b.status : cur.status,
      b.start_date !== undefined ? b.start_date : cur.start_date,
      b.end_date !== undefined ? b.end_date : cur.end_date,
      b.remarks !== undefined ? b.remarks : cur.remarks,
      loc.address, loc.lat, loc.lng,
      req.params.id]);
  await audit(req, 'UPDATE_IMMERSION', 'work_immersion', req.params.id, { status: b.status, has_location: !!loc.lat });
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

// Map tracing data — all JDVP recipients that have coordinates.
jdvp.get('/map', requireRole(...WRITE), asyncH(async (req, res) => {
  const where = ['j.lat IS NOT NULL AND j.lng IS NOT NULL'];
  const params = [];
  if (req.query.batch) { where.push('j.batch = ?'); params.push(req.query.batch); }
  const rows = await qa(
    `SELECT j.id, j.student_id, j.batch, j.program, j.status, j.remarks, j.address, j.lat, j.lng,
            st.lrn, st.first_name || ' ' || st.last_name AS student_name, st.grade_level
     FROM jdvp_recipients j JOIN students st ON st.id = j.student_id
     WHERE ${where.join(' AND ')} ORDER BY j.batch DESC, st.last_name`,
    params);
  res.json({ data: rows });
}));

jdvp.post('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.student_id || !b.batch) {
    return res.status(400).json({ error: 'student_id and batch are required' });
  }
  if (!(await q('SELECT id FROM students WHERE id = ?', [b.student_id]))) {
    return res.status(404).json({ error: 'Student not found' });
  }
  if (b.status && !JDVP_STATUSES.includes(b.status)) return res.status(400).json({ error: 'Invalid status' });
  const exists = await q('SELECT id FROM jdvp_recipients WHERE student_id = ? AND batch = ?',
    [b.student_id, String(b.batch).trim()]);
  if (exists) return res.status(409).json({ error: 'Student already listed in this batch' });
  const status = b.status || 'pending';
  const loc = locForInsert(b);
  const id = await qi(
    `INSERT INTO jdvp_recipients (student_id, batch, program, status, remarks, address, lat, lng, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.student_id, String(b.batch).trim(), b.program || null, status, b.remarks || null,
      loc.address, loc.lat, loc.lng, req.user.id]);
  await audit(req, 'CREATE_JDVP', 'jdvp_recipients', id, { student_id: b.student_id, batch: b.batch, has_location: !!loc.lat });
  res.status(201).json({ id });
}));

jdvp.patch('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (b.status && !JDVP_STATUSES.includes(b.status)) return res.status(400).json({ error: 'Invalid status' });
  const cur = await q('SELECT * FROM jdvp_recipients WHERE id = ?', [req.params.id]);
  if (!cur) return res.status(404).json({ error: 'Record not found' });
  const loc = locForUpdate(b, cur);
  await qr(
    'UPDATE jdvp_recipients SET program = ?, status = ?, remarks = ?, address = ?, lat = ?, lng = ? WHERE id = ?',
    [b.program !== undefined ? b.program : cur.program,
      b.status !== undefined ? b.status : cur.status,
      b.remarks !== undefined ? b.remarks : cur.remarks,
      loc.address, loc.lat, loc.lng,
      req.params.id]);
  await audit(req, 'UPDATE_JDVP', 'jdvp_recipients', req.params.id, { status: b.status, has_location: !!loc.lat });
  res.json({ ok: true });
}));

jdvp.delete('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const r = await qr('DELETE FROM jdvp_recipients WHERE id = ?', [req.params.id]);
  if (!r.changes) return res.status(404).json({ error: 'Record not found' });
  await audit(req, 'DELETE_JDVP', 'jdvp_recipients', req.params.id);
  res.json({ ok: true });
}));

module.exports = { immersion, jdvp };