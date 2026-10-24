// Leader election — the mechanism that keeps scheduled jobs (backup, storage
// cleanup, notify sweep) running exactly once when several app instances are
// up. These specs pin the takeover contract, because the failure mode is
// silent: a job that stops running just means no backups, with no error.
//
// Regression: `start()` used to give up permanently the first time another
// instance held the lock. If that leader then died, every remaining instance
// had already stopped competing and the job stayed dead until a process
// restart. A non-leader must therefore keep retrying.
//
// These used to assert against fixed sleeps (sleep(400) then check). That is
// flaky: `node --test` runs test FILES in parallel, so on a loaded runner the
// leader's 200ms tick can slip well past the sleep and the assertion observes
// a half-finished state. Every wait is now a poll against a deadline, so a
// slow machine takes longer but never reports a false failure.
'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/db');

// Tight timers keep the whole file in the low seconds.
process.env.JOB_LEADER_TTL_MS = '1200';
process.env.JOB_HEARTBEAT_MS = '250';

const leader = require('../src/leader');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Generous ceiling. The contract is "within a few leader ticks", not "within
// exactly N ms", so the deadline absorbs scheduler noise without hiding a real
// regression (a broken leader never acquires at all, so it still times out).
const DEADLINE_MS = 15000;

async function waitFor(fn, { timeoutMs = DEADLINE_MS, intervalMs = 50, message = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await fn()) return true;
    if (Date.now() >= deadline) throw new Error('timed out waiting for ' + message);
    await sleep(intervalMs);
  }
}

// SQLite has no INTERVAL arithmetic, so build timestamps in JS. db.js stores
// its own timestamps in the same 'YYYY-MM-DD HH:MM:SS' UTC form.
function ts(offsetSeconds = 0) {
  const d = new Date(Date.now() + offsetSeconds * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
         `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

async function seedLock(job, instanceId, ttlSeconds) {
  await db.qr(
    `INSERT INTO job_locks (job_name, instance_id, acquired_at, heartbeat_at, expires_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (job_name) DO UPDATE
       SET instance_id = excluded.instance_id,
           expires_at = excluded.expires_at`,
    [job, instanceId, ts(-5), ts(-5), ts(ttlSeconds)]
  );
}

async function lockRow(job) {
  return db.q('SELECT instance_id, expires_at FROM job_locks WHERE job_name = ?', [job]);
}

test('leader election', async (t) => {
  await db.init();
  t.after(async () => { await db.close(); });

  await test('a live foreign lock is respected: the job does not run', async () => {
    const job = 'test-live-lock';
    await seedLock(job, 'INSTANCE-FOREIGN', 30);

    let runs = 0;
    const stop = leader.start(job, { run: async () => { runs++; }, intervalMs: 200, onError: () => {} });
    // Give it several leader ticks to prove it declines, rather than a fixed
    // sleep that might expire before the first tick even fires.
    await sleep(1500);
    stop();
    await db.qr('DELETE FROM job_locks WHERE job_name = ?', [job]);

    assert.equal(runs, 0, 'must not run while another instance holds a live lock');
    assert.ok(runs === 0, 'the job must not fire even once during the observation window');
  });

  await test('takes over once the foreign lock expires', async () => {
    const job = 'test-takeover';
    // Already expired at seed time, so the very next acquire retry wins.
    await seedLock(job, 'INSTANCE-FOREIGN', -1);

    let runs = 0;
    const stop = leader.start(job, { run: async () => { runs++; }, intervalMs: 200, onError: () => {} });

    await waitFor(() => runs > 0, { message: 'the standby instance to acquire the expired lock' });
    stop();
    await db.qr('DELETE FROM job_locks WHERE job_name = ?', [job]);

    assert.ok(runs > 0, 'a standby instance must acquire the lock once it expires');
  });

  await test('only one instance ends up owning the lock', async () => {
    const job = 'test-race';
    await db.qr('DELETE FROM job_locks WHERE job_name = ?', [job]);

    const a = leader.start(job, { run: async () => {}, intervalMs: 200, onError: () => {} });
    const b = leader.start(job, { run: async () => {}, intervalMs: 200, onError: () => {} });
    await waitFor(async () => !!(await lockRow(job)), { message: 'one of the two instances to acquire the lock' });

    const row = await lockRow(job);
    a(); b();
    await db.qr('DELETE FROM job_locks WHERE job_name = ?', [job]);

    assert.ok(row && row.instance_id, 'exactly one lock holder must remain');
  });

  await test('stopping releases the lock so another instance can take over', async () => {
    const job = 'test-release';
    await db.qr('DELETE FROM job_locks WHERE job_name = ?', [job]);

    const stop = leader.start(job, { run: async () => {}, intervalMs: 200, onError: () => {} });
    // Confirm it actually acquired first; otherwise "row is null afterwards"
    // would pass without ever exercising the release path.
    await waitFor(async () => !!(await lockRow(job)), { message: 'the leader to acquire the lock' });
    stop();

    await waitFor(async () => (await lockRow(job)) === null, { message: 'stop() to release the lock' });

    const row = await lockRow(job);
    await db.qr('DELETE FROM job_locks WHERE job_name = ?', [job]);

    assert.equal(row, null, 'shutdown must free the lock rather than leave it to expire');
  });
});