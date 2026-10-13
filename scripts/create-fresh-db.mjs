// Create a FRESH, empty database on the current Neon branch and apply the full
// PG migration pipeline to it, leaving every existing database untouched.
//
// Use this when DATABASE_URL points at a database whose schema is not this
// project's - e.g. a branch that was copied from another application, where
// `students.id` is a uuid and the FK in migrations 001 cannot be implemented.
//
// Why not just DROP SCHEMA public CASCADE (scripts/reset-db-schema.mjs)?
// Because that database may belong to a different project. Creating a sibling
// database is non-destructive: the other app keeps working, and the school app
// simply gets pointed at the new one.
//
//   node scripts/create-fresh-db.mjs                     # defaults to ./hinabangan
//   NEW_DB=school node scripts/create-fresh-db.mjs
//
// Afterwards, point the app at it by changing only the path in DATABASE_URL:
//   .../<old-name>  ->  .../hinabangan
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let Client;
try {
  ({ Client } = require('pg'));
} catch {
  console.error('Could not load the pg driver. Run `npm ci` at the repo root first.');
  process.exit(1);
}

const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error('DATABASE_URL is not set. Run this where it is available (e.g. Render Shell).');
  process.exit(1);
}

const NEW_DB = process.env.NEW_DB || 'hinabangan';
const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = path.join(here, '..', 'database', 'migrations');
const base = new URL(conn);

// Identifiers cannot be bound as parameters; the name comes from NEW_DB, so
// restrict it to characters that need no quoting.
if (!/^[a-z_][a-z0-9_]*$/.test(NEW_DB)) {
  console.error(`NEW_DB must be a plain identifier (lowercase, digits, underscore). Got: ${NEW_DB}`);
  process.exit(1);
}

const ssl = (() => {
  try {
    const mode = new URL(conn).searchParams.get('sslmode');
    if (!mode || mode === 'disable') return false;
    return { rejectUnauthorized: false };
  } catch { return false; }
})();

const connectTo = (dbname) => {
  const u = new URL(base.toString());
  u.pathname = '/' + dbname;
  return new Client({ connectionString: u.toString(), ssl });
};

// Never point this at the database that currently holds the other app's data.
if (decodeURIComponent(base.pathname.replace(/^\//, '')) === NEW_DB) {
  console.error(`DATABASE_URL already points at "${NEW_DB}" - refusing to touch it.`);
  console.error('Point DATABASE_URL at the CURRENT database and choose a different NEW_DB.');
  process.exit(1);
}

const admin = connectTo('postgres');
await admin.connect();
const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [NEW_DB]);
if (exists.rowCount) {
  console.log(`database "${NEW_DB}" already exists - reusing it`);
} else {
  await admin.query(`CREATE DATABASE "${NEW_DB}"`);
  console.log(`created database "${NEW_DB}"`);
}
await admin.end();

const db = connectTo(NEW_DB);
await db.connect();
await db.query('SET search_path = public');
await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (file TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');

const files = fs.readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql') && !f.endsWith('.sqlite.sql') && /^\d+-/.test(f))
  .sort();

let applied = 0;
let skipped = 0;
for (const file of files) {
  // Mirror db.js migrate(): never replay a migration already recorded, or it
  // collides with the constraints the first run created.
  const done = await db.query('SELECT 1 FROM schema_migrations WHERE file = $1', [file]);
  if (done.rowCount) { skipped++; continue; }
  const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8');
  try {
    await db.query('BEGIN');
    await db.query('SET search_path = public');
    await db.query(sql);
    await db.query('INSERT INTO schema_migrations (file) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
    await db.query('COMMIT');
    applied++;
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    console.error(`\nFAILED at ${file} (${applied} applied): ${err.code || ''} ${err.message}`);
    await db.end();
    process.exit(1);
  }
}

const v = await db.query(`
  SELECT
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r') AS tables,
    (SELECT count(*)::int FROM schema_migrations) AS migrations,
    (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'id') AS students_id_type,
    (SELECT count(*)::int FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type = 'uuid') AS uuid_columns`);

console.log(`\napplied ${applied} migrations to "${NEW_DB}"`);
console.log(v.rows[0]);
if (v.rows[0].students_id_type !== 'bigint' || v.rows[0].uuid_columns !== 0) {
  console.error('\nunexpected schema - students.id should be bigint with no uuid columns.');
  await db.end();
  process.exit(1);
}

const target = new URL(base.toString());
target.pathname = '/' + NEW_DB;
console.log('\nNext: set DATABASE_URL to this, then deploy.');
console.log('  host/database changed, credentials and host unchanged:\n');
console.log('  ' + target.toString().replace(/(postgres(?:ql)?:\/\/)[^@]*@/, '$1<credentials>@'));
console.log('\n  Only the path after the host changes. Keep sslmode=require.');
await db.end();