const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./config');
const logger = require('./logger');

const usePg = !!process.env.DATABASE_URL;
let driver = null;
let dialect = 'sqlite';
let poolRef = null;

function pgParams(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => '$' + (++i));
}

// Normalize JS boolean params to 1/0: PostgreSQL accepts booleans directly,
// node:sqlite rejects them ("Provided value cannot be bound"), so bind as
// smallint text on both dialects.
function normParams(p) {
  if (!p) return p;
  return p.map((v) => (v === true ? 1 : v === false ? 0 : v));
}

// Neon rejects any DDL that would extend a file on a branch already at its
// size cap, surfacing as SQLSTATE 53100. Distinguishing this from a genuine
// migration defect decides whether the app is allowed to boot.
function isStorageCapError(err) {
  if (!err) return false;
  if (err.code === '53100') return true;
  return /53100|disk full|no space left|exceeded the size limit/i.test(String(err.message || ''));
}

async function init() {
  if (usePg) {
    dialect = 'pg';
    const { Pool } = require('pg');
    const connUrl = new URL(process.env.DATABASE_URL);
    // Fix SSL mode warning: explicitly use 'verify-full' (matches current behavior)
    // Neon requires SSL; verify-full validates the server certificate.
    const sslMode = connUrl.searchParams.get('sslmode');
    const useSsl = sslMode === 'disable' ? false : { rejectUnauthorized: false };
    // Pin search_path on every new backend connection and keep the pool small:
    // backups historically leaked a SET search_path into Neon's pooler which
    // then behaved as if search_path pointed at a schema that had been dropped.
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: useSsl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      options: '-c search_path=public'
    });
    // search_path is pinned by the pool's `options` parameter above, which the
    // server applies during connection setup - before the client is handed
    // out, so it cannot race.
    //
    // Do NOT re-issue SET search_path from a pool.on('connect') listener: that
    // callback fires while the acquiring caller is already dispatching its
    // first query, which pg reports as "Calling client.query() when the
    // client is already executing a query" and can interleave badly.
    pool.on('error', (err) => {
      logger.error({ err }, 'PostgreSQL pool idle client error');
    });
    poolRef = pool;
    driver = {
      params: pgParams,
      run: (sql, p) => pool.query(pgParams(sql), normParams(p) || []).then((r) => ({ changes: r.rowCount })),
      runId: async (sql, p) => (await pool.query(pgParams(sql + ' RETURNING *'), normParams(p) || [])).rows[0]?.id,
      get: async (sql, p) => (await pool.query(pgParams(sql), normParams(p) || [])).rows[0] || null,
      all: async (sql, p) => (await pool.query(pgParams(sql), normParams(p) || [])).rows,
      exec: (sql) => pool.query(sql),
      close: () => pool.end(),
      tx: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const stmts = {
            run: (sql, p) => client.query(pgParams(sql), normParams(p) || []).then((r) => ({ changes: r.rowCount })),
            runId: async (sql, p) => (await client.query(pgParams(sql + ' RETURNING *'), normParams(p) || [])).rows[0]?.id,
            get: async (sql, p) => (await client.query(pgParams(sql), normParams(p) || [])).rows[0] || null,
            all: async (sql, p) => (await client.query(pgParams(sql), normParams(p) || [])).rows,
          };
          const result = await fn({
            ...stmts,
            q: stmts.get,
            qa: stmts.all,
            qr: stmts.run,
            qi: stmts.runId,
          });
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      },
    };
  } else {
    const { DatabaseSync } = require('node:sqlite');
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const db = new DatabaseSync(path.join(DATA_DIR, 'meridianed.db'));
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    const stmtCache = new Map();
    function getStmt(sql) {
      if (stmtCache.size > 500) stmtCache.clear();
      let stmt = stmtCache.get(sql);
      if (!stmt) {
        stmt = db.prepare(sql);
        stmtCache.set(sql, stmt);
      }
      return stmt;
    }
    // SQLite uses a single shared connection, so all statements — including the
    // BEGIN/COMMIT of a transaction — must run on one serialized queue. Without
    // this, an `await` inside a tx callback would let another request's writes
    // execute inside the open transaction and get rolled back on ROLLBACK.
    let chain = Promise.resolve();
    function enqueue(fn) {
      const p = chain.then(() => {
        try {
          return fn();
        } catch (e) {
          e.stack = 'SQLITE-BIND >>> ' + (fn.sql || 'unknown') + '\n' + e.stack;
          throw e;
        }
      });
      chain = p.then(() => {}, () => {});
      return p;
    }
    function bind(sql, args, fn) {
      fn.sql = sql;
      fn.args = () => args;
      return enqueue(fn);
    }
    driver = {
      params: (sql) => sql,
      run: (sql, p) => bind(sql, p, () => {
        const st = getStmt(sql);
        const r = p ? st.run(...normParams(p)) : st.run();
        return { changes: Number(r.changes || 0) };
      }),
      runId: (sql, p) => bind(sql, p, () => {
        const st = getStmt(sql);
        const r = p ? st.run(...normParams(p)) : st.run();
        return Number(r.lastInsertRowid);
      }),
      get: (sql, p) => enqueue(() => {
        const st = getStmt(sql);
        return (p ? st.get(...p) : st.get()) || null;
      }),
      all: (sql, p) => enqueue(() => {
        const st = getStmt(sql);
        return p ? st.all(...p) : st.all();
      }),
      exec: (sql) => db.exec(sql),
      close: () => db.close(),
      tx: (fn) => enqueue(async () => {
        db.exec('BEGIN');
        try {
          const stmts = {
            run: (sql, p) => {
              const st = getStmt(sql);
              const r = p ? st.run(...normParams(p)) : st.run();
              return { changes: Number(r.changes || 0) };
            },
            runId: (sql, p) => {
              const st = getStmt(sql);
              const r = p ? st.run(...normParams(p)) : st.run();
              return Number(r.lastInsertRowid);
            },
            get: (sql, p) => {
              const st = getStmt(sql);
              return (p ? st.get(...p) : st.get()) || null;
            },
            all: (sql, p) => {
              const st = getStmt(sql);
              return p ? st.all(...p) : st.all();
            },
          };
          const result = await fn({
            ...stmts,
            q: stmts.get,
            qa: stmts.all,
            qr: stmts.run,
            qi: stmts.runId,
          });
          db.exec('COMMIT');
          return result;
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
      }),
    };
  }
if (usePg) {
    // Neon free tier caps logical size at 512 MB, and DDL (CREATE TABLE/INDEX)
    // extends data files, so prune high-churn rows BEFORE migrations. Deletes are
    // cheap and bounded (measured at ~1s on the live branch), so they stay on the
    // boot path.
    //
    // The expensive reclaim work (whole-database VACUUM, TRUNCATE, VACUUM FULL,
    // and the all-schema size scan) is deliberately NOT awaited here. On the live
    // branch it ran for ~10 minutes, which blew past Render's port-scan window
    // and failed the deploy before the process could bind a port. It also cannot
    // recover the orphaned relfiles that actually account for the bloat (see
    // logTopTables() and DEPLOYMENT_RUNBOOK.md 4c). It now runs in the background
    // via scheduleStorageMaintenance(), after the app is up and listening.
    await pruneHighChurn();
  }
  try {
    await migrate();
  } catch (err) {
    // A branch that is already over Neon's size cap rejects any DDL with 53100.
    // Crashing out here turns an operational storage problem into a total
    // outage and a Render restart loop, and every retry fails identically
    // because nothing about re-running prunes the orphaned files. Start
    // anyway: reads and non-DDL writes still work, the health endpoint stays
    // green, and the size warning above tells the operator what to do. Any
    // other migration failure is a real defect and still aborts the boot.
    if (isStorageCapError(err)) {
      logger.error(
        { err: err.message, sizeMb: Math.round(await dbSizeMb()) },
        'migrations blocked by the Neon storage cap (53100) - starting anyway so the app stays reachable. Rebuild the branch from a dump; see DEPLOYMENT_RUNBOOK.md 4c.'
      );
    } else {
      throw err;
    }
  }
  // Heavy maintenance runs in the background, never on the boot path - and only
  // after migrations have finished, so the 5s timer cannot race a pending DDL.
  scheduleStorageMaintenance();
  if (usePg) {
    // Keep high-churn tables from refilling toward the cap while the instance
    // stays awake (Render free tier can remain up for hours between requests).
    const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000;
    const timer = setInterval(() => { pruneHighChurn().catch(() => {}); }, PRUNE_INTERVAL_MS);
    if (typeof timer.unref === 'function') timer.unref();
  }
  return driver;
}

// Neon project storage cap: 512 MB. Once the branch exceeds it, Postgres
// refuses to extend files (53100). Deleting rows marks them dead but does not
// release pages; VACUUM FULL compacts high-churn tables so Neon's garbage
// collector can actually reclaim the space. Only run all of this when close to
// the cap — VACUUM FULL takes locks, so we avoid it on a healthy install.
const NEON_CAP_MB = 512;
const RECLAIM_THRESHOLD_MB = Math.floor(NEON_CAP_MB * 0.75); // 75% of the 512 MB cap

async function dbSizeMb() {
  if (!usePg) return 0;
  try {
    const row = await driver.get('SELECT pg_database_size(current_database()) AS bytes');
    return Number(row?.bytes || 0) / 1024 / 1024;
  } catch (err) {
    console.warn('[SIZE] could not read database size: ' + err.message);
    return 0;
  }
}

// Neon project storage cap: once the branch exceeds the size limit, Postgres
// refuses to extend files (53100). Deleting rows marks them dead but does not
// release pages; VACUUM FULL compacts the high-churn tables so Neon's garbage
// collector can actually reclaim the space. Runs at boot BEFORE migrations so
// DDL that extends files (CREATE TABLE/INDEX) has room. Table names are fixed
// constants.
async function pruneHighChurn() {
  if (!usePg) return;
  const pruneStatements = [
    "DELETE FROM data_access_logs WHERE created_at < now() - interval '30 days'",
    "DELETE FROM audit_logs       WHERE created_at < now() - interval '90 days'",
    "DELETE FROM notifications    WHERE created_at < now() - interval '45 days'",
    "DELETE FROM ai_chat_logs     WHERE created_at < now() - interval '45 days'",
    "DELETE FROM password_resets  WHERE created_at < now() - interval '14 days' OR used_at IS NOT NULL",
    "DELETE FROM refresh_tokens   WHERE revoked = TRUE OR expires_at < now()",
    "DELETE FROM device_tokens    WHERE updated_at < now() - interval '90 days'",
    "DELETE FROM doc_generations  WHERE created_at < now() - interval '45 days'",
  ];
  for (const stmt of pruneStatements) {
    try {
      await driver.exec(stmt);
    } catch (err) {
      console.warn('[PRUNE] skipped statement: ' + err.message);
    }
  }
}

async function emergencyPruneAtCap() {
  if (!usePg) return;
  console.warn('[EMERGENCY PRUNE] Database at/over cap — aggressive cleanup');
  const emergencyStatements = [
    "DELETE FROM data_access_logs WHERE created_at < now() - interval '7 days'",
    "DELETE FROM audit_logs WHERE created_at < now() - interval '30 days'",
    "DELETE FROM notifications WHERE created_at < now() - interval '14 days'",
    "DELETE FROM ai_chat_logs WHERE created_at < now() - interval '14 days'",
    "DELETE FROM report_submissions WHERE created_at < now() - interval '30 days'",
    "DELETE FROM schedule_entries WHERE created_at < now() - interval '60 days'",
    "DELETE FROM security_incidents WHERE created_at < now() - interval '90 days'",
    "DELETE FROM password_audit WHERE created_at < now() - interval '90 days'",
    "DELETE FROM enrollment_subjects WHERE enrollment_id IN (SELECT id FROM enrollments WHERE status = 'withdrawn' AND created_at < now() - interval '1 year')",
    "VACUUM (ANALYZE)",
  ];
  for (const stmt of emergencyStatements) {
    try {
      await driver.exec(stmt);
    } catch (err) {
      console.warn('[EMERGENCY PRUNE] skipped: ' + err.message);
    }
  }
}

async function logTopTables() {
  if (!usePg) return;
  try {
    const rows = await driver.all(
      "SELECT relname AS table, pg_total_relation_size(c.oid) AS bytes FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r','m') ORDER BY bytes DESC LIMIT 15"
    );
    let total = 0;
    for (const r of rows) {
      // pg driver returns BIGINT as a string; coerce before arithmetics.
      const mb = Number(r.bytes) / 1024 / 1024;
      total += mb;
      console.log('[SIZE]', r.table, mb.toFixed(1) + 'MB');
    }
    // Sum every relation in EVERY schema, not just public: a table left in a
    // non-public schema is invisible above but still counted by
    // pg_database_size(), which is exactly the shape of the 514MB-vs-1.5MB
    // case seen in production.
    const all = await driver.get(
      "SELECT COALESCE(sum(pg_total_relation_size(c.oid)), 0) AS bytes FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind IN ('r','m','i','t','S')"
    );
    const allMb = Number(all?.bytes || 0) / 1024 / 1024;
    // pg_database_size() counts every relfile in the directory, including
    // indexes, TOAST and files orphaned by dropped tables.
    const dbMb = await dbSizeMb();
    console.log('[SIZE] top-15 public tables: ' + total.toFixed(1) + 'MB of ' + Math.round(dbMb) + 'MB database size');
    console.log('[SIZE] all relations, all schemas: ' + allMb.toFixed(1) + 'MB');
    const unaccounted = dbMb - allMb;
    if (dbMb > 0 && unaccounted > 64) {
      logger.warn(
        { dbMb: Math.round(dbMb), accountedMb: Math.round(allMb), orphanedMb: Math.round(unaccounted) },
        'most of the database size is NOT in any live relation (orphaned relfiles from dropped tables) - TRUNCATE and VACUUM cannot recover it; rebuild the Neon branch from a pg_dump. See DEPLOYMENT_RUNBOOK.md 4c.'
      );
    }
  } catch (err) {
    console.warn('[SIZE] could not read table sizes: ' + err.message);
  }
}

async function reclaimSpace() {
  if (!usePg) return;
  // 1. Plain VACUUM ANALYZE on the whole database. On Neon this is the documented
  //    remedy for a bloated logical size: it lets the storage garbage-collect old
  //    MVCC page versions and detached relfiles WITHOUT taking table locks. Cheap
  //    even at the cap (bloat that has already been deleted is dropped, not grown).
  try {
    console.log('[VACUUM] whole-database VACUUM ANALYZE');
    await driver.exec('VACUUM (ANALYZE)');
  } catch (err) {
    console.warn('[VACUUM] plain VACUUM failed: ' + err.message);
  }
  const afterPlainMb = await dbSizeMb();
  console.log('[VACUUM] size after VACUUM ANALYZE: ' + Math.round(afterPlainMb) + 'MB');
  // 2. Still over/near the cap. VACUUM FULL rewrites each table into a fresh
  //    relfile before dropping the old one, so it needs free space equal to
  //    roughly the largest table. At a hard size cap there is none, so it
  //    fails with 53100 and reclaims nothing. TRUNCATE, by contrast, attaches
  //    a new empty relfile and unlinks the old one - it needs essentially no
  //    space and returns the pages immediately. Do that FIRST for the tables
  //    that only ever hold regenerable rows.
  if (afterPlainMb >= RECLAIM_THRESHOLD_MB) {
    await truncateRegenerableTables();
    const afterTruncateMb = await dbSizeMb();
    console.log('[VACUUM] size after TRUNCATE of regenerable tables: ' + Math.round(afterTruncateMb) + 'MB');
    if (afterTruncateMb >= RECLAIM_THRESHOLD_MB) {
      try {
        console.log('[VACUUM] whole-database VACUUM FULL (locks, needs free space)');
        await driver.exec('VACUUM (FULL, ANALYZE)');
      } catch (err) {
        // Expected when already over the cap: the rewrite cannot be staged.
        // Not fatal - boot continues and the size warning below explains it.
        console.warn('[VACUUM] VACUUM FULL failed (expected at/over the storage cap): ' + err.message);
      }
    }
  }
}

// Deferred, best-effort storage maintenance. Everything here is observation or
// reclamation that must NOT block boot: on the live branch it ran for ~10
// minutes (all-schema size scan ~5.5 min + VACUUM FULL ~2.5 min) and made
// Render time out before the port was bound. It also cannot reclaim the orphaned
// relfiles that dominate the size on a broken branch - the genuine fix there is
// rebuilding from a pg_dump (DEPLOYMENT_RUNBOOK.md 4c). Runs once on a timer,
// unref'd so it never keeps the process alive.
let storageMaintenanceScheduled = false;
function scheduleStorageMaintenance() {
  if (storageMaintenanceScheduled) return;
  storageMaintenanceScheduled = true;
  const timer = setTimeout(async () => {
    try {
      const sizeBefore = await dbSizeMb();
      await logTopTables();
      if (sizeBefore < RECLAIM_THRESHOLD_MB) {
        console.log('[MAINT] size ' + Math.round(sizeBefore) + 'MB — below reclaim threshold, nothing to do');
        return;
      }
      await reclaimSpace();
      const sizeAfter = await dbSizeMb();
      console.log(
        '[MAINT] size after reclaim: ' + Math.round(sizeAfter) + 'MB (freed ' + Math.round(Math.max(0, sizeBefore - sizeAfter)) + 'MB)'
      );
      if (sizeAfter >= RECLAIM_THRESHOLD_MB) {
        await emergencyPruneAtCap();
        const sizeAfterEmergency = await dbSizeMb();
        console.log(
          '[MAINT] size after emergency prune: ' + Math.round(sizeAfterEmergency) + 'MB'
        );
      }
    } catch (err) {
      console.warn('[MAINT] background storage maintenance failed (non-fatal): ' + err.message);
    }
  }, 5000);
  if (typeof timer.unref === 'function') timer.unref();
}

// Tables whose contents are fully regenerable: session/anti-abuse tokens,
// delivery logs, and the read-access trail that pruneHighChurn() already
// discards on a 30-day cycle. Truncating these costs nothing of record and is
// the only reclaim available once the branch is at its size cap.
//
// Deliberately NOT truncated: audit_logs, password_audit,
// security_incidents, students, grades and anything else under RA 10173.
const REGENERABLE_TABLES = [
  'csrf_tokens',
  'password_resets',
  'refresh_tokens',
  'device_tokens',
  'data_access_logs',
  'ai_chat_logs',
  'notifications',
  'job_locks',
  'rate_limits',
];

async function truncateRegenerableTables() {
  if (!usePg) return;
  for (const table of REGENERABLE_TABLES) {
    try {
      // to_regclass keeps this safe on installs where the table was never
      // created; TRUNCATE on a missing table would abort the whole boot.
      await driver.exec(`TRUNCATE TABLE ${table}`);
      console.log('[TRUNCATE] ' + table);
    } catch (err) {
      // Missing table, or it is referenced by a live foreign key.
      console.warn('[TRUNCATE] skipped ' + table + ': ' + err.message);
    }
  }
}

async function migrate() {
  const dir = path.join(__dirname, '..', '..', 'database', 'migrations');
  const files = fs.readdirSync(dir)
    .filter((f) => dialect !== 'pg' ? f.endsWith('.sqlite.sql') : (f.endsWith('.sql') && !f.endsWith('.sqlite.sql')))
    .filter((f) => /^\d+-/.test(f))
    .sort();
  if (usePg) {
    await driver.exec('CREATE TABLE IF NOT EXISTS schema_migrations (file TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const applied = await driver.all('SELECT file FROM schema_migrations');
    const appliedSet = new Set(applied.map((r) => r.file));
    for (const file of files) {
      if (appliedSet.has(file)) continue;
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      // 53100 = Neon branch at/over the project size limit. The statement rolls
      // back, then we free space and retry once — deletes+VACUUM are the only
      // writes Neon tolerates at the cap.
      for (let attempt = 1; attempt <= 2; attempt++) {
        const client = await poolRef.connect();
        try {
          await client.query('SET search_path = public');
          await client.query('BEGIN');
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (file, applied_at) VALUES ($1, now()) ON CONFLICT (file) DO NOTHING', [file]);
          await client.query('COMMIT');
          break;
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          if (err.code === '53100' && attempt === 1) {
            console.warn('[MIGRATE] ' + file + ' hit 53100 (size cap) — pruning + VACUUM, retrying once');
            try { await pruneHighChurn(); } catch (_) {}
            try { await reclaimSpace(); } catch (_) {}
          } else if (err.code === '53100' && attempt === 2 && /^\s*--|CREATE INDEX/i.test(sql.replace(/--.*$/gm, '').trim()) && !/CREATE TABLE|ALTER TABLE|CREATE TYPE|INSERT |UPDATE |DELETE /.test(sql)) {
            // Index-only migration at a hard storage cap: the tables exist (the
            // indexes are a performance nicety), so boot instead of crash-looping.
            // NOT recorded in schema_migrations — it will retry on a later boot
            // once space is freed.
            console.error('[MIGRATE] ' + file + ' SKIPPED (storage cap 53100) — indexes not created; will retry next boot once capacity is freed');
            break;
          } else {
            throw err;
          }
        } finally {
          client.release();
        }
      }
    }
  } else {
    driver.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (file TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`);
    const appliedRows = await driver.all('SELECT file FROM schema_migrations');
    const appliedSet = new Set(appliedRows.map((r) => r.file));
    for (const file of files) {
      if (appliedSet.has(file)) continue;
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      driver.exec('BEGIN IMMEDIATE');
      try { console.log('[MIGRATE]',file); driver.exec(sql);
        await driver.run('INSERT OR IGNORE INTO schema_migrations (file) VALUES (?)', [file]);
        driver.exec('COMMIT');
      } catch (err) {
        try { driver.exec('ROLLBACK'); } catch (_) {}
        throw err;
      }
    }
  }
}

function q(sql, params) {
  if (!driver) throw new Error('db not initialized');
  return driver.get(sql, params);
}

function qa(sql, params) {
  if (!driver) throw new Error('db not initialized');
  return driver.all(sql, params);
}

function qr(sql, params) {
  if (!driver) throw new Error('db not initialized');
  return driver.run(sql, params);
}

function qi(sql, params) {
  if (!driver) throw new Error('db not initialized');
  return driver.runId(sql, params);
}

function close() {
  return driver && driver.close();
}

function nowSql() {
  return dialect === 'pg' ? 'now()' : "datetime('now')";
}

// Drivers return booleans in different shapes: PG BOOLEAN columns come back as
// JS true/false, PG COUNT/BIGINT values come back as STRINGS ("0", "7"), and
// SQLite returns 0/1 numbers. A raw `!!v` would treat the string "0" as truthy
// — always coerce through Number() so "0" is falsy on every dialect.
function bool(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'boolean') return v;
  return Number(v) > 0;
}

// Writing a BOOLEAN is the mirror problem. normParams maps JS true/false to 1/0
// so SQLite binds them as integers, but PostgreSQL refuses an integer for a
// BOOLEAN column:
//   column "pinned" is of type boolean but expression is of type integer
// That made every achievement create/update fail on production. Booleans
// therefore cannot be bound as parameters at all - they have to be inlined as
// dialect literals, exactly like the `revoked = TRUE` literals elsewhere.
//
// The value is coerced through bool(), so it must only ever be called with a
// boolean-ish value, never with raw user input interpolated into SQL.
function boolLiteral(v) {
  const t = bool(v);
  if (dialect === 'pg') return t ? 'TRUE' : 'FALSE';
  return t ? '1' : '0';
}

// PG reports unique violations as SQLSTATE 23505; node:sqlite throws
// ERR_SQLITE_ERROR with a "UNIQUE constraint failed" message and no code. Call
// sites that do read-then-insert use this to fall back to an UPDATE instead of
// letting the whole transaction roll back.
function isUniqueViolation(err) {
  if (!err) return false;
  const code = err.code;
  if (code === '23505' || code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT_PRIMARYKEY') return true;
  if (typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT')) return true;
  return typeof err.message === 'string' && /UNIQUE constraint failed|duplicate key value/i.test(err.message);
}

// Execute a function with RLS session variables set (PostgreSQL only).
// For SQLite, just executes the function (no RLS support).
// Usage: await db.withUser(userId, role, async ({ q, qa, qr, qi, tx }) => { ... })
async function withUser(userId, role, fn) {
  if (!usePg) return fn(driver);
  const client = await poolRef.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL app.current_user_id = $1', [String(userId || 0)]);
    await client.query('SET LOCAL app.current_user_role = $1', [role || '']);
    const stmts = {
      run: (sql, p) => client.query(pgParams(sql), normParams(p) || []).then((r) => ({ changes: r.rowCount })),
      runId: async (sql, p) => (await client.query(pgParams(sql + ' RETURNING *'), normParams(p) || [])).rows[0]?.id,
      get: async (sql, p) => (await client.query(pgParams(sql), normParams(p) || [])).rows[0] || null,
      all: async (sql, p) => (await client.query(pgParams(sql), normParams(p) || [])).rows,
    };
    const result = await fn({
      ...stmts,
      q: stmts.get,
      qa: stmts.all,
      qr: stmts.run,
      qi: stmts.runId,
      tx: async (inner) => {
        // Nested transaction not supported with SET LOCAL; run inner in same tx
        return inner({
          ...stmts,
          q: stmts.get,
          qa: stmts.all,
          qr: stmts.run,
          qi: stmts.runId,
        });
      },
    });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { isStorageCapError, init, q, qa, qr, qi, close, nowSql, bool, boolLiteral, isUniqueViolation, usePg, withUser, get dialect() { return dialect; }, tx: (fn) => driver.tx(fn) };
