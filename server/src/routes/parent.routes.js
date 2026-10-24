const express = require('express');
const { q, qa } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH } = require('../utils');
const { linkedStudentIds, ensurePortalSeesStudent } = require('../scope');

const router = express.Router();
router.use(authenticate);

const PARENT_ROLES = ['parent', 'guardian'];

// Resolve the target student for a parent request. Honors studentId route
// params but only when the student is linked to this caller.
async function resolveChild(req, res, studentId) {
  const check = await ensurePortalSeesStudent(req.user, Number(studentId));
  if (!check.ok) {
    res.status(403).json({ error: "You do not have access to this student's records" });
    return null;
  }
  return Number(studentId);
}

// GET /students — all children linked to this parent/guardian.
router.get('/students', requireRole(...PARENT_ROLES), asyncH(async (req, res) => {
  const ids = await linkedStudentIds(req.user);
  if (!ids || !ids.length) return res.json({ data: [] });
  const rows = await qa(
    `SELECT s.id, s.lrn, s.first_name, s.middle_name, s.last_name, s.suffix, s.sex,
            s.birth_date, s.grade_level, s.status,
            (SELECT sec.name FROM enrollments e JOIN sections sec ON sec.id = e.section_id
              WHERE e.student_id = s.id AND e.status = 'enrolled'
              ORDER BY e.school_year DESC, e.id DESC LIMIT 1) AS section_name
     FROM students s
     WHERE s.id IN (${ids.map(() => '?').join(',')})
     ORDER BY s.last_name, s.first_name`,
    ids);
  res.json({ data: rows });
}));

// GET /students/:studentId — a linked child's profile.
router.get('/students/:studentId', requireRole(...PARENT_ROLES), asyncH(async (req, res) => {
  const studentId = await resolveChild(req, res, req.params.studentId);
  if (!studentId) return undefined;
  const student = await q(
    `SELECT s.id, s.lrn, s.first_name, s.middle_name, s.last_name, s.suffix, s.sex,
            s.birth_date, s.birth_place, s.religion, s.address, s.contact,
            s.guardian_name, s.guardian_contact, s.guardian_relation,
            s.grade_level, s.status,
            (SELECT sec.name FROM enrollments e JOIN sections sec ON sec.id = e.section_id
              WHERE e.student_id = s.id AND e.status = 'enrolled'
              ORDER BY e.school_year DESC, e.id DESC LIMIT 1) AS section_name
     FROM students s WHERE s.id = ?`,
    [studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json({ data: student });
}));

// GET /students/:studentId/grades — linked child's grades.
router.get('/students/:studentId/grades', requireRole(...PARENT_ROLES), asyncH(async (req, res) => {
  const studentId = await resolveChild(req, res, req.params.studentId);
  if (!studentId) return undefined;
  const rows = await qa(
    `SELECT g.school_year, g.quarter, g.written_work, g.performance_task,
            g.quarterly_exam, g.computed_grade, g.remarks, su.code, su.title AS subject_name
     FROM grades g
     JOIN subjects su ON su.id = g.subject_id
     WHERE g.student_id = ?
     ORDER BY g.school_year, g.quarter, su.code`,
    [studentId]);
  res.json({ data: rows });
}));

// GET /students/:studentId/attendance — linked child's attendance record.
router.get('/students/:studentId/attendance', requireRole(...PARENT_ROLES), asyncH(async (req, res) => {
  const studentId = await resolveChild(req, res, req.params.studentId);
  if (!studentId) return undefined;
  const rows = await qa(
    `SELECT date, status, time_in, time_out, remarks
     FROM attendance
     WHERE student_id = ?
     ORDER BY date DESC
     LIMIT 90`,
    [studentId]);
  res.json({ data: rows });
}));

// GET /students/:studentId/interventions — linked child's intervention plans.
router.get('/students/:studentId/interventions', requireRole(...PARENT_ROLES), asyncH(async (req, res) => {
  const studentId = await resolveChild(req, res, req.params.studentId);
  if (!studentId) return undefined;
  const rows = await qa(
    `SELECT p.id, p.title, p.category, p.strategy, p.frequency, p.start_date, p.end_date,
            p.status, p.progress_notes, p.created_at, p.updated_at, u.name AS recorder_name
     FROM intervention_plans p
     LEFT JOIN users u ON u.id = p.recorded_by
     WHERE p.student_id = ?
     ORDER BY p.updated_at DESC`,
    [studentId]);
  res.json({ data: rows });
}));

// GET /students/:studentId/consents — linked child's consent forms & signature status.
router.get('/students/:studentId/consents', requireRole(...PARENT_ROLES), asyncH(async (req, res) => {
  const studentId = await resolveChild(req, res, req.params.studentId);
  if (!studentId) return undefined;
  const rows = await qa(
    `SELECT f.id, f.title, f.description, f.form_type,
            cr.status, cr.signature_name, cr.signed_at
     FROM consent_forms f
     LEFT JOIN consent_responses cr
       ON cr.form_id = f.id AND cr.user_id = ? AND cr.student_id = ?
     WHERE f.is_active = TRUE
     ORDER BY f.created_at DESC`,
    [req.user.id, studentId]);
  res.json({ data: rows });
}));

// GET /access-logs — recent access-log entries for the caller's children.
router.get('/access-logs', requireRole(...PARENT_ROLES), asyncH(async (req, res) => {
  const ids = await linkedStudentIds(req.user);
  if (!ids || !ids.length) return res.json({ data: [], total: 0 });
  const conditions = [`dal.student_id IN (${ids.map(() => '?').join(',')})`];
  const params = [...ids];
  const { action, from, to } = req.query;
  if (action && String(action).length <= 40) {
    conditions.push('dal.action = ?');
    params.push(String(action));
  }
  if (from) {
    const d = new Date(String(from));
    if (!Number.isNaN(d.getTime())) { conditions.push('dal.created_at >= ?'); params.push(d); }
  }
  if (to) {
    const d = new Date(String(to));
    if (!Number.isNaN(d.getTime())) { conditions.push('dal.created_at <= ?'); params.push(d); }
  }
  const rows = await qa(
    `SELECT dal.id, dal.user_id, dal.student_id, dal.action, dal.ip, dal.created_at,
            u.name AS user_name, s.first_name, s.last_name
     FROM data_access_logs dal
     LEFT JOIN users u ON u.id = dal.user_id
     LEFT JOIN students s ON s.id = dal.student_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY dal.created_at DESC LIMIT 50`,
    params);
  const totalRow = await qa(
    `SELECT COUNT(*) AS n FROM data_access_logs dal
     WHERE ${conditions.join(' AND ')}`,
    params);
  res.json({ data: rows, total: Number(totalRow[0]?.n || 0), limit: 50, offset: 0 });
}));

// GET /consents/signed — consent responses signed by this parent/guardian.
router.get('/consents/signed', requireRole(...PARENT_ROLES), asyncH(async (req, res) => {
  const ids = await linkedStudentIds(req.user);
  const childFilter = ids && ids.length
    ? `AND (cr.student_id IS NULL OR cr.student_id IN (${ids.map(() => '?').join(',')}))`
    : 'AND cr.student_id IS NULL';
  const params = ids && ids.length ? [req.user.id, ...ids] : [req.user.id];
  const rows = await qa(
    `SELECT cr.id, cr.form_id, cr.status, cr.signature_name, cr.signed_at,
            f.title AS form_title, f.form_type,
            s.first_name AS student_first, s.last_name AS student_last, s.lrn
     FROM consent_responses cr
     JOIN consent_forms f ON f.id = cr.form_id
     LEFT JOIN students s ON s.id = cr.student_id
     WHERE cr.user_id = ? ${childFilter}
     ORDER BY cr.signed_at DESC LIMIT 20`,
    params);
  res.json({ data: rows });
}));

// GET /erasure-requests/pending — pending erasure requests for the caller's children.
router.get('/erasure-requests/pending', requireRole(...PARENT_ROLES), asyncH(async (req, res) => {
  const ids = await linkedStudentIds(req.user);
  if (!ids || !ids.length) return res.json({ data: [] });
  const rows = await qa(
    `SELECT er.id, er.student_id, er.status, er.reason, er.created_at,
            s.first_name AS student_first, s.last_name AS student_last, s.lrn
     FROM data_erasure_requests er
     LEFT JOIN students s ON s.id = er.student_id
     WHERE er.status = 'pending'
       AND er.student_id IN (${ids.map(() => '?').join(',')})
     ORDER BY er.created_at DESC LIMIT 10`,
    ids);
  res.json({ data: rows });
}));

module.exports = router;