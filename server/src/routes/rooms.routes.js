const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');

const router = express.Router();
router.use(authenticate);
const WRITE = ['super_admin', 'school_admin'];

/* ── CRUD ──────────────────────────────────────────────── */

router.get('/', requireRole(...WRITE), asyncH(async (req, res) => {
  let sql = 'SELECT * FROM rooms';
  const where = [];
  const params = [];
  if (req.query.room_type) { where.push('room_type = ?'); params.push(req.query.room_type); }
  if (req.query.active === '1') { where.push('active = 1'); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY building, floor, code';
  res.json({ data: await qa(sql, params) });
}));

router.post('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.code || !b.name) {
    return res.status(400).json({ error: 'code and name are required' });
  }
  const exists = await q('SELECT id FROM rooms WHERE code = ?', [b.code.trim()]);
  if (exists) return res.status(409).json({ error: 'Room code already exists' });
  const id = await qi(
    'INSERT INTO rooms (code, name, building, floor, capacity, room_type, equipment) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [b.code.trim(), b.name, b.building || null, b.floor || null, b.capacity || null, b.room_type || null, b.equipment || null]
  );
  await audit(req, 'CREATE_ROOM', 'rooms', id, { code: b.code });
  res.status(201).json({ id });
}));

router.patch('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Room not found' });
  const b = req.body || {};
  if (b.code !== undefined) {
    const dup = await q('SELECT id FROM rooms WHERE code = ? AND id != ?', [b.code.trim(), row.id]);
    if (dup) return res.status(409).json({ error: 'Room code already exists' });
  }
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  await qr(
    'UPDATE rooms SET code = ?, name = ?, building = ?, floor = ?, capacity = ?, room_type = ?, equipment = ? WHERE id = ?',
    [f('code', row.code), f('name', row.name), f('building', row.building), f('floor', row.floor),
      f('capacity', row.capacity), f('room_type', row.room_type), f('equipment', row.equipment), row.id]
  );
  await audit(req, 'UPDATE_ROOM', 'rooms', row.id);
  res.json({ ok: true });
}));

router.delete('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM rooms WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Room not found' });
  const ref = await q('SELECT id FROM schedule_entries WHERE room_id = ? LIMIT 1', [row.id]);
  if (ref) return res.status(409).json({ error: 'Cannot delete room: schedule entries reference it' });
  await qr('DELETE FROM rooms WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_ROOM', 'rooms', row.id);
  res.json({ ok: true });
}));

/* ── Availability ──────────────────────────────────────── */

router.get('/availability', requireRole(...WRITE), asyncH(async (req, res) => {
  const { day, start_time, end_time, school_year, exclude_assignment_id } = req.query;
  if (!day || !start_time || !end_time || !school_year) {
    return res.status(400).json({ error: 'day, start_time, end_time, and school_year are required' });
  }
  const conflictSql =
    `SELECT DISTINCT r.*
     FROM rooms r
     JOIN schedule_entries se ON se.room_id = r.id
     WHERE se.day = ? AND se.school_year = ?
       AND se.start_time < ? AND se.end_time > ?` +
    (exclude_assignment_id ? ' AND se.assignment_id != ?' : '');
  const conflictParams = exclude_assignment_id
    ? [day, school_year, end_time, start_time, exclude_assignment_id]
    : [day, school_year, end_time, start_time];
  const unavailable = await qa(conflictSql, conflictParams);
  const unavailableIds = unavailable.map((r) => r.id);
  let sql = 'SELECT * FROM rooms WHERE active = 1';
  const params = [];
  if (unavailableIds.length) {
    sql += ` AND id NOT IN (${unavailableIds.map(() => '?').join(',')})`;
    params.push(...unavailableIds);
  }
  sql += ' ORDER BY code';
  const available = await qa(sql, params);
  res.json({ available, unavailable });
}));

/* ── Utilization ───────────────────────────────────────── */

router.get('/utilization', requireRole(...WRITE), asyncH(async (req, res) => {
  const schoolYear = req.query.school_year;
  if (!schoolYear) return res.status(400).json({ error: 'school_year is required' });
  const rooms = await qa('SELECT * FROM rooms ORDER BY code');
  const stats = [];
  for (const room of rooms) {
    const [row] = await qa(
      `SELECT COUNT(*) AS entries
       FROM schedule_entries
       WHERE room_id = ? AND school_year = ?`,
      [room.id, schoolYear]
    );
    const totalSlots = 5 * 10;
    const used = row.entries || 0;
    stats.push({
      room_id: room.id,
      code: room.code,
      name: room.name,
      entries_per_week: used,
      total_weekly_slots: totalSlots,
      utilization_pct: totalSlots > 0 ? Math.round((used / totalSlots) * 10000) / 100 : 0,
    });
  }
  res.json({ data: stats });
}));

module.exports = router;
