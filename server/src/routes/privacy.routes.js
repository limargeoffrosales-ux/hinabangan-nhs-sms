const express = require('express');
const db = require('../db');
const { q, qa, qi, qr, nowSql } = db;
const { authenticate, requireRole, clearUserCache } = require('../auth');
const { asyncH, audit, page } = require('../utils');
const { deleteFile, fileKeyFromUrl } = require('../storage');
const logger = require('../logger');

const router = express.Router();
router.use(authenticate);

const ADMIN_ROLES = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];

// The audit trail is the forensic record of who did what. Letting any admin
// role shorten its retention window — or purge it outright — makes the logging
// tamper-evident but not tamper-resistant, so those two entities are gated to
// super_admin while the operational tables (notifications, ai_chat_logs) stay
// available to all admins.
const FORENSIC_ENTITIES = new Set(['audit_logs', 'data_access_logs']);

// ── Data Retention ─────────────────────────────────────────────

router.get('/retention', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const rows = await qa('SELECT * FROM data_retention_policies ORDER BY entity');
  res.json({ data: rows });
}));

router.patch('/retention/:id', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const existing = await q('SELECT * FROM data_retention_policies WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Policy not found' });
  const touchesForensics = FORENSIC_ENTITIES.has(existing.entity);
  if (touchesForensics && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only super_admin can change audit-log retention' });
  }
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
  ai_chat_logs: 'ai_chat_logs',
};

async function runPurge(policy, req) {
  const table = TABLE_MAP[policy.entity];
  if (!table) return { error: `Unknown entity: ${policy.entity}` };
  // Defense in depth: even if a caller reaches the purge path, the forensic
  // tables cannot be destroyed by a non-super_admin.
  if (FORENSIC_ENTITIES.has(policy.entity) && req.user.role !== 'super_admin') {
    return { error: 'Only super_admin can purge audit logs' };
  }

  const days = Number(policy.retention_days) || 365;
  const daysInt = Math.max(1, Math.floor(days));
  const result = await qr(`DELETE FROM ${table} WHERE created_at < ${db.dialect === 'pg' ? `(now() - ($1 || ' days')::interval)` : `datetime('now', '-' || ? || ' days')`}`, [String(daysInt)]);
  const deletedCount = result.changes || 0;

  await qr(
    'UPDATE data_retention_policies SET last_purged_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [policy.id]);
  await audit(req, 'DATA_PURGE', 'data_retention_policies', policy.id, {
    entity: policy.entity, retention_days: policy.retention_days, deleted: deletedCount,
  });
  return { purged: deletedCount };
}

router.post('/retention/:id/purge', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
  const policy = await q('SELECT * FROM data_retention_policies WHERE id = ? AND enabled = TRUE', [req.params.id]);
  if (!policy) return res.status(404).json({ error: 'No active retention policy for this id' });
  if (FORENSIC_ENTITIES.has(policy.entity) && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only super_admin can purge audit logs' });
  }
  const result = await runPurge(policy, req);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ purged: result.purged, entity: policy.entity });
}));

router.post('/purge/:entity', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
  const policy = await q('SELECT * FROM data_retention_policies WHERE entity = ? AND enabled = TRUE', [req.params.entity]);
  if (!policy) return res.status(404).json({ error: 'No active retention policy for this entity' });
  if (FORENSIC_ENTITIES.has(policy.entity) && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only super_admin can purge audit logs' });
  }
  const result = await runPurge(policy, req);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ entity: policy.entity, deleted: result.purged });
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
  if (req.query.from) {
    const fromDate = new Date(req.query.from);
    if (!isNaN(fromDate)) {
      conditions.push('dal.created_at >= ?');
      params.push(fromDate);
    }
  }
  if (req.query.to) {
    const toDate = new Date(req.query.to);
    if (!isNaN(toDate)) {
      conditions.push('dal.created_at <= ?');
      params.push(toDate);
    }
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
  clearUserCache(user.id);
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
  clearUserCache(user.id);
  await audit(req, 'USER_RESTORE', 'users', user.id, {
    username: user.username, role: user.role, previous_status: user.status,
  });
  res.json({ ok: true, status: 'active' });
}));

// ── Right-to-Erasure (RA 10173) ───────────────────────────────

// List erasure requests with resolved student/requester names.
router.get('/erasure-requests', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const where = [];
  const params = [];
  if (req.query.status) { where.push('er.status = ?'); params.push(req.query.status); }
  if (req.query.student_id) { where.push('er.student_id = ?'); params.push(Number(req.query.student_id)); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = await qa(
    `SELECT er.*,
            s.first_name AS student_first, s.last_name AS student_last, s.lrn,
            u.name AS requested_by_name
     FROM data_erasure_requests er
     LEFT JOIN students s ON s.id = er.student_id
     LEFT JOIN users u ON u.id = er.requested_by
     ${whereSql}
     ORDER BY er.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]);
  const totalRow = (await qa(
    `SELECT COUNT(*) AS n FROM data_erasure_requests er ${whereSql}`, params))[0];
  const decorated = rows.map((r) => ({
    ...r,
    student_name: r.student_first ? `${r.student_last}, ${r.student_first}` : null,
  }));
  res.json({ data: decorated, total: Number(totalRow.n), limit, offset });
}));

// Create a right-to-erasure request.
router.post('/erasure-requests', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.student_id) return res.status(400).json({ error: 'student_id is required' });
  const student = await q('SELECT id FROM students WHERE id = ?', [Number(b.student_id)]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const reason = String(b.reason || '').trim();
  const id = await qi(
    'INSERT INTO data_erasure_requests (student_id, requested_by, reason, status) VALUES (?, ?, ?, ?)',
    [student.id, req.user.id, reason || null, 'pending']);
  await audit(req, 'ERASURE_REQUEST_CREATE', 'data_erasure_requests', id,
    { student_id: student.id, reason: reason || null });
  res.status(201).json({ id });
}));

// Export a snapshot of the student's PII for a request.
router.get('/erasure-requests/:id/export', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const reqRow = await q('SELECT * FROM data_erasure_requests WHERE id = ?', [req.params.id]);
  if (!reqRow) return res.status(404).json({ error: 'Erasure request not found' });
  if (!reqRow.student_id) return res.status(400).json({ error: 'This request has no linked student' });
  const bundle = await gatherStudentPii(reqRow.student_id);
  res.json({ request_id: Number(reqRow.id), request: reqRow, ...bundle });
}));

// Approve & process: permanently erase the student's PII and mark done.
router.post('/erasure-requests/:id/approve', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
  const reqRow = await q('SELECT * FROM data_erasure_requests WHERE id = ?', [req.params.id]);
  if (!reqRow) return res.status(404).json({ error: 'Erasure request not found' });
  if (reqRow.status !== 'pending') return res.status(400).json({ error: `Request already ${reqRow.status}` });
  const studentId = reqRow.student_id;
  if (!studentId) return res.status(400).json({ error: 'No linked student to erase' });

  // Gather PII first (for the audit record), then erase in a transaction.
  const bundle = await gatherStudentPii(studentId);
  const student = await q('SELECT photo_url FROM students WHERE id = ?', [studentId]);
  const photoKey = fileKeyFromUrl(student && student.photo_url);
  await db.tx(async (conn) => {
    await conn.qr('DELETE FROM intervention_contacts WHERE plan_id IN (SELECT id FROM intervention_plans WHERE student_id = ?)', [studentId]);
    // Consent responses must be erased too: either directly by student_id (newer
    // rows) or, for legacy rows signed before consent binds a student and that
    // are not yet linked to another student, by any of this student's parents.
    // Parent-signed consents that ARE linked to another student keep that link.
    await conn.qr(
      'DELETE FROM consent_responses WHERE student_id = ? OR (student_id IS NULL AND user_id IN (SELECT parent_user_id FROM parent_students WHERE student_id = ?))',
      [studentId, studentId]);
    // Access-log rows referencing the erased student are part of their data trail.
    await conn.qr('DELETE FROM data_access_logs WHERE student_id = ?', [studentId]);
    await conn.qr('DELETE FROM grades WHERE student_id = ?', [studentId]);
    await conn.qr('DELETE FROM attendance WHERE student_id = ?', [studentId]);
    await conn.qr('DELETE FROM enrollments WHERE student_id = ?', [studentId]);
    await conn.qr('DELETE FROM parent_students WHERE student_id = ?', [studentId]);
    await conn.qr('DELETE FROM learner_assessments WHERE student_id = ?', [studentId]);
    await conn.qr('DELETE FROM aral_session_attendance WHERE student_id = ?', [studentId]);
    await conn.qr('DELETE FROM assignment_submissions WHERE student_id = ?', [studentId]);
    await conn.qr('DELETE FROM student_conduct_ratings WHERE student_id = ?', [studentId]);
    await conn.qr('DELETE FROM student_conduct_records WHERE student_id = ?', [studentId]);
    await conn.qr('DELETE FROM certifications WHERE student_id = ?', [studentId]);
    await conn.qr('DELETE FROM guidance_cases WHERE student_id = ?', [studentId]);
    await conn.qr('DELETE FROM intervention_plans WHERE student_id = ?', [studentId]);
    await conn.qr('DELETE FROM work_immersion WHERE student_id = ?', [studentId]);
    await conn.qr('DELETE FROM jdvp_recipients WHERE student_id = ?', [studentId]);
    await conn.qr('DELETE FROM student_competency_scores WHERE student_id = ?', [studentId]);
    // AI chat logs may reference the erased student in free-text messages.
    // Per data minimization (RA 10173), redact the student's name rather than
    // deleting all chat history, which would destroy other users' data.
    const student = await conn.q('SELECT first_name, last_name FROM students WHERE id = ?', [studentId]);
    if (student) {
      const redacted = '[REDACTED]';
      await conn.qr(
        `UPDATE ai_chat_logs SET
           messages = CASE WHEN messages::text ILIKE ? THEN
             regexp_replace(messages::text, ?, ?, 'gi')::jsonb
           ELSE messages END`,
        [`%${student.first_name}%`, student.first_name, redacted]);
      await conn.qr(
        `UPDATE ai_chat_logs SET
           messages = CASE WHEN messages::text ILIKE ? THEN
             regexp_replace(messages::text, ?, ?, 'gi')::jsonb
           ELSE messages END`,
        [`%${student.last_name}%`, student.last_name, redacted]);
    }
    await conn.qr('DELETE FROM students WHERE id = ?', [studentId]);
  });
  if (photoKey) {
    deleteFile(photoKey).catch((err) => {
      logger.error({ err: err.message, key: photoKey }, '[ERASURE] failed to delete student photo');
    });
  }
  // Strip the gathered PII before persisting: storing a full snapshot of erased
  // data on the request row would leave a permanent copy of the very PII the
  // erasure removes. Only a redacted receipt (per-table row counts) is kept.
  const receipt = summarizeBundle(bundle);
  await qr(
    `UPDATE data_erasure_requests
     SET status = 'processed', processed_by = ?, processed_at = ${nowSql()},
         exported_json = ?
     WHERE id = ?`,
    [req.user.id, JSON.stringify(receipt), reqRow.id]);
  await audit(req, 'ERASURE_REQUEST_APPROVE', 'data_erasure_requests', reqRow.id,
    { student_id: studentId, tables_erased: 24, photo_deleted: !!photoKey });
  res.json({ ok: true, status: 'processed' });
}));

// Assemble every PII-bearing record for a student into one exportable object.
async function gatherStudentPii(studentId) {
  const student = await q('SELECT * FROM students WHERE id = ?', [studentId]);
  if (!student) return { student: null };
  const [contacts, attendance, grades, enrollments, guidance, plans, immersion, certs, ratings, access,
    assessments, aral, submissions, conduct, jdvp, consents] =
    await Promise.all([
      qa('SELECT * FROM parent_students WHERE student_id = ?', [studentId]),
      qa('SELECT * FROM attendance WHERE student_id = ?', [studentId]),
      qa('SELECT * FROM grades WHERE student_id = ?', [studentId]),
      qa('SELECT * FROM enrollments WHERE student_id = ?', [studentId]),
      qa('SELECT * FROM guidance_cases WHERE student_id = ?', [studentId]),
      qa('SELECT * FROM intervention_plans WHERE student_id = ?', [studentId]),
      qa('SELECT * FROM work_immersion WHERE student_id = ?', [studentId]),
      qa('SELECT * FROM certifications WHERE student_id = ?', [studentId]),
      qa('SELECT * FROM student_conduct_ratings WHERE student_id = ?', [studentId]),
      qa('SELECT * FROM data_access_logs WHERE student_id = ?', [studentId]),
      qa('SELECT * FROM learner_assessments WHERE student_id = ?', [studentId]),
      qa('SELECT * FROM aral_session_attendance WHERE student_id = ?', [studentId]),
      qa('SELECT * FROM assignment_submissions WHERE student_id = ?', [studentId]),
      qa('SELECT * FROM student_conduct_records WHERE student_id = ?', [studentId]),
      qa('SELECT * FROM jdvp_recipients WHERE student_id = ?', [studentId]),
      qa('SELECT * FROM consent_responses WHERE student_id = ? OR (student_id IS NULL AND user_id IN (SELECT parent_user_id FROM parent_students WHERE student_id = ?))', [studentId, studentId]),
    ]);
  return { student, contacts, attendance, grades, enrollments, guidance, plans, immersion, certs, ratings, access, assessments, aral, submissions, conduct, jdvp, consents };
}

// Redact a gathered PII bundle into a non-personal receipt for the audit trail.
function summarizeBundle(bundle) {
  const counts = {};
  for (const [key, rows] of Object.entries(bundle)) {
    if (key === 'student') continue;
    if (Array.isArray(rows)) counts[key] = rows.length;
  }
  return { erased: true, note: 'PII intentionally not retained after processing; per-table record counts only', tables: counts };
}

module.exports = router;
