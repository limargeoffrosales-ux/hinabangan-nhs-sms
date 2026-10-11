const { qi, q, qa } = require('./db');
const logger = require('./logger');

async function audit(req, action, entity, entityId, details, diff = null) {
  try {
    await qi(
      'INSERT INTO audit_logs (user_id, username, action, entity, entity_id, details, diff_json, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user ? req.user.id : null, req.user ? req.user.username : null,
        action, entity, entityId != null ? String(entityId) : null,
        details ? JSON.stringify(details) : null,
        diff ? JSON.stringify(diff) : null, req.ip]
    );
  } catch (err) {
    logger.error({ err, action, entity }, 'Audit log write failed');
  }
}

function asyncH(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function page(req) {
  const rawLimit = Number(req.query.limit !== undefined ? req.query.limit : 50);
  const rawOffset = Number(req.query.offset !== undefined ? req.query.offset : 0);
  const limit = Number.isFinite(rawLimit) ? Math.max(Math.min(Math.floor(rawLimit), 200), 1) : 50;
  const offset = Number.isFinite(rawOffset) ? Math.max(Math.floor(rawOffset), 0) : 0;
  return { limit, offset };
}

// PII masking — mask sensitive fields for non-privileged views
function maskPII(row, fields = ['lrn', 'contact', 'guardian_contact', 'guardian_name', 'address', 'birth_place']) {
  if (!row) return row;
  const masked = { ...row };
  for (const f of fields) {
    if (masked[f]) {
      const v = String(masked[f]);
      if (v.length <= 3) masked[f] = '*'.repeat(v.length);
      else if (v.length <= 4) masked[f] = '****';
      else masked[f] = v.slice(0, 2) + '*'.repeat(v.length - 4) + v.slice(-2);
    }
  }
  return masked;
}

// Log read access to student records
async function logAccess(req, studentId, action = 'STUDENT_VIEW') {
  if (!req.user) return;
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    await qi(
      `INSERT INTO data_access_logs (user_id, username, student_id, action, ip) VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, req.user.username, studentId, action, ip]
    );
  } catch (err) {
    logger.error({ err, studentId, action }, 'Access log write failed');
  }
}

function safeJsonParse(str, fallback = null) {
  try { return JSON.parse(str); } catch { return fallback; }
}

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&apos;');
}

// --- Soft delete / recycle bin helpers ---------------------------------------
const SOFT_DELETE_TABLES = new Set([
  'students', 'grades', 'announcements', 'sections', 'subjects',
  'teachers', 'enrollments', 'attendance'
]);

function isSoftDeleteTable(table) {
  return SOFT_DELETE_TABLES.has(table);
}

// Soft delete a row: set deleted_at + deleted_by instead of DELETE
async function softDelete(table, id, userId) {
  if (!isSoftDeleteTable(table)) throw new Error(`Table ${table} not configured for soft delete`);
  const now = new Date().toISOString();
  const result = await qi(
    `UPDATE ${table} SET deleted_at = ?, deleted_by = ? WHERE id = ? AND deleted_at IS NULL`,
    [now, userId, id]
  );
  return (result?.changes || 0) > 0;
}

// Restore a soft-deleted row
async function restoreDeleted(table, id) {
  if (!isSoftDeleteTable(table)) throw new Error(`Table ${table} not configured for soft delete`);
  const result = await qi(
    `UPDATE ${table} SET deleted_at = NULL, deleted_by = NULL WHERE id = ? AND deleted_at IS NOT NULL`,
    [id]
  );
  return (result?.changes || 0) > 0;
}

// Permanently hard-delete (admin only, after retention period)
async function hardDelete(table, id) {
  if (!isSoftDeleteTable(table)) throw new Error(`Table ${table} not configured for soft delete`);
  const result = await qi(`DELETE FROM ${table} WHERE id = ?`, [id]);
  return (result?.changes || 0) > 0;
}

// List soft-deleted rows (recycle bin view)
async function listDeleted(table, { limit = 50, offset = 0 } = {}) {
  if (!isSoftDeleteTable(table)) throw new Error(`Table ${table} not configured for soft delete`);
  return qa(
    `SELECT * FROM ${table} WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
}

// Compute diff between old and new row objects for audit trail
function computeDiff(oldRow, newRow, ignoreFields = ['updated_at', 'deleted_at', 'deleted_by']) {
  if (!oldRow && !newRow) return null;
  const old = oldRow || {};
  const nw = newRow || {};
  const keys = new Set([...Object.keys(old), ...Object.keys(nw)]);
  const diff = { old: {}, new: {} };
  let hasChanges = false;
  for (const k of keys) {
    if (ignoreFields.includes(k)) continue;
    const ov = old[k];
    const nv = nw[k];
    if (JSON.stringify(ov) !== JSON.stringify(nv)) {
      diff.old[k] = ov;
      diff.new[k] = nv;
      hasChanges = true;
    }
  }
  return hasChanges ? diff : null;
}

// Audit with automatic diff computation
async function auditWithDiff(req, action, entity, entityId, oldRow, newRow, extraDetails = {}) {
  const diff = computeDiff(oldRow, newRow);
  await audit(req, action, entity, entityId, { ...extraDetails, entityId }, diff);
}

module.exports = {
  audit, asyncH, page, maskPII, logAccess, safeJsonParse, esc,
  softDelete, restoreDeleted, hardDelete, listDeleted,
  isSoftDeleteTable, computeDiff, auditWithDiff
};
