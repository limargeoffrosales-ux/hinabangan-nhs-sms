const express = require('express');
const { q, qa, qr, dialect } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');

const router = express.Router();
router.use(authenticate);

const ADMIN_ROLES = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];

// GET /privacy-audit/access-logs — list read-access logs (paginated, filterable)
router.get('/access-logs', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const conditions = [];
  const params = [];

  if (req.query.student_id) {
    conditions.push('dal.student_id = ?');
    params.push(Number(req.query.student_id));
  }
  if (req.query.user_id) {
    conditions.push('dal.user_id = ?');
    params.push(Number(req.query.user_id));
  }
  if (req.query.action) {
    conditions.push('dal.action = ?');
    params.push(req.query.action);
  }
  if (req.query.date_from) {
    conditions.push('dal.created_at >= ?');
    params.push(req.query.date_from);
  }
  if (req.query.date_to) {
    conditions.push('dal.created_at <= ?');
    params.push(req.query.date_to);
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
    `SELECT COUNT(*) AS n FROM data_access_logs dal ${where}`,
    params))[0];

  res.json({ data: rows, total: totalRow.n, limit, offset });
}));

// GET /privacy-audit/access-logs/stats — aggregate stats
router.get('/access-logs/stats', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const topViewed = await qa(
    `SELECT dal.student_id, s.first_name, s.last_name, COUNT(*) AS view_count
     FROM data_access_logs dal
     LEFT JOIN students s ON s.id = dal.student_id
     WHERE dal.action LIKE 'STUDENT_%'
     GROUP BY dal.student_id
     ORDER BY view_count DESC
     LIMIT 10`);

  const topViewers = await qa(
    `SELECT dal.user_id, u.username, u.name, u.role, COUNT(*) AS access_count
     FROM data_access_logs dal
     LEFT JOIN users u ON u.id = dal.user_id
     GROUP BY dal.user_id
     ORDER BY access_count DESC
     LIMIT 10`);

  const recentActivity = await qa(
    dialect === 'pg'
      ? `SELECT dal.action, COUNT(*) AS count
         FROM data_access_logs dal
         WHERE dal.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
         GROUP BY dal.action
         ORDER BY count DESC`
      : `SELECT dal.action, COUNT(*) AS count
         FROM data_access_logs dal
         WHERE dal.created_at >= datetime('now', '-7 days')
         GROUP BY dal.action
         ORDER BY count DESC`);

  const totalLogs = (await qa('SELECT COUNT(*) AS n FROM data_access_logs'))[0].n;

  res.json({
    top_viewed_students: topViewed,
    top_viewers: topViewers,
    recent_activity: recentActivity,
    total_logs: totalLogs,
  });
}));

// GET /privacy-audit/role-reviews — list users with their roles, last login, MFA status
router.get('/role-reviews', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const rows = await qa(
    `SELECT u.id, u.username, u.name, u.role, u.email, u.status, u.mfa_enabled, u.created_at,
            (SELECT rt.expires_at FROM refresh_tokens rt WHERE rt.user_id = u.id AND rt.revoked = FALSE ORDER BY rt.expires_at DESC LIMIT 1) AS last_token_activity,
            (SELECT MAX(rt2.expires_at) FROM refresh_tokens rt2 WHERE rt2.user_id = u.id) AS last_login_estimate
     FROM users u
     ORDER BY u.role, u.name
     LIMIT ? OFFSET ?`,
    [limit, offset]);

  const total = (await qa('SELECT COUNT(*) AS n FROM users'))[0].n;

  res.json({ data: rows, total, limit, offset });
}));

// POST /privacy-audit/role-reviews/:userId/suspend — temporarily suspend a user's access
router.post('/role-reviews/:userId/suspend', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
  const user = await q('SELECT id, username, name, role, status FROM users WHERE id = ?', [req.params.userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (Number(user.id) === req.user.id) return res.status(400).json({ error: 'You cannot suspend your own account' });
  if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only super_admin can suspend another super_admin' });
  }

  const newStatus = user.status === 'suspended' ? 'active' : 'suspended';
  await qr('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, user.id]);

  // Revoke all active refresh tokens if suspending
  if (newStatus === 'suspended') {
    await qr('UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ? AND revoked = FALSE', [user.id]);
  }

  await audit(req, newStatus === 'suspended' ? 'USER_SUSPEND' : 'USER_UNSUSPEND', 'users', user.id, {
    username: user.username, role: user.role, previous_status: user.status,
  });

  res.json({ ok: true, status: newStatus });
}));

module.exports = router;
