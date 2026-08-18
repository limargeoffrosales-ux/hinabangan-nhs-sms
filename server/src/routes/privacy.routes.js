const express = require('express');
const db = require('../db');
const { q, qa, qi, qr, nowSql } = db;
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');

const router = express.Router();
router.use(authenticate);

const ADMIN_ROLES = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];

// ── Data Retention ─────────────────────────────────────────────

router.get('/retention', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const rows = await qa('SELECT * FROM data_retention_policies ORDER BY entity');
  res.json({ data: rows });
}));

router.patch('/retention/:id', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const existing = await q('SELECT * FROM data_retention_policies WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Policy not found' });
  const b = req.body || {};
  const retentionDays = b.retention_days !== undefined ? Number(b.retention_days) : existing.retention_days;
  const enabled = b.enabled !== undefined ? !!b.enabled : existing.enabled;
  if (retentionDays < 1) return res.status(400).json({ error: 'retention_days must be at least 1' });
  await qr(
    'UPDATE data_retention_policies SET retention_days = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [retentionDays, enabled, existing.id]);
  await audit(req, 'RETENTION_POLICY_UPDATE', 'data_retention_policies', existing.id, { entity: existing.entity, retention_days: retentionDays, enabled });
  const row = await q('SELECT * FROM data_retention_policies WHERE id = ?', [existing.id]);
  res.json(row);
}));

router.put('/retention/:id', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const existing = await q('SELECT * FROM data_retention_policies WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Policy not found' });
  const b = req.body || {};
  const retentionDays = b.retention_days !== undefined ? Number(b.retention_days) : existing.retention_days;
  const enabled = b.enabled !== undefined ? !!b.enabled : existing.enabled;
  if (retentionDays < 1) return res.status(400).json({ error: 'retention_days must be at least 1' });
  await qr(
    'UPDATE data_retention_policies SET retention_days = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [retentionDays, enabled, existing.id]);
  await audit(req, 'RETENTION_POLICY_UPDATE', 'data_retention_policies', existing.id, { entity: existing.entity, retention_days: retentionDays, enabled });
  const row = await q('SELECT * FROM data_retention_policies WHERE id = ?', [existing.id]);
  res.json(row);
}));

const TABLE_MAP = {
  notifications: 'notifications',
  audit_logs: 'audit_logs',
  data_access_logs: 'data_access_logs',
  doc_generations: 'doc_generations',
  doc_formats: 'doc_formats',
};

async function runPurge(policy, req) {
  const table = TABLE_MAP[policy.entity];
  if (!table) return { error: `Unknown entity: ${policy.entity}` };

  const days = Number(policy.retention_days) || 365;
  const cutoffParam = db.dialect === 'pg'
    ? `(now() - interval '${days} days')`
    : `datetime('now', '-${days} days')`;

  const result = await qr(`DELETE FROM ${table} WHERE created_at < ${cutoffParam}`);
  const deletedCount = result.changes || 0;

  await qr(
    'UPDATE data_retention_policies SET last_purged_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [policy.id]);
  await audit(req, 'DATA_PURGE', 'data_retention_policies', policy.id, {
    entity: policy.entity, retention_days: policy.retention_days, deleted: deletedCount,
  });
  return { purged: deletedCount };
}

router.post('/retention/:id/purge', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const policy = await q('SELECT * FROM data_retention_policies WHERE id = ? AND enabled = TRUE', [req.params.id]);
  if (!policy) return res.status(404).json({ error: 'No active retention policy for this id' });
  const result = await runPurge(policy, req);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ purged: result.purged, entity: policy.entity });
}));

router.post('/purge/:entity', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const policy = await q('SELECT * FROM data_retention_policies WHERE entity = ? AND enabled = TRUE', [req.params.entity]);
  if (!policy) return res.status(404).json({ error: 'No active retention policy for this entity' });
  const result = await runPurge(policy, req);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ entity: policy.entity, deleted: result.purged });
}));

// ── Erasure Requests ───────────────────────────────────────────

router.get('/erasure-requests', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const rows = await qa(
    `SELECT er.*, s.first_name, s.last_name, s.lrn,
            u.name AS requested_by_name
     FROM data_erasure_requests er
     LEFT JOIN students s ON s.id = er.student_id
     LEFT JOIN users u ON u.id = er.requested_by
     ORDER BY er.created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]);
  const total = (await qa('SELECT COUNT(*) AS n FROM data_erasure_requests'))[0].n;
  res.json({ data: rows, total, limit, offset });
}));

router.post('/erasure-requests', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const { student_id, reason } = req.body || {};
  if (!student_id) return res.status(400).json({ error: 'student_id is required' });
  const student = await q('SELECT id, lrn, first_name, last_name FROM students WHERE id = ?', [student_id]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const existing = await q(
    "SELECT id FROM data_erasure_requests WHERE student_id = ? AND status = 'pending'",
    [student_id]);
  if (existing) return res.status(409).json({ error: 'An erasure request is already pending for this student' });
  const id = await qi(
    'INSERT INTO data_erasure_requests (student_id, requested_by, reason, status) VALUES (?, ?, ?, ?)',
    [student_id, req.user.id, reason || null, 'pending']);
  await audit(req, 'ERASURE_REQUEST_CREATE', 'data_erasure_requests', id, {
    student_id, lrn: student.lrn, name: `${student.last_name}, ${student.first_name}`,
  });
  res.status(201).json({ id, status: 'pending' });
}));

router.post('/erasure-request', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const { student_id, reason } = req.body || {};
  if (!student_id) return res.status(400).json({ error: 'student_id is required' });
  const student = await q('SELECT id, lrn, first_name, last_name FROM students WHERE id = ?', [student_id]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const existing = await q(
    "SELECT id FROM data_erasure_requests WHERE student_id = ? AND status = 'pending'",
    [student_id]);
  if (existing) return res.status(409).json({ error: 'An erasure request is already pending for this student' });
  const id = await qi(
    'INSERT INTO data_erasure_requests (student_id, requested_by, reason, status) VALUES (?, ?, ?, ?)',
    [student_id, req.user.id, reason || null, 'pending']);
  await audit(req, 'ERASURE_REQUEST_CREATE', 'data_erasure_requests', id, {
    student_id, lrn: student.lrn, name: `${student.last_name}, ${student.first_name}`,
  });
  res.status(201).json({ id, status: 'pending' });
}));

router.get('/erasure-requests/:id/export', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const request = await q('SELECT * FROM data_erasure_requests WHERE id = ?', [req.params.id]);
  if (!request) return res.status(404).json({ error: 'Erasure request not found' });
  const student = await q('SELECT * FROM students WHERE id = ?', [request.student_id]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const linkedAccounts = {};
  if (student.user_id) {
    linkedAccounts.student_account = await q(
      'SELECT id, username, name, role, email, phone, status, created_at FROM users WHERE id = ?',
      [student.user_id]);
  }
  linkedAccounts.parents = await qa(
    `SELECT u.id, u.username, u.name, u.email, u.phone, ps.relation
     FROM parent_students ps JOIN users u ON u.id = ps.parent_user_id
     WHERE ps.student_id = ?`, [student.id]).catch(() => []);
  const enrollments = await qa(
    `SELECT e.*, sec.name AS section_name
     FROM enrollments e LEFT JOIN sections sec ON sec.id = e.section_id
     WHERE e.student_id = ? ORDER BY e.school_year`, [student.id]);
  const grades = await qa(
    `SELECT g.*, sub.code AS subject_code, sub.title AS subject_title
     FROM grades g JOIN subjects sub ON sub.id = g.subject_id
     WHERE g.student_id = ? ORDER BY g.school_year, g.quarter, sub.code`, [student.id]);
  const attendance = await qa(
    'SELECT * FROM attendance WHERE student_id = ? ORDER BY date DESC', [student.id]);
  const conductRecords = await qa(
    'SELECT * FROM conduct_records WHERE student_id = ? ORDER BY created_at DESC', [student.id]).catch(() => []);
  const consentResponses = await qa(
    `SELECT cr.*, cf.title AS form_title
     FROM consent_responses cr JOIN consent_forms cf ON cf.id = cr.form_id
     WHERE cr.user_id = ? ORDER BY cr.signed_at DESC`, [student.user_id]).catch(() => []);
  await audit(req, 'STUDENT_DATA_EXPORT', 'students', student.id, {
    lrn: student.lrn, exported_by: req.user.id,
  });
  res.json({
    export_date: new Date().toISOString(),
    student: {
      id: student.id, lrn: student.lrn, first_name: student.first_name, middle_name: student.middle_name,
      last_name: student.last_name, suffix: student.suffix, sex: student.sex, birth_date: student.birth_date,
      birth_place: student.birth_place, religion: student.religion, address: student.address,
      contact: student.contact, guardian_name: student.guardian_name, guardian_contact: student.guardian_contact,
      guardian_relation: student.guardian_relation, grade_level: student.grade_level,
      track_strand: student.track_strand, status: student.status, created_at: student.created_at,
    },
    linked_accounts: linkedAccounts, enrollments, grades, attendance,
    conduct_records: conductRecords, consent_responses: consentResponses,
  });
}));

router.get('/export/:studentId', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const student = await q('SELECT * FROM students WHERE id = ?', [req.params.studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const linkedAccounts = {};
  if (student.user_id) {
    linkedAccounts.student_account = await q(
      'SELECT id, username, name, role, email, phone, status, created_at FROM users WHERE id = ?',
      [student.user_id]);
  }
  linkedAccounts.parents = await qa(
    `SELECT u.id, u.username, u.name, u.email, u.phone, ps.relation
     FROM parent_students ps JOIN users u ON u.id = ps.parent_user_id
     WHERE ps.student_id = ?`, [student.id]).catch(() => []);
  const enrollments = await qa(
    `SELECT e.*, sec.name AS section_name
     FROM enrollments e LEFT JOIN sections sec ON sec.id = e.section_id
     WHERE e.student_id = ? ORDER BY e.school_year`, [student.id]);
  const grades = await qa(
    `SELECT g.*, sub.code AS subject_code, sub.title AS subject_title
     FROM grades g JOIN subjects sub ON sub.id = g.subject_id
     WHERE g.student_id = ? ORDER BY g.school_year, g.quarter, sub.code`, [student.id]);
  const attendance = await qa('SELECT * FROM attendance WHERE student_id = ? ORDER BY date DESC', [student.id]);
  const conductRecords = await qa('SELECT * FROM conduct_records WHERE student_id = ? ORDER BY created_at DESC', [student.id]).catch(() => []);
  const consentResponses = await qa(
    `SELECT cr.*, cf.title AS form_title
     FROM consent_responses cr JOIN consent_forms cf ON cf.id = cr.form_id
     WHERE cr.user_id = ? ORDER BY cr.signed_at DESC`, [student.user_id]).catch(() => []);
  await audit(req, 'STUDENT_DATA_EXPORT', 'students', student.id, { lrn: student.lrn, exported_by: req.user.id });
  res.json({
    export_date: new Date().toISOString(),
    student: {
      id: student.id, lrn: student.lrn, first_name: student.first_name, middle_name: student.middle_name,
      last_name: student.last_name, suffix: student.suffix, sex: student.sex, birth_date: student.birth_date,
      birth_place: student.birth_place, religion: student.religion, address: student.address,
      contact: student.contact, guardian_name: student.guardian_name, guardian_contact: student.guardian_contact,
      guardian_relation: student.guardian_relation, grade_level: student.grade_level,
      track_strand: student.track_strand, status: student.status, created_at: student.created_at,
    },
    linked_accounts: linkedAccounts, enrollments, grades, attendance,
    conduct_records: conductRecords, consent_responses: consentResponses,
  });
}));

router.post('/erasure-requests/:id/approve', requireRole('super_admin'), asyncH(async (req, res) => {
  const request = await q('SELECT * FROM data_erasure_requests WHERE id = ?', [req.params.id]);
  if (!request) return res.status(404).json({ error: 'Erasure request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: `Request is already ${request.status}` });
  const student = await q('SELECT * FROM students WHERE id = ?', [request.student_id]);
  if (!student) {
    await qr('UPDATE data_erasure_requests SET status = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['processed', request.id]);
    return res.json({ ok: true, note: 'Student record already removed' });
  }
  await qr(
    `UPDATE students SET
       first_name = '[REDACTED]', middle_name = NULL, last_name = '[REDACTED]',
       suffix = NULL, lrn = '[REDACTED]', birth_date = NULL, birth_place = NULL,
       religion = NULL, address = NULL, contact = NULL, guardian_name = NULL,
       guardian_contact = NULL, guardian_relation = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`, [student.id]);
  await audit(req, 'STUDENT_ERASURE', 'students', student.id, {
    lrn: student.lrn, name: `${student.last_name}, ${student.first_name}`,
    requested_by: request.requested_by, reason: request.reason,
  });
  await qr(
    'UPDATE data_erasure_requests SET status = ?, processed_by = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['processed', req.user.id, request.id]);
  res.json({ ok: true, status: 'processed' });
}));

router.post('/erasure/:id/approve', requireRole('super_admin'), asyncH(async (req, res) => {
  const request = await q('SELECT * FROM data_erasure_requests WHERE id = ?', [req.params.id]);
  if (!request) return res.status(404).json({ error: 'Erasure request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: `Request is already ${request.status}` });
  const student = await q('SELECT * FROM students WHERE id = ?', [request.student_id]);
  if (!student) {
    await qr('UPDATE data_erasure_requests SET status = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['processed', request.id]);
    return res.json({ ok: true, note: 'Student record already removed' });
  }
  await qr(
    `UPDATE students SET
       first_name = '[REDACTED]', middle_name = NULL, last_name = '[REDACTED]',
       suffix = NULL, lrn = '[REDACTED]', birth_date = NULL, birth_place = NULL,
       religion = NULL, address = NULL, contact = NULL, guardian_name = NULL,
       guardian_contact = NULL, guardian_relation = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`, [student.id]);
  await audit(req, 'STUDENT_ERASURE', 'students', student.id, {
    lrn: student.lrn, name: `${student.last_name}, ${student.first_name}`,
    requested_by: request.requested_by, reason: request.reason,
  });
  await qr(
    'UPDATE data_erasure_requests SET status = ?, processed_by = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['processed', req.user.id, request.id]);
  res.json({ ok: true, status: 'processed' });
}));

// ── Access Logs (mirrored from privacy-audit) ─────────────────

router.get('/access-logs', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const conditions = [];
  const params = [];
  if (req.query.student_id) { conditions.push('dal.student_id = ?'); params.push(Number(req.query.student_id)); }
  if (req.query.user_id) { conditions.push('dal.user_id = ?'); params.push(Number(req.query.user_id)); }
  if (req.query.action) { conditions.push('dal.action = ?'); params.push(req.query.action); }
  if (req.query.filter) {
    const f = `%${req.query.filter}%`;
    if (db.dialect === 'pg') {
      conditions.push('(u.name ILIKE ? OR s.first_name ILIKE ? OR s.last_name ILIKE ? OR dal.action ILIKE ?)');
    } else {
      conditions.push('(u.name LIKE ? ESCAPE \'\\\' OR s.first_name LIKE ? ESCAPE \'\\\' OR s.last_name LIKE ? ESCAPE \'\\\' OR dal.action LIKE ? ESCAPE \'\\\')');
    }
    params.push(f, f, f, f);
  }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const rows = await qa(
    `SELECT dal.*, u.name AS user_name, s.first_name, s.last_name
     FROM data_access_logs dal
     LEFT JOIN users u ON u.id = dal.user_id
     LEFT JOIN students s ON s.id = dal.student_id
     ${where}
     ORDER BY dal.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]);
  const totalRow = (await qa(
    `SELECT COUNT(*) AS n FROM data_access_logs dal LEFT JOIN users u ON u.id = dal.user_id LEFT JOIN students s ON s.id = dal.student_id ${where}`,
    params))[0];
  res.json({ data: rows, total: totalRow.n, limit, offset });
}));

// ── Role Reviews (mirrored from privacy-audit) ────────────────

router.get('/role-reviews', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const rows = await qa(
    `SELECT u.id, u.username, u.name, u.role, u.email, u.status, u.mfa_enabled, u.created_at,
            u.password_changed_at AS last_password_change
     FROM users u
     ORDER BY u.role, u.name
     LIMIT ? OFFSET ?`,
    [limit, offset]);
  const total = (await qa('SELECT COUNT(*) AS n FROM users'))[0].n;
  res.json({ data: rows, total, limit, offset });
}));

router.post('/role-reviews/:userId/suspend', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
  const user = await q('SELECT id, username, name, role, status FROM users WHERE id = ?', [req.params.userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (Number(user.id) === req.user.id) return res.status(400).json({ error: 'You cannot suspend your own account' });
  if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only super_admin can suspend another super_admin' });
  }
  const newStatus = user.status === 'suspended' ? 'active' : 'suspended';
  await qr('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, user.id]);
  if (newStatus === 'suspended') {
    await qr('UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ? AND revoked = FALSE', [user.id]);
  }
  await audit(req, newStatus === 'suspended' ? 'USER_SUSPEND' : 'USER_UNSUSPEND', 'users', user.id, {
    username: user.username, role: user.role, previous_status: user.status,
  });
  res.json({ ok: true, status: newStatus });
}));

router.post('/role-reviews/:userId/restore', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
  const user = await q('SELECT id, username, name, role, status FROM users WHERE id = ?', [req.params.userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.status !== 'suspended') return res.status(400).json({ error: 'User is not suspended' });
  await qr('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['active', user.id]);
  await audit(req, 'USER_RESTORE', 'users', user.id, {
    username: user.username, role: user.role, previous_status: user.status,
  });
  res.json({ ok: true, status: 'active' });
}));

module.exports = router;
