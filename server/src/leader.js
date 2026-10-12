// Leader election for in-process scheduled jobs.
//
// Every app instance starts the same setInterval timers (backup, storage
// cleanup, notify sweep). Without coordination that means N instances produce
// N backups and N cleanups. This module uses the `job_locks` table so exactly
// one instance — the leader — runs each job:
//
//   - acquire() does a single atomic INSERT ... ON CONFLICT that only succeeds
//     when the slot is free or the previous leader's lock has expired. The
//     RETURNING clause tells us whether WE won, so there is no separate
//     read-then-write race.
//   - heartbeat() extends expires_at while the leader is alive. If a leader
//     crashes, its lock expires after ttlMs and another instance acquires it.
//   - release() frees the lock on graceful shutdown.
//
// All functions are no-ops on SQLite and PostgreSQL alike (the SQL is written
// dialect-agnostically via nowSql()).

const crypto = require('crypto');
const { qr, nowSql } = require('./db');
const logger = require('./logger');

const instanceId = crypto.randomUUID();
const TTL_MS = Number(process.env.JOB_LEADER_TTL_MS || 60 * 1000);
const HEARTBEAT_MS = Number(process.env.JOB_HEARTBEAT_MS || 20 * 1000);

// nowSql() returns now() / datetime('now'). For an interval we need the right
// dialect's relative-time literal.
function expiryExpr() {
  const { dialect } = require('./db');
  return dialect === 'pg'
    ? `now() + (${TTL_MS} || ' milliseconds')::interval`
    : `datetime('now', '+' || ${TTL_MS} || ' seconds')`;
}

// Try to become the leader for `jobName`. Returns true if this instance now
// owns the lock, false if another live instance holds it.
async function acquire(jobName) {
  try {
    const row = await qr(
      `INSERT INTO job_locks (job_name, instance_id, acquired_at, heartbeat_at, expires_at)
       VALUES (?, ?, ${nowSql()}, ${nowSql()}, ${expiryExpr()})
       ON CONFLICT (job_name) DO UPDATE
         SET instance_id = excluded.instance_id,
             acquired_at = ${nowSql()},
             heartbeat_at = ${nowSql()},
             expires_at = ${expiryExpr()}
       WHERE job_locks.expires_at < ${nowSql()}
       RETURNING instance_id`,
      [jobName, instanceId]
    );
    // qr returns { changes } from the driver; we need the returned row, so use
    // a dedicated path. Fall back to a follow-up read if the driver swallows
    // RETURNING (node:sqlite run() returns lastInsertRowid, not rows).
    const won = await confirmOwner(jobName);
    return won === instanceId;
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack, job: jobName }, 'LEADER acquire failed');
    return false;
  }
}

// Read back who owns the lock (portable across both drivers).
async function confirmOwner(jobName) {
  const { q } = require('./db');
  const row = await q('SELECT instance_id FROM job_locks WHERE job_name = ?', [jobName]);
  return row ? row.instance_id : null;
}

// Extend the lock. Returns true if we are still the leader.
async function heartbeat(jobName) {
  try {
    const result = await qr(
      `UPDATE job_locks SET heartbeat_at = ${nowSql()}, expires_at = ${expiryExpr()}
       WHERE job_name = ? AND instance_id = ?`,
      [jobName, instanceId]
    );
    return Number(result.changes || 0) > 0;
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack, job: jobName }, 'LEADER heartbeat failed');
    return false;
  }
}

// Free the lock (best-effort, on shutdown).
async function release(jobName) {
  try {
    await qr('DELETE FROM job_locks WHERE job_name = ? AND instance_id = ?', [jobName, instanceId]);
  } catch {
    /* best-effort */
  }
}

// Convenience wrapper: acquire, then run `run()` immediately and on
// `intervalMs`, heartbeating so the lock stays ours. Returns a stop() fn that
// releases the lock and clears timers. If we lose the lock mid-run (another
// instance's acquire expired ours — shouldn't happen while we heartbeat, but
// a DB blip could), we stop running the job.
function start(jobName, { run, intervalMs, onError }) {
  let stopped = false;
  let timers = [];

  (async () => {
    const isLeader = await acquire(jobName);
    if (stopped) return;
    if (!isLeader) {
      logger.info({ job: jobName, instance: instanceId }, 'LEADER: not leader — job runs on another instance');
      return;
    }
    logger.info({ job: jobName, instance: instanceId, intervalMs, ttlMs: TTL_MS }, 'LEADER: acquired job');

    const beat = async () => {
      const still = await heartbeat(jobName);
      if (!still && !stopped) {
        logger.warn({ job: jobName }, 'LEADER: lost leadership — stopping job on this instance');
        stop();
      }
    };

    const tick = async () => {
      try {
        await run();
      } catch (err) {
        if (onError) onError(err);
      }
    };

    timers.push(setInterval(beat, HEARTBEAT_MS));
    if (typeof intervalMs === 'number' && intervalMs > 0) {
      timers.push(setInterval(tick, intervalMs));
    }
    // Run once now.
    tick().catch(() => {});
  })();

  function stop() {
    if (stopped) return;
    stopped = true;
    timers.forEach((t) => clearInterval(t));
    release(jobName).catch(() => {});
  }

  return stop;
}

module.exports = { acquire, heartbeat, release, start, instanceId, TTL_MS, HEARTBEAT_MS };
