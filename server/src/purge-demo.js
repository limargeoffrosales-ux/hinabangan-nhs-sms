const { q, qa, qr } = require('./db');

function log(label, n) {
  console.log(`PURGE: ${label}: ${n} row(s) removed`);
}

const DEMO_ANNOUNCEMENTS = [
  'Welcome to School Year 2025-2026',
  'First Quarter Examinations',
  'Teachers: DLL submission reminder',
];
const DEMO_TEACHERS = ['T-0001', 'T-0002', 'T-0003', 'T-0004', 'T-0005', 'T-0006', 'T-0007', 'T-0008'];
const DEMO_SECTIONS = ['ACAD 11-A', 'ACAD 11-B', 'TECHPRO 11-A', 'HUMSS 12-A', 'STEM 12-A', 'TVL-ICT 12-A'];
const DEMO_RESEARCH = [
  'Improving Oral Communication Skills of Grade 11 HUMSS Learners Through Structured Peer Discussions',
  'Gamified Review Quizzes in General Mathematics: Impact on Performance and Engagement',
  'Project READS: A Reading Enhancement Program for Struggling Grade 11 Readers',
];
const DEMO_QUESTIONS = [
  '%oral communication message%',
  '%active listening%',
  '%Evaluate: 3%',
  '%Which equation is linear%',
  '%thesis statement%',
  '%mean of 5 numbers%',
];

async function countAndDel(table, whereSql, params) {
  const n = Number((await qa(`SELECT COUNT(*) AS n FROM ${table} WHERE ${whereSql}`, params))[0].n);
  if (n > 0) await qr(`DELETE FROM ${table} WHERE ${whereSql}`, params);
  return n;
}

async function countWhere(selectSql, params) {
  const rows = await qa(selectSql, params);
  return rows.map((r) => r.id);
}

async function purgeDemo() {
  const already = await q('SELECT value FROM system_flags WHERE key = ?', ['purged_demo']);
  if (already) {
    console.log('PURGE: demo data already purged (one-shot) — skipping.');
    return;
  }

  const mark = (v) => qr(
    'INSERT INTO system_flags (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    ['purged_demo', v]);

  const studentIds = await countWhere(
    "SELECT id FROM students WHERE address LIKE '%Testville%'", []);
  const sid = studentIds.join(',') || '0';
  log('demo students', studentIds.length);

  const inClause = (ids) => (ids.length ? ids.join(',') : '0');

  log('attendance', await countAndDel('attendance', `student_id IN (${inClause(studentIds)})`, []));
  log('grades', await countAndDel('grades', `student_id IN (${inClause(studentIds)})`, []));
  log('enrollments', await countAndDel('enrollments', `student_id IN (${inClause(studentIds)})`, []));
  log('learner assessments', await countAndDel('learner_assessments', `student_id IN (${inClause(studentIds)})`, []));
  log('intervention plans', await countAndDel('intervention_plans', `student_id IN (${inClause(studentIds)})`, []));
  log('intervention contacts', await countAndDel(
    'intervention_contacts', `plan_id IN (SELECT id FROM intervention_plans WHERE student_id IN (${inClause(studentIds)}))`, []));

  log('research projects', await countAndDel(
    'research_projects',
    `title = ? OR title = ? OR title = ?`, DEMO_RESEARCH));
  log('research versions', await countAndDel(
    'research_versions',
    `project_id IN (SELECT id FROM research_projects WHERE title = ? OR title = ? OR title = ?)`, DEMO_RESEARCH));
  log('research milestones', await countAndDel(
    'research_milestones',
    `project_id IN (SELECT id FROM research_projects WHERE title = ? OR title = ? OR title = ?)`, DEMO_RESEARCH));

  const annCount = await countAndDel(
    'announcements', `title = ? OR title = ? OR title = ?`, DEMO_ANNOUNCEMENTS);
  log('announcements', annCount);

  const teacherIds = await countWhere('SELECT id FROM teachers WHERE employee_no IN (?,?,?,?,?,?,?,?)', DEMO_TEACHERS);
  log('demo teachers', teacherIds.length);
  const sectionIds = await countWhere(
    'SELECT id FROM sections WHERE name IN (?,?,?,?,?,?) AND school_year = ?', [...DEMO_SECTIONS, '2025-2026']);
  log('demo sections', sectionIds.length);

  const sIn = inClause(sectionIds);
  log('class assignments', await countAndDel('class_assignments', `section_id IN (${sIn})`, []));
  log('schedule entries', await countAndDel('schedule_entries', `section_id IN (${sIn})`, []));

  log('question bank (demo)', await countAndDel(
    'question_bank', `question LIKE ? OR question LIKE ? OR question LIKE ? OR question LIKE ? OR question LIKE ? OR question LIKE ?`,
    DEMO_QUESTIONS));
  log('rubrics (demo)', await countAndDel('rubrics', `title = ?`, ['Oral Presentation Rubric']));
  log('TOS (demo)', await countAndDel('tos_records', `title = ?`, ['First Quarter TOS — Oral Communication']));
  log('item analyses (demo)', await countAndDel('item_analyses', `title = ?`, ['Q1 General Mathematics Item Analysis']));

  log('sections', await countAndDel('sections', `id IN (${sIn})`, []));
  log('teachers', await countAndDel('teachers', `id IN (${inClause(teacherIds)})`, []));
  log('students', await countAndDel('students', `id IN (${sid})`, []));
  console.log('PURGE: subjects kept — the SHS curriculum catalog is preserved (migration-managed).');

  await mark('1');
  console.log('PURGE: demo data removed. System is now production-ready (one-shot flag saved).');
}

module.exports = { purgeDemo };