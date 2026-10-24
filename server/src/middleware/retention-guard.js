const { q } = require('../db');

const RETENTION_YEARS = 5;
const RETENTION_DAYS = RETENTION_YEARS * 365;

async function enforceRetentionPolicy(tableName, recordId) {
  const protectedTables = ['students', 'grades', 'enrollments', 'attendance', 'class_assignments'];
  if (!protectedTables.includes(tableName)) {
    return { allowed: true };
  }
  const row = await q(`SELECT created_at FROM ${tableName} WHERE id = ?`, [recordId]);
  if (!row) return { allowed: false, error: 'Record not found' };

  const createdAt = new Date(row.created_at || Date.now());
  const ageDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (ageDays < RETENTION_DAYS) {
    return {
      allowed: false,
      error: `Data Retention Policy (RA 10173 & DepEd): Institutional records in '${tableName}' are immutable and protected from deletion for 5 years. (Record age: ${Math.floor(ageDays)} days; minimum required: ${RETENTION_DAYS} days).`,
    };
  }
  return { allowed: true };
}

module.exports = { enforceRetentionPolicy, RETENTION_YEARS };
