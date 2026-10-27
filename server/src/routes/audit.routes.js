const express = require('express');
const { qa, q } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, page, listDeleted } = require('../utils');

const router = express.Router();
router.use(authenticate, requireRole('super_admin', 'school_admin'));

router.get('/', asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const q = req.query.q ? `%${req.query.q}%` : '%';
  const rows = await qa(
    'SELECT * FROM audit_logs WHERE action LIKE ? OR username LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [q, q, limit, offset]);
  res.json({ data: rows, limit, offset });
}));

router.get('/actions', asyncH(async (req, res) => {
  const rows = await qa('SELECT action, COUNT(*) AS n FROM audit_logs GROUP BY action ORDER BY n DESC LIMIT 25');
  res.json({ data: rows });
}));

// Recycle bin: list soft-deleted rows across all tables
router.get('/recycle-bin', asyncH(async (req, res) => {
  const { table, limit, offset } = page(req);
  if (table) {
    try {
      const rows = await listDeleted(table, { limit, offset });
      return res.json({ data: rows, limit, offset, table });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }
  // Aggregate across all tables
  const tables = ['students', 'grades', 'announcements', 'sections', 'subjects', 'teachers', 'enrollments', 'attendance'];
  const all = [];
  for (const t of tables) {
    try {
      const rows = await listDeleted(t, { limit: 5, offset: 0 });
      if (rows.length) all.push({ table: t, count: rows.length, latest: rows[0] });
    } catch {}
  }
  res.json({ data: all });
}));

router.get('/anomalies', asyncH(async (req, res) => {
  const sensitiveActions = [
    'EXPORT', 'EXPORT_ANALYTICS', 'EXPORT_STUDENTS',
    'UPDATE_USER_ROLE', 'CREATE_USER', 'DELETE_USER',
    'SUPERADMIN_LOGIN', 'LOGIN_LOCKED_OUT', 'SECURITY_INCIDENT',
    'CHANGE_PASSWORD', 'PASSWORD_RESET', 'DELETE_TEACHER'
  ];
  const placeholders = sensitiveActions.map(() => '?').join(',');
  const rows = await qa(
    `SELECT * FROM audit_logs
     WHERE action IN (${placeholders}) OR ip IN (
       SELECT ip FROM audit_logs WHERE action = 'LOGIN_LOCKED_OUT' GROUP BY ip HAVING COUNT(*) >= 3
     )
     ORDER BY created_at DESC LIMIT 50`,
    sensitiveActions
  );

  const anomalies = rows.map((r) => ({
    ...r,
    severity: ['LOGIN_LOCKED_OUT', 'SECURITY_INCIDENT', 'DELETE_USER'].includes(r.action) ? 'high' : 'medium',
    warning: `Suspicious action detected: ${r.action} by ${r.username || 'unknown'} from IP ${r.ip || 'N/A'}`
  }));

  res.json({ data: anomalies, total: anomalies.length });
}));

module.exports = router;
