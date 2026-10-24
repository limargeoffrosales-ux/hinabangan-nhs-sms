const { q, qa, qr } = require('./db');
const logger = require('./logger');
const { getCurrentSchoolYear } = require('./schoolYear');
const { deleteFile, fileKeyFromUrl } = require('./storage');

function log(label, n) {
  logger.info({ table: label, removed: n }, 'PURGE: rows removed');
}

let DEMO_SCHOOL_YEAR = null;

async function initDemoSchoolYear() {
  DEMO_SCHOOL_YEAR = await getCurrentSchoolYear();
}

const DEMO_ANNOUNCEMENTS = () => [
  `Welcome to School Year ${DEMO_SCHOOL_YEAR || '2026-2027'}`,
  'First Quarter Examinations',
  'Teachers: DLL submission reminder',
];
const DEMO_TEACHERS = ['T-0001', 'T-0002', 'T-0003', 'T-0004', 'T-0005', 'T-0006', 'T-0007', 'T-0008'];
const DEMO_SECTIONS = ['ACAD 11-A', 'ACAD 11-B', 'TECHPRO 11-A', 'HUMSS 12-A', 'STEM 12-A', 'TVL-ICT 12-A'];
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

function placeholders(ids) {
  return ids.map(() => '?').join(',');
}

async function purgeStudentPhotos(studentIds) {
  if (!studentIds.length) return;
  const rows = await qa(
    `SELECT id, photo_url FROM students WHERE id IN (${placeholders(studentIds)}) AND photo_url IS NOT NULL AND photo_url <> ''`,
    studentIds);
  let removed = 0;
  for (const r of rows) {
    try {
      const key = fileKeyFromUrl(r.photo_url);
      if (key) {
        await deleteFile(key);
        removed += 1;
      }
    } catch (err) {
      logger.warn({ err: err.message, id: r.id }, 'PURGE: failed to remove student photo object');
    }
  }
  if (removed) logger.info({ objects: removed }, 'PURGE: R2 student photo objects removed');
}

async function purgeDemo() {
  if (process.env.PURGE_DEMO !== '1') {
    logger.info('PURGE: skipped (set PURGE_DEMO=1 to remove demo data on boot)');
    return;
  }
  await initDemoSchoolYear();
  const already = await q('SELECT value FROM system_flags WHERE key = ?', ['purged_demo']);
  if (already) {
    logger.info('PURGE: demo data already purged (one-shot) — skipping.');
    return;
  }

  const mark = (v) => qr(
    'INSERT INTO system_flags (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    ['purged_demo', v]);

  const studentIds = await countWhere(
    "SELECT id FROM students WHERE address LIKE '%Testville%'", []);
  log('demo students', studentIds.length);

  const sidPlaceholders = placeholders(studentIds);
  log('attendance', await countAndDel('attendance', `student_id IN (${sidPlaceholders})`, studentIds));
  log('grades', await countAndDel('grades', `student_id IN (${sidPlaceholders})`, studentIds));
  log('enrollments', await countAndDel('enrollments', `student_id IN (${sidPlaceholders})`, studentIds));
  log('learner assessments', await countAndDel('learner_assessments', `student_id IN (${sidPlaceholders})`, studentIds));
  log('intervention plans', await countAndDel('intervention_plans', `student_id IN (${sidPlaceholders})`, studentIds));
  log('intervention contacts', await countAndDel(
    'intervention_contacts', `plan_id IN (SELECT id FROM intervention_plans WHERE student_id IN (${sidPlaceholders}))`, studentIds));

  const annCount = await countAndDel(
    'announcements', `title = ? OR title = ? OR title = ?`, DEMO_ANNOUNCEMENTS);
  log('announcements', annCount);

  const teacherIds = await countWhere('SELECT id FROM teachers WHERE employee_no IN (?,?,?,?,?,?,?,?)', DEMO_TEACHERS);
  log('demo teachers', teacherIds.length);
  const sectionIds = await countWhere(
    'SELECT id FROM sections WHERE name IN (?,?,?,?,?,?) AND school_year = ?', [...DEMO_SECTIONS, DEMO_SCHOOL_YEAR]);
  log('demo sections', sectionIds.length);

  const secPlaceholders = placeholders(sectionIds);
  log('class assignments', await countAndDel('class_assignments', `section_id IN (${secPlaceholders})`, sectionIds));
  log('schedule entries', await countAndDel('schedule_entries', `section_id IN (${secPlaceholders})`, sectionIds));

  log('question bank (demo)', await countAndDel(
    'question_bank', `question LIKE ? OR question LIKE ? OR question LIKE ? OR question LIKE ? OR question LIKE ? OR question LIKE ?`,
    DEMO_QUESTIONS));
  log('rubrics (demo)', await countAndDel('rubrics', `title = ?`, ['Oral Presentation Rubric']));
  log('TOS (demo)', await countAndDel('tos_records', `title = ?`, ['First Quarter TOS — Oral Communication']));
  log('item analyses (demo)', await countAndDel('item_analyses', `title = ?`, ['Q1 General Mathematics Item Analysis']));

  log('sections', await countAndDel('sections', `id IN (${secPlaceholders})`, sectionIds));
  const tchPlaceholders = placeholders(teacherIds);
  log('teachers', await countAndDel('teachers', `id IN (${tchPlaceholders})`, teacherIds));
  await purgeStudentPhotos(studentIds);
  log('students', await countAndDel('students', `id IN (${sidPlaceholders})`, studentIds));
  logger.info('PURGE: subjects kept — the SHS curriculum catalog is preserved (migration-managed).');

  await mark('1');
  logger.info('PURGE: demo data removed. System is now production-ready (one-shot flag saved).');
}

module.exports = { purgeDemo };
