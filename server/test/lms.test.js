process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-lms';

const os = require('os');
const fs = require('fs');
const path = require('path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-test-'));

const http = require('http');
const express = require('express');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { init, qi, close } = require('../src/db');
const { signAccess } = require('../src/auth');
const { requireLm, loadSpace } = require('../src/middleware/lms-authz');
const lmsRoutes = require('../src/routes/lms.routes');

const { targetIncludes, normalizeTarget } = lmsRoutes;

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

let server;
let base;
let teacherToken;
let studentToken;
let otherTeacherToken;
let spaceId;
let studentId;

const SCHOOL_YEAR = '2099-2100';

async function makeUser(username, role) {
  return qi(
    'INSERT INTO users (username, password_hash, name, role, status) VALUES (?, ?, ?, ?, ?)',
    [username, 'x', username, role, 'active']
  );
}

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(base + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

before(async () => {
  await init();

  const teacherUserId = await makeUser('lm_teacher', 'teacher');
  const otherUserId = await makeUser('lm_other', 'teacher');
  const studentUserId = await makeUser('lm_student', 'student');
  const teacherId = await qi(
    'INSERT INTO teachers (employee_no, first_name, last_name, sex, status, user_id) VALUES (?, ?, ?, ?, ?, ?)',
    ['LM-T1', 'Lm', 'Teacher', 'F', 'active', teacherUserId]
  );
  await qi(
    'INSERT INTO teachers (employee_no, first_name, last_name, sex, status, user_id) VALUES (?, ?, ?, ?, ?, ?)',
    ['LM-T2', 'Other', 'Teacher', 'M', 'active', otherUserId]
  );
  studentId = await qi(
    'INSERT INTO students (lrn, first_name, last_name, sex, grade_level, status, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['LM-LRN-1', 'Lm', 'Student', 'F', '7', 'active', studentUserId]
  );
  const subjectId = await qi(
    'INSERT INTO subjects (code, title, description, grade_level, units) VALUES (?, ?, ?, ?, ?)',
    ['LM-MATH7', 'LM Math 7', 'desc', 7, 1]
  );
  const sectionId = await qi(
    'INSERT INTO sections (name, grade_level, school_year, status) VALUES (?, ?, ?, ?)',
    ['LM-G7-A', 7, SCHOOL_YEAR, 'active']
  );
  await qi(
    'INSERT INTO class_assignments (school_year, section_id, subject_id, teacher_id) VALUES (?, ?, ?, ?)',
    [SCHOOL_YEAR, sectionId, subjectId, teacherId]
  );
  spaceId = await qi(
    'INSERT INTO lm_spaces (school_year, section_id, subject_id, teacher_id, title) VALUES (?, ?, ?, ?, ?)',
    [SCHOOL_YEAR, sectionId, subjectId, teacherId, 'LM-G7-A - LM Math 7']
  );
  const enrollmentId = await qi(
    'INSERT INTO enrollments (student_id, section_id, school_year, grade_level, status) VALUES (?, ?, ?, ?, ?)',
    [studentId, sectionId, SCHOOL_YEAR, '7', 'enrolled']
  );
  await qi(
    'INSERT INTO enrollment_subjects (enrollment_id, subject_id) VALUES (?, ?)',
    [enrollmentId, subjectId]
  );

  teacherToken = signAccess({ id: teacherUserId, role: 'teacher', name: 'Lm Teacher', username: 'lm_teacher' });
  otherTeacherToken = signAccess({ id: otherUserId, role: 'teacher', name: 'Other Teacher', username: 'lm_other' });
  studentToken = signAccess({ id: studentUserId, role: 'student', name: 'Lm Student', username: 'lm_student' });

  const app = express();
  app.use(express.json());
  app.use('/api/v1/lms', lmsRoutes);
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try {
    await close();
  } catch {
    // ignore
  }
});

test('targetIncludes: null/empty means everyone', () => {
  assert.equal(targetIncludes(null, 5), true);
  assert.equal(targetIncludes('', 5), true);
  assert.equal(targetIncludes([], 5), true);
});

test('targetIncludes: array and JSON-string forms match only listed ids', () => {
  assert.equal(targetIncludes([5, 7], 5), true);
  assert.equal(targetIncludes([5, 7], 6), false);
  assert.equal(targetIncludes('[5,7]', 7), true);
  assert.equal(targetIncludes('[5,7]', 8), false);
});

test('normalizeTarget: comma string and array both serialize to JSON', () => {
  assert.equal(normalizeTarget('1, 2'), '[1,2]');
  assert.equal(normalizeTarget([3, 4]), '[3,4]');
  assert.equal(normalizeTarget(''), null);
  assert.equal(normalizeTarget(null), null);
});

test('admin role is rejected by requireLm', () => {
  const { nexted, res } = runMw(requireLm(), { role: 'school_admin' }, fakeRes());
  assert.equal(nexted, false);
  assert.equal(res._get().statusCode, 403);
});

test('loadSpace rejects admin with 403', async () => {
  const req = { params: { spaceId }, role: 'school_admin', user: { id: 0, role: 'school_admin' } };
  const res = fakeRes();
  let nexted = false;
  await loadSpace(req, res, () => { nexted = true; });
  assert.equal(nexted, false);
  assert.equal(res._get().statusCode, 403);
});

test('teacher lists their space', async () => {
  const { status, json } = await api(`/api/v1/lms/spaces?school_year=${SCHOOL_YEAR}`, { token: teacherToken });
  assert.equal(status, 200);
  assert.ok(json.data.some((s) => Number(s.id) === Number(spaceId)));
});

test('student lists the enrolled space', async () => {
  const { status, json } = await api(`/api/v1/lms/spaces?school_year=${SCHOOL_YEAR}`, { token: studentToken });
  assert.equal(status, 200);
  assert.ok(json.data.some((s) => Number(s.id) === Number(spaceId)));
});

test('non-owner teacher is denied the space', async () => {
  const { status } = await api(`/api/v1/lms/spaces/${spaceId}`, { token: otherTeacherToken });
  assert.equal(status, 403);
});

let moduleId;
test('teacher creates a module', async () => {
  const { status, json } = await api(`/api/v1/lms/spaces/${spaceId}/modules`, {
    method: 'POST', token: teacherToken, body: { title: 'Q1 Week 1', quarter: 1 },
  });
  assert.equal(status, 200);
  assert.ok(json.id);
  moduleId = json.id;
});

test('student cannot create a module', async () => {
  const { status } = await api(`/api/v1/lms/spaces/${spaceId}/modules`, {
    method: 'POST', token: studentToken, body: { title: 'nope' },
  });
  assert.equal(status, 403);
});

let materialId;
test('teacher creates an unpublished material', async () => {
  const { status, json } = await api(`/api/v1/lms/spaces/${spaceId}/materials`, {
    method: 'POST', token: teacherToken, body: { title: 'Lesson 1', type: 'reading', module_id: moduleId },
  });
  assert.equal(status, 200);
  materialId = json.id;
});

test('student does not see an unpublished material', async () => {
  const { status, json } = await api(`/api/v1/lms/spaces/${spaceId}/materials`, { token: studentToken });
  assert.equal(status, 200);
  assert.equal(json.data.filter((m) => Number(m.id) === Number(materialId)).length, 0);
});

test('published material becomes visible to the student', async () => {
  const patch = await api(`/api/v1/lms/spaces/${spaceId}/materials/${materialId}`, {
    method: 'PATCH', token: teacherToken, body: { published: true },
  });
  assert.equal(patch.status, 200);
  const { json } = await api(`/api/v1/lms/spaces/${spaceId}/materials`, { token: studentToken });
  assert.equal(json.data.filter((m) => Number(m.id) === Number(materialId)).length, 1);
});

test('student cannot patch materials', async () => {
  const { status } = await api(`/api/v1/lms/spaces/${spaceId}/materials/${materialId}`, {
    method: 'PATCH', token: studentToken, body: { target_student_ids: String(studentId) },
  });
  assert.equal(status, 403);
});

test('targeting excludes the student, then re-including restores visibility', async () => {
  await api(`/api/v1/lms/spaces/${spaceId}/materials/${materialId}`, {
    method: 'PATCH', token: teacherToken, body: { target_student_ids: '999999' },
  });
  const hidden = await api(`/api/v1/lms/spaces/${spaceId}/materials`, { token: studentToken });
  assert.equal(hidden.json.data.filter((m) => Number(m.id) === Number(materialId)).length, 0);

  await api(`/api/v1/lms/spaces/${spaceId}/materials/${materialId}`, {
    method: 'PATCH', token: teacherToken, body: { target_student_ids: String(studentId) },
  });
  const visible = await api(`/api/v1/lms/spaces/${spaceId}/materials`, { token: studentToken });
  assert.equal(visible.json.data.filter((m) => Number(m.id) === Number(materialId)).length, 1);
});

test('attachment list is empty for the owner and denied to a non-owner', async () => {
  const own = await api(`/api/v1/lms/spaces/${spaceId}/materials/${materialId}/attachments`, { token: teacherToken });
  assert.equal(own.status, 200);
  assert.deepEqual(own.json.data, []);
  const other = await api(`/api/v1/lms/spaces/${spaceId}/materials/${materialId}/attachments`, { token: otherTeacherToken });
  assert.equal(other.status, 403);
});
