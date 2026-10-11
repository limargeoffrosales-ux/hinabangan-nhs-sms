const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { createBackup, cleanupBackups, runDrill, backupDir, listBackups } = require('./backup');
const { opsAlert } = require('./notify');

const intervalMs = (() => {
  const v = Number(process.env.BACKUP_INTERVAL_HOURS);
  if (Number.isFinite(v) && v > 0) return v * 3600 * 1000;
  return 24 * 3600 * 1000;
})();
const keep = (() => {
  const v = Number(process.env.BACKUP_RETAIN);
  return Number.isFinite(v) && v > 0 ? v : 5;
})();
const healthIntervalMs = 6 * 3600 * 1000; // check backup health every 6h

let running = false;

async function checkBackupHealth() {
  try {
    const backups = listBackups();
    if (!backups.length) {
      await opsAlert({
        subject: 'No backups found',
        body: `No backup files found in ${backupDir()}. Automated backup may not be running.`
      });
      return;
    }
    const newest = backups[backups.length - 1];
    const ageMs = Date.now() - new Date(newest.mtime).getTime();
    const maxAgeMs = intervalMs * 2; // alert if older than 2x interval
    if (ageMs > maxAgeMs) {
      await opsAlert({
        subject: 'Backup is stale',
        body: `Newest backup (${newest.file}) is ${Math.round(ageMs / 3600000)}h old (interval: ${intervalMs / 3600000}h).`
      });
    }
    if (newest.sizeBytes < 1024) {
      await opsAlert({
        subject: 'Backup suspiciously small',
        body: `Backup ${newest.file} is only ${newest.sizeBytes} bytes. May be empty or corrupt.`
      });
    }
    if (process.env.BACKUP_DRILL_ENABLED === '1') {
      // Drill already runs after each backup; if it failed, opsAlert already fired
    }
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack }, 'BACKUP health check failed:');
  }
}

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
          await opsAlert({
            subject: 'Backup restore drill failed',
            body: `Restore drill for ${result.file} mismatched tables: ${report.tables.filter((t) => !t.ok).map((t) => t.table).join(', ')}`
          });
        }
      }
    }
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack }, 'BACKUP sweep failed:');
    await opsAlert({
      subject: 'Automated backup failed',
      body: `Backup sweep error: ${err.message}`
    });
  } finally {
    running = false;
  }
}

function startBackupSweep() {
  if (process.env.BACKUP_ENABLED !== '1') {
    logger.info('BACKUP sweep disabled (set BACKUP_ENABLED=1 to enable)');
    return;
  }
  const leader = require('./leader');
  leader.start('backup', {
    run: runOnce,
    intervalMs,
    onError: (err) => logger.error({ err: err?.message, stack: err?.stack }, 'BACKUP sweep tick failed:'),
  });
  setInterval(checkBackupHealth, healthIntervalMs);
  checkBackupHealth(); // run once at startup
  logger.info({
    intervalMs,
    retain: keep,
    drillEnabled: process.env.BACKUP_DRILL_ENABLED === '1',
    dialect: process.env.DATABASE_URL ? 'pg' : 'sqlite',
    healthCheckIntervalMs: healthIntervalMs,
  }, 'BACKUP sweep initialized (leader-elected)');
}

module.exports = { startBackupSweep, runOnce };
