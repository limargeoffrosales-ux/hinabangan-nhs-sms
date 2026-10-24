const { q } = require('../db');
const { teacherScope, linkedStudentIds } = require('../scope');
const { asyncH } = require('../utils');

function requireLm() {
  return (req, res, next) => {
    const r = req.role;
    if (r === 'teacher' || r === 'student') return next();
    return res.status(403).json({ error: 'Insufficient permissions for LM module' });
  };
}

async function loadSpace(req, res, next) {
  try {
    const spaceId = Number(req.params.spaceId || req.query.space_id);
    if (!spaceId) return res.status(400).json({ error: 'space_id required' });
    const space = await q(
      `SELECT s.*,
              sec.name AS section_name, sec.grade_level, sec.strand, sec.school_year,
              sub.code AS subject_code, sub.title AS subject_title,
              t.first_name AS teacher_first, t.last_name AS teacher_last, t.user_id AS teacher_user_id
       FROM lm_spaces s
       LEFT JOIN sections sec ON sec.id = s.section_id
       LEFT JOIN subjects sub ON sub.id = s.subject_id
       LEFT JOIN teachers t ON t.id = s.teacher_id
       WHERE s.id = ?`,
      [spaceId]
    );
    if (!space) return res.status(404).json({ error: 'Space not found' });
    req.space = space;

    if (req.role === 'teacher') {
      const scope = await teacherScope(req.user);
      if (!scope || scope.teacherId !== Number(space.teacher_id)) {
        return res.status(403).json({ error: 'You do not have access to this space' });
      }
      req.lmTeacherScope = scope;
      return next();
    }

    if (req.role === 'student') {
      const ids = await linkedStudentIds(req.user);
      if (!ids || ids.length === 0) return res.status(403).json({ error: 'No student linked to your account' });
      const st = await q('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!st) return res.status(403).json({ error: 'Student profile not found' });
      const ok = await q(
        `SELECT 1
         FROM enrollments e
         JOIN enrollment_subjects es ON es.enrollment_id = e.id
         WHERE e.student_id = ? AND e.section_id = ? AND e.school_year = ? AND es.subject_id = ?
         AND e.status = 'enrolled'
         LIMIT 1`,
        [st.id, space.section_id, space.school_year, space.subject_id]
      );
      if (!ok) return res.status(403).json({ error: 'You are not enrolled in this class space' });
      req.lmStudent = st;
      return next();
    }

    return res.status(403).json({ error: 'Insufficient permissions for LM module' });
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireLm, loadSpace };
