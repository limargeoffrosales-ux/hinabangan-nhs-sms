const { q, qa, qr } = require('./db');
const { deleteFile } = require('./storage');
const logger = require('./logger');

const SWEEP_MS = (() => {
  const v = Number(process.env.STORAGE_SWEEP_MS);
  return Number.isFinite(v) && v > 0 ? v : 6 * 60 * 60 * 1000;
})();
const BATCH = 200;

// Retention window formatted to match how each dialect stores timestamps:
// SQLite stores datetime('now') as 'YYYY-MM-DD HH:MM:SS' (UTC); PostgreSQL is
// TIMESTAMPTZ and coerces the string literal in the session timezone (UTC).
function cutoffDate(days) {
  const t = new Date(Date.now() - days * 86400000);
  const p = (n) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}`;
}

// Delete doc_generations rows older than `days`. Bodies are stored in the DB
// (TEXT), so no R2 objects are involved. Opt-in: DOC_GENERATION_RETENTION_DAYS.
async function purgeDocGenerations(days) {
  const cutoff = cutoffDate(days);
  const before = await q('SELECT COUNT(*) AS c FROM doc_generations WHERE created_at < ?', [cutoff]);
  const count = Number((before && before.c) || 0);
  if (count === 0) return 0;
  const run = await qr('DELETE FROM doc_generations WHERE created_at < ?', [cutoff]);
  return Number((run && run.changes) || 0);
}

// Delete submission_files rows older than `days` AND their R2 objects.
// Opt-in: SUBMISSION_FILE_RETENTION_DAYS.
async function purgeSubmissionFiles(days) {
  const cutoff = cutoffDate(days);
  let total = 0;
  for (;;) {
    const rows = await qa('SELECT id, stored_name FROM submission_files WHERE uploaded_at < ? ORDER BY uploaded_at ASC LIMIT ?', [cutoff, BATCH]);
    if (!rows.length) break;
    for (const r of rows) {
      try {
        await deleteFile(r.stored_name);
      } catch (e) {
        logger.warn({ key: r.stored_name, err: e.message }, 'STORAGE_CLEANUP delete object skipped');
      }
    }
    const placeholders = rows.map(() => '?').join(',');
    const run = await qr(`DELETE FROM submission_files WHERE id IN (${placeholders})`, rows.map((r) => r.id));
    total += Number((run && run.changes) || 0);
    if (rows.length < BATCH) break;
  }
  return total;
}

async function purgeExpiredAuditLogs() {
  const cutoff = cutoffDate(1825); // 5 years retention rule
  const run = await qr('DELETE FROM access_logs WHERE timestamp < ?', [cutoff]).catch(() => ({ changes: 0 }));
  const runInc = await qr('DELETE FROM security_incidents WHERE created_at < ?', [cutoff]).catch(() => ({ changes: 0 }));
  return Number((run && run.changes) || 0) + Number((runInc && runInc.changes) || 0);
}

let sweeping = false;

async function sweep() {
  if (sweeping) return;
  sweeping = true;
  try {
    const docDays = parseInt(process.env.DOC_GENERATION_RETENTION_DAYS || '', 10);
    const fileDays = parseInt(process.env.SUBMISSION_FILE_RETENTION_DAYS || '', 10);
    const report = {};
    if (Number.isFinite(docDays) && docDays > 0) report.docGenerations = await purgeDocGenerations(docDays);
    if (Number.isFinite(fileDays) && fileDays > 0) report.submissionFiles = await purgeSubmissionFiles(fileDays);
    report.expiredAuditLogs = await purgeExpiredAuditLogs();
    if (report.docGenerations || report.submissionFiles || report.expiredAuditLogs) {
      logger.info(report, 'STORAGE_CLEANUP & 5-YEAR RETENTION sweep completed');
    }
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack }, 'STORAGE_CLEANUP failed:');
  } finally {
    sweeping = false;
  }
}

function startStorageCleanup() {
  const leader = require('./leader');
  leader.start('storage-cleanup', {
    run: sweep,
    intervalMs: SWEEP_MS,
    onError: (err) => logger.error({ err: err?.message, stack: err?.stack }, 'STORAGE_CLEANUP tick failed:'),
  });
  logger.info({
    sweepMs: SWEEP_MS,
    docRetentionDays: process.env.DOC_GENERATION_RETENTION_DAYS || 'off',
    submissionFileRetentionDays: process.env.SUBMISSION_FILE_RETENTION_DAYS || 'off',
  }, 'STORAGE_CLEANUP initialized (leader-elected)');
}

module.exports = { startStorageCleanup, sweep, purgeDocGenerations, purgeSubmissionFiles, cutoffDate };
