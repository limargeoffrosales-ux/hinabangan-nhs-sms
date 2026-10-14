'use strict';

for (const k of ['DATABASE_URL', 'POSTGRES_URL', 'PGURL']) delete process.env[k];
const os = require('os');
const fs = require('fs');
const path = require('path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'meridianed-lms-'));
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-lms';

const { before, test, after } = require('node:test');
const assert = require('node:assert/strict');
const { init, q, qa, qr, qi, close } = require('../src/db');
const { signAccess } = require('../src/auth');
const { requireLm, loadSpace } = require('../src/middleware/lms-authz');

function fakeRes() {
  let statusCode = 200;
  let body = null;
  return {
    status(c) {
      statusCode = c;
      return {
        json(b) {
          body = b;
        },
      };
    },
    _get() {
      return { statusCode, body };
    },
  };
}

function runMw(mw, req, res) {
  let nexted = false;
  mw(req, res, () => {
    nexted = true;
  });
  return { nexted, res };
}

before(async () => {
  await init();
});

after(async () => {
  try {
    await close();
  } catch {}
});

test('requireLm allows teacher and student, denies admin', () => {
  const mw = requireLm();
  let r = runMw(mw, { role: 'teacher' }, fakeRes());
  assert.equal(r.nexted, true);
  r = runMw(mw, { role: 'student' }, fakeRes());
  assert.equal(r.nexted, true);
  r = runMw(mw, { role: 'school_admin' }, fakeRes());
  const rr = r.res._get();
  assert.equal(r.nexted, false);
  assert.equal(rr.statusCode, 403);
});

test('loadSpace denies admin even if space exists (via role gate)', async () => {
  const userRow = await q('SELECT id FROM users WHERE role = ? AND username = ?', ['school_admin', 'admin']);
  if (!userRow) {
    const id = await qi(
      "INSERT INTO users (username, role, password_hash, name, status, password_changed_at) VALUES (?, ?, ?, ?, ?, NULL)",
      ['admin', 'school_admin', 'x', 'School Admin', 'active']
    );
  } else {
    await qr('UPDATE users SET role = ? WHERE id = ?', ['school_admin', userRow.id]);
  }
  const adminRow = await q('SELECT id, role FROM users WHERE username = ?', ['admin']);
  assert.ok(adminRow);
  assert.equal(adminRow.role, 'school_admin');

  const now = new Date().toISOString().slice(0, 10);
  const sy = `${now.slice(0, 4)}-${String(Number(now.slice(0, 4)) + 1).slice(-4)}`;
  const tId = await qi(
    'INSERT INTO teachers (employee_no, first_name, last_name, sex, position, prc_no, email, contact, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ['TLM001', 'Tea', 'Cher', 'F', 'Teacher', 'PRC1', 't@x.com', '091', 'active']
  );
  const subId = await qi(
    'INSERT INTO subjects (code, title, description, grade_level, units) VALUES (?, ?, ?, ?, ?)',
    ['MATH7', 'Math 7', 'desc', 7, 1]
  );
  const secId = await qi(
    'INSERT INTO sections (name, grade_level, school_year, status) VALUES (?, ?, ?, ?)',
    ['G7-A', 7, sy, 'active']
  );
  const caId = await qi(
    'INSERT INTO class_assignments (school_year, section_id, subject_id, teacher_id) VALUES (?, ?, ?, ?)',
    [sy, secId, subId, tId]
  );
  const spaceId = await qi(
    'INSERT INTO lm_spaces (school_year, section_id, subject_id, teacher_id, class_assignment_id, title) VALUES (?, ?, ?, ?, ?, ?)',
    [sy, secId, subId, tId, caId, 'G7-A - Math 7']
  );

  const mw = loadSpace;
  const req = { params: { spaceId }, role: 'school_admin', user: { id: adminRow.id, role: 'school_admin' } };
  const res = fakeRes();
  let nexted = false;
  await mw(req, res, () => {
    nexted = true;
  });
  const rr = res._get();
  assert.equal(nexted, false);
  assert.equal(rr.statusCode, 403);
});
