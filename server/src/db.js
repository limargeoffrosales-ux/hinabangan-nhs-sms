const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./config');
const logger = require('./logger');

const usePg = !!process.env.DATABASE_URL;
let driver = null;
let dialect = 'sqlite';

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
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: useSsl, max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 });
    pool.on('error', (err) => {
      logger.error({ err }, 'PostgreSQL pool idle client error');
    });
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
  await migrate();
  return driver;
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
      await driver.exec('BEGIN');
      try {
        await driver.exec(sql);
        await driver.run('INSERT INTO schema_migrations (file, applied_at) VALUES (?, now()) ON CONFLICT (file) DO NOTHING', [file]);
        await driver.exec('COMMIT');
      } catch (err) {
        await driver.exec('ROLLBACK');
        throw err;
      }
    }
  } else {
    const { DatabaseSync } = require('node:sqlite');
    const mdb = new DatabaseSync(path.join(DATA_DIR, 'meridianed.db'));
    mdb.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (file TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`);
    const appliedRows = mdb.prepare('SELECT file FROM schema_migrations').all();
    const appliedSet = new Set(appliedRows.map((r) => r.file));
    try {
      for (const file of files) {
        if (appliedSet.has(file)) continue;
        const sql = fs.readFileSync(path.join(dir, file), 'utf8');
        driver.exec(sql);
        mdb.prepare('INSERT OR IGNORE INTO schema_migrations (file) VALUES (?)').run(file);
      }
    } finally {
      mdb.close();
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

function bool(v) {
  return usePg ? !!v : (v ? 1 : 0);
}

module.exports = { init, q, qa, qr, qi, close, nowSql, bool, usePg, get dialect() { return dialect; }, tx: (fn) => driver.tx(fn) };
