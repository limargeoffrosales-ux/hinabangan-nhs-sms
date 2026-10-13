const { spawn } = require('child_process');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../src/db');
const PORT = 4215;
const BASE = `http://127.0.0.1:${PORT}`;
const U = 'probe_admin';
const P = 'ProbePass!23';

const child = spawn(process.execPath, ['-r', path.join(__dirname, '..', 'src', 'loadEnv.js'), 'src/index.js'], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let booted = false; const waiters = [];
child.stdout.on('data', d => { if (!booted && String(d).includes('listening on http://127.0.0.1:' + PORT)) { booted = true; while (waiters.length) waiters.shift()(); } });
child.stderr.on('data', d => process.stderr.write('SRVERR:' + String(d).slice(0, 200)));

async function main() {
  await db.init();
  const hash = await bcrypt.hash(P, 12);
  const ex = await db.q('SELECT id FROM users WHERE username = ?', [U]);
  if (ex) await db.qr('UPDATE users SET password_hash=?, role=?, status=?, email=? WHERE id=?', [hash, 'super_admin', 'active', 'p@x.t', ex.id]);
  else await db.qi('INSERT INTO users (username,password_hash,name,role,email,status) VALUES (?,?,?,?,?,?)', [U, hash, 'P', 'super_admin', 'p@x.t', 'active']);
  const sec = await db.q('SELECT id FROM sections LIMIT 1');
  const stu = await db.q('SELECT id FROM students LIMIT 1');
  if (!sec || !stu) { console.log('NO DATA in DB for happy-path check'); process.exit(0); }
  const sy = await db.q("SELECT value FROM app_settings WHERE key='school_year'");
  const schoolYear = (sy && sy.value) || '2026-2027';

  if (!booted) await new Promise(r => waiters.push(r));
  const login = await fetch(`${BASE}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: U, password: P }) });
  const { token } = await login.json();
  const H = { Authorization: `Bearer ${token}` };
  const hits = [
    `/api/v1/deped-forms/sf1?section_id=${sec.id}&school_year=${schoolYear}`,
    `/api/v1/deped-forms/sf2?section_id=${sec.id}&month=1&year=2026`,
    `/api/v1/deped-forms/sf3?section_id=${sec.id}`,
    `/api/v1/deped-forms/sf4?section_id=${sec.id}&month=1&year=2026`,
    `/api/v1/deped-forms/sf5?section_id=${sec.id}&term=Q1`,
    `/api/v1/deped-forms/sf6?section_id=${sec.id}`,
    `/api/v1/deped-forms/sf7?section_id=${sec.id}`,
    `/api/v1/deped-forms/sf9?section_id=${sec.id}&school_year=${schoolYear}`,
    `/api/v1/deped-forms/sf9/full?section_id=${sec.id}&school_year=${schoolYear}`,
    `/api/v1/deped-forms/sf10?student_id=${stu.id}`,
    `/api/v1/deped-forms/sf11?student_id=${stu.id}`,
    `/api/v1/deped-forms/attendance-summary?section_id=${sec.id}`,
    `/api/v1/deped-forms/student-id?student_id=${stu.id}`,
    `/api/v1/deped-forms/summary-of-grades?student_id=${stu.id}`,
  ];
  let bad = 0;
  for (const p of hits) {
    const r = await fetch(BASE + p, { headers: H });
    const t = (await r.text()).slice(0, 90);
    const flag = r.status >= 500 ? ' ERROR' : '';
    if (r.status >= 500) bad++;
    console.log(`${r.status === 200 ? 'OK ' : '!! '}[${r.status}] ${p}${flag} :: ${t}`);
  }
  await db.qr('DELETE FROM users WHERE username = ?', [U]);
  child.kill();
  process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error('CRASH', e); child.kill(); process.exit(1); });