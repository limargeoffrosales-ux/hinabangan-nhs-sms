const express = require('express');
const { q, qa } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');
const { getScaleForSubject, convertGrade } = require('../grading/scales');
const {
  getHonorSettings,
  saveHonorSettings,
  summarizeSubjects,
  honorDesignation,
  assignRanks,
  studentSummary,
  DESIGNATIONS,
} = require('../grading/analytics');
const { ensureTeacherSeesStudent, ensureTeacherSeesSection, ensurePortalSeesStudent, teacherScope } = require('../scope');

const router = express.Router();
router.use(authenticate);

const READ = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'guidance'];
const SETTINGS_WRITE = ['super_admin', 'school_admin'];

function enrolledStudents(schoolYear, { gradeLevel, sectionId } = {}) {
  const where = ["e.school_year = ? AND e.status = 'enrolled'"];
  const params = [schoolYear];
  if (gradeLevel) {
    where.push('st.grade_level = ?');
    params.push(gradeLevel);
  }
  if (sectionId) {
    where.push('e.section_id = ?');
    params.push(Number(sectionId));
  }
  return qa(
    `SELECT DISTINCT st.id, st.lrn, st.first_name, st.middle_name, st.last_name, st.suffix, st.grade_level,
            sec.id AS section_id, sec.name AS section_name
     FROM enrollments e
     JOIN students st ON st.id = e.student_id
     JOIN sections sec ON sec.id = e.section_id
     WHERE ${where.join(' AND ')}
     ORDER BY st.last_name, st.first_name`,
    params);
}

// Compute per-student subject summaries in bulk (avoids N+1) for the given student rows.
async function buildRankings(students, schoolYear, settings) {
  if (!students.length) return [];
  const ids = students.map((s) => s.id);
  const place = ids.map(() => '?').join(',');
  const gradeRows = await qa(
    `SELECT g.student_id, g.subject_id, ROUND(AVG(g.computed_grade), 2) AS final
     FROM grades g
     WHERE g.school_year = ? AND g.computed_grade IS NOT NULL AND g.student_id IN (${place})
     GROUP BY g.student_id, g.subject_id`,
    [schoolYear, ...ids]);
  const subjectIds = [...new Set(gradeRows.map((g) => Number(g.subject_id)))];
  const subjects = subjectIds.length
    ? await qa(`SELECT id, code, title, units FROM subjects WHERE id IN (${subjectIds.map(() => '?').join(',')})`, subjectIds)
    : [];
  const subjectById = new Map(subjects.map((s) => [Number(s.id), s]));
  const byStudent = new Map();
  for (const g of gradeRows) {
    if (!byStudent.has(g.student_id)) byStudent.set(g.student_id, []);
    byStudent.get(g.student_id).push(g);
  }
  const scaleCache = {};
  const out = [];
  for (const st of students) {
    const raw = byStudent.get(st.id) || [];
    const rows = [];
    for (const g of raw) {
      const su = subjectById.get(Number(g.subject_id));
      if (!su) continue;
      const scale = scaleCache[g.subject_id] || (scaleCache[g.subject_id] = await getScaleForSubject(g.subject_id));
      const conv = convertGrade(g.final, scale);
      rows.push({
        subject_id: Number(g.subject_id),
        code: su.code,
        title: su.title,
        units: Number(su.units || 0),
        final: Number(g.final),
        letter: conv ? conv.letter : null,
        points: conv ? conv.points : null,
        proficiency: conv ? conv.proficiency : null,
        passed: conv ? conv.passed : null,
        scale: scale ? scale.code : null,
        scale_credits_pass_only: scale ? !!scale.credits_pass_only : false,
      });
    }
    const summary = summarizeSubjects(rows);
    out.push({
      student: {
        id: st.id, lrn: st.lrn, first_name: st.first_name, middle_name: st.middle_name,
        last_name: st.last_name, suffix: st.suffix, grade_level: st.grade_level,
        section_id: st.section_id, section_name: st.section_name,
      },
      ...summary,
      min_final: summary.subjects.length
        ? Math.min(...summary.subjects.filter((s) => s.final != null).map((s) => s.final))
        : null,
      honor: honorDesignation(summary, settings),
    });
  }
  return out;
}

// GET /honor-roll?school_year=&grade_level=&section_id=&designation=
router.get('/honor-roll', requireRole(...READ), asyncH(async (req, res) => {
  const { school_year } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });
  const settings = await getHonorSettings();
  const students = await enrolledStudents(school_year, {
    gradeLevel: req.query.grade_level,
    sectionId: req.query.section_id,
  });
  const rows = await buildRankings(students, school_year, settings);
  assignRanks(rows, 'gwa');
  const designation = (req.query.designation || '').toString().trim();
  const data = designation ? rows.filter((r) => r.honor === designation) : rows;
  const counts = Object.keys(DESIGNATIONS).reduce((acc, key) => {
    acc[key] = rows.filter((r) => r.honor === key).length;
    return acc;
  }, {});
  res.json({ school_year, settings, counts, data });
}));

// GET /rank?school_year=&section_id=&grade_level=
router.get('/rank', requireRole(...READ, 'teacher'), asyncH(async (req, res) => {
  const { school_year } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });
  const sectionId = req.query.section_id;
  const gradeLevel = req.query.grade_level;
  if (!sectionId && !gradeLevel) {
    return res.status(400).json({ error: 'section_id or grade_level is required' });
  }
  if (req.role === 'teacher') {
    if (!sectionId) {
      return res.status(403).json({ error: 'Teachers may only view class rank for a specific section' });
    }
    const chk = await ensureTeacherSeesSection(req.user, sectionId);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }
  const settings = await getHonorSettings();
  const students = await enrolledStudents(school_year, { gradeLevel, sectionId });
  const rows = await buildRankings(students, school_year, settings);
  assignRanks(rows, 'gwa');
  res.json({ school_year, metric: 'gwa', ranked: rows.length, data: rows });
}));

// GET /students/:studentId?school_year=
router.get('/students/:studentId', requireRole(...READ, 'teacher', 'student', 'parent'), asyncH(async (req, res) => {
  const { school_year } = req.query;
  if (!school_year) return res.status(400).json({ error: 'school_year is required' });
  const student = await q('SELECT * FROM students WHERE id = ?', [req.params.studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (req.role === 'teacher') {
    const chk = await ensureTeacherSeesStudent(req.user, student.id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  } else if (req.role === 'student' || req.role === 'parent') {
    const chk = await ensurePortalSeesStudent(req.user, student.id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }
  const settings = await getHonorSettings();
  const summary = await studentSummary(student.id, school_year);
  const enrollment = await q(
    `SELECT sec.id AS section_id, sec.name AS section_name
     FROM enrollments e JOIN sections sec ON sec.id = e.section_id
     WHERE e.student_id = ? AND e.school_year = ? AND e.status = 'enrolled' LIMIT 1`,
    [student.id, school_year]);
  let rank = null;
  let rankTotal = null;
  if (enrollment) {
    const peers = await enrolledStudents(school_year, { sectionId: enrollment.section_id });
    const rows = await buildRankings(peers, school_year, settings);
    assignRanks(rows, 'gwa');
    rankTotal = rows.length;
    const found = rows.find((r) => r.student.id === student.id);
    rank = found ? found.rank : null;
  }
  const honor = honorDesignation(summary, settings);
  const minFinal = summary.subjects.length
    ? Math.min(...summary.subjects.filter((s) => s.final != null).map((s) => s.final))
    : null;
  res.json({
    student: {
      id: student.id, lrn: student.lrn, first_name: student.first_name, middle_name: student.middle_name,
      last_name: student.last_name, suffix: student.suffix, grade_level: student.grade_level,
      track_strand: student.track_strand,
    },
    school_year,
    section: enrollment || null,
    general_average: summary.gwa,
    gpa: summary.gpa,
    weighted_gpa: summary.weighted_gpa,
    credits: { earned: summary.credits_earned, total: summary.credits_total },
    min_final: minFinal,
    honor,
    rank,
    rank_total: rankTotal,
    subjects: summary.subjects,
  });
}));

// GET /honor-roll/settings
router.get('/honor-roll/settings', requireRole(...READ), asyncH(async (req, res) => {
  res.json(await getHonorSettings());
}));

// PUT /honor-roll/settings
router.put('/honor-roll/settings', requireRole(...SETTINGS_WRITE), asyncH(async (req, res) => {
  const value = await saveHonorSettings(req.body || {});
  await audit(req, 'HONOR_ROLL_SETTINGS_UPDATE', 'app_settings', 'honor_roll', value);
  res.json(value);
}));

module.exports = router;
