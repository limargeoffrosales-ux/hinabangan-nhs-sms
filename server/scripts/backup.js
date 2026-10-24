#!/usr/bin/env node
/**
 * Database backup utility (PostgreSQL/Neon + local SQLite).
 *
 * Usage:
 *   node scripts/backup.js                 # Create a backup (PG if DATABASE_URL set, else SQLite)
 *   node scripts/backup.js --list          # List local backups
 *   node scripts/backup.js --cleanup [N]   # Keep newest N backups (default 5); prunes local + R2
 *   node scripts/backup.js --restore FILE [--yes] [--bootstrap]   # Restore + verify.
 *                                          #   --bootstrap: build schema from migrations first
 *                                          #                (for a fresh/empty target DB)
 *   node scripts/backup.js --drill [FILE]  # Drill: restore into an isolated schema, rebuild it
 *                                          # from migrations, restore data, re-dump and diff.
 *                                          # Defaults to the newest local backup.
 *   node scripts/backup.js --verify FILE   # Offline integrity check (parses + validates)
 */
const path = require('path');
const {
  createBackup,
  listBackups,
  cleanupBackups,
  restoreBackup,
  runDrill,
  readDumpFile,
  backupDir,
} = require('../src/backup');

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--list') {
    listBackups();
    return;
  }

  if (args[0] === '--cleanup') {
    await cleanupBackups(Number(args[1]) || 5);
    return;
  }

  if (args[0] === '--verify') {
    const file = args[1];
    if (!file) { console.error('Usage: node scripts/backup.js --verify FILE'); process.exit(1); }
    const dump = readDumpFile(file);
    const rows = dump.tables.reduce((n, t) => n + t.rows.length, 0);
    console.log(`OK — ${dump.dialect} dump v${dump.version}, ${dump.tables.length} tables, ${rows} rows, created ${dump.created_at}`);
    return;
  }

  if (args[0] === '--restore') {
    const file = args[1];
    const yes = args.includes('--yes');
    const bootstrap = args.includes('--bootstrap');
    if (!file) { console.error('Usage: node scripts/backup.js --restore FILE [--yes] [--bootstrap]'); process.exit(1); }
    if (!yes) {
      console.error('Refusing to restore without --yes. Restoration replaces live data.');
      console.error(`(Use --bootstrap to build the schema from migrations first on an empty target.)`);
      process.exit(1);
    }
    console.log(`Restoring ${file}${bootstrap ? ' with schema bootstrap' : ''}...`);
    const original = readDumpFile(file);
    await restoreBackup(file, { bootstrap });
    console.log(`Data restored (${original.tables.length} tables). Run the drill to confirm integrity.`);
    return;
  }

  if (args[0] === '--drill') {
    let file = args[1];
    if (!file) {
      const files = require('fs').readdirSync(backupDir()).filter((f) => f.endsWith('.json.gz')).sort();
      const latest = files[files.length - 1];
      if (!latest) { console.error('No backups found to drill.'); process.exit(1); }
      file = path.join(backupDir(), latest);
    }
    console.log(`Drill against ${file}...`);
    const report = await runDrill(file);
    if (!report.ok) process.exit(1);
    return;
  }

  // Default: create a backup.
  const result = await createBackup();
  console.log(`Backup created: ${result.path}`);
  console.log(`Local:  ${result.file}  (${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB, ${result.tables} tables, ${result.rows} rows)`);
  console.log(result.r2Key ? `R2:     ${result.r2Key}` : 'R2:     not configured — backup stored locally only');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});