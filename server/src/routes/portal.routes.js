const express = require('express');
const db = require('../db');
const { q, qa } = db;
const { authenticate, requireRole } = require('../auth');
const { asyncH } = require('../utils');
const { linkedStudentIds } = require('../scope');
const { getCurrentSchoolYear } = require('../schoolYear');
const { finalsForStudents, round2 } = require('../grading/analytics');
const { getDefaultScale, getScaleForSubject, convertGrade } = require('../grading/scales');

const router = express.Router();
router.use(authenticate);
const PORTAL = ['student', 'parent'];

// "2026-2027" -> "2027-2028"
function nextSchoolYear(sy) {
  const m = String(sy || '').match(/^(\d{4})-(\d{4})$/);
  if (!m) return '2027-2028';
  const start = Number(m[1]);
  return `${start + 1}-${start + 2}`;
}

// Latest registration / link-request status for a role='student' caller.
async function portalLinkRequest(userId) {
  const row = await q(
    `SELECT status, notes, created_at FROM student_link_requests
     WHERE user_id = ? ORDER BY id DESC LIMIT 1`, [userId]);
  return row || null;
}

// Resolve the target student for a portal request. Honors an explicit
// student_id query param (multi-child parents) but only when it belongs to
// the caller; otherwise falls back to the first linked student.
async function resolvePortalStudent(ids, req, res) {
  const raw = req.query && req.query.student_id;
  if (raw != null && raw !== '') {
    const n = Number(raw);
    if (!ids.includes(n)) {
      res.status(403).json({ error: "You do not have access to this student's records" });
      return null;
    }
    return n;
  }
  return ids[0];
}

function computeAge(birthdate) {
  if (!birthdate) return null;
  const birth = new Date(birthdate + 'T00:00:00');
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const STUDENT_FIELDS = 'id, lrn, first_name, middle_name, last_name, suffix, grade_level, track_strand, status, birth_date';

async function loadStudentRows(ids) {
  if (!ids || !ids.length) return new Map();
  const rows = await qa(`SELECT ${STUDENT_FIELDS} FROM students WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  return new Map(rows.map((r) => [Number(r.id), { ...r, age: r.birth_date ? computeAge(r.birth_date) : null }]));
}

async function loadCurrentSections(ids) {
  const map = new Map();
  if (!ids || !ids.length) return map;
  const rows = await qa(
    `SELECT e.student_id, sec.id AS section_id, sec.name AS section_name,
            sec.grade_level, e.school_year
     FROM enrollments e JOIN sections sec ON sec.id = e.section_id
     JOIN (
       SELECT student_id, MAX(school_year) AS sy FROM enrollments
       WHERE student_id IN (${ids.map(() => '?').join(',')}) AND status = 'enrolled'
       GROUP BY student_id
     ) latest ON latest.student_id = e.student_id AND latest.sy = e.school_year
     WHERE e.student_id IN (${ids.map(() => '?').join(',')}) AND e.status = 'enrolled'`,
    [...ids, ...ids]);
  for (const r of rows) map.set(Number(r.student_id), r);
  return map;
}

async function loadStuSections(ids, schoolYear) {
  const map = new Map();
  if (!ids || !ids.length) return map;
  const rows = await qa(
    `SELECT e.student_id, sec.id AS section_id, sec.name AS section_name, sec.grade_level
     FROM enrollments e JOIN sections sec ON sec.id = e.section_id
     WHERE e.student_id IN (${ids.map(() => '?').join(',')}) AND e.school_year = ? AND e.status = 'enrolled'`,
    [...ids, schoolYear]);
  for (const r of rows) map.set(Number(r.student_id), r);
  return map;
}

// Attendance summary for all students at once (single GROUP BY query).
async function attendanceSummaries(ids, schoolYear) {
  const map = new Map();
  if (!ids || !ids.length) return map;
  const rows = await qa(
    `SELECT student_id, status, COUNT(*) AS n
     FROM attendance
     WHERE student_id IN (${ids.map(() => '?').join(',')}) AND substr(CAST(date AS TEXT), 1, 4) = ?
     GROUP BY student_id, status`,
    [...ids, String(schoolYear).slice(0, 4)]);
  for (const id of ids) map.set(Number(id), { counts: { present: 0, absent: 0, late: 0, excused: 0 }, total: 0, rate: null });
  for (const r of rows) {
    const sid = Number(r.student_id);
    const entry = map.get(sid);
    if (!entry) continue;
    entry.counts[r.status] = (entry.counts[r.status] || 0) + Number(r.n);
    entry.total += Number(r.n);
  }
  for (const [, entry] of map) {
    if (entry.total) entry.rate = round2(((entry.counts.present + entry.counts.late) / entry.total) * 100);
  }
  return map;
}

// GET /me — portal user identity + linked students (with current section).
router.get('/me', requireRole(...PORTAL), asyncH(async (req, res) => {
  const ids = await linkedStudentIds(req.user);
  const stMap = await loadStudentRows(ids);
  const secMap = await loadCurrentSections(ids);
  const students = ids
    .filter((id) => stMap.has(Number(id)))
    .map((id) => {
      const idNum = Number(id);
      const enr = secMap.get(idNum);
      return { ...stMap.get(idNum), section: enr ? { section_id: enr.section_id, section_name: enr.section_name, school_year: enr.school_year } : null };
    });
  res.json({
    user: { id: req.user.id, username: req.user.username, name: req.user.name, role: req.user.role },
    students,
    link_request: req.user.role === 'student' ? await portalLinkRequest(req.user.id) : null,
  });
}));

// GET /overview?school_year= — at-a-glance data for the portal home:
// per linked student (section, GWA, GPA, credits, attendance) + latest announcements.
router.get('/overview', requireRole(...PORTAL), asyncH(async (req, res) => {
  const { school_year } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });
  const announcements = await qa(
    `SELECT a.id, a.title, a.body, a.created_at, u.name AS author_name
     FROM announcements a LEFT JOIN users u ON u.id = a.author_id
     ORDER BY a.created_at DESC LIMIT 3`);
  const ids = await linkedStudentIds(req.user);
  const [stMap, secMap, sumMap, attMap] = await Promise.all([
    loadStudentRows(ids),
    loadStuSections(ids, school_year),
    finalsForStudents(ids, school_year),
    attendanceSummaries(ids, school_year),
  ]);
  const students = ids
    .filter((id) => stMap.has(Number(id)))
    .map((id) => {
      const idNum = Number(id);
      const section = secMap.get(idNum) || null;
      const summary = sumMap.get(idNum) || {};
      return {
        ...stMap.get(idNum),
        section: section ? { section_id: section.section_id, section_name: section.section_name, section_grade_level: section.grade_level } : null,
        gwa: summary.gwa,
        gpa: summary.gpa,
        weighted_gpa: summary.weighted_gpa,
        credits: { earned: summary.credits_earned, total: summary.credits_total },
        attendance: attMap.get(idNum) || { counts: { present: 0, absent: 0, late: 0, excused: 0 }, total: 0, rate: null },
      };
    });
  res.json({ school_year, announcements, students, link_request: req.user.role === 'student' ? await portalLinkRequest(req.user.id) : null });
}));

// GET /enrollment-options — sections open for SELF-SERVICE application to the
// next (upcoming) school year, plus the caller's past applications.
router.get('/enrollment-options', requireRole(...PORTAL), asyncH(async (req, res) => {
  const ids = await linkedStudentIds(req.user);
  const studentId = await resolvePortalStudent(ids, req, res);
  if (!studentId) return res.json({ current_school_year: null, next_school_year: null, sections: [] });
  const currentSy = await getCurrentSchoolYear();
  const enrollments = await qa(
    `SELECT e.*, s.name AS section_name FROM enrollments e LEFT JOIN sections s ON s.id = e.section_id
     WHERE e.student_id = ? ORDER BY e.school_year DESC`,
    [studentId]);
  const sections = await qa(
    `SELECT sec.id, sec.name, sec.grade_level, sec.strand, sec.school_year, sec.capacity,
            (SELECT COUNT(*) FROM enrollments e
              WHERE e.section_id = sec.id AND e.school_year = sec.school_year AND e.status = 'enrolled') AS enrolled_count,
            (SELECT COUNT(*) FROM enrollments e
              WHERE e.section_id = sec.id AND e.school_year = sec.school_year AND e.status = 'pending') AS pending_count
     FROM sections sec
     WHERE sec.school_year = ? AND sec.status = 'active'
     ORDER BY sec.grade_level, sec.name`,
    [nextSchoolYear(currentSy)]);
  res.json({
    current_school_year: currentSy,
    next_school_year: nextSchoolYear(currentSy),
    sections: sections.map((s) => ({ ...s, capacity: Number(s.capacity || 0), enrolled_count: Number(s.enrolled_count || 0), pending_count: Number(s.pending_count || 0) })),
    enrollments,
  });
}));

router.get('/my-immersion', requireRole(...PORTAL), asyncH(async (req, res) => {
  const ids = await linkedStudentIds(req.user);
  const studentId = await resolvePortalStudent(ids, req, res);
  if (!studentId) return res.json({ data: [] });
  const rows = await qa(
    `SELECT wi.* FROM work_immersion wi WHERE wi.student_id = ? ORDER BY wi.batch DESC, wi.program`,
    [studentId]);
  if (rows.length) {
    const attRows = await qa(
      `SELECT ia.immersion_id, ia.date, ia.status, ia.time_in, ia.time_out, ia.hours, ia.remarks
       FROM immersion_attendance ia
       JOIN work_immersion wi ON wi.id = ia.immersion_id
       WHERE wi.student_id = ? ORDER BY ia.date`,
      [studentId]);
    const byPlacement = {};
    for (const a of attRows) {
      (byPlacement[a.immersion_id] = byPlacement[a.immersion_id] || []).push(a);
    }
    for (const r of rows) {
      const att = byPlacement[r.id] || [];
      const counts = { present: 0, absent: 0, late: 0, excused: 0 };
      for (const a of att) counts[a.status] = (counts[a.status] || 0) + 1;
      const total = att.length;
      const presentAndLate = counts.present + counts.late;
      r.attendance = att;
      r.attendance_counts = counts;
      r.attendance_total = total;
      r.attendance_rate = total ? Math.round((presentAndLate / total) * 100) : null;
    }
  }
  res.json({ data: rows });
}));

router.get('/today-schedule', requireRole(...PORTAL), asyncH(async (req, res) => {
  const ids = await linkedStudentIds(req.user);
  const studentId = await resolvePortalStudent(ids, req, res);
  if (!studentId) return res.json({ data: [] });
  // schedule_entries.day is INTEGER (1=Mon .. 5=Fri); Date.getDay() is 0=Sun..6=Sat
  const today = new Date().getDay();
  if (today > 5) return res.json({ data: [] });
  const { school_year } = req.query;
  const rows = await qa(
    `SELECT se.*, sub.code AS subject_code, sub.title AS subject_title,
            t.first_name || ' ' || t.last_name AS teacher_name, sec.name AS section_name
     FROM schedule_entries se
     JOIN subjects sub ON sub.id = se.subject_id
     JOIN teachers t ON t.id = se.teacher_id
     JOIN sections sec ON sec.id = se.section_id
     JOIN enrollments e ON e.section_id = se.section_id AND e.school_year = se.school_year AND e.status = 'enrolled'
     WHERE e.student_id = ? AND se.day = ? ${school_year ? 'AND se.school_year = ?' : ''}
     ORDER BY se.start_time`,
    school_year ? [studentId, today, school_year] : [studentId, today]);
  res.json({ data: rows });
}));

router.get('/upcoming-assignments', requireRole(...PORTAL), asyncH(async (req, res) => {
  const ids = await linkedStudentIds(req.user);
  const studentId = await resolvePortalStudent(ids, req, res);
  if (!studentId) return res.json({ data: [] });
  const { school_year } = req.query;
  const todayStr = new Date().toISOString().slice(0, 10);
  const rows = await qa(
    `SELECT a.id, a.title, a.due_date, a.description, sub.code AS subject_code, sub.title AS subject_title,
            asub.status AS submission_status
     FROM assignments a
     JOIN class_assignments ca ON ca.id = a.class_assignment_id
     JOIN subjects sub ON sub.id = ca.subject_id
     JOIN enrollments e ON e.section_id = ca.section_id AND e.school_year = a.school_year AND e.status = 'enrolled'
     LEFT JOIN assignment_submissions asub ON asub.assignment_id = a.id AND asub.student_id = ?
     WHERE e.student_id = ? ${school_year ? 'AND a.school_year = ?' : ''}
       AND (a.due_date IS NULL OR a.due_date >= ?)
       AND asub.id IS NULL
     ORDER BY a.due_date IS NULL, a.due_date ASC
     LIMIT 10`,
    school_year ? [studentId, studentId, school_year, todayStr] : [studentId, studentId, todayStr]);
  res.json({ data: rows });
}));

router.get('/report-card', requireRole(...PORTAL), asyncH(async (req, res) => {
  const ids = await linkedStudentIds(req.user);
  const studentId = await resolvePortalStudent(ids, req, res);
  if (!studentId) return res.json({ subjects: [], general_average: null });
  const { school_year, term } = req.query;
  if (!school_year || !term) return res.status(400).json({ error: 'school_year and term are required' });
  const period = String(term).trim();
  if (!/^[1-3]$/.test(period)) return res.status(400).json({ error: 'term must be 1, 2 or 3' });
  const rows = await qa(
    `SELECT g.subject_id, su.code, su.title, g.written_work, g.performance_task, g.quarterly_exam, g.computed_grade, g.remarks
     FROM grades g JOIN subjects su ON su.id = g.subject_id
     WHERE g.student_id = ? AND g.school_year = ? AND g.quarter = ? ORDER BY su.code`,
    [studentId, school_year, period]);
  const withGrades = rows.filter((r) => r.computed_grade != null);
  const average = withGrades.length
    ? Math.round(withGrades.reduce((a, r) => a + Number(r.computed_grade), 0) / withGrades.length * 100) / 100
    : null;
  res.json({ subjects: rows, general_average: average, school_year, term: Number(period) });
}));

// Batches an entire evaluation for one linked student in a single call:
// per-term subject rows (with scale conversion), finals, summary + attendance.
// Used by the portal Grades page so students/parents see the full school year
// (Q1, Q2, Q3 + finals) without N round-trips.
router.get('/report-card-full', requireRole(...PORTAL), asyncH(async (req, res) => {
  const ids = await linkedStudentIds(req.user);
  const studentId = await resolvePortalStudent(ids, req, res);
  if (!studentId) return res.json({ student: null, school_year: null, terms: [], finals: [], summary: null, attendance: null });
  const { school_year } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });
  const student = await q('SELECT * FROM students WHERE id = ?', [studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const rows = await qa(
    `SELECT g.quarter, g.subject_id, su.code, su.title, g.written_work, g.performance_task, g.quarterly_exam, g.computed_grade, g.remarks
     FROM grades g JOIN subjects su ON su.id = g.subject_id
     WHERE g.student_id = ? AND g.school_year = ? ORDER BY su.code, g.quarter`,
    [studentId, school_year]);
  const defaultScale = await getDefaultScale();
  const scaleCache = {};
  const convertRow = async (r) => {
    let scale = r.subject_id && scaleCache[r.subject_id] ? scaleCache[r.subject_id] : null;
    if (!scale) {
      scale = r.subject_id ? ((await getScaleForSubject(r.subject_id)) || defaultScale) : defaultScale;
      if (r.subject_id) scaleCache[r.subject_id] = scale;
    }
    const conv = r.computed_grade != null ? convertGrade(r.computed_grade, scale) : null;
    return {
      subject_id: Number(r.subject_id), code: r.code, title: r.title,
      written_work: r.written_work, performance_task: r.performance_task,
      quarterly_exam: r.quarterly_exam, computed_grade: r.computed_grade, remarks: r.remarks,
      letter: conv && conv.letter, points: conv && conv.points,
      proficiency: conv && conv.proficiency, passed: conv ? conv.passed : null,
    };
  };
  const byTerm = { 1: [], 2: [], 3: [] };
  for (const r of rows) (byTerm[Number(r.quarter)] = byTerm[Number(r.quarter)] || []).push(r);
  const terms = [];
  for (const t of [1, 2, 3]) {
    const subj = byTerm[t] || [];
    const conv = [];
    for (const r of subj) conv.push(await convertRow(r));
    const withGrades = conv.filter((s) => s.computed_grade != null);
    const general_average = withGrades.length
      ? Math.round(withGrades.reduce((a, s) => a + Number(s.computed_grade), 0) / withGrades.length * 100) / 100
      : null;
    terms.push({ term: t, subjects: conv, general_average });
  }
  const fin = (await finalsForStudents([studentId], school_year)).get(studentId);
  const summary = fin ? {
    gwa: fin.gwa, gpa: fin.gpa, weighted_gpa: fin.weighted_gpa,
    credits_earned: fin.credits_earned, credits_total: fin.credits_total,
  } : null;
  const finals = fin ? fin.subjects : [];
  const att = (await attendanceSummaries([studentId], school_year)).get(studentId) || null;
  const attendance = att || { counts: { present: 0, absent: 0, late: 0, excused: 0 }, total: 0, rate: null };
  res.json({ student, school_year, terms, finals, summary, attendance });
}));

/* ── Student certifications ───────────────────────── */
router.get('/certifications', requireRole(...PORTAL), asyncH(async (req, res) => {
  const ids = await linkedStudentIds(req.user);
  if (!ids.length) return res.json({ data: [] });
  const rows = await qa(
    `SELECT * FROM certifications WHERE student_id IN (${ids.map(() => '?').join(',')}) ORDER BY date_acquired DESC`,
    ids);
  res.json({ data: rows });
}));

/* ── Teacher contacts for linked student ─────────── */
router.get('/teacher-contacts', requireRole(...PORTAL), asyncH(async (req, res) => {
  const ids = await linkedStudentIds(req.user);
  const studentId = await resolvePortalStudent(ids, req, res);
  if (!studentId) return res.json({ data: [] });
  const { school_year } = req.query;
  const enr = await q(
    `SELECT e.section_id FROM enrollments e WHERE e.student_id = ? AND e.school_year = ? AND e.status = 'enrolled' LIMIT 1`,
    [studentId, school_year || new Date().getFullYear() + '-' + (new Date().getFullYear() + 1)]);
  if (!enr) return res.json({ data: [] });
  const rows = await qa(
    `SELECT DISTINCT t.id, t.first_name, t.last_name, t.email, t.contact,
            ca.subject_id, sub.code AS subject_code, sub.title AS subject_title,
            sec.name AS section_name,
            CASE WHEN sec.adviser_teacher_id = t.id THEN 1 ELSE 0 END AS is_adviser
     FROM class_assignments ca
     JOIN teachers t ON t.id = ca.teacher_id
     JOIN subjects sub ON sub.id = ca.subject_id
     JOIN sections sec ON sec.id = ca.section_id
     WHERE ca.section_id = ? ${school_year ? 'AND ca.school_year = ?' : ''}
     ORDER BY is_adviser DESC, sub.code`,
    school_year ? [enr.section_id, school_year] : [enr.section_id]);
  res.json({ data: rows });
}));

/* ── Weekly schedule for linked student ──────────── */
router.get('/weekly-schedule', requireRole(...PORTAL), asyncH(async (req, res) => {
  const ids = await linkedStudentIds(req.user);
  const studentId = await resolvePortalStudent(ids, req, res);
  if (!studentId) return res.json({ data: [] });
  const { school_year } = req.query;
  const rows = await qa(
    `SELECT se.day, se.start_time, se.end_time, se.room,
            sub.code AS subject_code, sub.title AS subject_title,
            t.first_name || ' ' || t.last_name AS teacher_name,
            sec.name AS section_name
     FROM schedule_entries se
     JOIN subjects sub ON sub.id = se.subject_id
     JOIN teachers t ON t.id = se.teacher_id
     JOIN sections sec ON sec.id = se.section_id
     JOIN enrollments e ON e.section_id = se.section_id AND e.school_year = se.school_year AND e.status = 'enrolled'
     WHERE e.student_id = ? ${school_year ? 'AND se.school_year = ?' : ''}
     ORDER BY se.day, se.start_time`,
    school_year ? [studentId, school_year] : [studentId]);
  res.json({ data: rows });
}));

/* ── Announcements (extended) ────────────────────── */
router.get('/announcements', requireRole(...PORTAL), asyncH(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const rows = await qa(
    `SELECT a.id, a.title, a.body, a.created_at, u.name AS author_name
     FROM announcements a LEFT JOIN users u ON u.id = a.author_id
     ORDER BY a.created_at DESC LIMIT ?`,
    [limit]);
  res.json({ data: rows });
}));

module.exports = router;
