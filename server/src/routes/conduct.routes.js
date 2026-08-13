const express = require('express');
const { q, qa, qi, qr, dialect } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');

const router = express.Router();
router.use(authenticate);

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'guidance', 'teacher'];
const ADMIN = ['super_admin', 'school_admin', 'principal', 'assistant_principal'];

const STATUSES = ['open', 'under_review', 'resolved'];
const SEVERITIES = ['minor', 'moderate', 'major'];

const SECTION_SUBQUERY =
  "(SELECT s.name FROM enrollments e LEFT JOIN sections s ON s.id = e.section_id " +
  "WHERE e.student_id = cr.student_id ORDER BY e.school_year DESC, e.term DESC, e.id DESC LIMIT 1)";

const LIST_SELECT = `
  SELECT cr.*,
    st.last_name || ', ' || st.first_name AS student_name,
    st.lrn,
    st.grade_level,
    ${SECTION_SUBQUERY} AS section_name,
    u.name AS reported_by_name,
    (SELECT COUNT(*) FROM conduct_case_actions ca WHERE ca.record_id = cr.id) AS action_count
  FROM student_conduct_records cr
  JOIN students st ON st.id = cr.student_id
  LEFT JOIN users u ON u.id = cr.reported_by`;

function daysOpen(dateStr) {
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

function decorate(rows) {
  return rows.map((r) => {
    const out = { ...r, days_open: daysOpen(r.incident_date) };
    return out;
  });
}

router.get('/', asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const where = [];
  const params = [];
  if (req.query.status) { where.push('cr.status = ?'); params.push(req.query.status); }
  if (req.query.type) { where.push('cr.incident_type = ?'); params.push(req.query.type); }
  if (req.query.severity) { where.push('cr.severity = ?'); params.push(req.query.severity); }
  if (req.query.student_id) { where.push('cr.student_id = ?'); params.push(req.query.student_id); }
  if (req.query.from) { where.push('cr.incident_date >= ?'); params.push(req.query.from); }
  if (req.query.to) { where.push('cr.incident_date <= ?'); params.push(req.query.to); }
  if (req.query.q) {
    where.push('(st.last_name LIKE ? OR st.first_name LIKE ? OR st.lrn LIKE ?)');
    const like = `%${req.query.q}%`;
    params.push(like, like, like);
  }
  const sql = LIST_SELECT +
    (where.length ? ' WHERE ' + where.join(' AND ') : '') +
    " ORDER BY (cr.status = 'open') DESC, cr.incident_date DESC, cr.id DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);
  res.json({ data: decorate(await qa(sql, params)), limit, offset });
}));

router.get('/summary', asyncH(async (req, res) => {
  const monthStart = dialect === 'pg'
    ? "date_trunc('month', now())::date"
    : "date('now', 'start of month')";
  const [byStatus, byType, bySeverity, monthRows, recent] = await Promise.all([
    qa('SELECT status, COUNT(*) AS n FROM student_conduct_records GROUP BY status'),
    qa('SELECT incident_type, COUNT(*) AS n FROM student_conduct_records GROUP BY incident_type'),
    qa('SELECT severity, COUNT(*) AS n FROM student_conduct_records GROUP BY severity'),
    qa(`SELECT COUNT(*) AS n FROM student_conduct_records WHERE incident_date >= ${monthStart}`),
    qa(`${LIST_SELECT} ORDER BY (cr.status = 'open') DESC, cr.incident_date DESC, cr.id DESC LIMIT 8`),
  ]);
  const pick = (rows, key) => rows.find((r) => r.status === key || r.incident_type === key || r.severity === key)?.n || 0;
  res.json({
    by_status: {
      open: Number(pick(byStatus, 'open')) || 0,
      under_review: Number(pick(byStatus, 'under_review')) || 0,
      resolved: Number(pick(byStatus, 'resolved')) || 0,
    },
    by_type: byType.reduce((m, r) => { m[r.incident_type] = Number(r.n); return m; }, {}),
    by_severity: {
      minor: Number(pick(bySeverity, 'minor')) || 0,
      moderate: Number(pick(bySeverity, 'moderate')) || 0,
      major: Number(pick(bySeverity, 'major')) || 0,
    },
    cases_this_month: Number(monthRows[0]?.n || 0),
    recent: decorate(recent),
  });
}));

router.post('/', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.student_id || !b.incident_type || !b.incident_date) {
    return res.status(400).json({ error: 'student_id, incident_type, and incident_date are required' });
  }
  const student = await q('SELECT id FROM students WHERE id = ?', [b.student_id]);
  if (!student) return res.status(400).json({ error: 'Student not found' });
  const id = await qi(
    `INSERT INTO student_conduct_records (student_id, incident_type, incident_date, description, severity, status, reported_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [b.student_id, b.incident_type, b.incident_date, b.description || null,
      b.severity || 'minor', b.status && STATUSES.includes(b.status) ? b.status : 'open', req.user.id]);
  await audit(req, 'CREATE_CONDUCT_RECORD', 'student_conduct_records', id,
    { student_id: b.student_id, incident_type: b.incident_type, severity: b.severity || 'minor' });
  res.status(201).json({ id });
}));

router.get('/:id', asyncH(async (req, res) => {
  const row = await q(`${LIST_SELECT} WHERE cr.id = ?`, [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Record not found' });
  row.actions = await qa(
    `SELECT ca.*, u.name AS done_by_name FROM conduct_case_actions ca
     LEFT JOIN users u ON u.id = ca.done_by
     WHERE ca.record_id = ? ORDER BY ca.action_date DESC, ca.id DESC`, [row.id]);
  res.json({ data: decorate([row])[0] });
}));

router.patch('/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM student_conduct_records WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Record not found' });
  const b = req.body || {};
  const next = {};
  if (b.incident_type !== undefined) {
    if (!b.incident_type) return res.status(400).json({ error: 'incident_type cannot be empty' });
    next.incident_type = b.incident_type;
  }
  if (b.incident_date !== undefined) next.incident_date = b.incident_date;
  if (b.description !== undefined) next.description = b.description;
  if (b.severity !== undefined) {
    if (!SEVERITIES.includes(b.severity)) return res.status(400).json({ error: 'Invalid severity' });
    next.severity = b.severity;
  }
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return res.status(400).json({ error: 'Invalid status' });
    next.status = b.status;
  }
  if (!Object.keys(next).length) return res.status(400).json({ error: 'Nothing to update' });
  const set = Object.keys(next).map((k) => `${k} = ?`).join(', ');
  await qr(`UPDATE student_conduct_records SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [...Object.values(next), row.id]);
  await audit(req, 'UPDATE_CONDUCT_RECORD', 'student_conduct_records', row.id, next);
  res.json({ ok: true });
}));

router.post('/:id/actions', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM student_conduct_records WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Record not found' });
  const b = req.body || {};
  if (!b.action_type || !b.action_date) {
    return res.status(400).json({ error: 'action_type and action_date are required' });
  }
  const id = await qi(
    'INSERT INTO conduct_case_actions (record_id, action_type, action_date, notes, done_by) VALUES (?, ?, ?, ?, ?)',
    [row.id, b.action_type, b.action_date, b.notes || null, req.user.id]);
  let status = row.status;
  if (status === 'open') {
    status = 'under_review';
    await qr('UPDATE student_conduct_records SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, row.id]);
  }
  await audit(req, 'ADD_CONDUCT_ACTION', 'conduct_case_actions', id, { record_id: row.id, action_type: b.action_type });
  res.status(201).json({ id, status });
}));

router.delete('/:id', requireRole(...ADMIN), asyncH(async (req, res) => {
  const row = await q('SELECT id FROM student_conduct_records WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Record not found' });
  await qr('DELETE FROM student_conduct_records WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_CONDUCT_RECORD', 'student_conduct_records', row.id);
  res.json({ ok: true });
}));

module.exports = router;
