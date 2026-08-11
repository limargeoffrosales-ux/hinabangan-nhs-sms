const express = require('express');
const { qa } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, page } = require('../utils');

const router = express.Router();
router.use(authenticate, requireRole('super_admin', 'school_admin', 'principal'));

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

module.exports = router;
