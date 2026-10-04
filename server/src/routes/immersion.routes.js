const express = require('express');
const { q, qa, qi, qr, dialect } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');
const { linkedStudentIds, ensurePortalSeesStudent, teacherScope, studentInScope, ensureTeacherSeesStudent } = require('../scope');

const { geocodeAddress } = require('../geocode');
const { todayStr, normalizeDateStr } = require('../dates');

// UTC cutoff string for a "last N minutes" window — kept in the storage format
// of each dialect so a plain >= comparison works (PG: ISO-with-Z; SQLite:
// 'YYYY-MM-DD HH:MM:SS' UTC as stored by CURRENT_TIMESTAMP).
function cutoffIsoAgo(minutes) {
  const d = new Date(Date.now() - minutes * 60000);
  if (dialect === 'pg') return d.toISOString();
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
const IMMERSION_STATUSES = ['pending', 'ongoing', 'completed', 'withdrawn'];
const JDVP_STATUSES = ['pending', 'served', 'withdrawn'];
const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'];

function today() {
  return todayStr();
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

immersion.get('/', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
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

// Map tracing data — all placements; the client splits placed vs missing.
// Teachers see only students in their advisory/assigned sections.
immersion.get('/map', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  const where = [];
  const params = [];
  if (req.query.batch) { where.push('wi.batch = ?'); params.push(req.query.batch); }
  if (req.user.role === 'teacher') {
    const scope = await teacherScope(req.user);
    if (!scope || !scope.sections.length) return res.json({ data: [] });
    const sc = studentInScope(scope, 'st');
    where.push(sc.sql);
    params.push(...sc.params);
  }
  const filter = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = await qa(
    `SELECT wi.id, wi.student_id, wi.batch, wi.program, wi.partner_institution, wi.status,
            wi.start_date, wi.end_date, wi.remarks,
            COALESCE(wi.address, v.address) AS address,
            COALESCE(wi.lat, v.lat) AS lat, COALESCE(wi.lng, v.lng) AS lng,
            st.lrn, st.first_name || ' ' || st.last_name AS student_name, st.grade_level
     FROM work_immersion wi JOIN students st ON st.id = wi.student_id
     LEFT JOIN work_immersion_venues v ON v.name = wi.partner_institution
     ${filter} ORDER BY wi.batch DESC, st.last_name`,
    params);
  res.json({ data: rows });
}));

// Roster for a batch + date with each placement's attendance record for that
// day (LEFT JOIN, so unmarked placements still show up).
immersion.get('/attendance', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
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
immersion.post('/attendance', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
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

// Export immersion attendance as XLSX
immersion.get('/attendance/export', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  const { batch } = req.query;
  let sql = `SELECT ia.date, ia.status, ia.time_in, ia.time_out, ia.hours, ia.remarks,
    st.lrn, st.first_name, st.last_name, st.middle_name, wi.batch, wi.program, wi.partner_institution
    FROM immersion_attendance ia
    JOIN work_immersion wi ON ia.immersion_id = wi.id
    JOIN students st ON wi.student_id = st.id
    WHERE 1=1`;
  const params = [];
  if (batch) { sql += ' AND wi.batch = ?'; params.push(String(batch).trim()); }
  sql += ' ORDER BY ia.date, st.last_name, st.first_name';
  const data = await qa(sql, params);

  const XLSX = require('xlsx');
  const rows = data.map(r => ({
    'Date': r.date, 'LRN': r.lrn, 'Name': `${r.last_name}, ${r.first_name} ${r.middle_name || ''}`.trim(),
    'Batch': r.batch, 'Program': r.program, 'Partner': r.partner_institution || '',
    'Status': r.status, 'Time In': r.time_in || '', 'Time Out': r.time_out || '',
    'Hours': r.hours || '', 'Remarks': r.remarks || '',
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Immersion Attendance');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename="immersion-attendance${batch ? '-' + batch : ''}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
}));

// Daily Time Record history for a single placement.
immersion.get('/:id/attendance', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
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

immersion.post('/', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.student_id || !b.batch || !b.program) {
    return res.status(400).json({ error: 'student_id, batch and program are required' });
  }
  if (!(await q('SELECT id FROM students WHERE id = ?', [b.student_id]))) {
    return res.status(404).json({ error: 'Student not found' });
  }
  // Teachers can only create placements for their own students.
  if (req.user.role === 'teacher') {
    const scopeCheck = await ensureTeacherSeesStudent(req.user, Number(b.student_id));
    if (!scopeCheck.ok) return res.status(403).json({ error: scopeCheck.reason });
  }
  if (b.status && !IMMERSION_STATUSES.includes(b.status)) return res.status(400).json({ error: 'Invalid status' });
  if (b.consent_status !== undefined && !['pending', 'granted', 'denied'].includes(b.consent_status)) {
    return res.status(400).json({ error: 'Invalid consent status' });
  }
  const exists = await q('SELECT id FROM work_immersion WHERE student_id = ? AND batch = ? AND program = ?',
    [b.student_id, String(b.batch).trim(), String(b.program).trim()]);
  if (exists) return res.status(409).json({ error: 'Student already has this program in this batch' });
  const status = b.status || 'ongoing';
  const loc = locForInsert(b);
  const resolved = await resolveLocation(loc.address, loc.lat, loc.lng);
  const id = await qi(
    `INSERT INTO work_immersion (student_id, batch, program, partner_institution, status, start_date, end_date, remarks, address, lat, lng, recorded_by, consent_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.student_id, String(b.batch).trim(), String(b.program).trim(),
      b.partner_institution || null, status, b.start_date || null, b.end_date || null,
      b.remarks || null, loc.address, resolved.lat, resolved.lng, req.user.id,
      b.consent_status !== undefined ? b.consent_status : 'pending']);
  await audit(req, 'CREATE_IMMERSION', 'work_immersion', id, { student_id: b.student_id, batch: b.batch, program: b.program, has_location: !!resolved.lat });
  res.status(201).json({ id });
}));

immersion.patch('/:id', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  const b = req.body || {};
  if (b.status && !IMMERSION_STATUSES.includes(b.status)) return res.status(400).json({ error: 'Invalid status' });
  if (b.consent_status !== undefined && !['pending', 'granted', 'denied'].includes(b.consent_status)) {
    return res.status(400).json({ error: 'Invalid consent status' });
  }
  const cur = await q('SELECT * FROM work_immersion WHERE id = ?', [req.params.id]);
  if (!cur) return res.status(404).json({ error: 'Record not found' });
  // Teachers can only edit their own students' placements.
  if (req.user.role === 'teacher') {
    const scopeCheck = await ensureTeacherSeesStudent(req.user, Number(cur.student_id));
    if (!scopeCheck.ok) return res.status(403).json({ error: scopeCheck.reason });
  }
  const loc = locForUpdate(b, cur);
  const resolved = await resolveLocationForUpdate(
    loc.address, loc.lat, loc.lng, cur.address,
    b.lat !== undefined || b.lng !== undefined);
  await qr(
    `UPDATE work_immersion SET partner_institution = ?, status = ?, start_date = ?, end_date = ?, remarks = ?,
          address = ?, lat = ?, lng = ?, consent_status = ? WHERE id = ?`,
    [b.partner_institution !== undefined ? b.partner_institution : cur.partner_institution,
      b.status !== undefined ? b.status : cur.status,
      b.start_date !== undefined ? b.start_date : cur.start_date,
      b.end_date !== undefined ? b.end_date : cur.end_date,
      b.remarks !== undefined ? b.remarks : cur.remarks,
      loc.address, resolved.lat, resolved.lng,
      b.consent_status !== undefined ? b.consent_status : (cur.consent_status || 'pending'),
      req.params.id]);
  await audit(req, 'UPDATE_IMMERSION', 'work_immersion', req.params.id, { status: b.status, consent_status: b.consent_status, has_location: !!resolved.lat });
  res.json({ ok: true });
}));

immersion.delete('/:id', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  const r = await qr('DELETE FROM work_immersion WHERE id = ?', [req.params.id]);
  if (!r.changes) return res.status(404).json({ error: 'Record not found' });
  // Teachers can only delete their own students' placements.
  if (req.user.role === 'teacher') {
    const cur = await q('SELECT student_id FROM work_immersion WHERE id = ?', [req.params.id]);
    if (cur) {
      const scopeCheck = await ensureTeacherSeesStudent(req.user, Number(cur.student_id));
      if (!scopeCheck.ok) return res.status(403).json({ error: scopeCheck.reason });
    }
  }
  await audit(req, 'DELETE_IMMERSION', 'work_immersion', req.params.id);
  res.json({ ok: true });
}));

// ============================================================
// WORK IMMERSION TRACKING — /api/v1/immersion/tracking
// ============================================================
const tracking = express.Router();
tracking.use(authenticate);

// Student daily attendance at immersion venue
tracking.post('/attendance', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.student_id || !b.date || !b.venue_id || !b.status) {
    return res.status(400).json({ error: 'student_id, date, venue_id and status are required' });
  }
  if (!ATTENDANCE_STATUSES.includes(b.status.toLowerCase().replace(/\s+/g, '_'))) {
    return res.status(400).json({ error: 'Invalid attendance status' });
  }
  const dateStr = String(b.date).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return res.status(400).json({ error: 'Invalid date format' });

  // Check student has immersion placement
  const placement = await q('SELECT id FROM work_immersion WHERE student_id = ? AND batch = ? AND program = ?',
    [b.student_id, b.batch || null, b.program || null]);
  if (!placement) return res.status(404).json({ error: 'No immersion placement found for this student' });

  // Check if attendance already recorded for this student/date/venue
  const exists = await q('SELECT id FROM work_immersion_attendance WHERE student_id = ? AND date = ? AND venue_id = ?',
    [b.student_id, dateStr, b.venue_id]);
  if (exists) {
    await qr('UPDATE work_immersion_attendance SET status = ?, arrival_time = ?, departure_time = ?, hours_worked = ?, remarks = ?, recorded_by = ? WHERE id = ?',
      [b.status, b.arrival_time || null, b.departure_time || null, b.hours_worked || null, b.remarks || null, req.user.id, exists.id]);
  } else {
    await qi('INSERT INTO work_immersion_attendance (student_id, date, venue_id, status, arrival_time, departure_time, hours_worked, remarks, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [b.student_id, dateStr, b.venue_id, b.status, b.arrival_time || null, b.departure_time || null, b.hours_worked || null, b.remarks || null, req.user.id]);
  }
  await audit(req, 'IMMERSION_ATTENDANCE', 'work_immersion_attendance', null, { student_id: b.student_id, date: dateStr, venue_id: b.venue_id, status: b.status, recorded_by: req.user.id });
  res.json({ ok: true, date: dateStr, status: b.status });
}));

// Get attendance history for a student
tracking.get('/:studentId/attendance', requireRole(...WRITE), asyncH(async (req, res) => {
  const rows = await qa(
    `SELECT a.id, a.date, a.status, a.arrival_time, a.departure_time, a.hours_worked, a.remarks, a.created_at,
            v.name AS venue_name, v.address AS venue_address
     FROM work_immersion_attendance a
     LEFT JOIN work_immersion_venues v ON v.id = a.venue_id
     WHERE a.student_id = ?
     ORDER BY a.date DESC`,
    [req.params.studentId]);
  res.json({ data: rows });
}));

// Student performance appraisal
tracking.post('/performance', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.student_id || !b.date || !b.performance_level) {
    return res.status(400).json({ error: 'student_id, date and performance_level are required' });
  }
  if (!['outstanding', 'satisfactory', 'needs_improvement'].includes(b.performance_level)) {
    return res.status(400).json({ error: 'Invalid performance level' });
  }

  const dateStr = String(b.date).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return res.status(400).json({ error: 'Invalid date format' });

  // Check student has immersion placement
  const placement = await q('SELECT id FROM work_immersion WHERE student_id = ?', [b.student_id]);
  if (!placement) return res.status(404).json({ error: 'No immersion placement found for this student' });

  // Check if appraisal already recorded for this date
  const exists = await q('SELECT id FROM work_immersion_performance WHERE student_id = ? AND appraisal_date = ?',
    [b.student_id, dateStr]);
  if (exists) {
    await qr('UPDATE work_immersion_performance SET performance_level = ?, competency_rating = ?, attendance_rate = ?, hours_completed = ?, strengths = ?, areas_for_improvement = ?, evaluated_by = ? WHERE student_id = ? AND appraisal_date = ?',
      [b.performance_level, b.competency_rating || null, b.attendance_rate || null, b.hours_completed || null, b.strengths || null, b.areas_for_improvement || null, req.user.id, b.student_id, dateStr]);
  } else {
    await qi('INSERT INTO work_immersion_performance (student_id, venue_id, appraisal_date, performance_level, competency_rating, attendance_rate, hours_completed, strengths, areas_for_improvement, evaluated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [b.student_id, b.venue_id || null, dateStr, b.performance_level, b.competency_rating || null, b.attendance_rate || null, b.hours_completed || null, b.strengths || null, b.areas_for_improvement || null, req.user.id]);
  }
  await audit(req, 'IMMERSION_PERFORMANCE', 'work_immersion_performance', null, { student_id: b.student_id, date: dateStr, performance_level: b.performance_level, evaluated_by: req.user.id });
  res.json({ ok: true, date: dateStr, performance_level: b.performance_level });
}));

// Get performance history for a student
tracking.get('/:studentId/performance', requireRole(...WRITE), asyncH(async (req, res) => {
  const rows = await qa(
    `SELECT p.id, p.appraisal_date, p.performance_level, p.competency_rating, p.attendance_rate, p.hours_completed, p.strengths, p.areas_for_improvement, p.created_at,
            v.name AS venue_name
     FROM work_immersion_performance p
     LEFT JOIN work_immersion_venues v ON v.id = p.venue_id
     WHERE p.student_id = ?
     ORDER BY p.appraisal_date DESC`,
    [req.params.studentId]);
  res.json({ data: rows });
}));

// Report security/concern issue
tracking.post('/issues', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.student_id || !b.issue_type || !b.severity || !b.description || !b.reported_date) {
    return res.status(400).json({ error: 'student_id, issue_type, severity, description and reported_date are required' });
  }
  if (!['safety', 'security', 'behavioral', 'academic', 'other'].includes(b.issue_type)) {
    return res.status(400).json({ error: 'Invalid issue type' });
  }
  if (!['low', 'medium', 'high', 'critical'].includes(b.severity)) {
    return res.status(400).json({ error: 'Invalid severity level' });
  }

  const reportedDate = new Date(String(b.reported_date));
  if (isNaN(reportedDate)) return res.status(400).json({ error: 'Invalid reported_date format' });

  // Check student has immersion placement
  const placement = await q('SELECT id FROM work_immersion WHERE student_id = ?', [b.student_id]);
  if (!placement) return res.status(404).json({ error: 'No immersion placement found for this student' });

  await qi('INSERT INTO work_immersion_issues (student_id, venue_id, issue_type, severity, description, reported_date, reported_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [b.student_id, b.venue_id || null, b.issue_type, b.severity, b.description, String(b.reported_date), req.user.id]);
  await audit(req, 'IMMERSION_ISSUE', 'work_immersion_issues', null, { student_id: b.student_id, issue_type: b.issue_type, severity: b.severity, reported_by: req.user.id });
  res.json({ ok: true, issue_type: b.issue_type, severity: b.severity });
}));

// Get issue history for a student
tracking.get('/:studentId/issues', requireRole(...WRITE), asyncH(async (req, res) => {
  const rows = await qa(
    `SELECT i.id, i.issue_type, i.severity, i.description, i.reported_date, i.resolved, i.resolved_date, i.resolved_by,
            v.name AS venue_name,
            u_reported.username AS reported_by_name, u_resolved.username AS resolved_by_name
     FROM work_immersion_issues i
     LEFT JOIN work_immersion_venues v ON v.id = i.venue_id
     LEFT JOIN users u_reported ON u_reported.id = i.reported_by
     LEFT JOIN users u_resolved ON u_resolved.id = i.resolved_by
     WHERE i.student_id = ?
     ORDER BY i.reported_date DESC`,
    [req.params.studentId]);
  res.json({ data: rows });
}));

// Venue management
tracking.post('/venues', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'venue name is required' });

  const venueId = await qi(
    `INSERT INTO work_immersion_venues (name, institution_type, address, lat, lng, contact_person, contact_phone, email, safety_rating, security_level, status, noted_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.name, b.institution_type || null, b.address || null, b.lat || null, b.lng || null, b.contact_person || null, b.contact_phone || null, b.email || null, b.safety_rating || null, b.security_level || null, b.status || 'active', req.user.id]
  );

  await audit(req, 'CREATE_VENUE', 'work_immersion_venues', venueId, { name: b.name, created_by: req.user.id });
  res.status(201).json({ id: venueId });
}));

// Get venue by ID
tracking.get('/venues/:venueId', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM work_immersion_venues WHERE id = ?', [req.params.venueId]);
  if (!row) return res.status(404).json({ error: 'Venue not found' });
  res.json({ data: row });
}));

// Get all venues
tracking.get('/venues', requireRole(...WRITE), asyncH(async (req, res) => {
  const rows = await qa('SELECT * FROM work_immersion_venues ORDER BY name');
  res.json({ data: rows });
}));

// Submit work immersion report
tracking.post('/reports', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.venue_id || !b.period_covered || !b.students_count) {
    return res.status(400).json({ error: 'venue_id, period_covered and students_count are required' });
  }

  const reportId = await qi(
    `INSERT INTO work_immersion_reports (teacher_id, venue_id, report_date, period_covered, students_count, attendance_rate, performance_summary, issues_raised, recommendations, submitted_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, b.venue_id, normalizeDateStr(b.report_date) || today(), b.period_covered, b.students_count, b.attendance_rate || null, b.performance_summary || null, b.issues_raised || null, b.recommendations || null, req.user.id]
  );

  await audit(req, 'SUBMIT_REPORT', 'work_immersion_reports', reportId, { venue_id: b.venue_id, teacher_id: req.user.id, students_count: b.students_count });
  res.status(201).json({ id: reportId });
}));

// Get report by ID
tracking.get('/reports/:reportId', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM work_immersion_reports WHERE id = ?', [req.params.reportId]);
  if (!row) return res.status(404).json({ error: 'Report not found' });
  res.json({ data: row });
}));

// Get reports by venue
tracking.get('/reports/venue/:venueId', requireRole(...WRITE), asyncH(async (req, res) => {
  const rows = await qa(
    `SELECT r.*, u.username AS teacher_name
     FROM work_immersion_reports r
     LEFT JOIN users u ON u.id = r.teacher_id
     WHERE r.venue_id = ?
     ORDER BY r.report_date DESC`,
    [req.params.venueId]);
  res.json({ data: rows });
}));

// ============================================================
// LIVE LOCATION TRACKING — /api/v1/immersion/tracking/...
// Portal opt-in (student/parent) reports GPS check-ins during
// immersion hours. Staff view the latest per student on a map.
// ------------------------------------------------------------
function dtMs(v) {
  if (v instanceof Date) return v.getTime();
  const s = String(v);
  return new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`).getTime();
}

// Portal/GPS: student or parent reports a live check-in for a linked student.
tracking.post('/location', requireRole('student', 'parent'), asyncH(async (req, res) => {
  const b = req.body || {};
  const studentId = Number(b.student_id);
  if (!studentId) return res.status(400).json({ error: 'student_id is required' });

  const scope = await ensurePortalSeesStudent(req.user, studentId);
  if (!scope.ok) return res.status(403).json({ error: scope.reason });

  const lat = Number(b.lat);
  const lng = Number(b.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return res.status(400).json({ error: 'Invalid latitude' });
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return res.status(400).json({ error: 'Invalid longitude' });
  const accuracy = b.accuracy_m !== undefined && Number.isFinite(Number(b.accuracy_m))
    ? Math.round(Number(b.accuracy_m)) : null;
  const source = ['device', 'manual', 'map'].includes(b.source) ? b.source : 'device';

  // Must have an ongoing placement with granted consent.
  const wi = await q(
    `SELECT * FROM work_immersion WHERE student_id = ? AND status = 'ongoing' ORDER BY id DESC LIMIT 1`,
    [studentId]);
  if (!wi) return res.status(400).json({ error: 'No ongoing work immersion placement for this student' });
  if (wi.consent_status !== 'granted') {
    return res.status(403).json({ error: 'Live tracking consent has not been granted' });
  }
  // Constrain to the placement window if dates are recorded.
  if (wi.start_date && wi.end_date) {
    const todayLocal = today();
    if (todayLocal < wi.start_date || todayLocal > wi.end_date) {
      return res.status(400).json({ error: 'Outside immersion schedule dates' });
    }
  }

  // Rate-limit: at most one check-in per ~20 seconds per student.
  const last = await q(
    `SELECT captured_at FROM work_immersion_tracking WHERE student_id = ? ORDER BY captured_at DESC, id DESC LIMIT 1`,
    [studentId]);
  if (last && Date.now() - dtMs(last.captured_at) < 20000) {
    return res.status(429).json({ error: 'Location check-in too frequent' });
  }

  const id = await qi(
    `INSERT INTO work_immersion_tracking (student_id, immersion_id, lat, lng, accuracy_m, source, reported_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [studentId, wi.id, lat, lng, accuracy, source, req.user.id]);

  // Prune history: keep the latest 500 check-ins per student.
  await qr(
    `DELETE FROM work_immersion_tracking
     WHERE student_id = ? AND id NOT IN (
       SELECT id FROM work_immersion_tracking WHERE student_id = ? ORDER BY captured_at DESC, id DESC LIMIT 500
     )`,
    [studentId, studentId]);

  await audit(req, 'IMMERSION_LOCATION', 'work_immersion_tracking', id, { student_id: studentId, immersion_id: wi.id });
  res.status(201).json({ ok: true, id, captured_at: new Date().toISOString() });
}));

// Portal opt-in: student/parent grants or revokes live-tracking consent.
tracking.post('/opt-in', requireRole('student', 'parent'), asyncH(async (req, res) => {
  const b = req.body || {};
  const studentId = Number(b.student_id);
  if (!studentId) return res.status(400).json({ error: 'student_id is required' });
  const consent = b.consent_status === 'denied' ? 'denied' : 'granted';

  const scope = await ensurePortalSeesStudent(req.user, studentId);
  if (!scope.ok) return res.status(403).json({ error: scope.reason });

  const wi = await q(
    `SELECT * FROM work_immersion WHERE student_id = ? AND status = 'ongoing' ORDER BY id DESC LIMIT 1`,
    [studentId]);
  if (!wi) return res.status(400).json({ error: 'No ongoing work immersion placement for this student' });

  await qr('UPDATE work_immersion SET consent_status = ? WHERE id = ?', [consent, wi.id]);
  await audit(req, 'IMMERSION_CONSENT', 'work_immersion', wi.id, { student_id: studentId, consent_status: consent });
  res.json({ ok: true, consent_status: consent });
}));

// Staff live map: latest check-in per student within the recency window.
tracking.get('/live', requireRole(...WRITE), asyncH(async (req, res) => {
  const windowMin = Math.min(Math.max(Number(req.query.window) || 120, 5), 360);
  const cutoff = cutoffIsoAgo(windowMin);
  const batch = req.query.batch || null;

  const rows = await qa(
    `SELECT t.id, t.student_id, t.lat, t.lng, t.accuracy_m, t.source, t.captured_at,
            wi.id AS immersion_id, wi.batch, wi.program, wi.partner_institution,
            s.lrn, s.first_name, s.middle_name, s.last_name, s.grade_level
     FROM work_immersion_tracking t
     JOIN work_immersion wi ON wi.id = t.immersion_id AND wi.status = 'ongoing' AND wi.consent_status = 'granted'
     JOIN students s ON s.id = t.student_id
     WHERE t.captured_at >= ?
       AND t.id = (
         SELECT t2.id FROM work_immersion_tracking t2
         WHERE t2.student_id = t.student_id
         ORDER BY t2.captured_at DESC, t2.id DESC LIMIT 1
       )
       ${batch ? 'AND wi.batch = ?' : ''}
     ORDER BY s.last_name, s.first_name`,
    batch ? [cutoff, batch] : [cutoff]);
  res.json({ data: rows, window_min: windowMin });
}));

// Staff history: recent check-ins for one student.
tracking.get('/:studentId/location', requireRole(...WRITE), asyncH(async (req, res) => {
  const rows = await qa(
    `SELECT t.id, t.lat, t.lng, t.accuracy_m, t.source, t.captured_at,
            u.username AS reported_by_name
     FROM work_immersion_tracking t
     LEFT JOIN users u ON u.id = t.reported_by
     WHERE t.student_id = ?
     ORDER BY t.captured_at DESC, t.id DESC
     LIMIT 100`,
    [req.params.studentId]);
  res.json({ data: rows });
}));

// ============================================================
// WORK IMMERSION MAP — /api/v1/immersion/map
// ------------------------------------------------------------
const map = express.Router();
map.use(authenticate);

// Get all companies/venues with active placements and their student counts
map.get('/', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  const rows = await qa(`
    SELECT wi.id, wi.partner_institution, wi.batch, wi.program,
           wi.status, wi.lat, wi.lng, wi.address,
           COUNT(DISTINCT st.id) AS student_count
    FROM work_immersion wi
    JOIN students st ON st.id = wi.student_id
    WHERE wi.lat IS NOT NULL AND wi.lng IS NOT NULL
    GROUP BY wi.id, wi.partner_institution, wi.batch, wi.program,
             wi.status, wi.lat, wi.lng, wi.address
    ORDER BY wi.partner_institution
  `);
  res.json({ data: rows });
}));

// Get students placed at a specific venue/company
map.get('/:venueId/students', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  const venueId = Number(req.params.venueId);
  const rows = await qa(`
    SELECT wi.id AS immersion_id, wi.partner_institution, wi.batch, wi.program,
           wi.status, st.id, st.lrn, st.first_name, st.last_name, st.grade_level,
           st.section, st.strand
    FROM work_immersion wi
    JOIN students st ON st.id = wi.student_id
    WHERE wi.id = ? AND wi.lat IS NOT NULL AND wi.lng IS NOT NULL
    ORDER BY st.last_name, st.first_name
  `, [venueId]);
  res.json({ data: rows });
}));

// Get single student's immersion placement with venue coords
map.get('/student/:studentId', requireRole(...WRITE, 'teacher'), asyncH(async (req, res) => {
  const rows = await qa(`
    SELECT wi.id AS immersion_id, wi.partner_institution, wi.batch, wi.program,
           wi.status, wi.lat, wi.lng, wi.address,
           st.id, st.lrn, st.first_name, st.last_name, st.grade_level,
           st.section, st.strand
    FROM work_immersion wi
    JOIN students st ON st.id = wi.student_id
    WHERE st.id = ?
    LIMIT 1
  `, [req.params.studentId]);
  res.json({ data: rows.length > 0 ? rows[0] : null });
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

// Map tracing data — all JDVP recipients; the client splits placed vs missing.
jdvp.get('/map', requireRole(...WRITE), asyncH(async (req, res) => {
  const where = [];
  const params = [];
  if (req.query.batch) { where.push('j.batch = ?'); params.push(req.query.batch); }
  const filter = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = await qa(
    `SELECT j.id, j.student_id, j.batch, j.program, j.status, j.remarks, j.address, j.lat, j.lng,
            st.lrn, st.first_name || ' ' || st.last_name AS student_name, st.grade_level
     FROM jdvp_recipients j JOIN students st ON st.id = j.student_id
     ${filter} ORDER BY j.batch DESC, st.last_name`,
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
  const resolved = await resolveLocation(loc.address, loc.lat, loc.lng);
  const id = await qi(
    `INSERT INTO jdvp_recipients (student_id, batch, program, status, remarks, address, lat, lng, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.student_id, String(b.batch).trim(), b.program || null, status, b.remarks || null,
      loc.address, resolved.lat, resolved.lng, req.user.id]);
  await audit(req, 'CREATE_JDVP', 'jdvp_recipients', id, { student_id: b.student_id, batch: b.batch, has_location: !!resolved.lat });
  res.status(201).json({ id });
}));

jdvp.patch('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (b.status && !JDVP_STATUSES.includes(b.status)) return res.status(400).json({ error: 'Invalid status' });
  const cur = await q('SELECT * FROM jdvp_recipients WHERE id = ?', [req.params.id]);
  if (!cur) return res.status(404).json({ error: 'Record not found' });
  const loc = locForUpdate(b, cur);
  const resolved = await resolveLocationForUpdate(
    loc.address, loc.lat, loc.lng, cur.address,
    b.lat !== undefined || b.lng !== undefined);
  await qr(
    'UPDATE jdvp_recipients SET program = ?, status = ?, remarks = ?, address = ?, lat = ?, lng = ? WHERE id = ?',
    [b.program !== undefined ? b.program : cur.program,
      b.status !== undefined ? b.status : cur.status,
      b.remarks !== undefined ? b.remarks : cur.remarks,
      loc.address, resolved.lat, resolved.lng,
      req.params.id]);
  await audit(req, 'UPDATE_JDVP', 'jdvp_recipients', req.params.id, { status: b.status, has_location: !!resolved.lat });
  res.json({ ok: true });
}));

jdvp.delete('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const r = await qr('DELETE FROM jdvp_recipients WHERE id = ?', [req.params.id]);
  if (!r.changes) return res.status(404).json({ error: 'Record not found' });
  await audit(req, 'DELETE_JDVP', 'jdvp_recipients', req.params.id);
  res.json({ ok: true });
}));

// ── JDVP Attendance ──────────────────────────────────────

jdvp.get('/attendance', requireRole(...WRITE), asyncH(async (req, res) => {
  const { batch, date, limit = 500 } = req.query;
  let sql = `SELECT ja.*, jr.student_id, jr.batch, jr.program, jr.status AS recipient_status,
    s.first_name, s.last_name, s.middle_name, s.lrn
    FROM jdvp_attendance ja
    JOIN jdvp_recipients jr ON ja.jdvp_recipient_id = jr.id
    JOIN students s ON jr.student_id = s.id
    WHERE 1=1`;
  const params = [];
  if (batch) { sql += ' AND jr.batch = ?'; params.push(String(batch).trim()); }
  if (date) { sql += ' AND ja.date = ?'; params.push(date); }
  sql += ' ORDER BY ja.date DESC, s.last_name, s.first_name';
  if (limit) { sql += ' LIMIT ?'; params.push(Number(limit)); }
  const data = await qa(sql, params);
  res.json({ data });
}));

jdvp.get('/attendance/roster', requireRole(...WRITE), asyncH(async (req, res) => {
  const { batch, date } = req.query;
  if (!batch || !date) return res.status(400).json({ error: 'batch and date are required' });
  const sql = `SELECT jr.id AS jdvp_recipient_id, jr.student_id, jr.batch, jr.program, jr.status AS recipient_status,
    s.first_name, s.last_name, s.middle_name, s.lrn,
    ja.id AS attendance_id, ja.status, ja.time_in, ja.time_out, ja.hours, ja.remarks
    FROM jdvp_recipients jr
    JOIN students s ON jr.student_id = s.id
    LEFT JOIN jdvp_attendance ja ON ja.jdvp_recipient_id = jr.id AND ja.date = ?
    WHERE jr.batch = ?
    ORDER BY s.last_name, s.first_name`;
  const data = await qa(sql, [date, String(batch).trim()]);
  res.json({ data });
}));

jdvp.post('/attendance', requireRole(...WRITE), asyncH(async (req, res) => {
  const { date, records } = req.body;
  if (!date || !Array.isArray(records)) return res.status(400).json({ error: 'date and records[] are required' });
  let saved = 0;
  for (const r of records) {
    if (!r.jdvp_recipient_id || !r.status) continue;
    if (!['present', 'absent', 'late', 'excused'].includes(r.status)) continue;
    const hours = (r.time_in && r.time_out)
      ? ((new Date(`2000-01-01T${r.time_out}`) - new Date(`2000-01-01T${r.time_in}`)) / 3600000).toFixed(1)
      : r.hours || null;
    if (dialect === 'pg') {
      await qr(
        `INSERT INTO jdvp_attendance (jdvp_recipient_id, date, status, time_in, time_out, hours, remarks, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (jdvp_recipient_id, date) DO UPDATE SET
           status = EXCLUDED.status, time_in = EXCLUDED.time_in, time_out = EXCLUDED.time_out,
           hours = EXCLUDED.hours, remarks = EXCLUDED.remarks, recorded_by = EXCLUDED.recorded_by`,
        [r.jdvp_recipient_id, date, r.status, r.time_in || null, r.time_out || null, hours, r.remarks || null, req.user.id]);
    } else {
      await qr(
        `INSERT INTO jdvp_attendance (jdvp_recipient_id, date, status, time_in, time_out, hours, remarks, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (jdvp_recipient_id, date) DO UPDATE SET
           status = excluded.status, time_in = excluded.time_in, time_out = excluded.time_out,
           hours = excluded.hours, remarks = excluded.remarks, recorded_by = excluded.recorded_by`,
        [r.jdvp_recipient_id, date, r.status, r.time_in || null, r.time_out || null, hours, r.remarks || null, req.user.id]);
    }
    saved++;
  }
  await audit(req, 'JDVP_ATTENDANCE_BULK', 'jdvp_attendance', null, { date, count: saved });
  res.json({ saved });
}));

jdvp.get('/attendance/export', requireRole(...WRITE), asyncH(async (req, res) => {
  const { batch } = req.query;
  let sql = `SELECT ja.date, ja.status, ja.time_in, ja.time_out, ja.hours, ja.remarks,
    s.lrn, s.first_name, s.last_name, s.middle_name, jr.batch, jr.program
    FROM jdvp_attendance ja
    JOIN jdvp_recipients jr ON ja.jdvp_recipient_id = jr.id
    JOIN students s ON jr.student_id = s.id
    WHERE 1=1`;
  const params = [];
  if (batch) { sql += ' AND jr.batch = ?'; params.push(String(batch).trim()); }
  sql += ' ORDER BY ja.date, s.last_name, s.first_name';
  const data = await qa(sql, params);

  const XLSX = require('xlsx');
  const rows = data.map(r => ({
    'Date': r.date, 'LRN': r.lrn, 'Name': `${r.last_name}, ${r.first_name} ${r.middle_name || ''}`.trim(),
    'Batch': r.batch, 'Program': r.program, 'Status': r.status,
    'Time In': r.time_in || '', 'Time Out': r.time_out || '', 'Hours': r.hours || '',
    'Remarks': r.remarks || '',
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'JDVP Attendance');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename="jdvp-attendance${batch ? '-' + batch : ''}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
}));

// Mount tracking sub-router under /tracking
immersion.use('/tracking', tracking);

// Mount map sub-router under /map
immersion.use('/map', map);

module.exports = { immersion, jdvp };