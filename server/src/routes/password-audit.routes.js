const express = require('express');
const { q, qa } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, page } = require('../utils');

const router = express.Router();
router.use(authenticate);

// GET /password-audit?user_id=&limit=&offset= — history for one user
router.get('/', requireRole('super_admin'), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const { user_id } = req.query;
  let sql = `
    SELECT pa.*, u.username AS target_username, u.name AS target_name,
           a.username AS changer_username, a.name AS changer_name
    FROM password_audit pa
    JOIN users u ON u.id = pa.user_id
    LEFT JOIN users a ON a.id = pa.changed_by`;
  const params = [];
  if (user_id) { sql += ' WHERE pa.user_id = ?'; params.push(user_id); }
  sql += ' ORDER BY pa.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const rows = await qa(sql, params);
  res.json({ data: rows, limit, offset });
}));

// GET /password-audit/all — all changes across all users
router.get('/all', requireRole('super_admin'), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const rows = await qa(
    `SELECT pa.*, u.username AS target_username, u.name AS target_name,
            a.username AS changer_username, a.name AS changer_name
     FROM password_audit pa
     JOIN users u ON u.id = pa.user_id
     LEFT JOIN users a ON a.id = pa.changed_by
     ORDER BY pa.created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]);
  res.json({ data: rows, limit, offset });
}));

// GET /password-audit/stats — summary statistics
router.get('/stats', requireRole('super_admin'), asyncH(async (req, res) => {
  const [total] = await qa('SELECT COUNT(*) AS count FROM password_audit');
  const [recent] = await qa("SELECT COUNT(*) AS count FROM password_audit WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'");
  const [byAction] = await qa(
    "SELECT action, COUNT(*) AS count FROM password_audit GROUP BY action ORDER BY action");
  const [byUser] = await qa(
    `SELECT pa.changed_by, a.username, a.name, COUNT(*) AS count
     FROM password_audit pa LEFT JOIN users a ON a.id = pa.changed_by
     GROUP BY pa.changed_by ORDER BY count DESC LIMIT 10`);
  res.json({
    total: total.count,
    last_7_days: recent.count,
    by_action: byAction,
    by_admin: byUser,
  });
}));

module.exports = router;
