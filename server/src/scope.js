const { q, qa } = require('./db');

async function teacherForUser(user) {
  if (!user || user.role !== 'teacher') return null;
  return q('SELECT id FROM teachers WHERE user_id = ?', [user.id]);
}

// Resolve the teacher's scope: advisory sections (sections.adviser_teacher_id)
// plus sections/subjects from their class assignments. Returns null when the
// user is not a teacher or has no linked teacher profile.
async function teacherScope(user) {
  const t = await teacherForUser(user);
  if (!t) return null;
  const advisory = (await qa('SELECT id FROM sections WHERE adviser_teacher_id = ?', [t.id]))
    .map((r) => Number(r.id));
  const classes = await qa(
    'SELECT DISTINCT section_id, subject_id FROM class_assignments WHERE teacher_id = ?',
    [t.id]);
  const assignedSections = [...new Set(classes.map((c) => Number(c.section_id)))];
  const sections = [...new Set([...advisory, ...assignedSections])];
  const classSet = new Set(classes.map((c) => `${Number(c.section_id)}:${Number(c.subject_id)}`));
  return {
    teacherId: Number(t.id),
    advisory,
    classes,
    sections,
    hasClass(sectionId, subjectId) {
      return classSet.has(`${Number(sectionId)}:${Number(subjectId)}`);
    },
  };
}

// SQL fragment restricting a `students` table reference (alias) to the
// students enrolled in the teacher's scope. Empty scope -> impossible condition.
function studentInScope(scope, alias) {
  if (!scope || !scope.sections.length) return { sql: '0 = 1', params: [] };
  const ids = scope.sections.map(() => '?');
  return {
    sql: `${alias}.id IN (SELECT e.student_id FROM enrollments e JOIN sections s ON s.id = e.section_id WHERE e.status = 'enrolled' AND s.id IN (${ids.join(',')}))`,
    params: scope.sections,
  };
}

// SQL fragment restricting a `sections` table reference (alias) to the
// teacher's advisory / assigned sections. Empty scope -> impossible condition.
function sectionInScope(scope, alias, column = 'id') {
  if (!scope || !scope.sections.length) return { sql: '0 = 1', params: [] };
  return { sql: `${alias}.${column} IN (${scope.sections.map(() => '?').join(',')})`, params: scope.sections };
}

async function ensureTeacherSeesStudent(user, studentId) {
  const scope = await teacherScope(user);
  if (!scope) return { ok: false, reason: 'No teacher profile is linked to this account' };
  if (!scope.sections.length) return { ok: false, reason: 'You have no advisory or assigned classes yet' };
  const found = await q(
    `SELECT 1 FROM enrollments e JOIN sections s ON s.id = e.section_id
     WHERE e.student_id = ? AND e.status = 'enrolled' AND s.id IN (${scope.sections.map(() => '?').join(',')}) LIMIT 1`,
    [studentId, ...scope.sections]);
  return found
    ? { ok: true, scope }
    : { ok: false, reason: 'This student is not in your advisory or assigned classes' };
}

async function ensureTeacherSeesSection(user, sectionId) {
  const scope = await teacherScope(user);
  if (!scope) return { ok: false, reason: 'No teacher profile is linked to this account' };
  if (!scope.sections.includes(Number(sectionId))) {
    return { ok: false, reason: 'This section is not under your advisory or class assignments' };
  }
  return { ok: true, scope };
}

// Student IDs visible to a portal user. Students see themselves (via students.user_id);
// parents see their linked children (via parent_students). Staff roles return null
// (unrestricted) so existing staff endpoints keep working.
async function linkedStudentIds(user) {
  if (!user) return null;
  if (user.role === 'student') {
    const st = await q('SELECT id FROM students WHERE user_id = ?', [user.id]);
    return st ? [Number(st.id)] : [];
  }
  if (user.role === 'parent' || user.role === 'guardian') {
    const rows = await qa('SELECT student_id FROM parent_students WHERE parent_user_id = ?', [user.id]);
    return rows.map((r) => Number(r.student_id));
  }
  return null;
}

// Scoping for student/parent portal roles: only allow access to their own / linked records.
async function ensurePortalSeesStudent(user, studentId) {
  const ids = await linkedStudentIds(user);
  if (ids === null) return { ok: true, ids };
  if (ids.includes(Number(studentId))) return { ok: true, ids };
  return { ok: false, reason: "You do not have access to this student's records" };
}

module.exports = {
  teacherForUser,
  teacherScope,
  studentInScope,
  sectionInScope,
  ensureTeacherSeesStudent,
  ensureTeacherSeesSection,
  linkedStudentIds,
  ensurePortalSeesStudent,
};
