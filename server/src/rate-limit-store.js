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

/** Initialize the rate_limits table (run once on startup) */
async function initRateLimitTable() {
  if (usePg) {
    await qr(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        key TEXT NOT NULL,
        window_start TIMESTAMPTZ NOT NULL,
        count INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (key, window_start)
      );
      CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_expires ON ${TABLE_NAME} (window_start);
    `);
  } else {
    await qr(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        key TEXT NOT NULL,
        window_start TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (key, window_start)
      );
      CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_expires ON ${TABLE_NAME} (window_start);
    `);
  }
}

/** Start periodic cleanup of expired entries */
function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(async () => {
    try {
      if (usePg) {
        await qr(`DELETE FROM ${TABLE_NAME} WHERE window_start < now() - INTERVAL '1 hour'`);
      } else {
        await qr(`DELETE FROM ${TABLE_NAME} WHERE window_start < datetime('now', '-1 hour')`);
      }
    } catch (e) {
      console.error('[RATE-LIMIT] cleanup failed:', e.message);
    }
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref?.(); // Don't prevent process exit
}

/** Stop cleanup timer (for tests) */
function stopCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Increment counter for a key within its time window
 * Returns { totalHits, resetTimeMs, windowStart }
 */
async function increment(key, windowMs = WINDOW_MS) {
  const windowSec = Math.ceil(windowMs / 1000);
  const _now = usePg ? 'now()' : "datetime('now')";
  const windowStart = usePg
    ? `date_trunc('minute', ${_now})` // Align to minute boundaries
    : `datetime('now', 'start of minute')`;

  if (usePg) {
    // PostgreSQL: UPSERT with ON CONFLICT
    const result = await q(
      `INSERT INTO ${TABLE_NAME} (key, count, window_start)
       VALUES ($1, 1, ${windowStart})
       ON CONFLICT (key, window_start) DO UPDATE
       SET count = ${TABLE_NAME}.count + 1
       RETURNING count, ${windowStart} AS window_start`,
      [key]
    );
    return {
      totalHits: Number(result.count),
      resetTimeMs: Date.now() + windowMs,
      windowStart: result.window_start,
    };
  } else {
    // SQLite: UPSERT with ON CONFLICT
    const result = await q(
      `INSERT INTO ${TABLE_NAME} (key, count, window_start)
       VALUES (?, 1, ${windowStart})
       ON CONFLICT (key, window_start) DO UPDATE
       SET count = ${TABLE_NAME}.count + 1
       RETURNING count, ${windowStart} AS window_start`,
      [key]
    );
    return {
      totalHits: Number(result.count),
      resetTimeMs: Date.now() + windowMs,
      windowStart: result.window_start,
    };
  }
}

/** Decrement counter (used when request completes successfully) */
async function decrement(key) {
  if (usePg) {
    await qr(`UPDATE ${TABLE_NAME} SET count = GREATEST(count - 1, 0) WHERE key = $1 AND window_start = date_trunc('minute', now())`, [key]);
  } else {
    await qr(`UPDATE ${TABLE_NAME} SET count = MAX(count - 1, 0) WHERE key = ? AND window_start = datetime('now', 'start of minute')`, [key]);
  }
}

/** Reset counter for a key (used on successful login, etc.) */
async function resetKey(key) {
  if (usePg) {
    await qr(`DELETE FROM ${TABLE_NAME} WHERE key = $1`, [key]);
  } else {
    await qr(`DELETE FROM ${TABLE_NAME} WHERE key = ?`, [key]);
  }
}

/** Get current count for a key without incrementing */
async function get(key) {
  if (usePg) {
    const row = await q(
      `SELECT count, window_start FROM ${TABLE_NAME} WHERE key = $1 AND window_start = date_trunc('minute', now())`,
      [key]
    );
    return row ? { totalHits: Number(row.count), windowStart: row.window_start } : null;
  } else {
    const row = await q(
      `SELECT count, window_start FROM ${TABLE_NAME} WHERE key = ? AND window_start = datetime('now', 'start of minute')`,
      [key]
    );
    return row ? { totalHits: Number(row.count), windowStart: row.window_start } : null;
  }
}

/**
 * Express-rate-limit compatible Store class
 * Implements: increment(key), decrement(key), resetKey(key)
 */
class DatabaseRateLimitStore {
  constructor(options = {}) {
    this.windowMs = options.windowMs || WINDOW_MS;
    this.prefix = options.prefix || 'rl:';
  }

  /** Called by express-rate-limit on init */
  async init() {
    await initRateLimitTable();
    startCleanup();
  }

  /** Increment counter for key */
  async increment(key) {
    const prefixedKey = this.prefix + key;
    const result = await increment(prefixedKey, this.windowMs);
    return {
      totalHits: result.totalHits,
      resetTime: new Date(result.resetTimeMs),
    };
  }

  /** Decrement counter */
  async decrement(key) {
    const prefixedKey = this.prefix + key;
    await decrement(prefixedKey);
  }

  /** Reset/remove key */
  async resetKey(key) {
    const prefixedKey = this.prefix + key;
    await resetKey(prefixedKey);
  }

  /** Shutdown cleanup */
  shutdown() {
    stopCleanup();
  }
}

/** Factory function for express-rate-limit */
function createDbStore(windowMs, prefix = 'rl:') {
  return new DatabaseRateLimitStore({ windowMs, prefix });
}

module.exports = {
  DatabaseRateLimitStore,
  createDbStore,
  initRateLimitTable,
  startCleanup,
  stopCleanup,
  increment,
  decrement,
  resetKey,
  get,
};