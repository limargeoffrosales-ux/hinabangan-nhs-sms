const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');

const router = express.Router();
const ADMIN_ROLES = ['super_admin', 'school_admin'];

// GET /security-incidents — list all incidents (admin)
router.get('/', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const p = page(req);
  const { type, severity, resolved } = req.query;
  let where = 'WHERE 1=1';
  const params = [];
  if (type) { where += ' AND incident_type = ?'; params.push(type); }
  if (severity) { where += ' AND severity = ?'; params.push(severity); }
  if (resolved !== undefined) { where += ' AND resolved = ?'; params.push(resolved === 'true' ? true : false); }

  const rows = await qa(`SELECT * FROM security_incidents ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, p.limit, p.offset]);
  const total = (await qa(`SELECT COUNT(*) AS n FROM security_incidents ${where}`, params))[0].n;

  // Get summary stats
  const stats = await qa(`SELECT incident_type, severity, COUNT(*) as count FROM security_incidents WHERE NOT resolved GROUP BY incident_type, severity ORDER BY count DESC`, []);

  res.json({ data: rows, total, limit: p.limit, offset: p.offset, stats });
}));

// GET /security-incidents/stats — security dashboard summary
router.get('/stats', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const unresolved = (await qa('SELECT COUNT(*) AS n FROM security_incidents WHERE NOT resolved'))[0].n;
  const today = (await qa("SELECT COUNT(*) AS n FROM security_incidents WHERE created_at >= CURRENT_DATE"))[0].n;
  const highSeverity = (await qa("SELECT COUNT(*) AS n FROM security_incidents WHERE severity = 'high' AND NOT resolved"))[0].n;
  const byType = await qa('SELECT incident_type, COUNT(*) as count FROM security_incidents GROUP BY incident_type ORDER BY count DESC');
  const recent = await qa('SELECT * FROM security_incidents ORDER BY created_at DESC LIMIT 10');
  res.json({ unresolved, today, highSeverity, byType, recent });
}));

// PATCH /security-incidents/:id/resolve — mark incident as resolved
router.patch('/:id/resolve', requireRole(...ADMIN_ROLES), asyncH(async (req, res) => {
  const incident = await q('SELECT * FROM security_incidents WHERE id = ?', [req.params.id]);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  if (incident.resolved) return res.status(400).json({ error: 'Already resolved' });
  await qr(
    'UPDATE security_incidents SET resolved = TRUE, resolved_by = ?, resolved_at = now() WHERE id = ?',
    [req.user.id, req.params.id]
  );
  await audit(req, 'INCIDENT_RESOLVE', 'security_incidents', req.params.id, { type: incident.incident_type });
  res.json({ ok: true });
}));

// DELETE /security-incidents/purge-old — delete incidents older than retention policy (super_admin only)
router.delete('/purge-old', requireRole('super_admin'), asyncH(async (req, res) => {
  const setting = (await qa("SELECT value FROM app_settings WHERE key = 'incident_retention_days'"))[0];
  const days = Number(setting?.value || 365);
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const result = await qr('DELETE FROM security_incidents WHERE created_at < ?', [cutoff]);
  await audit(req, 'INCIDENT_PURGE', 'security_incidents', null, { days, deleted: result.rowCount });
  res.json({ ok: true, deleted: result.rowCount, retentionDays: days });
}));

module.exports = router;
