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

// PII masking — mask sensitive fields for non-privileged views
function maskPII(row, fields = ['lrn', 'contact', 'guardian_contact', 'guardian_name', 'address', 'birth_place']) {
  if (!row) return row;
  const masked = { ...row };
  for (const f of fields) {
    if (masked[f]) {
      const v = String(masked[f]);
      if (v.length <= 4) masked[f] = '****';
      else masked[f] = v.slice(0, 2) + '*'.repeat(v.length - 4) + v.slice(-2);
    }
  }
  return masked;
}

// Log read access to student records
async function logAccess(req, studentId, action = 'STUDENT_VIEW') {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    await qi(
      `INSERT INTO data_access_logs (user_id, username, student_id, action, ip) VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, req.user.username, studentId, action, ip]
    );
  } catch {}
}

module.exports = { audit, asyncH, page, maskPII, logAccess };
