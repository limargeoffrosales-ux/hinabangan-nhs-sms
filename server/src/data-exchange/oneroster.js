const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { q, qa, qr, qi, nowSql } = require('../db');
const { toCsv, parseCsv, prefixedId } = require('./csv');

const SCHOOL_NAME = 'Hinabangan National High School';
const SCHOOL_ID = 'org-1';

const FILES = [
  { name: 'users', label: 'Users', importable: true },
  { name: 'orgs', label: 'Orgs', importable: false },
  { name: 'academicSessions', label: 'Academic Sessions', importable: false },
  { name: 'courses', label: 'Courses', importable: true },
  { name: 'classes', label: 'Classes', importable: true },
  { name: 'enrollments', label: 'Enrollments', importable: true },
  { name: 'demographics', label: 'Demographics', importable: false },
  { name: 'gradebooks', label: 'Gradebooks', importable: false },
  { name: 'results', label: 'Results', importable: false },
  { name: 'attendanceEvents', label: 'Attendance Events', importable: false },
  { name: 'manifest', label: 'Manifest', importable: false },
];

const COLUMNS = {
  users: ['sourcedId', 'status', 'dateLastModified', 'enabledUser', 'orgSourcedIds', 'role',
    'username', 'userId', 'ids', 'givenName', 'middleName', 'familyName', 'identifier', 'email',
    'sms', 'phones', 'agents', 'grades', 'password'],
  orgs: ['sourcedId', 'status', 'dateLastModified', 'name', 'type', 'identifier', 'parentSourcedId'],
  academicSessions: ['sourcedId', 'status', 'dateLastModified', 'title', 'type', 'startDate', 'endDate', 'schoolYear'],
  courses: ['sourcedId', 'status', 'dateLastModified', 'title', 'schoolYearSourcedId', 'code', 'grade', 'subjectCodes'],
  classes: ['sourcedId', 'status', 'dateLastModified', 'title', 'courseSourcedId', 'classCode', 'classType',
    'location', 'schoolSourcedId', 'termSourcedId', 'subjectCodes', 'periods'],
  enrollments: ['sourcedId', 'status', 'dateLastModified', 'classSourcedId', 'schoolSourcedId',
    'userSourcedId', 'role', 'primary', 'beginDate', 'endDate'],
  demographics: ['sourcedId', 'status', 'dateLastModified', 'birthDate', 'sex',
    'americanIndianOrAlaskaNative', 'asian', 'blackOrAfricanAmerican', 'hispanicOrLatino', 'white',
    'demographicRaceTwoOrMoreRaces', 'countryOfBirthCode', 'demographicEthnicity'],
  gradebooks: ['sourcedId', 'status', 'dateLastModified', 'title', 'courseSourcedId', 'academicSessionSourcedId'],
  results: ['sourcedId', 'status', 'dateLastModified', 'lineItemSourcedId', 'studentSourcedId',
    'scoreStatus', 'score', 'scoreDate', 'comment'],
  attendanceEvents: ['sourcedId', 'status', 'dateLastModified', 'type', 'userSourcedId', 'date',
    'time', 'status', 'teacherSourcedId', 'classSourcedId', 'schoolSourcedId'],
  manifest: ['propertyName', 'propertyValue'],
};

const todayIso = () => new Date().toISOString().slice(0, 10);

function syToYears(sy) {
  const m = String(sy || '').match(/(\d{4})/g);
  const start = m ? Number(m[0]) : new Date().getFullYear();
  return { start, end: start + 1 };
}

const roleMap = {
  super_admin: 'administrator', region_admin: 'administrator', division_admin: 'administrator',
  school_admin: 'administrator', principal: 'administrator', assistant_principal: 'administrator',
  registrar: 'administrator', teacher: 'teacher', guidance: 'administrator', nurse: 'administrator',
  librarian: 'administrator', cashier: 'administrator', accounting: 'administrator', hr: 'administrator',
  property_custodian: 'administrator', ict: 'administrator', security: 'administrator',
};

function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  if (!parts.length || parts[0] === '') return { givenName: '', familyName: '' };
  const givenName = parts[0];
  const familyName = parts.slice(1).join(' ');
  return { givenName, familyName };
}

function sexToOneroster(sex) {
  const v = String(sex || '').toLowerCase();
  if (v.startsWith('m')) return 'male';
  if (v.startsWith('f')) return 'female';
  return 'unspecified';
}

async function getSchoolYears() {
  const rows = await qa(
    `SELECT school_year FROM class_assignments
     UNION SELECT school_year FROM enrollments
     UNION SELECT school_year FROM grades
     ORDER BY school_year`);
  const ys = rows.map((r) => r.school_year).filter(Boolean);
  return ys.length ? ys : [String(new Date().getFullYear()) + '-' + (new Date().getFullYear() + 1)];
}

// ---- Export builders -------------------------------------------------------

async function buildUsers() {
  const staff = await qa(
    `SELECT id, username, name, email, role FROM users WHERE role NOT IN ('student','parent') ORDER BY id`);
  const students = await qa(
    `SELECT id, lrn, global_learner_id, first_name, middle_name, last_name, sex, grade_level, status FROM students ORDER BY id`);
  const rows = [];
  for (const s of staff) {
    const { givenName, familyName } = splitName(s.name);
    rows.push({
      sourcedId: prefixedId('u', s.id),
      status: 'active', dateLastModified: todayIso(), enabledUser: 'true',
      orgSourcedIds: SCHOOL_ID, role: roleMap[s.role] || 'administrator',
      username: s.username, userId: s.username, ids: '',
      givenName, middleName: '', familyName,
      identifier: '', email: s.email || '', sms: '', phones: '', agents: '', grades: '', password: '',
    });
  }
  for (const s of students) {
    const gradeNum = String(s.grade_level || '').replace(/\D/g, '');
    rows.push({
      sourcedId: prefixedId('s', s.id),
      status: s.status || 'active', dateLastModified: todayIso(), enabledUser: 'true',
      orgSourcedIds: SCHOOL_ID, role: 'student',
      username: s.lrn, userId: s.lrn, ids: s.global_learner_id ? JSON.stringify([s.global_learner_id]) : '',
      givenName: s.first_name, middleName: s.middle_name || '', familyName: s.last_name,
      identifier: s.lrn, email: '', sms: '', phones: '', agents: '', grades: gradeNum, password: '',
    });
  }
  return rows;
}

async function buildOrgs() {
  return [{
    sourcedId: SCHOOL_ID, status: 'active', dateLastModified: todayIso(),
    name: SCHOOL_NAME, type: 'school', identifier: 'HNHS', parentSourcedId: '',
  }];
}

async function buildAcademicSessions() {
  const ys = await getSchoolYears();
  return ys.map((sy) => {
    const { start, end } = syToYears(sy);
    return {
      sourcedId: sy, status: 'active', dateLastModified: todayIso(),
      title: `School Year ${sy}`, type: 'schoolYear',
      startDate: `${start}-06-01`, endDate: `${end}-03-31`, schoolYear: sy,
    };
  });
}

async function buildCourses() {
  const subjects = await qa(`SELECT id, code, title, grade_level, track FROM subjects ORDER BY id`);
  const ys = await getSchoolYears();
  return subjects.map((s) => ({
    sourcedId: prefixedId('course', s.id), status: 'active', dateLastModified: todayIso(),
    title: s.title, schoolYearSourcedId: ys[0] || '', code: s.code,
    grade: s.grade_level, subjectCodes: s.code,
  }));
}

async function buildClasses() {
  const rows = await qa(
    `SELECT ca.id, ca.school_year, ca.section_id, ca.subject_id, ca.room,
            s.name AS section_name, su.code AS subject_code, su.title AS subject_title
     FROM class_assignments ca
     JOIN sections s ON s.id = ca.section_id
     JOIN subjects su ON su.id = ca.subject_id
     ORDER BY ca.id`);
  return rows.map((c) => ({
    sourcedId: prefixedId('class', c.id), status: 'active', dateLastModified: todayIso(),
    title: c.subject_title, courseSourcedId: prefixedId('course', c.subject_id),
    classCode: `${c.subject_code}-${c.section_name}`, classType: 'scheduled',
    location: c.room || '', schoolSourcedId: SCHOOL_ID, termSourcedId: c.school_year,
    subjectCodes: c.subject_code, periods: '',
  }));
}

async function buildEnrollments() {
  const es = await qa(
    `SELECT e.student_id, e.section_id, e.school_year, es.subject_id
     FROM enrollments e
     JOIN enrollment_subjects es ON es.enrollment_id = e.id
     WHERE e.status = 'enrolled' ORDER BY e.student_id`);
  const assignments = await qa(`SELECT id, section_id, subject_id, school_year FROM class_assignments`);
  const byKey = {};
  for (const a of assignments) byKey[`${a.section_id}:${a.subject_id}:${a.school_year}`] = a.id;
  const rows = [];
  for (const r of es) {
    const aid = byKey[`${r.section_id}:${r.subject_id}:${r.school_year}`];
    if (!aid) continue;
    rows.push({
      sourcedId: prefixedId('enr', `${r.student_id}-${aid}`), status: 'active', dateLastModified: todayIso(),
      classSourcedId: prefixedId('class', aid), schoolSourcedId: SCHOOL_ID,
      userSourcedId: prefixedId('s', r.student_id), role: 'student', primary: 'true',
      beginDate: '', endDate: '',
    });
  }
  return rows;
}

async function buildDemographics() {
  const students = await qa(`SELECT id, birth_date, sex FROM students ORDER BY id`);
  return students.map((s) => ({
    sourcedId: prefixedId('s', s.id), status: 'active', dateLastModified: todayIso(),
    birthDate: s.birth_date ? String(s.birth_date).slice(0, 10) : '', sex: sexToOneroster(s.sex),
    americanIndianOrAlaskaNative: '', asian: 'true', blackOrAfricanAmerican: '',
    hispanicOrLatino: '', white: '', demographicRaceTwoOrMoreRaces: '',
    countryOfBirthCode: 'PH', demographicEthnicity: '',
  }));
}

async function buildGradebooksAndResults() {
  const grades = await qa(
    `SELECT g.student_id, g.subject_id, g.school_year, g.quarter, g.computed_grade, g.remarks
     FROM grades g ORDER BY g.subject_id, g.school_year, g.quarter`);
  const subjects = await qa(`SELECT id, title FROM subjects`);
  const titles = {};
  for (const s of subjects) titles[s.id] = s.title;
  const lineItems = {};
  const gradebooks = [];
  const results = [];
  for (const g of grades) {
    const li = `li-${g.subject_id}-${g.school_year}-q${g.quarter}`;
    if (!lineItems[li]) {
      lineItems[li] = true;
      gradebooks.push({
        sourcedId: li, status: 'active', dateLastModified: todayIso(),
        title: `${titles[g.subject_id] || 'Subject'} · ${g.school_year} · Q${g.quarter}`,
        courseSourcedId: prefixedId('course', g.subject_id), academicSessionSourcedId: g.school_year,
      });
    }
    results.push({
      sourcedId: prefixedId('res', `${g.student_id}-${g.subject_id}-${g.school_year}-q${g.quarter}`),
      status: 'active', dateLastModified: todayIso(),
      lineItemSourcedId: li, studentSourcedId: prefixedId('s', g.student_id),
      scoreStatus: 'graded', score: g.computed_grade, scoreDate: todayIso(), comment: g.remarks || '',
    });
  }
  return { gradebooks, results };
}

async function buildAttendanceEvents() {
  const att = await qa(
    `SELECT a.student_id, a.date, a.status FROM attendance a ORDER BY a.date, a.student_id`);
  return att.map((a) => ({
    sourcedId: prefixedId('att', `${a.student_id}-${a.date}`), status: 'active', dateLastModified: todayIso(),
    type: 'attendance', userSourcedId: prefixedId('s', a.student_id), date: a.date, time: '',
    status: String(a.status || 'present').toLowerCase(), teacherSourcedId: '', classSourcedId: '',
    schoolSourcedId: SCHOOL_ID,
  }));
}

async function buildFile(name) {
  switch (name) {
    case 'users': return buildUsers();
    case 'orgs': return buildOrgs();
    case 'academicSessions': return buildAcademicSessions();
    case 'courses': return buildCourses();
    case 'classes': return buildClasses();
    case 'enrollments': return buildEnrollments();
    case 'demographics': return buildDemographics();
    case 'gradebooks': return (await buildGradebooksAndResults()).gradebooks;
    case 'results': return (await buildGradebooksAndResults()).results;
    case 'attendanceEvents': return buildAttendanceEvents();
    case 'manifest': {
      const entries = [['oneroster.version', '1.2'], ['oneroster.csv.bom', 'utf-8'],
        ['source.system', 'meridianed'], ['source.school', SCHOOL_NAME]];
      for (const f of FILES) {
        if (f.name === 'manifest') continue;
        const rows = await buildFile(f.name);
        entries.push([`oneroster.rows.${f.name}`, String(rows.length)]);
      }
      return entries.map(([propertyName, propertyValue]) => ({ propertyName, propertyValue }));
    }
    default: throw new Error(`Unknown OneRoster file: ${name}`);
  }
}

async function buildFileCsv(name) {
  const rows = await buildFile(name);
  const csv = await toCsv(COLUMNS[name], rows);
  return { csv, rows: rows.length };
}

async function listFiles() {
  const out = [];
  for (const f of FILES) {
    const rows = await buildFile(f.name);
    out.push({ name: f.name, label: f.label, rows: rows.length, importable: f.importable });
  }
  return out;
}

// ---- Import ----------------------------------------------------------------

function required(row, cols) {
  for (const c of cols) if (!row[c] || String(row[c]).trim() === '') return c;
  return null;
}

function rowOf(raw, key) {
  // columns are lowercased by parseCsv? They are not. Normalise access.
  return raw[key] !== undefined ? raw[key] : raw[key.toLowerCase()];
}

async function ensureGlobalId(studentId) {
  const gid = `HNHS-${new Date().getFullYear()}-${String(studentId).padStart(6, '0')}`;
  await qr(
    `UPDATE students SET global_learner_id = ? WHERE id = ? AND (global_learner_id IS NULL OR global_learner_id = '')`,
    [gid, studentId]);
}

async function planUsers(rows) {
  const plans = [];
  let i = 0;
  for (const raw of rows) {
    i++;
    const role = String(rowOf(raw, 'role') || '').trim().toLowerCase();
    const givenName = String(rowOf(raw, 'givenName') || '').trim();
    const middleName = String(rowOf(raw, 'middleName') || '').trim();
    const familyName = String(rowOf(raw, 'familyName') || '').trim();
    const lrn = String(rowOf(raw, 'identifier') || rowOf(raw, 'username') || '').trim();
    const username = String(rowOf(raw, 'username') || '').trim();
    const email = String(rowOf(raw, 'email') || '').trim();
    if (!role) { plans.push({ row: i, error: 'Missing role' }); continue; }
    if (role === 'student') {
      if (!givenName && !familyName) { plans.push({ row: i, error: 'Missing student name' }); continue; }
      const existing = lrn ? await q('SELECT id, lrn FROM students WHERE lrn = ?', [lrn]) : null;
      const gradeRaw = String(rowOf(raw, 'grades') || '').replace(/[\[\]"]/g, '').trim().split(',')[0];
      const gradeNum = gradeRaw.replace(/\D/g, '');
      const sexRaw = String(rowOf(raw, 'sex') || '').trim().toLowerCase();
      const sex = sexRaw.startsWith('f') ? 'Female' : (sexRaw.startsWith('m') ? 'Male' : 'Male');
      plans.push({
        row: i, action: existing ? 'update' : 'create', entity: 'student', summary: `${givenName} ${familyName}`.trim(),
        data: { id: existing && existing.id, lrn, givenName, middleName, familyName, sex, gradeLevel: gradeNum ? `Grade ${gradeNum}` : 'Grade 11' },
      });
    } else if (roleMap[role] || role === 'administrator' || role === 'teacher') {
      if (!username) { plans.push({ row: i, error: 'Missing username' }); continue; }
      const existing = await q('SELECT id FROM users WHERE username = ?', [username]);
      const targetRole = role === 'teacher' ? 'teacher' : 'school_admin';
      plans.push({
        row: i, action: existing ? 'update' : 'create', entity: 'user', summary: `${username} (${targetRole})`,
        data: { id: existing && existing.id, username, givenName, familyName, email, role: targetRole },
      });
    } else {
      plans.push({ row: i, error: `Unsupported role: ${role}` });
    }
  }
  return plans;
}

async function applyUsers(plans) {
  const out = [];
  for (const p of plans) {
    if (p.error) { out.push(p); continue; }
    try {
      if (p.entity === 'student') {
        const name = `${p.data.givenName} ${p.data.middleName} ${p.data.familyName}`.replace(/\s+/g, ' ').trim();
        if (p.action === 'create') {
          const id = await qi(
            `INSERT INTO students (lrn, first_name, middle_name, last_name, sex, grade_level, status)
             VALUES (?, ?, ?, ?, ?, ?, 'active')`,
            [p.data.lrn || null, p.data.givenName, p.data.middleName, p.data.familyName, p.data.sex, p.data.gradeLevel]);
          await ensureGlobalId(id);
          out.push({ ...p, status: 'created', createdId: id });
        } else {
          await qr(
            `UPDATE students SET first_name = ?, middle_name = ?, last_name = ? WHERE id = ?`,
            [p.data.givenName, p.data.middleName, p.data.familyName, p.data.id]);
          await ensureGlobalId(p.data.id);
          out.push({ ...p, status: 'updated' });
        }
      } else {
        if (p.action === 'create') {
          const pw = crypto.randomBytes(12).toString('base64url');
          await qi(
            `INSERT INTO users (username, password_hash, name, role, email, status) VALUES (?, ?, ?, ?, ?, 'active')`,
            [p.data.username, await bcrypt.hash(pw, 10),
              `${p.data.givenName} ${p.data.familyName}`.trim(), p.data.role, p.data.email || null]);
          out.push({ ...p, status: 'created', generatedPassword: pw });
        } else {
          await qr(
            `UPDATE users SET name = ?, email = COALESCE(?, email), role = ? WHERE id = ?`,
            [`${p.data.givenName} ${p.data.familyName}`.trim(), p.data.email || null, p.data.role, p.data.id]);
          out.push({ ...p, status: 'updated' });
        }
      }
    } catch (e) {
      out.push({ ...p, error: e.message });
    }
  }
  return out;
}

async function planCourses(rows) {
  const plans = [];
  let i = 0;
  for (const raw of rows) {
    i++;
    const code = String(rowOf(raw, 'code') || '').trim();
    const title = String(rowOf(raw, 'title') || '').trim();
    const grade = String(rowOf(raw, 'grade') || '').trim();
    if (!code) { plans.push({ row: i, error: 'Missing course code' }); continue; }
    const existing = await q('SELECT id FROM subjects WHERE code = ?', [code]);
    plans.push({
      row: i, action: existing ? 'update' : 'create', entity: 'subject', summary: `${code} - ${title}`,
      data: { id: existing && existing.id, code, title, grade },
    });
  }
  return plans;
}

async function applyCourses(plans) {
  const out = [];
  for (const p of plans) {
    if (p.error) { out.push(p); continue; }
    try {
      if (p.action === 'create') {
        const id = await qi(
          `INSERT INTO subjects (code, title, grade_level, track, units) VALUES (?, ?, ?, 'academic', 1.0)`,
          [p.data.code, p.data.title || p.data.code, p.data.grade || null]);
        out.push({ ...p, status: 'created', createdId: id });
      } else {
        await qr(`UPDATE subjects SET title = COALESCE(?, title), grade_level = COALESCE(?, grade_level) WHERE id = ?`,
          [p.data.title || null, p.data.grade || null, p.data.id]);
        out.push({ ...p, status: 'updated' });
      }
    } catch (e) { out.push({ ...p, error: e.message }); }
  }
  return out;
}

async function planClasses(rows) {
  const plans = [];
  let i = 0;
  for (const raw of rows) {
    i++;
    const sourcedId = String(rowOf(raw, 'sourcedId') || '').trim();
    const courseSourcedId = String(rowOf(raw, 'courseSourcedId') || '').trim();
    const termSourcedId = String(rowOf(raw, 'termSourcedId') || '').trim();
    const classCode = String(rowOf(raw, 'classCode') || '').trim();
    const location = String(rowOf(raw, 'location') || '').trim();
    const idMatch = sourcedId.match(/^class-(\d+)$/);
    if (idMatch) {
      const existing = await q('SELECT id FROM class_assignments WHERE id = ?', [Number(idMatch[1])]);
      if (existing) {
        plans.push({ row: i, action: 'update', entity: 'class', summary: `class-${existing.id}`, data: { id: existing.id, location } });
        continue;
      }
    }
    const c = courseSourcedId.match(/^course-(\d+)$/);
    if (!c) { plans.push({ row: i, error: 'Invalid courseSourcedId' }); continue; }
    const subject = await q('SELECT id, code FROM subjects WHERE id = ?', [Number(c[1])]);
    if (!subject) { plans.push({ row: i, error: `Course not found: ${courseSourcedId}` }); continue; }
    const sectionName = classCode.startsWith(subject.code + '-')
      ? classCode.slice(subject.code.length + 1).trim() : classCode.trim();
    const section = sectionName ? await q('SELECT id FROM sections WHERE name = ?', [sectionName]) : null;
    if (!section) { plans.push({ row: i, error: `Section not found: ${sectionName || classCode}` }); continue; }
    const existing = await q(
      'SELECT id FROM class_assignments WHERE school_year = ? AND section_id = ? AND subject_id = ?',
      [termSourcedId, section.id, subject.id]);
    plans.push({
      row: i, action: existing ? 'update' : 'create', entity: 'class', summary: `${subject.code} · ${sectionName} · ${termSourcedId}`,
      data: { id: existing && existing.id, schoolYear: termSourcedId, sectionId: section.id, subjectId: subject.id, location },
    });
  }
  return plans;
}

async function applyClasses(plans) {
  const out = [];
  for (const p of plans) {
    if (p.error) { out.push(p); continue; }
    try {
      if (p.action === 'create') {
        const id = await qi(
          `INSERT INTO class_assignments (school_year, section_id, subject_id, duration_minutes, meetings_per_week, room)
           VALUES (?, ?, ?, 60, 1, ?)`,
          [p.data.schoolYear, p.data.sectionId, p.data.subjectId, p.data.location || null]);
        out.push({ ...p, status: 'created', createdId: id });
      } else {
        await qr(`UPDATE class_assignments SET room = COALESCE(?, room) WHERE id = ?`, [p.data.location || null, p.data.id]);
        out.push({ ...p, status: 'updated' });
      }
    } catch (e) { out.push({ ...p, error: e.message }); }
  }
  return out;
}

async function planEnrollments(rows) {
  const plans = [];
  let i = 0;
  for (const raw of rows) {
    i++;
    const classSourcedId = String(rowOf(raw, 'classSourcedId') || '').trim();
    const userSourcedId = String(rowOf(raw, 'userSourcedId') || '').trim();
    const cm = classSourcedId.match(/^class-(\d+)$/);
    const sm = userSourcedId.match(/^s-(\d+)$/);
    if (!cm || !sm) { plans.push({ row: i, error: 'Invalid classSourcedId/userSourcedId' }); continue; }
    const cls = await q('SELECT id, section_id, subject_id, school_year FROM class_assignments WHERE id = ?', [Number(cm[1])]);
    if (!cls) { plans.push({ row: i, error: `Class not found: ${classSourcedId}` }); continue; }
    const student = await q('SELECT id FROM students WHERE id = ?', [Number(sm[1])]);
    if (!student) { plans.push({ row: i, error: `Student not found: ${userSourcedId}` }); continue; }
    plans.push({
      row: i, action: 'enroll', entity: 'enrollment',
      summary: `student ${cls.section_id}/${cls.subject_id} ${cls.school_year}`,
      data: { studentId: student.id, sectionId: cls.section_id, subjectId: cls.subject_id, schoolYear: cls.school_year },
    });
  }
  return plans;
}

async function applyEnrollments(plans) {
  const out = [];
  for (const p of plans) {
    if (p.error) { out.push(p); continue; }
    try {
      let enr = await q(
        'SELECT id FROM enrollments WHERE student_id = ? AND section_id = ? AND school_year = ? AND status = ?',
        [p.data.studentId, p.data.sectionId, p.data.schoolYear, 'enrolled']);
      if (!enr) {
        const id = await qi(
          `INSERT INTO enrollments (student_id, section_id, school_year, grade_level, strand, status, enrolled_at)
           VALUES (?, ?, ?, (SELECT grade_level FROM students WHERE id = ?), (SELECT track_strand FROM students WHERE id = ?), 'enrolled', ${nowSql()})`,
          [p.data.studentId, p.data.sectionId, p.data.schoolYear, p.data.studentId, p.data.studentId]);
        enr = { id };
      }
      const hasSubj = await q('SELECT id FROM enrollment_subjects WHERE enrollment_id = ? AND subject_id = ?', [enr.id, p.data.subjectId]);
      if (!hasSubj) {
        await qi('INSERT INTO enrollment_subjects (enrollment_id, subject_id) VALUES (?, ?)', [enr.id, p.data.subjectId]);
      }
      out.push({ ...p, status: 'enrolled' });
    } catch (e) { out.push({ ...p, error: e.message }); }
  }
  return out;
}

const PLANNERS = { users: planUsers, courses: planCourses, classes: planClasses, enrollments: planEnrollments };
const APPLIERS = { users: applyUsers, courses: applyCourses, classes: applyClasses, enrollments: applyEnrollments };

async function planImport(fileType, rows) {
  const planner = PLANNERS[fileType];
  if (!planner) return { error: `Import is not supported for '${fileType}' (export only)` };
  const plans = await planner(rows);
  const errors = plans.filter((p) => p.error);
  const ok = plans.filter((p) => !p.error);
  return { fileType, total: rows.length, ok: ok.length, errors: errors.length, plans };
}

async function applyImport(fileType, plans) {
  const applier = APPLIERS[fileType];
  if (!applier) return { error: `Import is not supported for '${fileType}'` };
  const applied = await applier(plans);
  const errors = applied.filter((p) => p.error);
  return { fileType, total: applied.length, ok: applied.length - errors.length, errors: errors.length, results: applied };
}

function fileNameForType(type) {
  return `${type}.csv`;
}

module.exports = {
  FILES, COLUMNS, SCHOOL_NAME, SCHOOL_ID,
  buildFile, buildFileCsv, listFiles, parseCsv, fileNameForType, planImport, applyImport,
};
