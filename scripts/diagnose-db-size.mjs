// Where did the disk space go?
//
// Production hit the Neon 512MB cap with ~1.5MB of live tables, which means
// the bulk of the branch is NOT reachable by DELETE, TRUNCATE or VACUUM. This
// script prints the breakdown so the recovery path is unambiguous before you
// decide whether to prune or to rebuild the branch.
//
// Run it where DATABASE_URL is set:
//
//   cd server && node ../scripts/diagnose-db-size.mjs
//
// Render Shell -> the service's shell has DATABASE_URL injected already.
// Locally:  $env:DATABASE_URL="postgresql://..." ; node scripts/diagnose-db-size.mjs

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error('DATABASE_URL is not set. Run this where it is available (e.g. Render Shell).');
  process.exit(1);
}

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

// `pg` is hoisted to the workspace root by npm, so resolve from there rather
// than assuming server/node_modules exists.
let Pool;
try {
  ({ Pool } = require('pg'));
} catch (err) {
  console.error('Could not load the pg driver. Run `npm ci` at the repo root first.');
  console.error('  ' + err.message);
  process.exit(1);
}

const mb = (bytes) => (Number(bytes || 0) / 1024 / 1024).toFixed(1);
const CAP_MB = 512;

const pool = new Pool({ connectionString: conn, ssl: conn.includes('sslmode=disable') ? false : { rejectUnauthorized: false }, max: 1 });
const q = async (sql) => (await pool.query(sql)).rows;

try {
  console.log('=== Neon branch size breakdown ===\n');

  const db = await q(`SELECT pg_database_size(current_database()) AS bytes,
                             current_database() AS name,
                             version() AS version`);
  const dbMb = Number(db[0].bytes) / 1024 / 1024;
  console.log(`database : ${db[0].name}`);
  console.log(`version  : ${String(db[0].version).split(' ').slice(0, 2).join(' ')}`);
  console.log(`size     : ${mb(db[0].bytes)} MB   (Neon free tier cap ~${CAP_MB} MB)`);
  console.log(`headroom : ${(CAP_MB - dbMb).toFixed(1)} MB\n`);

  const rel = await q(`
    SELECT n.nspname AS schema, c.relname AS name,
           pg_total_relation_size(c.oid) AS bytes,
           CASE c.relkind WHEN 'r' THEN 'table' WHEN 'm' THEN 'matview' WHEN 'i' THEN 'index'
                          WHEN 't' THEN 'toast' WHEN 'S' THEN 'sequence' ELSE c.relkind::text END AS kind
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r','m','i','t','S')
    ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 20`);
  console.log('--- largest relations (all schemas, incl. indexes + TOAST) ---');
  for (const r of rel) {
    console.log(`  ${mb(r.bytes).padStart(8)} MB  [${r.kind}] ${r.schema}.${r.name}`);
  }
  if (rel.length === 0) console.log('  (none)');

  const sum = await q(`
    SELECT COALESCE(sum(pg_total_relation_size(c.oid)), 0) AS bytes
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r','m','i','t','S')`);
  const accountedMb = Number(sum[0].bytes) / 1024 / 1024;

  const schemas = await q(`
    SELECT nspname FROM pg_namespace
    WHERE nspname NOT LIKE 'pg\\_%' AND nspname <> 'information_schema' ORDER BY nspname`);

  console.log(`\nlive relations total : ${mb(sum[0].bytes)} MB`);
  console.log(`non-system schemas   : ${schemas.map((s) => s.nspname).join(', ')}`);

  const orphanMb = dbMb - accountedMb;
  console.log(`unaccounted          : ${orphanMb.toFixed(1)} MB\n`);

  console.log('=== Verdict ===');
  if (orphanMb > 64) {
    console.log('Most of the branch is NOT reachable through any table.');
    console.log('These are orphaned relfiles left behind by DROP TABLE /');
    console.log('ALTER TABLE ... DROP across past migrations.');
    console.log('');
    console.log('DELETE, TRUNCATE and VACUUM cannot remove them.');
    console.log('Rebuild the branch (DEPLOYMENT_RUNBOOK.md 4c):');
    console.log('  1. pg_dump "$DATABASE_URL" > backup.sql   (or Neon -> Dump/Download)');
    console.log('  2. Neon console -> create a fresh branch');
    console.log('  3. Render -> Environment -> DATABASE_URL = new branch -> Save -> Deploy');
    console.log('  4. Delete the old branch only after the new one is healthy.');
  } else if (dbMb >= CAP_MB * 0.9) {
    console.log('The size is in live tables. TRUNCATE of the regenerable');
    console.log('tables (tokens, access logs, notifications) plus the boot-time');
    console.log('prune should bring it back under the cap. Redeploy to trigger it.');
  } else {
    console.log('Healthy. No storage action needed.');
  }
} catch (err) {
  console.error('diagnostic failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}