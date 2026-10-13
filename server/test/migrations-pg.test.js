// PG migrations must apply cleanly to an EMPTY database.
//
// This is the check that was missing. The suite ran the migration pipeline only
// against SQLite, and the PG tests only compared file *names* between dialects.
// Nothing ever applied the PG SQL to a real PostgreSQL, so a branch created
// with Neon "Branch schema only" (tables present, schema_migrations empty)
// exposed a replay failure that no test could see.
//
// Runs only when PG_TEST_URL is set, e.g. against a throwaway container:
//
//   docker run -d --name pgtest -e POSTGRES_PASSWORD=testpw \
//     -e POSTGRES_DB=schooltest -p 45999:5432 postgres:16-alpine
//   PG_TEST_URL=postgres://postgres:testpw@127.0.0.1:45999/schooltest node --test ...
//
// Without it the test skips rather than failing, so CI on a fresh runner is
// unaffected.
'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const PG_TEST_URL = process.env.PG_TEST_URL;
const MIGRATIONS = path.join(__dirname, '..', '..', 'database', 'migrations');

const pgFiles = () =>
  fs.readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.sqlite.sql') && /^\d+-/.test(f))
    .sort();

test('PG migrations apply cleanly to an empty database', { skip: PG_TEST_URL ? false : 'set PG_TEST_URL to run' }, async (t) => {
  const { Client } = require('pg');
  const client = new Client({ connectionString: PG_TEST_URL, ssl: false });
  await client.connect();
  t.after(async () => { await client.end().catch(() => {}); });

  // Guarantee a genuinely empty target, whatever the throwaway DB contained.
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (file TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');

  const files = pgFiles();
  assert.ok(files.length > 0, 'there must be PG migrations');

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8');
    try {
      await client.query('BEGIN');
      await client.query('SET search_path = public');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (file) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      const pos = err.position ? Number(err.position) : 0;
      const ctx = pos > 0 ? sql.slice(Math.max(0, pos - 200), pos + 120) : '(no position)';
      assert.fail(
        `migration ${file} failed on a clean PostgreSQL: ${err.code || ''} ${err.message}\n--- context ---\n${ctx}`,
      );
    }
  }

  const { rows } = await client.query(
    `SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'`,
  );
  assert.ok(rows[0].n > 50, `expected the schema to be rebuilt, got ${rows[0].n} tables`);
});

test('replaying PG migrations over an existing schema is not supported', { skip: PG_TEST_URL ? false : 'set PG_TEST_URL to run' }, async (t) => {
  // Documents the failure that stranded the Neon recovery: a branch with the
  // schema copied but no schema_migrations replays migrations over live objects.
  // That is why scripts/reset-db-schema.mjs exists rather than relying on the
  // app to sort itself out.
  const { Client } = require('pg');
  const client = new Client({ connectionString: PG_TEST_URL, ssl: false });
  await client.connect();
  t.after(async () => { await client.end().catch(() => {}); });

  await client.query('SET search_path = public');
  const before = await client.query('SELECT count(*)::int AS n FROM schema_migrations');
  const applied = before.rows[0].n;
  if (applied === 0) return; // previous test skipped; nothing to compare

  const sample = pgFiles().find((f) => /006-/.test(f));
  if (!sample) return;

  const sql = fs.readFileSync(path.join(MIGRATIONS, sample), 'utf8');
  let failed = false;
  try {
    await client.query('BEGIN');
    await client.query('SET search_path = public');
    await client.query(sql);
    await client.query('COMMIT');
  } catch {
    await client.query('ROLLBACK').catch(() => {});
    failed = true;
  }
  assert.ok(failed, '006 is expected to collide when replayed over an existing schema');
});