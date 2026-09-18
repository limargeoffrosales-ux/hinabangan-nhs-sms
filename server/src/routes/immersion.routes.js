const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');

const { geocodeAddress } = require('../geocode');

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
const IMMERSION_STATUSES = ['pending', 'ongoing', 'completed', 'withdrawn'];
const JDVP_STATUSES = ['pending', 'served', 'withdrawn'];
const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function computeHours(timeIn, timeOut) {
  if (!timeIn || !timeOut) return null;
  const t = (s) => {
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(s).trim());
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  };
  const a = t(timeIn);
  const b = t(timeOut);
  if (a == null || b == null || b < a) return null;
  return Math.round(((b - a) / 60) * 100) / 100;
}

// Fill missing coordinates from the partner address so staff only need to type
// an address. Explicitly supplied coordinates always win.
async function resolveLocation(address, lat, lng) {
  if (address && (lat == null || lng == null)) {
    const g = await geocodeAddress(address);
    if (g) { lat = lat ?? g.lat; lng = lng ?? g.lng; }
  }
  return { lat, lng };
}

// When an address changes and coordinates were not explicitly sent, re-pin from
// the new address. Unresolved or cleared addresses drop stale pins.
async function resolveLocationForUpdate(address, lat, lng, curAddress, coordsSent) {
  if (coordsSent) return { lat, lng };
  if (address === (curAddress || null)) return { lat, lng };
  if (!address) return { lat: null, lng: null };
  const g = await geocodeAddress(address);
  return g ? { lat: g.lat, lng: g.lng } : { lat: null, lng: null };
}

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

// Roster for a batch + date with each placement's attendance record for that
// day (LEFT JOIN, so unmarked placements still show up).
immersion.get('/attendance', requireRole(...WRITE), asyncH(async (req, res) => {
  const d = req.query.date || today();
  const batch = req.query.batch || null;
  const where = [];
  const params = [];
  if (batch) { where.push('wi.batch = ?'); params.push(batch); }
  const filter = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = await qa(
    `SELECT wi.id AS immersion_id, wi.student_id, wi.batch, wi.program, wi.partner_institution, wi.status AS placement_status,
            wi.start_date, wi.end_date,
            st.lrn, st.first_name || ' ' || st.last_name AS student_name, st.sex, st.grade_level,
            ia.id AS attendance_id, ia.status, ia.time_in, ia.time_out, ia.hours, ia.remarks, ia.date AS attendance_date
     FROM work_immersion wi
     JOIN students st ON st.id = wi.student_id
     LEFT JOIN immersion_attendance ia ON ia.immersion_id = wi.id AND ia.date = ?
     ${filter} ORDER BY st.last_name, st.first_name`,
    [d, ...params]);
  const counts = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
  for (const r of rows) {
    if (r.status) counts[r.status] = (counts[r.status] || 0) + 1;
    else counts.unmarked += 1;
  }
  res.json({ date: d, batch, rows, counts });
}));

// Bulk upsert daily attendance for a batch. Each record keys on the placement's
// immersion_id + date; marking the same day twice overwrites the first entry.
immersion.post('/attendance', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.batch || !b.date || !Array.isArray(b.records) || b.records.length === 0) {
    return res.status(400).json({ error: 'batch, date and non-empty records are required' });
  }
  const dateStr = String(b.date).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return res.status(400).json({ error: 'Invalid date' });
  const placements = await qa('SELECT id FROM work_immersion WHERE batch = ?', [String(b.batch).trim()]);
  const allowed = new Set(placements.map((p) => Number(p.id)));
  if (allowed.size === 0) return res.status(400).json({ error: 'Batch has no placements' });

  let recorded = 0;
  for (const rec of b.records) {
    const immersionId = Number(rec.immersion_id);
    if (!allowed.has(immersionId)) continue;
    const status = String(rec.status || 'present').toLowerCase().replace(/\s+/g, '_');
    if (!ATTENDANCE_STATUSES.includes(status)) continue;
    const hours = computeHours(rec.time_in, rec.time_out);
    const exists = await q('SELECT id FROM immersion_attendance WHERE immersion_id = ? AND date = ?', [immersionId, dateStr]);
    if (exists) {
      await qr('UPDATE immersion_attendance SET status = ?, time_in = ?, time_out = ?, hours = ?, remarks = ?, recorded_by = ? WHERE id = ?',
        [status, rec.time_in || null, rec.time_out || null, hours, rec.remarks || null, req.user.id, exists.id]);
    } else {
      await qi('INSERT INTO immersion_attendance (immersion_id, date, status, time_in, time_out, hours, remarks, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [immersionId, dateStr, status, rec.time_in || null, rec.time_out || null, hours, rec.remarks || null, req.user.id]);
    }
    recorded += 1;
  }
  await audit(req, 'IMMERSION_ATTENDANCE', 'immersion_attendance', null, { batch: String(b.batch).trim(), date: dateStr, recorded });
  res.json({ ok: true, date: dateStr, recorded });
}));

// Daily Time Record history for a single placement.
immersion.get('/:id/attendance', requireRole(...WRITE), asyncH(async (req, res) => {
  const cur = await q('SELECT wi.*, st.lrn, st.first_name || \' \' || st.last_name AS student_name FROM work_immersion wi JOIN students st ON st.id = wi.student_id WHERE wi.id = ?', [req.params.id]);
  if (!cur) return res.status(404).json({ error: 'Placement not found' });
  const rows = await qa(
    `SELECT id, date, status, time_in, time_out, hours, remarks, recorded_by, created_at
     FROM immersion_attendance WHERE immersion_id = ? ORDER BY date DESC`,
    [req.params.id]);
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
  const total = rows.length;
  const presentAndLate = counts.present + counts.late;
  res.json({
    placement: cur,
    data: rows,
    counts,
    total,
    rate: total ? Math.round((presentAndLate / total) * 100) : null,
  });
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
  const resolved = await resolveLocation(loc.address, loc.lat, loc.lng);
  const id = await qi(
    `INSERT INTO work_immersion (student_id, batch, program, partner_institution, status, start_date, end_date, remarks, address, lat, lng, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.student_id, String(b.batch).trim(), String(b.program).trim(),
      b.partner_institution || null, status, b.start_date || null, b.end_date || null,
      b.remarks || null, loc.address, resolved.lat, resolved.lng, req.user.id]);
  await audit(req, 'CREATE_IMMERSION', 'work_immersion', id, { student_id: b.student_id, batch: b.batch, program: b.program, has_location: !!resolved.lat });
  res.status(201).json({ id });
}));

immersion.patch('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (b.status && !IMMERSION_STATUSES.includes(b.status)) return res.status(400).json({ error: 'Invalid status' });
  const cur = await q('SELECT * FROM work_immersion WHERE id = ?', [req.params.id]);
  if (!cur) return res.status(404).json({ error: 'Record not found' });
  const loc = locForUpdate(b, cur);
  const resolved = await resolveLocationForUpdate(
    loc.address, loc.lat, loc.lng, cur.address,
    b.lat !== undefined || b.lng !== undefined);
  await qr(
    `UPDATE work_immersion SET partner_institution = ?, status = ?, start_date = ?, end_date = ?, remarks = ?,
          address = ?, lat = ?, lng = ? WHERE id = ?`,
    [b.partner_institution !== undefined ? b.partner_institution : cur.partner_institution,
      b.status !== undefined ? b.status : cur.status,
      b.start_date !== undefined ? b.start_date : cur.start_date,
      b.end_date !== undefined ? b.end_date : cur.end_date,
      b.remarks !== undefined ? b.remarks : cur.remarks,
      loc.address, resolved.lat, resolved.lng,
      req.params.id]);
  await audit(req, 'UPDATE_IMMERSION', 'work_immersion', req.params.id, { status: b.status, has_location: !!resolved.lat });
  res.json({ ok: true });
}));

immersion.delete('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const r = await qr('DELETE FROM work_immersion WHERE id = ?', [req.params.id]);
  if (!r.changes) return res.status(404).json({ error: 'Record not found' });
  await audit(req, 'DELETE_IMMERSION', 'work_immersion', req.params.id);
  res.json({ ok: true });
}));

module.exports = { immersion, jdvp };
