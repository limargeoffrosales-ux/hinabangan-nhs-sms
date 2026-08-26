#!/usr/bin/env node
/**
 * Database backup utility.
 *
 * Usage:
 *   node scripts/backup.js              # Creates timestamped backup in DATA_DIR/backups/
 *   node scripts/backup.js --restore FILE  # Restores from a backup file (sqlite only)
 *
 * For PostgreSQL: set DATABASE_URL and use pg_dump directly.
 * For SQLite: copies the database file.
 */
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../src/config');

const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_PATH = path.join(DATA_DIR, 'meridianed.db');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function backupSqlite() {
  ensureDir(BACKUP_DIR);
  if (!fs.existsSync(DB_PATH)) {
    console.error('No SQLite database found at', DB_PATH);
    process.exit(1);
  }
  const dest = path.join(BACKUP_DIR, `meridianed-${timestamp()}.db`);
  fs.copyFileSync(DB_PATH, dest);
  console.log(`Backup created: ${dest}`);
  console.log(`Size: ${(fs.statSync(dest).size / 1024 / 1024).toFixed(2)} MB`);
  return dest;
}

function listBackups() {
  ensureDir(BACKUP_DIR);
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.db'))
    .sort()
    .reverse();
  if (files.length === 0) {
    console.log('No backups found in', BACKUP_DIR);
    return;
  }
  console.log('Available backups:');
  for (const f of files) {
    const stat = fs.statSync(path.join(BACKUP_DIR, f));
    console.log(`  ${f}  ${(stat.size / 1024 / 1024).toFixed(2)} MB  ${stat.mtime.toISOString()}`);
  }
}

function restoreSqlite(file) {
  if (!fs.existsSync(file)) {
    console.error('Backup file not found:', file);
    process.exit(1);
  }
  ensureDir(BACKUP_DIR);
  const currentBackup = path.join(BACKUP_DIR, `pre-restore-${timestamp()}.db`);
  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, currentBackup);
    console.log('Current database backed up to:', currentBackup);
  }
  fs.copyFileSync(file, DB_PATH);
  console.log('Database restored from:', file);
}

function cleanup(keep = 10) {
  ensureDir(BACKUP_DIR);
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.db'))
    .sort();
  if (files.length <= keep) {
    console.log(`${files.length} backups (<= ${keep} kept) — nothing to clean.`);
    return;
  }
  const toDelete = files.slice(0, files.length - keep);
  for (const f of toDelete) {
    fs.unlinkSync(path.join(BACKUP_DIR, f));
    console.log('  deleted:', f);
  }
  console.log(`Cleaned ${toDelete.length} old backup(s), kept ${keep}.`);
}

const args = process.argv.slice(2);
if (args[0] === '--restore') {
  restoreSqlite(args[1]);
} else if (args[0] === '--list') {
  listBackups();
} else if (args[0] === '--cleanup') {
  cleanup(Number(args[1]) || 10);
} else if (process.env.DATABASE_URL) {
  console.log('PostgreSQL detected. Use pg_dump for backups:');
  console.log(`  pg_dump "$DATABASE_URL" > backup-${timestamp()}.sql`);
} else {
  backupSqlite();
}
