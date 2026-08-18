const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./config');

const usePg = !!process.env.DATABASE_URL;
let driver = null;
let dialect = 'sqlite';

async function init() {
  if (usePg) {
    dialect = 'pg';
    const { Pool } = require('pg');
    const connUrl = new URL(process.env.DATABASE_URL);
    const sslMode = connUrl.searchParams.get('sslmode');
    const useSsl = sslMode === 'disable' ? false : { rejectUnauthorized: false };
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: useSsl });
    const params = (sql) => { params.i = 0; return sql.replace(/\?/g, () => '$' + (++params.i)); };
    driver = {
      params,
      run: (sql, p) => pool.query(params(sql), p || []).then((r) => ({ changes: r.rowCount })),
      runId: async (sql, p) => (await pool.query(params(sql + ' RETURNING *'), p || [])).rows[0]?.id,
      get: async (sql, p) => (await pool.query(params(sql), p || [])).rows[0] || null,
      all: async (sql, p) => (await pool.query(params(sql), p || [])).rows,
      exec: (sql) => pool.query(sql),
      close: () => pool.end(),
    };
  } else {
    const { DatabaseSync } = require('node:sqlite');
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const db = new DatabaseSync(path.join(DATA_DIR, 'meridianed.db'));
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    driver = {
      params: (sql) => sql,
      run: (sql, p) => {
        const st = db.prepare(sql);
        const r = p ? st.run(...p) : st.run();
        return { changes: Number(r.changes || 0) };
      },
      runId: (sql, p) => {
        const st = db.prepare(sql);
        const r = p ? st.run(...p) : st.run();
        return Number(r.lastInsertRowid);
      },
      get: (sql, p) => {
        const st = db.prepare(sql);
        return (p ? st.get(...p) : st.get()) || null;
      },
      all: (sql, p) => {
        const st = db.prepare(sql);
        return p ? st.all(...p) : st.all();
      },
      exec: (sql) => db.exec(sql),
      close: () => db.close(),
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
      await driver.exec(sql);
      await driver.run('INSERT INTO schema_migrations (file, applied_at) VALUES (?, now()) ON CONFLICT (file) DO NOTHING', [file]);
    }
  } else {
    const { DatabaseSync } = require('node:sqlite');
    const mdb = new DatabaseSync(path.join(DATA_DIR, 'meridianed.db'));
    mdb.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (file TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`);
    const appliedRows = mdb.prepare('SELECT file FROM schema_migrations').all();
    const appliedSet = new Set(appliedRows.map((r) => r.file));
    for (const file of files) {
      if (appliedSet.has(file)) continue;
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      driver.exec(sql);
      mdb.prepare('INSERT OR IGNORE INTO schema_migrations (file) VALUES (?)').run(file);
    }
    mdb.close();
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

module.exports = { init, q, qa, qr, qi, close, nowSql, bool, usePg, get dialect() { return dialect; } };
