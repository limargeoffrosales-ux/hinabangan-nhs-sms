const { qi } = require('./db');

async function audit(req, action, entity, entityId, details) {
  try {
    await qi(
      'INSERT INTO audit_logs (user_id, username, action, entity, entity_id, details, ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user ? req.user.id : null, req.user ? req.user.username : null,
        action, entity, entityId != null ? String(entityId) : null,
        details ? JSON.stringify(details) : null, req.ip]
    );
  } catch {}
}

function asyncH(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function page(req) {
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const offset = Math.max(Number(req.query.offset || 0), 0);
  return { limit, offset };
}

module.exports = { audit, asyncH, page };
