const express = require('express');
const db = require('../db');
const { q, qa, qi, qr, nowSql } = db;
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');

const router = express.Router();
router.use(authenticate);

const ADMIN_ROLES = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];

// GET /privacy/retention — list data retention policies
router.get('/retention', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const rows = await qa('SELECT * FROM data_retention_policies ORDER BY entity');
  res.json({ data: rows });
}));

// PUT /privacy/retention/:id — update a retention policy (days, enabled)
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

// POST /privacy/purge/:entity — manually trigger purge for an entity
router.post('/purge/:entity', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const policy = await q('SELECT * FROM data_retention_policies WHERE entity = ? AND enabled = TRUE', [req.params.entity]);
  if (!policy) return res.status(404).json({ error: 'No active retention policy for this entity' });

  const tableMap = {
    notifications: 'notifications',
    audit_logs: 'audit_logs',
    data_access_logs: 'data_access_logs',
    doc_generations: 'doc_generations',
    doc_formats: 'doc_formats',
  };
  const table = tableMap[policy.entity];
  if (!table) return res.status(400).json({ error: `Unknown entity: ${policy.entity}` });

  const cutoffParam = db.dialect === 'pg'
    ? `(now() - interval '${policy.retention_days} days')`
    : `datetime('now', '-${policy.retention_days} days')`;

  const result = await qr(`DELETE FROM ${table} WHERE created_at < ${cutoffParam}`);
  const deletedCount = result.changes || 0;

  await qr(
    'UPDATE data_retention_policies SET last_purged_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [policy.id]);
  await audit(req, 'DATA_PURGE', 'data_retention_policies', policy.id, {
    entity: policy.entity, retention_days: policy.retention_days, deleted: deletedCount,
  });

  res.json({ entity: policy.entity, deleted: deletedCount });
}));

// GET /privacy/erasure-requests — list all erasure requests (admin)
router.get('/erasure-requests', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const rows = await qa(
    `SELECT er.*, s.first_name, s.last_name, s.lrn,
            u.name AS requested_by_name
     FROM student_erasure_requests er
     LEFT JOIN students s ON s.id = er.student_id
     LEFT JOIN users u ON u.id = er.requested_by
     ORDER BY er.created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]);
  const total = (await qa('SELECT COUNT(*) AS n FROM student_erasure_requests'))[0].n;
  res.json({ data: rows, total, limit, offset });
}));

// POST /privacy/erasure-request — create an erasure request for a student
router.post('/erasure-request', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const { student_id, reason } = req.body || {};
  if (!student_id) return res.status(400).json({ error: 'student_id is required' });
  const student = await q('SELECT id, lrn, first_name, last_name FROM students WHERE id = ?', [student_id]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const existing = await q(
    "SELECT id FROM student_erasure_requests WHERE student_id = ? AND status = 'pending'",
    [student_id]);
  if (existing) return res.status(409).json({ error: 'An erasure request is already pending for this student' });
  const id = await qi(
    'INSERT INTO student_erasure_requests (student_id, requested_by, reason, status) VALUES (?, ?, ?, ?)',
    [student_id, req.user.id, reason || null, 'pending']);
  await audit(req, 'ERASURE_REQUEST_CREATE', 'student_erasure_requests', id, {
    student_id, lrn: student.lrn, name: `${student.last_name}, ${student.first_name}`,
  });
  res.status(201).json({ id, status: 'pending' });
}));

// POST /privacy/erasure/:id/approve — approve and process erasure (super_admin only)
router.post('/erasure/:id/approve', requireRole('super_admin'), asyncH(async (req, res) => {
  const request = await q('SELECT * FROM student_erasure_requests WHERE id = ?', [req.params.id]);
  if (!request) return res.status(404).json({ error: 'Erasure request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: `Request is already ${request.status}` });

  const student = await q('SELECT * FROM students WHERE id = ?', [request.student_id]);
  if (!student) {
    await qr('UPDATE student_erasure_requests SET status = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['processed', request.id]);
    return res.json({ ok: true, note: 'Student record already removed' });
  }

  // Anonymize PII but keep record shell for referential integrity
  await qr(
    `UPDATE students SET
       first_name = '[REDACTED]',
       middle_name = NULL,
       last_name = '[REDACTED]',
       suffix = NULL,
       lrn = '[REDACTED]',
       birth_date = NULL,
       birth_place = NULL,
       religion = NULL,
       address = NULL,
       contact = NULL,
       guardian_name = NULL,
       guardian_contact = NULL,
       guardian_relation = NULL,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [student.id]);

  await audit(req, 'STUDENT_ERASURE', 'students', student.id, {
    lrn: student.lrn,
    name: `${student.last_name}, ${student.first_name}`,
    requested_by: request.requested_by,
    reason: request.reason,
  });

  await qr(
    'UPDATE student_erasure_requests SET status = ?, processed_by = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['processed', req.user.id, request.id]);

  res.json({ ok: true, status: 'processed' });
}));

// GET /privacy/export/:studentId — export student PII as JSON (right-to-access)
router.get('/export/:studentId', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const student = await q('SELECT * FROM students WHERE id = ?', [req.params.studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  // Linked accounts
  const linkedAccounts = {};
  if (student.user_id) {
    linkedAccounts.student_account = await q(
      'SELECT id, username, name, role, email, phone, status, created_at FROM users WHERE id = ?',
      [student.user_id]);
  }
  linkedAccounts.parents = await qa(
    `SELECT u.id, u.username, u.name, u.email, u.phone, ps.relation
     FROM parent_students ps JOIN users u ON u.id = ps.parent_user_id
     WHERE ps.student_id = ?`,
    [student.id]);

  // Enrollments
  const enrollments = await qa(
    `SELECT e.*, sec.name AS section_name
     FROM enrollments e LEFT JOIN sections sec ON sec.id = e.section_id
     WHERE e.student_id = ? ORDER BY e.school_year`,
    [student.id]);

  // Grades
  const grades = await qa(
    `SELECT g.*, sub.code AS subject_code, sub.title AS subject_title
     FROM grades g JOIN subjects sub ON sub.id = g.subject_id
     WHERE g.student_id = ? ORDER BY g.school_year, g.quarter, sub.code`,
    [student.id]);

  // Attendance
  const attendance = await qa(
    'SELECT * FROM attendance WHERE student_id = ? ORDER BY date DESC',
    [student.id]);

  // Conduct records
  const conductRecords = await qa(
    'SELECT * FROM conduct_records WHERE student_id = ? ORDER BY created_at DESC',
    [student.id]).catch(() => []);

  // Consent responses
  const consentResponses = await qa(
    `SELECT cr.*, cf.title AS form_title
     FROM consent_responses cr JOIN consent_forms cf ON cf.id = cr.form_id
     WHERE cr.user_id = ? ORDER BY cr.signed_at DESC`,
    [student.user_id]).catch(() => []);

  const exportData = {
    export_date: new Date().toISOString(),
    student: {
      id: student.id,
      lrn: student.lrn,
      first_name: student.first_name,
      middle_name: student.middle_name,
      last_name: student.last_name,
      suffix: student.suffix,
      sex: student.sex,
      birth_date: student.birth_date,
      birth_place: student.birth_place,
      religion: student.religion,
      address: student.address,
      contact: student.contact,
      guardian_name: student.guardian_name,
      guardian_contact: student.guardian_contact,
      guardian_relation: student.guardian_relation,
      grade_level: student.grade_level,
      track_strand: student.track_strand,
      status: student.status,
      created_at: student.created_at,
    },
    linked_accounts: linkedAccounts,
    enrollments,
    grades,
    attendance,
    conduct_records: conductRecords,
    consent_responses: consentResponses,
  };

  await audit(req, 'STUDENT_DATA_EXPORT', 'students', student.id, {
    lrn: student.lrn, exported_by: req.user.id,
  });

  res.json(exportData);
}));

module.exports = router;
