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

async function init() {
  if (usePg) {
    dialect = 'pg';
    const { Pool } = require('pg');
    const connUrl = new URL(process.env.DATABASE_URL);
    const sslMode = connUrl.searchParams.get('sslmode');
    const useSsl = sslMode === 'disable' ? false : { rejectUnauthorized: false };
    // Pin search_path on every new backend connection and keep the pool small:
    // backups historically leaked a SET search_path into Neon's pooler which
    // then behaved as if search_path pointed at a schema that had been dropped.
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: useSsl, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000, options: '-c search_path=public' });
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
    // Neon free tier caps logical size at 512 MB. Prune must run BEFORE
    // migrations: a DDL migration (CREATE TABLE/INDEX) extends data files,
    // which fails with 53100 if the branch is still over the cap. Deletes never
    // extend the file, so they run on every boot; VACUUM FULL (which locks
    // tables and needs temp space) only runs when near the cap. The size before
    // and after, plus the biggest tables, are logged so Render logs show where
    // the space actually went when diagnosing a cap.
    const sizeBefore = await dbSizeMb();
    await logTopTables();
    await pruneHighChurn();
    if (sizeBefore >= RECLAIM_THRESHOLD_MB) {
      logger.info({ sizeMb: Math.round(sizeBefore) }, 'db near storage cap — pruning + VACUUM FULL before migrations');
      await reclaimSpace();
    }
    const sizeAfter = await dbSizeMb();
    if (sizeAfter > 0) {
      logger.info(
        { beforeMb: Math.round(sizeBefore), afterMb: Math.round(sizeAfter), freedMb: Math.round(Math.max(0, sizeBefore - sizeAfter)) },
        'db size after boot prune'
      );
    }
    if (sizeAfter >= RECLAIM_THRESHOLD_MB) {
      logger.warn(
        { sizeMb: Math.round(sizeAfter) },
        'db still at/over storage cap after prune — writes may fail (53100) until Neon reclaims physical space'
      );
    }
  }
  await migrate();
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

async function logTopTables() {
  if (!usePg) return;
  try {
    const rows = await driver.all(
      "SELECT relname AS table, pg_total_relation_size(c.oid) AS bytes FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r','m') ORDER BY bytes DESC LIMIT 15"
    );
    for (const r of rows) {
      console.log('[SIZE]', r.table, Math.round(r.bytes / 1024 / 1024) + 'MB');
    }
  } catch (err) {
    console.warn('[SIZE] could not read table sizes: ' + err.message);
  }
}

async function reclaimSpace() {
  if (!usePg) return;
  const tables = ['data_access_logs', 'audit_logs', 'notifications', 'ai_chat_logs', 'password_resets', 'refresh_tokens', 'device_tokens', 'doc_generations'];
  for (const table of tables) {
    try {
      await driver.exec('VACUUM FULL ' + table);
    } catch (err) {
      console.warn('[VACUUM] skipped ' + table + ': ' + err.message);
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
  }
  if (usePg) {
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

module.exports = { init, q, qa, qr, qi, close, nowSql, bool, usePg, get dialect() { return dialect; }, tx: (fn) => driver.tx(fn) };
