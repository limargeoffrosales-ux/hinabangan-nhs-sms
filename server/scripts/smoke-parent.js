/* Throwaway smoke test for the parent portal API. Creates two temporary
 * parent accounts, runs HTTP assertions against a live server, then deletes
 * the accounts. Safe to run against the dev SQLite DB. */
const { spawn } = require('child_process');
const path = require('path');
const bcrypt = require('bcryptjs');
const { init, qa, qi, qr, close } = require('../src/db');

const SERVER_PORT = 4123;
const BASE = `http://127.0.0.1:${SERVER_PORT}`;
let exitCode = 0;

async function httpx(method, p, { body, token } = {}) {
  const res = await fetch(BASE + p, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

function assert(name, cond, extra) {
  if (cond) { console.log(`PASS  ${name}`); }
  else { console.log(`FAIL  ${name} ${extra ? JSON.stringify(extra).slice(0, 300) : ''}`); exitCode = 1; }
}

async function waitForBoot() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/api/v1/health`);
      if (r.ok) return true;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

(async () => {
  await init();
  const studentRows = await qa('SELECT id FROM students ORDER BY id LIMIT 1');
  const kidId = studentRows.length ? Number(studentRows[0].id) : null;
  const hash = await bcrypt.hash('P@rentTest123', 12);
  await qr("DELETE FROM users WHERE username IN ('smokep_linked','smokep_unlinked')");
  const linkedId = await qi(
    "INSERT INTO users (username, password_hash, name, role, email, status) VALUES ('smokep_linked', ?, 'Smoke Linked', 'parent', 'smokep_linked@test.ph', 'active')",
    [hash]);
  await qi(
    "INSERT INTO users (username, password_hash, name, role, email, status) VALUES ('smokep_unlinked', ?, 'Smoke Unlinked', 'parent', 'smokep_unlinked@test.ph', 'active')",
    [hash]);
  if (kidId) {
    try { await qi('INSERT INTO parent_students (parent_user_id, student_id) VALUES (?, ?)', [linkedId, kidId]); }
    catch { /* already linked in an earlier run */ }
  }
  await close();

  const server = spawn(process.execPath, ['--env-file-if-exists=.env', 'src/index.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(SERVER_PORT), NOTIFY_EMAIL_MODE: 'stream' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (d) => {
    const s = String(d);
    if (s.includes('Error') || s.includes('MODULE_NOT_FOUND')) console.log('SERVER-STDERR', s.slice(0, 500));
  });

  const booted = await waitForBoot();
  assert('server boots', booted);

  let linkedToken = null;
  let unlinkedToken = null;
  if (booted) {
    const login = await httpx('POST', '/api/v1/auth/login', { body: { username: 'smokep_linked', password: 'P@rentTest123' } });
    assert('linked parent login', login.status === 200, login.json);
    linkedToken = login.json && login.json.token;

    const login2 = await httpx('POST', '/api/v1/auth/login', { body: { username: 'smokep_unlinked', password: 'P@rentTest123' } });
    assert('unlinked parent login', login2.status === 200, login2.json);
    unlinkedToken = login2.json && login2.json.token;

    if (linkedToken) {
      const list = await httpx('GET', '/api/v1/parent/students', { token: linkedToken });
      assert('GET /parent/students returns ONLY linked children',
        list.status === 200 && Array.isArray(list.json && list.json.data) && list.json.data.length === 1 && Number(list.json.data[0].id) === kidId,
        list.json);

      const prof = await httpx('GET', `/api/v1/parent/students/${kidId}`, { token: linkedToken });
      assert('GET /parent/students/:id profile', prof.status === 200 && prof.json && prof.json.data && Number(prof.json.data.id) === kidId, prof.json);

      for (const sub of ['grades', 'attendance', 'interventions', 'consents']) {
        const r = await httpx('GET', `/api/v1/parent/students/${kidId}/${sub}`, { token: linkedToken });
        assert(`GET /parent/students/:id/${sub} (200 + data array)`, r.status === 200 && Array.isArray(r.json && r.json.data), r.json);
      }

      const logs = await httpx('GET', '/api/v1/parent/access-logs', { token: linkedToken });
      assert('GET /parent/access-logs (200 + data array)', logs.status === 200 && Array.isArray(logs.json && logs.json.data), logs.json);

      const signed = await httpx('GET', '/api/v1/parent/consents/signed', { token: linkedToken });
      assert('GET /parent/consents/signed (200 + data array)', signed.status === 200 && Array.isArray(signed.json && signed.json.data), signed.json);

      const erasure = await httpx('GET', '/api/v1/parent/erasure-requests/pending', { token: linkedToken });
      assert('GET /parent/erasure-requests/pending (200 + data array)', erasure.status === 200 && Array.isArray(erasure.json && erasure.json.data), erasure.json);
    }

    if (linkedToken && unlinkedToken && kidId) {
      const other = await httpx('GET', `/api/v1/parent/students/${kidId}`, { token: unlinkedToken });
      assert('unlinked parent blocked from other student (403)', other.status === 403, other.json);

      const unlinkedList = await httpx('GET', '/api/v1/parent/students', { token: unlinkedToken });
      assert('unlinked parent sees an empty child list', unlinkedList.status === 200 && unlinkedList.json.data.length === 0, unlinkedList.json);
    }

    const noAuth = await httpx('GET', '/api/v1/parent/students');
    assert('parent routes reject anonymous (401)', noAuth.status === 401, noAuth.json);
  }

  server.kill();
  await new Promise((r) => setTimeout(r, 800));

  await init();
  await qr('DELETE FROM parent_students WHERE parent_user_id IN (SELECT id FROM users WHERE username IN (?, ?))', ['smokep_linked', 'smokep_unlinked']);
  await qr('DELETE FROM users WHERE username IN (?, ?)', ['smokep_linked', 'smokep_unlinked']);
  await close();

  console.log(exitCode === 0 ? 'SMOKE OK' : 'SMOKE FAILED');
  process.exit(exitCode);
})().catch((e) => { console.error('SMOKE CRASH', e); process.exit(1); });