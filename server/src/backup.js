const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const { DATA_DIR } = require('./config');

const DUMP_FORMAT = 'meridianed-dump';
const DUMP_VERSION = 1;
const DEFAULT_KEEP = 5;

const DB_PATH = path.join(DATA_DIR, 'meridianed.db');

function backupDir() {
  return process.env.BACKUP_DIR || path.join(DATA_DIR, 'backups');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function ident(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

function intOr(v, def) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}

// ── Dialect pickers ─────────────────────────────────────────────────────────
// Backup flows run SET search_path (and CREATE/DROP SCHEMA) on their own
// connection. If that connection goes through Neon's pooler, the session
// setting leaks onto shared pooler server connections and breaks every later
// connection ("no schema has been selected to create in"). Always dial the
// direct endpoint here — backups are infrequent and session-scoped anyway.
function pgConnect(url) {
  const { Client } = require('pg');
  let connUrl = null;
  try { connUrl = new URL(url); } catch { /* keep null */ }
  const directUrl = url.includes('-pooler') ? url.replace('-pooler', '') : url;
  const sslMode = connUrl ? connUrl.searchParams.get('sslmode') : null;
  const ssl = sslMode === 'disable' ? false : { rejectUnauthorized: false };
  return new Client({ connectionString: directUrl, ssl });
}

function openSqlite(dbPath, { readOnly = false } = {}) {
  const { DatabaseSync } = require('node:sqlite');
  const opts = {};
  if (readOnly) opts.readOnly = true;
  return new DatabaseSync(dbPath, opts);
}

// ── Schema bootstrap (fresh schema from migrations, used by drill + bootstrap) ─
const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'database', 'migrations');

function migrationFiles(dialect) {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => (dialect === 'pg' ? (f.endsWith('.sql') && !f.endsWith('.sqlite.sql')) : f.endsWith('.sqlite.sql')))
    .filter((f) => /^\d+-/.test(f))
    .sort();
}

// Replay migrations database-side. `record` controls whether each file is
// recorded in schema_migrations: bootstrap records them (mirroring db.js),
// the drill does NOT (the dump itself carries the applied-migration rows).
async function replayPgMigrations(client, schema, { record = false } = {}) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${ident(schema)}`);
  await client.query(`SET search_path = ${ident(schema)}`);
  await client.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (file TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  for (const file of migrationFiles('pg')) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      if (record) await client.query('INSERT INTO schema_migrations (file) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }
}

function replaySqliteMigrations(db, { record = false } = {}) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (file TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  const rec = db.prepare('INSERT OR IGNORE INTO schema_migrations (file) VALUES (?)');
  for (const file of migrationFiles('sqlite')) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      if (record) rec.run(file);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

// ── Dumping ──────────────────────────────────────────────────────────────────
async function pgListTables(client) {
  const res = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
     ORDER BY table_name`);
  return res.rows.map((r) => r.table_name);
}

// Dump the whole database into one portable object. PG uses a single
// SERIALIZABLE READ ONLY transaction so every table sees one consistent
// snapshot. date/numeric columns are cast to text so their exact value
// survives the JSON round-trip (pg parses date as a JS Date and numeric with
// precision loss otherwise).
async function pgDump(client) {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  let tables;
  let schema;
  try {
    const sres = await client.query('SELECT current_schema() AS s');
    schema = sres.rows[0].s;
    tables = await pgListTables(client);
    const dumped = [];
    for (const name of tables) {
      const colsRes = await client.query(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = $1
         ORDER BY ordinal_position`, [name]);
      const cols = colsRes.rows.map((r) => r.column_name);
      const selectList = colsRes.rows.map((r) =>
        (r.data_type === 'date' || r.data_type === 'numeric')
          ? `${ident(r.column_name)}::text AS ${ident(r.column_name)}`
          : ident(r.column_name));
      const rowsRes = await client.query(
        `SELECT ${selectList.join(', ')} FROM ${ident(schema)}.${ident(name)}`);
      const rows = rowsRes.rows.map((r) => cols.map((c) => r[c]));
      dumped.push({ table: name, columns: cols, rows });
    }
    await client.query('COMMIT');
    return { format: DUMP_FORMAT, version: DUMP_VERSION, dialect: 'pg', schema, created_at: new Date().toISOString(), tables: dumped };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

function sqliteDump(db) {
  db.exec('BEGIN');
  try {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);
    const dumped = [];
    for (const name of tables) {
      const st = db.prepare(`SELECT * FROM ${ident(name)}`);
      const cols = st.columns().map((c) => c.column);
      const rows = st.all().map((r) => cols.map((c) => r[c]));
      dumped.push({ table: name, columns: cols, rows });
    }
    db.exec('COMMIT');
    return { format: DUMP_FORMAT, version: DUMP_VERSION, dialect: 'sqlite', created_at: new Date().toISOString(), tables: dumped };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ── FK-aware table ordering for inserts ─────────────────────────────────────
async function pgFkDeps(client) {
  const res = await client.query(
    `SELECT DISTINCT c.conrelid::regclass::text AS rel,
            c.confrelid::regclass::text AS ref
     FROM pg_constraint c
     WHERE c.contype = 'f'
       AND c.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())`);
  return res.rows.map((r) => [r.rel.split('.').pop(), r.ref.split('.').pop()]);
}

function sqliteFkDeps(db) {
  const rows = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL").all();
  const deps = [];
  for (const r of rows) {
    const re = /references\s+["'`]?([\w-]+)/gi;
    let m;
    while ((m = re.exec(r.sql)) !== null) {
      if (m[1].toLowerCase() !== r.name) deps.push([r.name, m[1]]);
    }
  }
  return deps;
}

function topoOrder(tableNames, deps) {
  const byLower = new Map(tableNames.map((t) => [t.toLowerCase(), t]));
  const remaining = new Set([...byLower.keys()]);
  const incoming = {};
  for (const [t, ref] of deps) {
    const tk = t.toLowerCase();
    const rk = ref.toLowerCase();
    if (byLower.has(rk) && tk !== rk) {
      incoming[tk] = incoming[tk] || new Set();
      incoming[tk].add(rk);
    }
  }
  const order = [];
  const emit = (name) => {
    order.push(byLower.get(name));
    remaining.delete(name);
    for (const k of Object.keys(incoming)) incoming[k].delete(name);
  };
  while (remaining.size) {
    const ready = [...remaining].filter((t) => !(incoming[t] && incoming[t].size));
    if (ready.length === 0) {
      // Cycle (e.g. mutual FK). Emit one and clear its blockers so we progress;
      // the drill will surface any genuine FK violation with the table name.
      const victim = remaining.values().next().value;
      if (incoming[victim]) incoming[victim].clear();
      emit(victim);
    } else {
      for (const t of ready) emit(t);
    }
  }
  return order;
}

// ── Restoring ────────────────────────────────────────────────────────────────
async function applyPg(client, dump, { schema = 'public', replace = false } = {}) {
  await client.query(`SET search_path = ${ident(schema)}`);
  const tableSet = new Set(dump.tables.map((t) => t.table.toLowerCase()));
  const deps = (await pgFkDeps(client)).filter(([t]) => tableSet.has(t.toLowerCase()));
  const tableByName = new Map(dump.tables.map((t) => [t.table.toLowerCase(), t]));
  const order = topoOrder(dump.tables.map((t) => t.table), deps);
  for (const name of order) {
    const tbl = tableByName.get(name.toLowerCase());
    if (!tbl || tbl.rows.length === 0) continue;
    if (replace) await client.query(`TRUNCATE TABLE ${ident(schema)}.${ident(name)} CASCADE`);
    const colList = tbl.columns.map(ident).join(', ');
    const placeholders = tbl.columns.map((_, i) => '$' + (i + 1)).join(', ');
    const sql = `INSERT INTO ${ident(schema)}.${ident(name)} (${colList}) VALUES (${placeholders})`;
    for (const row of tbl.rows) await client.query(sql, row);
  }
  if (replace) await resetPgSequences(client, schema);
}

// Advance SERIAL sequences past the restored rows. pg_dump does the equivalent;
// without it the app would hit "duplicate key value violates unique constraint"
// on the next insert of any table that got explicit ids from the backup.
async function resetPgSequences(client, schema) {
  const res = await client.query(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = current_schema() AND column_default LIKE 'nextval%'`);
  for (const r of res.rows) {
    const seq = await client.query(
      `SELECT pg_get_serial_sequence($1, $2) AS seq`,
      [`${schema}.${r.table_name}`, r.column_name]);
    const seqName = seq.rows[0].seq;
    if (!seqName) continue;
    await client.query(
      `SELECT setval($1, COALESCE((SELECT MAX(${ident(r.column_name)}) FROM ${ident(schema)}.${ident(r.table_name)}), 1), true)`,
      [seqName]);
  }
}

function applySqlite(db, dump, { replace = false } = {}) {
  const tableSet = new Set(dump.tables.map((t) => t.table.toLowerCase()));
  const deps = sqliteFkDeps(db).filter(([t]) => tableSet.has(t.toLowerCase()));
  const tableByName = new Map(dump.tables.map((t) => [t.table.toLowerCase(), t]));
  const order = topoOrder(dump.tables.map((t) => t.table), deps);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('BEGIN');
  try {
    for (const name of order) {
      const tbl = tableByName.get(name.toLowerCase());
      if (!tbl || tbl.rows.length === 0) continue;
      if (replace) db.exec(`DELETE FROM ${ident(name)}`);
      const colList = tbl.columns.map(ident).join(', ');
      const placeholders = tbl.columns.map(() => '?').join(', ');
      const st = db.prepare(`INSERT INTO ${ident(name)} (${colList}) VALUES (${placeholders})`);
      for (const row of tbl.rows) st.run(...row);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ── Verification ─────────────────────────────────────────────────────────────
function compareDumps(a, b) {
  const key = (rows) => rows.map((r) => JSON.stringify(r)).sort();
  const aT = new Map(a.tables.map((t) => [t.table.toLowerCase(), t]));
  const bT = new Map(b.tables.map((t) => [t.table.toLowerCase(), t]));
  const names = [...new Set([...aT.keys(), ...bT.keys()])].sort();
  const tables = [];
  let ok = true;
  for (const name of names) {
    const x = aT.get(name);
    const y = bT.get(name);
    const colsOk = !!x && !!y && x.columns.length === y.columns.length &&
      x.columns.every((c, i) => String(c).toLowerCase() === String(y.columns[i]).toLowerCase());
    const rowsA = x ? key(x.rows) : [];
    const rowsB = y ? key(y.rows) : [];
    const same = colsOk && rowsA.length === rowsB.length && rowsA.every((r, i) => r === rowsB[i]);
    if (!same) ok = false;
    tables.push({ table: x ? x.table : name, rows: Math.max(rowsA.length, rowsB.length), ok: same });
  }
  return { ok, tables };
}

function parseDump(buf) {
  const json = buf.toString('utf8');
  const dump = JSON.parse(json);
  if (!dump || dump.format !== DUMP_FORMAT) throw new Error('Not a meridianed dump file');
  if (dump.version !== DUMP_VERSION) throw new Error(`Unsupported dump version ${dump.version}`);
  return dump;
}

function readDumpFile(file) {
  let buf;
  if (/\.gz$/i.test(file)) {
    try {
      buf = zlib.gunzipSync(fs.readFileSync(file));
    } catch (err) {
      throw new Error(`failed to gunzip ${file}: ${err.message}`);
    }
  } else {
    buf = fs.readFileSync(file);
  }
  return parseDump(buf);
}

// ── Backup + restore orchestration ───────────────────────────────────────────
function gzipDump(dump) {
  return zlib.gzipSync(Buffer.from(JSON.stringify(dump), 'utf8'));
}

function r2Prefix() {
  return (process.env.BACKUP_R2_PREFIX || 'backups/meridianed').replace(/\/+$/, '');
}

async function uploadToR2(key, buffer) {
  if (!(process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY && process.env.R2_SECRET_KEY)) return null;
  const { uploadBuffer } = require('./storage');
  await uploadBuffer(key, buffer, 'application/gzip');
  return key;
}

async function createBackup() {
  const usePgUrl = process.env.DATABASE_URL;
  let dump;
  if (usePgUrl) {
    const client = pgConnect(usePgUrl);
    try {
      await client.connect();
      dump = await pgDump(client);
    } finally {
      await client.end().catch(() => {});
    }
  } else {
    ensureDir(DATA_DIR);
    if (!fs.existsSync(DB_PATH)) throw new Error(`No SQLite database found at ${DB_PATH}`);
    // A raw file copy is NOT safe: the app runs WAL mode, so the base .db file
    // can lag behind committed transactions (reads would see stale data).
    // VACUUM INTO materializes an atomic, consistent snapshot instead.
    const snapDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meridianed-snap-'));
    const snapPath = path.join(snapDir, 'snap.db');
    let db;
    try {
      const src = openSqlite(DB_PATH);
      try {
        src.exec(`VACUUM INTO '${snapPath.replace(/'/g, "''")}'`);
      } finally {
        src.close();
      }
      db = openSqlite(snapPath, { readOnly: true });
      dump = sqliteDump(db);
    } finally {
      if (db) db.close();
      try { fs.rmSync(snapDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
  const buffer = gzipDump(dump);
  const fileName = `meridianed-${timestamp()}.json.gz`;
  const dir = backupDir();
  ensureDir(dir);
  const localPath = path.join(dir, fileName);
  fs.writeFileSync(localPath, buffer);
  const r2Key = await uploadToR2(`${r2Prefix()}/${fileName}`, buffer);
  const totalRows = dump.tables.reduce((n, t) => n + t.rows.length, 0);
  return { dialect: dump.dialect, file: fileName, path: localPath, tables: dump.tables.length, rows: totalRows, sizeBytes: buffer.length, r2Key };
}

function localBackupFiles() {
  ensureDir(backupDir());
  return fs.readdirSync(backupDir())
    .filter((f) => f.endsWith('.json.gz'))
    .sort();
}

function listBackups() {
  const files = localBackupFiles();
  if (!files.length) {
    console.log('No backups found in', backupDir());
    return [];
  }
  console.log('Available backups:');
  const out = [];
  for (const f of files) {
    const stat = fs.statSync(path.join(backupDir(), f));
    const mb = (stat.size / 1024 / 1024).toFixed(2);
    out.push({ file: f, path: path.join(backupDir(), f), sizeBytes: stat.size, mtime: stat.mtime.toISOString() });
    console.log(`  ${f}  ${mb} MB  ${stat.mtime.toISOString()}`);
  }
  return out;
}

function cleanupLocal(keep) {
  const files = localBackupFiles();
  const excess = files.slice(0, Math.max(0, files.length - keep));
  for (const f of excess) {
    fs.unlinkSync(path.join(backupDir(), f));
    console.log('  deleted:', f);
  }
  if (excess.length) console.log(`Cleaned ${excess.length} old backup(s), kept ${keep}.`);
  else console.log(`${files.length} backups (<= ${keep} kept) — nothing to clean.`);
  return excess.length;
}

async function cleanupR2(keep) {
  if (!(process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY && process.env.R2_SECRET_KEY)) return 0;
  const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
  const s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY, secretAccessKey: process.env.R2_SECRET_KEY },
  });
  const prefix = r2Prefix() + '/';
  const res = await s3.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET || 'meridianed-uploads', Prefix: prefix }));
  const list = (res.Contents || [])
    .filter((o) => o.Key.endsWith('.json.gz'))
    .sort((a, b) => a.Key.localeCompare(b.Key));
  const excess = list.slice(0, Math.max(0, list.length - keep));
  if (!excess.length) return 0;
  await s3.send(new DeleteObjectsCommand({
    Bucket: process.env.R2_BUCKET || 'meridianed-uploads',
    Delete: { Objects: excess.map((o) => ({ Key: o.Key })) },
  }));
  console.log(`Cleaned ${excess.length} old backup object(s), kept ${keep}.`);
  return excess.length;
}

function cleanupBackups(keep = DEFAULT_KEEP) {
  const k = intOr(keep, DEFAULT_KEEP);
  const local = cleanupLocal(k);
  return cleanupR2(k).then((r2) => local + r2);
}

// Restore a dump into the live database (pg = DATABASE_URL, sqlite = local
// file). The dump's tables are always replaced by backup contents. `bootstrap`
// builds the schema from migrations first (for a fresh/empty target DB).
async function restoreBackup(file, { bootstrap = false } = {}) {
  const dump = readDumpFile(file);
  if (process.env.DATABASE_URL) {
    const client = pgConnect(process.env.DATABASE_URL);
    try {
      await client.connect();
      if (bootstrap) await replayPgMigrations(client, 'public', { record: true });
      // A restore always replaces the dump's tables: migrations seed some
      // tables with defaults, and those rows must be superseded by the backup.
      await applyPg(client, dump, { schema: 'public', replace: true });
    } finally {
      await client.end().catch(() => {});
    }
  } else {
    const target = process.env.BACKUP_TARGET_SQLITE || DB_PATH;
    ensureDir(path.dirname(target));
    const db = openSqlite(target);
    try {
      if (bootstrap) replaySqliteMigrations(db, { record: true });
      applySqlite(db, dump, { replace: true });
    } finally {
      db.close();
    }
  }
  return dump;
}

// Restore drill: builds a fresh isolated schema, replays migrations, restores
// the dump there, re-dumps, and diffs every table against the original.
async function runDrill(file) {
  const dump = readDumpFile(file);
  let restored;
  let cleanUp;
  if (process.env.DATABASE_URL) {
    const client = pgConnect(process.env.DATABASE_URL);
    const schema = `drill_${Date.now().toString(36)}`;
    cleanUp = async () => {
      try { await client.query(`DROP SCHEMA IF EXISTS ${ident(schema)} CASCADE`); } catch { /* keep going */ }
      await client.end().catch(() => {});
    };
    try {
      await client.connect();
      await replayPgMigrations(client, schema);
      // Migrations seed some tables with defaults (app_settings, report_types,
      // subjects, …). The restore replaces them with the dump's rows, so the
      // drill must clear the seed rows first — exactly like a real restore.
      await applyPg(client, dump, { schema, replace: true });
      await client.query(`SET search_path = ${ident(schema)}`);
      restored = await pgDump(client);
    } catch (err) {
      await cleanUp();
      throw err;
    }
  } else {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meridianed-drill-'));
    const dbPath = path.join(tmpDir, 'drill.db');
    const db = openSqlite(dbPath);
    cleanUp = () => {
      try { db.close(); } catch { /* ignore */ }
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    };
    try {
      replaySqliteMigrations(db);
      applySqlite(db, dump, { replace: true });
      restored = sqliteDump(db);
    } catch (err) {
      cleanUp();
      throw err;
    }
  }
  const report = compareDumps(restored, dump);
  if (report.ok) {
    console.log(`RESTORE DRILL PASS — ${report.tables.length} tables, ${dump.tables.reduce((n, t) => n + t.rows.length, 0)} rows identical`);
  } else {
    console.log(`RESTORE DRILL FAIL — mismatched tables: ${report.tables.filter((t) => !t.ok).map((t) => t.table).join(', ')}`);
  }
  await cleanUp();
  return report;
}

module.exports = {
  DUMP_FORMAT,
  ident,
  backupDir,
  createBackup,
  listBackups,
  cleanupBackups,
  restoreBackup,
  runDrill,
  readDumpFile,
  compareDumps,
  pgConnect,
  openSqlite,
  replayPgMigrations,
  replaySqliteMigrations,
};