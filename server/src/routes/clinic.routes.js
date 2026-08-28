const express = require('express');
const db = require('../db');
const { q, qa, qi, qr, nowSql, dialect } = db;
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');
const { getCurrentSchoolYear, getDaysFromNowParam } = require('../schoolYear');

const router = express.Router();
router.use(authenticate);

// Nurse scope note: School nurses serve the entire school population.
// Clinic/health access is intentionally school-wide (not section-scoped)
// because health records must be accessible to any nurse regardless of
// student's section/grade. This differs from teacher-scoped modules.
// If a per-grade/section nurse assignment model is added in the future,
// scope checks can be added here.
const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'nurse'];

/* ── List visits ────────────────────────────────────── */
router.get('/visits', requireRole(...WRITE), asyncH(async (req, res) => {
  const { date, outcome, student_id } = req.query;
  let sql = `SELECT cv.*, st.first_name || ' ' || st.last_name AS student_name,
    t.first_name || ' ' || t.last_name AS teacher_name
    FROM clinic_visits cv
    LEFT JOIN students st ON st.id = cv.student_id
    LEFT JOIN teachers t ON t.id = cv.teacher_id`;
  const where = [];
  const params = [];
  if (date) { where.push('DATE(cv.visit_date) = ?'); params.push(date); }
  if (outcome) { where.push('cv.outcome = ?'); params.push(outcome); }
  if (student_id) { where.push('cv.student_id = ?'); params.push(student_id); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY cv.visit_date DESC';
  res.json({ data: await qa(sql, params) });
}));

/* ── Visit summary ─────────────────────────────────── */
router.get('/visits/summary', requireRole(...WRITE), asyncH(async (req, res) => {
  const { date } = req.query;
  const where = [];
  const params = [];
  if (date) { where.push('DATE(visit_date) = ?'); params.push(date); }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = await q(`SELECT COUNT(*) AS count FROM clinic_visits ${clause}`, params);
  const byOutcome = await qa(`SELECT outcome, COUNT(*) AS count FROM clinic_visits ${clause} GROUP BY outcome`, params);
  const byComplaint = await qa(`SELECT complaint, COUNT(*) AS count FROM clinic_visits ${clause} GROUP BY complaint ORDER BY count DESC LIMIT 10`, params);
  res.json({ total: total.count, by_outcome: byOutcome, top_complaints: byComplaint });
}));

/* ── Get single visit ──────────────────────────────── */
router.get('/visits/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q(
    `SELECT cv.*, st.first_name || ' ' || st.last_name AS student_name,
      t.first_name || ' ' || t.last_name AS teacher_name
     FROM clinic_visits cv
     LEFT JOIN students st ON st.id = cv.student_id
     LEFT JOIN teachers t ON t.id = cv.teacher_id
     WHERE cv.id = ?`, [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Visit not found' });
  const dispenses = await qa(
    `SELECT md.*, cm.name AS medicine_name FROM medicine_dispenses md
     JOIN clinic_medicines cm ON cm.id = md.medicine_id WHERE md.visit_id = ? ORDER BY md.dispensed_at`,
    [row.id]);
  res.json({ ...row, dispenses });
}));

/* ── Create visit ──────────────────────────────────── */
router.post('/visits', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.complaint) return res.status(400).json({ error: 'complaint is required' });
  const id = await qi(
    `INSERT INTO clinic_visits (student_id, teacher_id, visitor_name, visit_date, complaint,
      diagnosis, treatment, temperature, blood_pressure, referred_to, outcome, recorded_by, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.student_id || null, b.teacher_id || null, b.visitor_name || null,
      b.visit_date || new Date().toISOString(), b.complaint,
      b.diagnosis || null, b.treatment || null, b.temperature || null,
      b.blood_pressure || null, b.referred_to || null, b.outcome || 'treated',
      req.user.id, b.notes || null]
  );
  await audit(req, 'CREATE_CLINIC_VISIT', 'clinic_visits', id);
  res.status(201).json({ id });
}));

/* ── Delete visit ──────────────────────────────────── */
router.delete('/visits/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM clinic_visits WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Visit not found' });
  await db.tx(async (conn) => {
    await conn.qr('DELETE FROM medicine_dispenses WHERE visit_id = ?', [row.id]);
    await conn.qr('DELETE FROM clinic_visits WHERE id = ?', [row.id]);
  });
  await audit(req, 'DELETE_CLINIC_VISIT', 'clinic_visits', row.id);
  res.json({ ok: true });
}));

/* ── Medicine inventory ────────────────────────────── */
router.get('/medicines', requireRole(...WRITE), asyncH(async (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM clinic_medicines';
  const params = [];
  if (status) { sql += ' WHERE status = ?'; params.push(status); }
  sql += ' ORDER BY name ASC';
  res.json({ data: await qa(sql, params) });
}));

router.get('/medicines/summary', requireRole(...WRITE), asyncH(async (req, res) => {
  const total = await q('SELECT COUNT(*) AS count, COALESCE(SUM(quantity),0) AS total_qty FROM clinic_medicines WHERE status = \'active\'');
  const low = await q('SELECT COUNT(*) AS count FROM clinic_medicines WHERE quantity <= 5 AND status = \'active\'');
  const thirtyDaysFromNow = getDaysFromNowParam(30);
  const expiring = await q('SELECT COUNT(*) AS count FROM clinic_medicines WHERE expiry_date IS NOT NULL AND expiry_date <= ? AND status = \'active\'', [thirtyDaysFromNow]);
  res.json({ total: total.count, total_qty: total.total_qty, low_stock: low.count, expiring_soon: expiring.count });
}));

router.post('/medicines', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'name is required' });
  const id = await qi(
    `INSERT INTO clinic_medicines (name, category, quantity, unit, expiry_date, supplier, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [b.name, b.category || null, b.quantity || 0, b.unit || 'pieces',
      b.expiry_date || null, b.supplier || null, b.status || 'active']
  );
  await audit(req, 'CREATE_MEDICINE', 'clinic_medicines', id, { name: b.name });
  res.status(201).json({ id });
}));

router.patch('/medicines/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM clinic_medicines WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Medicine not found' });
  const b = req.body || {};
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  await qr(
    `UPDATE clinic_medicines SET name=?, category=?, quantity=?, unit=?,
      expiry_date=?, supplier=?, status=?, updated_at=${nowSql()} WHERE id=?`,
    [f('name', row.name), f('category', row.category), f('quantity', row.quantity),
      f('unit', row.unit), f('expiry_date', row.expiry_date), f('supplier', row.supplier),
      f('status', row.status), row.id]
  );
  await audit(req, 'UPDATE_MEDICINE', 'clinic_medicines', row.id);
  res.json({ ok: true });
}));

router.delete('/medicines/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM clinic_medicines WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Medicine not found' });
  await qr('DELETE FROM clinic_medicines WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_MEDICINE', 'clinic_medicines', row.id);
  res.json({ ok: true });
}));

/* ── Dispense medicine ─────────────────────────────── */
router.post('/dispense', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.medicine_id || !b.quantity) return res.status(400).json({ error: 'medicine_id and quantity required' });
  const id = await db.tx(async (conn) => {
    const med = await conn.q('SELECT * FROM clinic_medicines WHERE id = ?', [b.medicine_id]);
    if (!med) throw Object.assign(new Error('Medicine not found'), { status: 404 });
    if (med.quantity < b.quantity) throw Object.assign(new Error('Insufficient stock'), { status: 400 });
    const dispenseId = await conn.qi(
      `INSERT INTO medicine_dispenses (medicine_id, visit_id, quantity, dispensed_to, dispensed_by, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [b.medicine_id, b.visit_id || null, b.quantity, b.dispensed_to || null, req.user.id, b.notes || null]
    );
    const newQty = med.quantity - b.quantity;
    await conn.qr('UPDATE clinic_medicines SET quantity = ?, status = ? WHERE id = ?',
      [newQty, newQty <= 0 ? 'depleted' : 'active', med.id]);
    return dispenseId;
  });
  await audit(req, 'DISPENSE_MEDICINE', 'medicine_dispenses', id);
  res.status(201).json({ id });
}));

module.exports = router;
