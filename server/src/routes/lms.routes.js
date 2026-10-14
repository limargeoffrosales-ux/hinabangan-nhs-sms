const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');
const { getCurrentSchoolYear, DEFAULT_SCHOOL_YEAR } = require('../schoolYear');
const { teacherForUser, linkedStudentIds } = require('../scope');
const { requireLm, loadSpace } = require('../middleware/lms-authz');

const router = express.Router();
router.use(authenticate);
router.use(requireLm());

const WRITE = ['teacher'];
const READ_STUDENT = ['student'];

async function findTeacher() {
  return teacherForUser({ role: 'teacher', id: null });
}

router.get('/spaces', asyncH(async (req, res) => {
  const sy = req.query.school_year || getCurrentSchoolYear() || DEFAULT_SCHOOL_YEAR;
  if (req.role === 'teacher') {
    const t = await teacherForUser(req.user);
    if (!t) return res.json({ data: [], limit: 50, offset: 0 });
    const rows = await qa(
      `SELECT s.*, sec.name AS section_name, sec.grade_level, sec.strand,
              sub.code AS subject_code, sub.title AS subject_title
       FROM lm_spaces s
       LEFT JOIN sections sec ON sec.id = s.section_id
       LEFT JOIN subjects sub ON sub.id = s.subject_id
       WHERE s.teacher_id = ? AND s.school_year = ?
       ORDER BY sec.name, sub.title`,
      [t.id, sy]
    );
    return res.json({ data: rows, limit: 50, offset: 0 });
  }

  if (req.role === 'student') {
    const ids = await linkedStudentIds(req.user);
    if (!ids || ids.length === 0) return res.json({ data: [], limit: 50, offset: 0 });
    const st = await q('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!st) return res.json({ data: [], limit: 50, offset: 0 });
    const rows = await qa(
      `SELECT s.*, sec.name AS section_name, sec.grade_level, sec.strand,
              sub.code AS subject_code, sub.title AS subject_title,
              t.first_name AS teacher_first, t.last_name AS teacher_last
       FROM lm_spaces s
       JOIN enrollments e ON e.section_id = s.section_id AND e.school_year = s.school_year AND e.status='enrolled'
       JOIN enrollment_subjects es ON es.enrollment_id = e.id AND es.subject_id = s.subject_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       LEFT JOIN subjects sub ON sub.id = s.subject_id
       LEFT JOIN teachers t ON t.id = s.teacher_id
       WHERE e.student_id = ? AND s.school_year = ?
       ORDER BY sec.name, sub.title`,
      [st.id, sy]
    );
    return res.json({ data: rows, limit: 50, offset: 0 });
  }

  return res.json({ data: [], limit: 50, offset: 0 });
}));

router.get('/spaces/:spaceId', loadSpace, asyncH(async (req, res) => {
  res.json(req.space);
}));

router.post('/spaces/sync', requireRole(...WRITE), asyncH(async (req, res) => {
  const sy = req.query.school_year || getCurrentSchoolYear() || DEFAULT_SCHOOL_YEAR;
  const t = await teacherForUser(req.user);
  if (!t) return res.status(403).json({ error: 'No teacher profile linked to your account' });
  const cas = await qa(
    `SELECT ca.id, ca.section_id, ca.subject_id, ca.school_year, s.name AS section_name, sub.title AS subject_title
     FROM class_assignments ca
     LEFT JOIN sections s ON s.id = ca.section_id
     LEFT JOIN subjects sub ON sub.id = ca.subject_id
     WHERE ca.teacher_id = ? AND ca.school_year = ?`,
    [t.id, sy]
  );
  let created = 0;
  let existing = 0;
  for (const ca of cas) {
    const found = await q(
      'SELECT id FROM lm_spaces WHERE school_year=? AND section_id=? AND subject_id=? AND teacher_id=?',
      [ca.school_year, ca.section_id, ca.subject_id, t.id]
    );
    if (found) {
      existing += 1;
      continue;
    }
    const id = await qi(
      'INSERT INTO lm_spaces (school_year, section_id, subject_id, teacher_id, class_assignment_id, title) VALUES (?, ?, ?, ?, ?, ?)',
      [ca.school_year, ca.section_id, ca.subject_id, t.id, ca.id || null, `${ca.section_name || ca.section_id} - ${ca.subject_title || ca.subject_id}`]
    );
    await audit(req, 'CREATE_LM_SPACE', 'lm_spaces', id, { class_assignment_id: ca.id });
    created += 1;
  }
  res.json({ ok: true, created, existing, total: cas.length });
}));

module.exports = router;
