// DB smoke — boots the real migration pipeline against a throwaway SQLite file
// so a schema break (or a migration that no longer applies) fails the build fast,
// regardless of what the live DB currently looks like.
//
// IMPORTANT: env is set BEFORE requiring src modules, and DATABASE_URL is deleted
// so this never touches a real PostgreSQL connection during a Render build.
'use strict';
for (const k of ['DATABASE_URL', 'POSTGRES_URL', 'PGURL']) delete process.env[k];
process.env.DATA_DIR = require('fs').mkdtempSync(
  require('path').join(require('os').tmpdir(), 'meridianed-test-')
);
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { before, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { init, q, qa, qr, close } = require('../src/db');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'database', 'migrations');

function sqliteMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sqlite.sql'))
    .sort();
}

before(async () => {
  await init();
});

test('full migration pipeline applies clean on a fresh SQLite DB', async () => {
  const applied = await qa('SELECT file FROM schema_migrations ORDER BY file', []);
  const files = sqliteMigrationFiles();

  assert.equal(applied.length, files.length,
    `expected ${files.length} migrations to be recorded, got ${applied.length}`);
  for (let i = 0; i < files.length; i++) {
    assert.equal(applied[i].file, files[i],
      `migration record at position ${i} does not match file order`);
  }

  const tables = (await qa(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    []))
    .map((r) => r.name)
    .sort();
  const expected = ['users', 'refresh_tokens', 'password_resets', 'security_incidents',
    'notifications', 'notification_templates', 'app_settings', 'ai_chat_logs'];
  for (const t of expected) {
    assert.ok(tables.includes(t), `expected table ${t} to exist`);
  }

  const pk = (await qa('PRAGMA table_info(password_resets)', []))
    .filter((c) => c.pk)
    .map((c) => c.name);
  assert.ok(pk.includes('id'), 'password_resets has a primary key');
});

test('settings and user rows round-trip through the migrated DB', async () => {
  const key = 'test_smoke_' + Date.now();
  await qr(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, 'alpha']);
  const read = await q('SELECT value FROM app_settings WHERE key = ?', [key]);
  assert.equal(read.value, 'alpha');

  const dup = 'test-user-' + Date.now();
  await qr(
    "INSERT INTO users (username, role, password_hash, name) VALUES (?, ?, ?, ?)",
    [dup, 'super_admin', 'x', 'Smoke Test']);
  const user = await q('SELECT id, username, role FROM users WHERE username = ?', [dup]);
  assert.equal(user.username, dup);
  assert.equal(user.role, 'super_admin');
  await qr('DELETE FROM users WHERE id = ?', [user.id]);
});

process.on('exit', () => {
  try { close(); } catch {}
  try { fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); } catch {}
});