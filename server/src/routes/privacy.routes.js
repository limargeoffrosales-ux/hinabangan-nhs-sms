const express = require('express');
const db = require('../db');
const { q, qa, qi, qr, nowSql } = db;
const { authenticate, requireRole, clearUserCache } = require('../auth');
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

const TABLE_MAP = {
  notifications: 'notifications',
  audit_logs: 'audit_logs',
  data_access_logs: 'data_access_logs',
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

router.post('/retention/:id/purge', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
  const policy = await q('SELECT * FROM data_retention_policies WHERE id = ? AND enabled = TRUE', [req.params.id]);
  if (!policy) return res.status(404).json({ error: 'No active retention policy for this id' });
  const result = await runPurge(policy, req);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ purged: result.purged, entity: policy.entity });
}));

router.post('/purge/:entity', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
  const policy = await q('SELECT * FROM data_retention_policies WHERE entity = ? AND enabled = TRUE', [req.params.entity]);
  if (!policy) return res.status(404).json({ error: 'No active retention policy for this entity' });
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

module.exports = router;
