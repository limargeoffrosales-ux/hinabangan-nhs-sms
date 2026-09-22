const path = require('path');
process.env.NODE_ENV = 'development';
const bcrypt = require('bcryptjs');
const { qi, qr, q, init } = require('../src/db');

const PORT = process.env.PORT || 4213;
const BASE = `http://127.0.0.1:${PORT}`;
const PROBE_USER = 'probe_admin';
const PROBE_PASS = 'ProbePass!23';

function startServer() {
  const { spawn } = require('child_process');
  const child = spawn(process.execPath, ['--env-file-if-exists=.env', 'src/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server boot timeout')), 30000);
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += String(d);
      if (buf.includes('listening on http://127.0.0.1:' + PORT)) {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error('server exited early code=' + code)); });
    child.stderr.on('data', (d) => { process.stderr.write(d); });
  });
}

// Mirrors the mounts in src/index.js
const MOUNTS = [
  ['/api/v1/students', 'students.routes.js'],
  ['/api/v1/attendance', 'attendance.routes.js'],
  ['/api/v1/grades', 'grades.routes.js'],
  ['/api/v1/announcements', 'announcements.routes.js'],
  ['/api/v1/auth', 'auth.routes.js'],
  ['/api/v1/users', 'users.routes.js'],
  ['/api/v1/teachers', 'teachers.routes.js'],
  ['/api/v1/subjects', 'subjects.routes.js'],
  ['/api/v1/sections', 'sections.routes.js'],
  ['/api/v1/enrollments', 'enrollments.routes.js'],
  ['/api/v1/grading', 'grading.routes.js'],
  ['/api/v1/exchange', 'exchange.routes.js'],
  ['/api/v1/analytics', 'analytics.routes.js'],
  ['/api/v1/analytics/kpi', 'analytics-kpi.routes.js'],
  ['/api/v1/portal', 'portal.routes.js'],
  ['/api/v1/dashboard', 'dashboard.routes.js'],
  ['/api/v1/audit', 'audit.routes.js'],
  ['/api/v1/schedule', 'schedule.routes.js'],
  ['/api/v1/assignments', 'assignments.routes.js'],
  ['/api/v1/submissions', 'submissions.routes.js'],
  ['/api/v1/interventions', 'interventions.routes.js'],
  ['/api/v1/assessment', 'assessment.routes.js'],
  ['/api/v1/immersion', 'immersion.routes.js'],
  ['/api/v1/jdvp', 'immersion.routes.js'],
  ['/api/v1/notifications', 'notifications.routes.js'],
  ['/api/v1/privacy', 'privacy.routes.js'],
  ['/api/v1/mfa', 'mfa.routes.js'],
  ['/api/v1/curriculum', 'curriculum.routes.js'],
  ['/api/v1/rooms', 'rooms.routes.js'],
  ['/api/v1/department', 'department.routes.js'],
  ['/api/v1/lessons', 'lessons.routes.js'],
  ['/api/v1/competency-tracker', 'competency-tracker.routes.js'],
  ['/api/v1/deped-forms', 'deped-forms.routes.js'],
  ['/api/v1/push', 'push.routes.js'],
  ['/api/v1/certifications', 'certifications.routes.js'],
  ['/api/v1/guidance', 'guidance.routes.js'],
  ['/api/v1/uploads', 'uploads.routes.js'],
  ['/api/v1/ai', 'ai.routes.js'],
  ['/api/v1/consents', 'consents.routes.js'],
  ['/api/v1/parent', 'parent.routes.js'],
];

function prefixFromRegexp(re) {
  try {
    let src = re.toString().replace(/^\/\^\\?\//, '');
    src = src.replace(/\\([/])/g, '$1');
    src = src.split('(?=')[0];
    let p = src.replace(/\/?\$$/, '');
    if (p) p = p.replace(/\\$/g, '');
    return p;
  } catch { return ''; }
}

async function upsertProbeAdmin() {
  await init();
  const existing = await q('SELECT id FROM users WHERE username = ?', [PROBE_USER]);
  if (existing) {
    await qr('UPDATE users SET password_hash = ?, role = ?, status = ?, email = ? WHERE id = ?',
      [await bcrypt.hash(PROBE_PASS, 12), 'super_admin', 'active', 'probe@local.test', existing.id]);
    return existing.id;
  }
  return qi('INSERT INTO users (username, password_hash, name, role, email, status) VALUES (?, ?, ?, ?, ?, ?)',
    [PROBE_USER, await bcrypt.hash(PROBE_PASS, 12), 'Error Probe Admin', 'super_admin', 'probe@local.test', 'active']);
}

function discoverRoutes() {
  const routes = new Map();
  function walk(stack, base) {
    for (const layer of stack || []) {
      if (!layer) continue;
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).filter(m => !['options', 'head'].includes(m));
        const full = (base + layer.route.path).replace(/\/+/g, '/').replace(/\/$/, '') || '/';
        if (!routes.has(full)) routes.set(full, new Set());
        methods.forEach(m => routes.get(full).add(m.toUpperCase()));
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        const childBase = (base + prefixFromRegexp(layer.regexp)).replace(/\/+/g, '/');
        walk(layer.handle.stack, childBase);
      }
    }
  }
  for (const [base, file] of MOUNTS) {
    const mod = require(path.join(__dirname, '..', 'src', 'routes', file));
    const routers = Array.isArray(mod) ? mod : (mod && typeof mod === 'object' ? Object.values(mod) : [mod]);
    for (const r of routers) if (r && typeof r.stack === 'object') walk(r.stack, base);
  }
  return [...routes.entries()];
}

async function main() {
  const child = await startServer();
  const buckets = { '2xx': [], '401': 0, '403': 0, '404': 0, '500': [], '4xx-other': [] };
  const slow = [];
  let bad = 0;
  try {
    await upsertProbeAdmin();

    let token, csrfToken;
    for (let i = 0; i < 5; i++) {
      const loginRes = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: PROBE_USER, password: PROBE_PASS }),
      });
      if (loginRes.status === 200) {
        const body = await loginRes.json();
        token = body.token; csrfToken = body.csrfToken;
        break;
      }
      if (i === 4) { console.error(`LOGIN FAILED: ${loginRes.status} ${await loginRes.text()}`); bad = 2; }
      await new Promise(r => setTimeout(r, 800));
    }
    if (!token) return bad;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const csrf = { ...headers, 'X-CSRF-Token': csrfToken };

    const unique = discoverRoutes();

    async function hit(p, method = 'GET', opts = {}) {
      const url = BASE + p;
      const t0 = Date.now();
      try {
        const r = await fetch(url, {
          method, headers: opts.headers,
          body: opts.body ? JSON.stringify(opts.body) : undefined,
        });
        const el = Date.now() - t0;
        const text = await r.text();
        if (el > 1500) slow.push({ p, method, el });
        let json = null; try { json = JSON.parse(text); } catch {}
        const key = r.status >= 500 ? '500' : r.status >= 200 && r.status < 300 ? '2xx' : r.status === 401 ? '401' : r.status === 403 ? '403' : r.status === 404 ? '404' : '4xx-other';
        if (r.status >= 400) process.stderr.write(`MARKER ${r.status} ${method} ${p}\n`);
        let item;
        if (key === '500') item = { p, method, status: r.status, body: text.slice(0, 260) };
        else if (key === '2xx') {
          item = { p, method, status: r.status, bytes: Buffer.byteLength(text) };
          if (!json && Buffer.byteLength(text) === 0) item.note = 'EMPTY BODY';
          if (json && typeof json === 'object' && !Array.isArray(json) && Object.keys(json).length === 0) item.note = 'EMPTY {}';
        } else item = { p, method, status: r.status };
        if (key === '500') { buckets['500'].push(item); bad = 1; }
        else if (key === '2xx') buckets['2xx'].push(item);
        else if (key === '4xx-other') buckets['4xx-other'].push(item);
        else buckets[key] += 1;
        return { status: r.status, json, text, el };
      } catch (e) {
        buckets['500'].push({ p, method, fetchError: e.message });
        bad = 1;
        return { fetchError: e.message };
      }
    }

    for (const [p, methods] of unique) {
      if (!methods.has('GET')) continue;
      if (/[*?]/.test(p)) continue;
      await hit(p, 'GET');
      await hit(p, 'GET', { headers });
      if (p.includes(':id') || p.includes(':userId') || p.includes(':studentId')) {
        const fb = p.replace(/:id/g, '999999999').replace(/:studentId/g, '999999999').replace(/:userId/g, '999999999').replace(/:roomId/g, '999999999');
        await hit(fb, 'GET', { headers });
      }
    }

    const postProbes = [
      ['/api/v1/auth/login', { broken: 1 }, false],
      ['/api/v1/students', {}, true],
      ['/api/v1/sections', {}, true],
      ['/api/v1/users', {}, true],
      ['/api/v1/attendance', {}, true],
      ['/api/v1/grades', {}, true],
      ['/api/v1/announcements', {}, true],
      ['/api/v1/enrollments', {}, true],
      ['/api/v1/interventions', {}, true],
      ['/api/v1/consents', {}, true],
      ['/api/v1/portal/enroll', {}, false],
    ];
    for (const [p, body, withCsrf] of postProbes) {
      const r = await fetch(BASE + p, { method: 'POST', headers: withCsrf ? csrf : headers, body: JSON.stringify(body) });
      const text = await r.text();
      if (r.status >= 500) { buckets['500'].push({ p, method: 'POST', status: r.status, body: text.slice(0, 260) }); bad = 1; }
      else if (r.status < 300) buckets['2xx'].push({ p, method: 'POST', status: r.status, bytes: Buffer.byteLength(text), note: 'UNEXPECTED 2xx for empty POST' });
    }

    console.log(`\nROUTE SURFACE: ${unique.length} unique paths`);
    console.log(`\n=== 500 / runtime errors (${buckets['500'].length}) ===`);
    for (const it of buckets['500']) console.log(`  [500] ${it.method || 'GET'} ${it.p} -> ${it.fetchError ? 'fetchError: ' + it.fetchError : 'status ' + it.status + ' :: ' + it.body}`);
    console.log(`\n=== empty / broken 2xx (of ${buckets['2xx'].length}) ===`);
    for (const it of buckets['2xx']) if (it.note) console.log(`  [${it.note}] ${it.method} ${it.p} (status ${it.status}, ${it.bytes}b)`);
    console.log(`\n=== 4xx-other (${buckets['4xx-other'].length}) ===`);
    for (const it of buckets['4xx-other']) console.log(`  [${it.status}] ${it.method} ${it.p}`);
    console.log(`\n=== slow (>1500ms) (${slow.length}) ===`);
    for (const s of slow) console.log(`  [${s.el}ms] ${s.method} ${s.p}`);
    console.log(`\n=== summary ===`);
    console.log(`  401:${buckets['401']} 403:${buckets['403']} 404:${buckets['404']} 4xxOther:${buckets['4xx-other'].length} 2xx:${buckets['2xx'].length} 500:${buckets['500'].length}`);

    await qr('DELETE FROM users WHERE username = ?', [PROBE_USER]);
  } finally {
    child.kill();
    await new Promise(r => setTimeout(r, 600));
  }
  return bad;
}

main().then(code => process.exit(code)).catch(e => { console.error('PROBE CRASH', e); process.exit(3); });