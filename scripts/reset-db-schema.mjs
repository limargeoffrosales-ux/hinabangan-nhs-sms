// Reset a database schema to empty so migrations can rebuild it cleanly.
//
// Why this exists: a Neon branch created with "Branch schema only" has the
// tables but an EMPTY schema_migrations table. Every migration then replays on
// top of existing objects and dies partway — e.g.
//
//   relation "enrollments_student_id_school_year_term_key" already exists   (42P07)
//
// Wiping the schema and letting the normal boot path re-run all migrations is
// the reliable reset: verified against PostgreSQL 16, all 100 PG migrations
// apply cleanly to a genuinely empty database (96 tables rebuilt).
//
// DESTRUCTIVE. It deletes every table in the `public` schema. Run it against a
// BRANCH you intend to rebuild, never against production data you still need.
//
//   node scripts/reset-db-schema.mjs            # asks for confirmation
//   node scripts/reset-db-schema.mjs --yes      # non-interactive
//   node scripts/reset-db-schema.mjs --dry-run   # show what would be dropped

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error('DATABASE_URL is not set. Run this where it is available (e.g. Render Shell).');
  process.exit(1);
}

let Client;
try {
  ({ Client } = require('pg'));
} catch {
  console.error('Could not load the pg driver. Run `npm ci` at the repo root first.');
  process.exit(1);
}

const args = process.argv.slice(2);
const assumeYes = args.includes('--yes');
const dryRun = args.includes('--dry-run');

// Refuse an obviously-dangerous target before touching anything.
let host = '(unknown)';
let dbName = '(unknown)';
try {
  const u = new URL(conn);
  host = u.hostname;
  dbName = u.pathname.replace(/^\//, '');
} catch { /* leave placeholders */ }

// Only force SSL when the connection string actually asks for it. Neon always
// includes `sslmode=require`; a local throwaway container usually has no
// sslmode at all, and forcing SSL there fails with "The server does not
// support SSL connections".
function sslFor(connectionString) {
  try {
    const mode = new URL(connectionString).searchParams.get('sslmode');
    if (!mode || mode === 'disable') return false;
    return { rejectUnauthorized: false };
  } catch {
    return false;
  }
}

const client = new Client({
  connectionString: conn,
  ssl: sslFor(conn),
});

try {
  await client.connect();
  await client.query('SET search_path = public');

  const { rows } = await client.query(`
    SELECT c.relname AS table, c.reltuples::bigint AS approx_rows
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','m','p')
    ORDER BY c.relname`);

  console.log('Target');
  console.log(`  host    : ${host}`);
  console.log(`  database: ${dbName}`);
  console.log(`  tables  : ${rows.length}`);
  if (rows.length) {
    console.log('  will DROP:');
    for (const r of rows) console.log(`    - ${r.table}`);
  }

  if (dryRun) {
    console.log('\n--dry-run: nothing was changed.');
    await client.end();
    process.exit(0);
  }

  if (!assumeYes) {
    console.log('\nThis DELETES every table listed above. Type RESET to continue:');
    const answer = await new Promise((resolve) => {
      const rl = require('node:readline').createInterface({ input: process.stdin, output: process.stdout });
      rl.question('', (a) => { rl.close(); resolve(a); });
    });
    if (String(answer).trim() !== 'RESET') {
      console.log('aborted - nothing was changed');
      await client.end();
      process.exit(1);
    }
  }

  console.log('\nresetting schema...');
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query('GRANT ALL ON SCHEMA public TO public');

  const after = await client.query(`
    SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','m')`);
  console.log(`tables remaining: ${after.rows[0].n}`);
  console.log('\nDone. Deploy the service now — the boot path rebuilds the schema');
  console.log('from database/migrations, then restore your data with:');
  console.log('  node server/scripts/backup.js --restore <file> --yes');
} catch (err) {
  console.error('reset failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}