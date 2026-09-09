const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { createBackup, cleanupBackups, runDrill, backupDir } = require('./backup');

const intervalMs = (() => {
  const v = Number(process.env.BACKUP_INTERVAL_HOURS);
  if (Number.isFinite(v) && v > 0) return v * 3600 * 1000;
  return 24 * 3600 * 1000;
})();
const keep = (() => {
  const v = Number(process.env.BACKUP_RETAIN);
  return Number.isFinite(v) && v > 0 ? v : 5;
})();

let running = false;

async function runOnce() {
  if (running) return;
  running = true;
  const started = Date.now();
  try {
    const result = await createBackup();
    logger.info({
      dialect: result.dialect,
      file: result.file,
      tables: result.tables,
      rows: result.rows,
      sizeBytes: result.sizeBytes,
      r2Key: result.r2Key,
      ms: Date.now() - started,
    }, 'BACKUP completed');
    await cleanupBackups(keep);
    if (process.env.BACKUP_DRILL_ENABLED === '1') {
      const localCopy = path.join(backupDir(), result.file);
      if (fs.existsSync(localCopy)) {
        const report = await runDrill(localCopy);
        if (report.ok) {
          logger.info({ file: result.file, tables: report.tables.length }, 'BACKUP drill PASS');
        } else {
          logger.error({
            file: result.file,
            mismatched: report.tables.filter((t) => !t.ok).map((t) => t.table),
          }, 'BACKUP drill FAIL');
        }
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, 'BACKUP sweep failed:');
  } finally {
    running = false;
  }
}

function startBackupSweep() {
  if (process.env.BACKUP_ENABLED !== '1') {
    logger.info('BACKUP sweep disabled (set BACKUP_ENABLED=1 to enable)');
    return;
  }
  runOnce();
  setInterval(runOnce, intervalMs);
  logger.info({
    intervalMs,
    retain: keep,
    drillEnabled: process.env.BACKUP_DRILL_ENABLED === '1',
    dialect: process.env.DATABASE_URL ? 'pg' : 'sqlite',
  }, 'BACKUP sweep initialized');
}

module.exports = { startBackupSweep, runOnce };