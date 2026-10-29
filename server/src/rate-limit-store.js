/**
 * Database-backed rate limit store for express-rate-limit
 * Uses PostgreSQL (production) or SQLite (development) - FREE, no Redis needed
 * Compatible with express-rate-limit's Store interface
 */

const { q, qr, usePg } = require('./db');

const TABLE_NAME = 'rate_limits';
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes default
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let cleanupTimer = null;
let tableInitialized = false;

async function ensureTable() {
  if (tableInitialized) return;
  try {
    if (usePg) {
      await qr(`
        CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          key          TEXT NOT NULL,
          window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
          count        INTEGER NOT NULL DEFAULT 1,
          PRIMARY KEY (key, window_start)
        );
        CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_window ON ${TABLE_NAME} (window_start);
        CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_key ON ${TABLE_NAME} (key);
      `);
    } else {
      await qr(`
        CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          key          TEXT NOT NULL,
          window_start TEXT NOT NULL,
          count        INTEGER NOT NULL DEFAULT 1,
          PRIMARY KEY (key, window_start)
        );
        CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_window ON ${TABLE_NAME} (window_start);
        CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_key ON ${TABLE_NAME} (key);
      `);
    }
    tableInitialized = true;
  } catch (e) {
    // Retry on next access if DB not initialized yet
  }
}

/** Calculate window start aligned to minute boundary */
function calcWindowStart(windowMs) {
  const now = Date.now();
  return new Date(Math.floor(now / windowMs) * windowMs);
}

/** Start periodic cleanup of expired entries */
function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(async () => {
    try {
      await ensureTable();
      if (usePg) {
        await qr(`DELETE FROM ${TABLE_NAME} WHERE window_start < now() - INTERVAL '1 hour'`);
      } else {
        await qr(`DELETE FROM ${TABLE_NAME} WHERE window_start < datetime('now', '-1 hour')`);
      }
    } catch (e) {
      console.error('[RATE-LIMIT] cleanup failed:', e.message);
    }
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref?.();
}

function stopCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

async function increment(key, windowMs = WINDOW_MS) {
  await ensureTable();
  const ws = calcWindowStart(windowMs);
  const wsIso = ws.toISOString();

  if (usePg) {
    const result = await q(
      `INSERT INTO ${TABLE_NAME} (key, count, window_start)
       VALUES ($1, 1, $2)
       ON CONFLICT (key, window_start) DO UPDATE
       SET count = ${TABLE_NAME}.count + 1
       RETURNING count, $2 AS window_start`,
      [key, wsIso]
    );
    return {
      totalHits: Number(result.count),
      resetTimeMs: Date.now() + windowMs,
      windowStart: result.window_start,
    };
  } else {
    await qr(
      `INSERT INTO ${TABLE_NAME} (key, count, window_start)
       VALUES (?, 1, ?)
       ON CONFLICT (key, window_start) DO UPDATE
       SET count = ${TABLE_NAME}.count + 1`,
      [key, wsIso]
    );
    const row = await q(
      `SELECT count, ? AS window_start FROM ${TABLE_NAME} WHERE key = ?`,
      [wsIso, key]
    );
    return {
      totalHits: Number(row?.count || 0),
      resetTimeMs: Date.now() + windowMs,
      windowStart: row?.window_start,
    };
  }
}

async function decrement(key, windowMs = WINDOW_MS) {
  await ensureTable();
  const ws = calcWindowStart(windowMs);
  const wsIso = ws.toISOString();
  if (usePg) {
    await qr(`UPDATE ${TABLE_NAME} SET count = GREATEST(count - 1, 0) WHERE key = $1 AND window_start = $2`, [key, wsIso]);
  } else {
    await qr(`UPDATE ${TABLE_NAME} SET count = MAX(count - 1, 0) WHERE key = ? AND window_start = ?`, [key, wsIso]);
  }
}

async function resetKey(key) {
  await ensureTable();
  if (usePg) {
    await qr(`DELETE FROM ${TABLE_NAME} WHERE key = $1`, [key]);
  } else {
    await qr(`DELETE FROM ${TABLE_NAME} WHERE key = ?`, [key]);
  }
}

async function get(key, windowMs = WINDOW_MS) {
  await ensureTable();
  const ws = calcWindowStart(windowMs);
  const wsIso = ws.toISOString();
  if (usePg) {
    const row = await q(
      `SELECT count, window_start FROM ${TABLE_NAME} WHERE key = $1 AND window_start = $2`,
      [key, wsIso]
    );
    return row ? { totalHits: Number(row.count), windowStart: row.window_start } : null;
  } else {
    const row = await q(
      `SELECT count, window_start FROM ${TABLE_NAME} WHERE key = ? AND window_start = ?`,
      [key, wsIso]
    );
    return row ? { totalHits: Number(row.count), windowStart: row.window_start } : null;
  }
}

class DatabaseRateLimitStore {
  constructor(options = {}) {
    this.windowMs = options.windowMs || WINDOW_MS;
    this.prefix = options.prefix || 'rl:';
  }

  async init() {
    await ensureTable();
    startCleanup();
  }

  async increment(key) {
    const prefixedKey = this.prefix + key;
    const result = await increment(prefixedKey, this.windowMs);
    return {
      totalHits: result.totalHits,
      resetTime: new Date(result.resetTimeMs),
    };
  }

  async decrement(key) {
    const prefixedKey = this.prefix + key;
    await decrement(prefixedKey, this.windowMs);
  }

  async resetKey(key) {
    const prefixedKey = this.prefix + key;
    await resetKey(prefixedKey);
  }

  shutdown() {
    stopCleanup();
  }
}

function createDbStore(windowMs, prefix = 'rl:') {
  return new DatabaseRateLimitStore({ windowMs, prefix });
}

module.exports = {
  DatabaseRateLimitStore,
  createDbStore,
  initRateLimitTable: ensureTable,
  startCleanup,
  stopCleanup,
  increment,
  decrement,
  resetKey,
  get,
};
