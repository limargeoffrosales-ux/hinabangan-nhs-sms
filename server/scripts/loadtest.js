#!/usr/bin/env node
// Dependency-free load test (Node 22+ global fetch). No npm install required.
//
// Usage:
//   node scripts/loadtest.js --base http://127.0.0.1:4100 --users 50 --duration 30
//   node scripts/loadtest.js --base http://127.0.0.1:4100 --users 200 --duration 60 --ramp 10
//
// Scenarios (per virtual user, repeated for --duration seconds):
//   1. login (superadmin)            -> token + csrf
//   2. GET  /api/v1/dashboard/summary
//   3. GET  /api/v1/students?page=1&limit=20
//   4. GET  /api/v1/grades?page=1&limit=20
//   5. GET  /api/v1/analytics/kpi/summary
//   6. POST /api/v1/attendance        (a grade/record-entry style write)
//
// Reports: requests/sec, p50/p95/p99 latency, error rate, max concurrent users.

const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
}
const BASE = arg('base', 'http://127.0.0.1:4100').replace(/\/$/, '');
const VUS = Number(arg('users', 50));
const DURATION_S = Number(arg('duration', 30));
const RAMP_S = Number(arg('ramp', 0));
const USERNAME = arg('username', 'superadmin');
const PASSWORD = arg('password', process.env.LOADTEST_PASSWORD || '');

if (!PASSWORD) {
  console.error('Set LOADTEST_PASSWORD env var (do not pass secrets on the CLI).');
  process.exit(1);
}

const stats = {
  requests: 0,
  errors: 0,
  latencies: [],
  statusCounts: {},
  startedAt: Date.now(),
};
let stop = false;

function record(ms, status, ok) {
  stats.requests++;
  stats.latencies.push(ms);
  stats.statusCounts[status] = (stats.statusCounts[status] || 0) + 1;
  if (!ok) stats.errors++;
}

async function timedFetch(path, opts = {}) {
  const start = Date.now();
  try {
    const res = await fetch(BASE + path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      signal: AbortSignal.timeout(15000),
    });
    const ms = Date.now() - start;
    record(ms, res.status, res.ok);
    return res;
  } catch (err) {
    const ms = Date.now() - start;
    record(ms, 'ERR', false);
    return null;
  }
}

async function login() {
  const res = await timedFetch('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!res || !res.ok) return null;
  try {
    const j = await res.json();
    return { token: j.token, csrf: j.csrfToken };
  } catch {
    return null;
  }
}

// One iteration of the scenario mix for a single authenticated user.
async function userIteration(creds) {
  const auth = { Authorization: 'Bearer ' + creds.token, 'X-CSRF-Token': creds.csrf };
  await timedFetch('/api/v1/dashboard/summary', { headers: auth });
  await timedFetch('/api/v1/students?page=1&limit=20', { headers: auth });
  await timedFetch('/api/v1/analytics/kpi/grade-distribution', { headers: auth });
  await timedFetch('/api/v1/attendance?page=1&limit=20', { headers: auth });
  // A representative write (attendance record entry).
  await timedFetch('/api/v1/attendance/bulk', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ records: [{ student_id: 1, date: new Date().toISOString().slice(0, 10), status: 'present' }] }),
  });
}

// Token pool: log in once per VU up front (sequentially, to respect the login
// rate limiter) and reuse the token for the whole run. This measures API
// throughput rather than the login limiter. Login limiter is reported separately.
const tokenPool = [];
async function buildTokenPool() {
  console.log(`Building token pool (${VUS} logins, sequential to respect login limiter)...`);
  for (let i = 0; i < VUS; i++) {
    const creds = await login();
    if (creds) tokenPool.push(creds);
    if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${VUS} tokens`);
  }
  console.log(`Token pool ready: ${tokenPool.length}/${VUS} logins succeeded`);
}

async function vu(id) {
  const creds = tokenPool[id % tokenPool.length];
  if (!creds) return;
  while (!stop) {
    try {
      await userIteration(creds);
    } catch {
      // keep going; errors are recorded inside timedFetch
    }
  }
}

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function report() {
  const elapsed = (Date.now() - stats.startedAt) / 1000;
  const sorted = [...stats.latencies].sort((a, b) => a - b);
  const rps = stats.requests / elapsed;
  const errRate = stats.requests ? (stats.errors / stats.requests) * 100 : 0;
  console.log('\n================ LOAD TEST RESULTS ================');
  console.log(`Base URL:        ${BASE}`);
  console.log(`Virtual users:   ${VUS}`);
  console.log(`Duration:        ${elapsed.toFixed(1)}s`);
  console.log(`Total requests:  ${stats.requests}`);
  console.log(`Throughput:      ${rps.toFixed(1)} req/s`);
  console.log(`Error rate:      ${errRate.toFixed(2)}% (${stats.errors}/${stats.requests})`);
  console.log(`Latency p50:     ${pct(sorted, 50).toFixed(0)} ms`);
  console.log(`Latency p95:     ${pct(sorted, 95).toFixed(0)} ms`);
  console.log(`Latency p99:     ${pct(sorted, 99).toFixed(0)} ms`);
  console.log(`Latency max:     ${sorted.length ? sorted[sorted.length - 1] : 0} ms`);
  console.log('Status codes:    ' + JSON.stringify(stats.statusCounts));
  console.log('==================================================\n');
}

async function main() {
  console.log(`Starting load test: ${VUS} VUs, ${DURATION_S}s, ramp ${RAMP_S}s -> ${BASE}`);
  await buildTokenPool();
  const vus = [];
  if (RAMP_S > 0) {
    const delayPerVu = (RAMP_S * 1000) / VUS;
    for (let i = 0; i < VUS; i++) {
      vus.push(vu(i));
      await new Promise((r) => setTimeout(r, delayPerVu));
    }
  } else {
    for (let i = 0; i < VUS; i++) vus.push(vu(i));
  }

  const reporter = setInterval(report, 5000);
  await new Promise((r) => setTimeout(r, DURATION_S * 1000));
  stop = true;
  clearInterval(reporter);
  await Promise.allSettled(vus);
  report();
}

main().catch((err) => {
  console.error('Load test failed:', err);
  process.exit(1);
});
