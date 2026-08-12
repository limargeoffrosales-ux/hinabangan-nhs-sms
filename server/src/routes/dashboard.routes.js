const express = require('express');
const db = require('../db');
const { q, qa } = db;
const { authenticate, requireRole } = require('../auth');
const { asyncH, page } = require('../utils');

const router = express.Router();
router.use(authenticate);

function today() {
  return new Date().toISOString().slice(0, 10);
}

router.get('/summary', asyncH(async (req, res) => {
  const [students, teachers, sections, subjects, enrollments] = await Promise.all([
    qa('SELECT grade_level, sex, COUNT(*) AS n FROM students GROUP BY grade_level, sex'),
    qa('SELECT COUNT(*) AS n FROM teachers WHERE status = \'active\''),
    qa('SELECT COUNT(*) AS n FROM sections WHERE status = \'active\''),
    qa('SELECT COUNT(*) AS n FROM subjects'),
    qa('SELECT school_year, COUNT(*) AS n FROM enrollments GROUP BY school_year ORDER BY school_year DESC LIMIT 5'),
  ]);
  const t = today();
  const attendance = await qa(
    `SELECT a.status, COUNT(*) AS n FROM attendance a WHERE a.date = ? GROUP BY a.status`, [t]);
  const totalStudents = students.reduce((a, r) => a + Number(r.n), 0);
  const present = attendance.find((r) => r.status === 'present')?.n || 0;
  const absences = await qa(
    'SELECT COUNT(*) AS n FROM attendance WHERE date = ? AND status = \'absent\'', [t]);
  res.json({
    students: totalStudents,
    teachers: Number(teachers[0]?.n || 0),
    sections: Number(sections[0]?.n || 0),
    subjects: Number(subjects[0]?.n || 0),
    attendance_rate: totalStudents ? Math.round(present / totalStudents * 100) : 0,
    absences_today: Number(absences[0]?.n || 0),
    by_grade_level: students.reduce((m, r) => {
      if (!m[r.grade_level]) m[r.grade_level] = { male: 0, female: 0 };
      m[r.grade_level][r.sex === 'Male' ? 'male' : 'female'] += Number(r.n);
      return m;
    }, {}),
    by_sex: {
      male: students.filter((r) => r.sex === 'Male').reduce((a, r) => a + Number(r.n), 0),
      female: students.filter((r) => r.sex === 'Female').reduce((a, r) => a + Number(r.n), 0),
    },
    enrollment_by_year: enrollments,
    date: t,
  });
}));

router.get('/attendance-trend', asyncH(async (req, res) => {
  const days = Number(req.query.days || 7);
  const cutoff = db.dialect === 'pg'
    ? `CURRENT_DATE - (? * INTERVAL '1 day')`
    : `date('now', '-' || ? || ' days')`;
  const rows = await qa(
    `SELECT date, status, COUNT(*) AS n FROM attendance WHERE date >= ${cutoff} GROUP BY date, status ORDER BY date`,
    [days]);
  res.json({ data: rows });
}));

router.get('/latest-activity', requireRole('super_admin', 'school_admin', 'principal'), asyncH(async (req, res) => {
  const { limit } = page(req);
  const rows = await qa('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?', [limit]);
  res.json({ data: rows });
}));

module.exports = router;
