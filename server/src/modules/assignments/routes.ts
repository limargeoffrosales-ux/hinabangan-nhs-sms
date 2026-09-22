// Assignments feature module
import { Router } from 'express';
import { q, qa, qi, qr, nowSql, bool } from '../../db';
import { authenticate, requireRole, isAdminRole } from '../../auth';
import { asyncH, audit } from '../../utils';
import { teacherForUser, ensurePortalSeesStudent, linkedStudentIds } from '../../scope';
import { notifyEvent } from '../../notify';
import { logger } from '../../logger';
import { WRITE_ROLES, STAFF_ROLES, PORTAL_ROLES } from '../../constants';

const router = Router();
router.use(authenticate);

const KINDS = ['homework', 'classwork', 'quiz', 'activity', 'performance_task', 'project'] as const;

function parseJson(text: string | null, fallback: any) {
  try { return JSON.parse(text!); } catch { return fallback; }
}

function round2(n: number) { return Math.round(n * 100) / 100; }

async function loadClassAssignment(id: number) {
  return q(
    `SELECT ca.*, s.name AS section_name, sub.code AS subject_code, sub.title AS subject_title,
            t.first_name AS teacher_first, t.last_name AS teacher_last
     FROM class_assignments ca
     JOIN sections s ON s.id = ca.section_id
     JOIN subjects sub ON sub.id = ca.subject_id
     LEFT JOIN teachers t ON t.id = ca.teacher_id
     WHERE ca.id = ?`, [id]);
}

async function canManageAssignment(user: any, assignmentId: number) {
  const a = await q(
    `SELECT a.*, ca.teacher_id AS class_teacher_id, ca.section_id, ca.subject_id,
            sub.title AS subject_title, sub.code AS subject_code
     FROM assignments a JOIN class_assignments ca ON ca.id = a.class_assignment_id
     LEFT JOIN subjects sub ON sub.id = ca.subject_id
     WHERE a.id = ?`, [assignmentId]);
  if (!a) return { ok: false, status: 404, reason: 'Assignment not found' };
  if (isAdminRole(user.role)) return { ok: true, a };
  if (user.role === 'teacher') {
    const t = await teacherForUser(user);
    if (!t) return { ok: false, status: 403, reason: 'No teacher profile is linked to this account' };
    if (Number(a.class_teacher_id) !== Number(t.id)) {
      return { ok: false, status: 403, reason: 'You are not the teacher of this assignment' };
    }
    return { ok: true, a };
  }
  return { ok: false, status: 403, reason: 'Insufficient permissions' };
}

router.get('/classes', requireRole(...STAFF_ROLES), asyncH(async (req, res) => {
  const { school_year } = req.query;
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (school_year) { where.push('ca.school_year = ?'); params.push(String(school_year)); }
  if (req.user.role === 'teacher') {
    const t = await teacherForUser(req.user);
    if (!t) return res.status(403).json({ error: 'No teacher profile is linked to this account' });
    where.push('ca.teacher_id = ?');
    params.push(t.id);
  }
  const sql = `SELECT ca.id AS class_assignment_id, ca.school_year, ca.section_id, s.name AS section_name,
                    ca.subject_id, sub.code AS subject_code, sub.title AS subject_title
             FROM class_assignments ca
             JOIN sections s ON s.id = ca.section_id
             JOIN subjects sub ON sub.id = ca.subject_id
             ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
             ORDER BY s.name, sub.code`;
  res.json({ data: await qa(sql, params) });
}));

router.get('/', requireRole(...STAFF_ROLES), asyncH(async (req, res) => {
  const { class_assignment_id, school_year } = req.query;
  const pageNum = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const limit = Math.min(Math.max(1, parseInt(String(req.query.limit || '25'), 10)), 100);
  const offset = (pageNum - 1) * limit;
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (class_assignment_id) { where.push('a.class_assignment_id = ?'); params.push(String(class_assignment_id)); }
  if (school_year) { where.push('a.school_year = ?'); params.push(String(school_year)); }
  if (req.user.role === 'teacher') {
    const t = await teacherForUser(req.user);
    if (!t) return res.status(403).json({ error: 'No teacher profile is linked to this account' });
    where.push('a.teacher_id = ?');
    params.push(t.id);
  }
  const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const total = Number((await q(`SELECT COUNT(*) AS total FROM assignments a${whereClause}`, params)).total || 0);
  const joinSql = `SELECT a.*, s.name AS section_name, sub.code AS subject_code, sub.title AS subject_title,
                      c.code AS competency_code, c.title AS competency_title,
                      (SELECT COUNT(*) FROM enrollments e
                        WHERE e.section_id = ca.section_id AND e.school_year = a.school_year AND e.status = 'enrolled') AS student_count,
                      (SELECT COUNT(*) FROM assignment_submissions asub WHERE asub.assignment_id = a.id) AS submitted_count,
                      (SELECT COUNT(*) FROM assignment_submissions asub WHERE asub.assignment_id = a.id AND asub.status = 'graded') AS graded_count
               FROM assignments a
               JOIN class_assignments ca ON ca.id = a.class_assignment_id
               JOIN sections s ON s.id = ca.section_id
               JOIN subjects sub ON sub.id = ca.subject_id
               LEFT JOIN competencies c ON c.id = a.competency_id
               ${whereClause}
               ORDER BY a.due_date IS NULL, a.due_date DESC, a.created_at DESC
               LIMIT ? OFFSET ?`;
  const rows = await qa(joinSql, [...params, limit, offset]);
  for (const r of rows) r.rubric = parseJson(r.rubric, null);
  res.json({ data: rows, total, page: pageNum, limit, totalPages: Math.ceil(total / limit) });
}));

router.post('/', requireRole(...STAFF_ROLES), asyncH(async (req, res) => {
  const b = req.body || {};
  const ca = await loadClassAssignment(Number(b.class_assignment_id));
  if (!ca) return res.status(404).json({ error: 'Class assignment not found' });
  if (req.user.role === 'teacher') {
    const t = await teacherForUser(req.user);
    if (!t) return res.status(403).json({ error: 'No teacher profile is linked to this account' });
    if (Number(ca.teacher_id) !== Number(t.id)) {
      return res.status(403).json({ error: 'You are not the teacher of this class' });
    }
  }
  const title = String(b.title || '').trim();
  if (!title) return res.status(400).json({ error: 'title is required' });
  const kind = KINDS.includes(b.kind) ? b.kind : 'homework';
  const totalPoints = Number(b.total_points);
  if (!(totalPoints >= 0)) return res.status(400).json({ error: 'total_points must be a non-negative number' });
  let rubric: string | null = null;
  if (Array.isArray(b.rubric) && b.rubric.length) {
    if (b.rubric.some((c: any) => !c || !c.criterion || !(Number(c.points) >= 0))) {
      return res.status(400).json({ error: 'rubric items need criterion and points' });
    }
    rubric = JSON.stringify(b.rubric);
  }
  const id = await qi(
    `INSERT INTO assignments (class_assignment_id, teacher_id, school_year, title, description, kind, total_points, due_date, allow_late, rubric, competency_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [ca.id, ca.teacher_id, ca.school_year, title, b.description || null, kind, round2(totalPoints),
      b.due_date || null, bool(b.allow_late !== false), rubric, b.competency_id || null]);
  await audit(req, 'ASSIGNMENT_CREATE', 'assignment', id, { title, kind, class_assignment_id: ca.id });
  notifyEvent('assignment_created', {
    section_id: ca.section_id,
    school_year: ca.school_year,
    data: {
      title, kind, points: round2(totalPoints),
      due_date: b.due_date ? new Date(b.due_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) : 'No due date',
      subject: ca.subject_title || ca.subject_code, section: ca.section_name,
    },
  }).catch((err) => logger.error({ err: err.message }, '[ASSIGNMENTS] notifyEvent(assignment_created) failed'));
  res.json({ ok: true, id });
}));

router.get('/student/:studentId', requireRole(...PORTAL_ROLES), asyncH(async (req, res) => {
  const { ensurePortalSeesStudent } = await import('../../scope');
  const chk = await ensurePortalSeesStudent(req.user, req.params.studentId);
  if (!chk.ok) return res.status(403).json({ error: chk.reason });
  const student = await q('SELECT id, first_name, last_name, lrn FROM students WHERE id = ?', [req.params.studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const { school_year } = req.query;
  const sql = `SELECT a.*, sub.code AS subject_code, sub.title AS subject_title,
                      t.first_name AS teacher_first, t.last_name AS teacher_last,
                      asub.id AS submission_id, asub.status AS submission_status,
                      asub.score, asub.feedback, asub.text_content, asub.link_url,
                      asub.submitted_at, asub.rubric_scores
               FROM assignments a
               JOIN class_assignments ca ON ca.id = a.class_assignment_id
               JOIN subjects sub ON sub.id = ca.subject_id
               LEFT JOIN teachers t ON t.id = ca.teacher_id
               JOIN enrollments e ON e.section_id = ca.section_id AND e.school_year = a.school_year AND e.status = 'enrolled'
               LEFT JOIN assignment_submissions asub ON asub.assignment_id = a.id AND asub.student_id = ?
               WHERE e.student_id = ?
                 ${school_year ? 'AND a.school_year = ?' : ''}
               ORDER BY a.due_date IS NULL, a.due_date, a.created_at DESC`;
  const params: (string | number)[] = [student.id, student.id];
  if (school_year) params.push(String(school_year));
  const rows = await qa(sql, params);
  for (const r of rows) r.rubric = parseJson(r.rubric, null);
  res.json({ student, data: rows });
}));

router.put('/submit', requireRole(...PORTAL_ROLES), asyncH(async (req, res) => {
  const b = req.body || {};
  let studentId: number | null = null;
  if (req.user.role === 'student') {
    const ids = await linkedStudentIds(req.user);
    studentId = ids && ids.length ? ids[0] : null;
  } else {
    studentId = Number(b.student_id);
  }
  if (!studentId) return res.status(400).json({ error: 'Could not determine student' });
  const { ensurePortalSeesStudent } = await import('../../scope');
  const chk = await ensurePortalSeesStudent(req.user, studentId);
  if (!chk.ok) return res.status(403).json({ error: chk.reason });
  const assignment = await q(
    `SELECT a.* FROM assignments a
     JOIN enrollments e ON e.section_id = (SELECT section_id FROM class_assignments WHERE id = a.class_assignment_id)
     WHERE a.id = ? AND e.student_id = ? AND e.status = 'enrolled' LIMIT 1`,
    [b.assignment_id, studentId]);
  if (!assignment) return res.status(403).json({ error: 'This assignment is not assigned to this student' });
  const text = String(b.text_content || '').trim();
  const link = String(b.link_url || '').trim();
  if (!text && !link) return res.status(400).json({ error: 'Provide your answer text or a link to your work' });
  if (link && !/^https?:\/\//i.test(link)) {
    return res.status(400).json({ error: 'Link must start with http:// or https://' });
  }
  const late = assignment.due_date ? new Date(assignment.due_date).getTime() < Date.now() : false;
  if (late && !assignment.allow_late) return res.status(403).json({ error: 'The due date has passed and late submissions are not allowed' });
  const existing = await q('SELECT id, status FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?',
    [assignment.id, studentId]);
  if (existing && existing.status === 'graded') {
    return res.status(403).json({ error: 'This submission was already graded and cannot be resubmitted' });
  }
  if (existing) {
    await qr(`UPDATE assignment_submissions SET text_content = ?, link_url = ?, status = 'submitted',
              score = NULL, feedback = NULL, rubric_scores = NULL, submitted_at = ${nowSql()}, updated_at = ${nowSql()}
              WHERE id = ?`,
      [text || null, link || null, existing.id]);
  } else {
    await qi(
      `INSERT INTO assignment_submissions (assignment_id, student_id, text_content, link_url, status, submitted_at)
       VALUES (?, ?, ?, ?, 'submitted', ${nowSql()})`,
      [assignment.id, studentId, text || null, link || null]);
  }
  await audit(req, 'ASSIGNMENT_SUBMIT', 'assignment', assignment.id, { student_id: studentId });
  res.json({ ok: true });
}));

router.get('/:id', requireRole(...STAFF_ROLES), asyncH(async (req, res) => {
  const chk = await canManageAssignment(req.user, Number(req.params.id));
  if (!chk.ok) return res.status(chk.status).json({ error: chk.reason });
  chk.a.rubric = parseJson(chk.a.rubric, null);
  res.json(chk.a);
}));

router.patch('/:id', requireRole(...STAFF_ROLES), asyncH(async (req, res) => {
  const chk = await canManageAssignment(req.user, Number(req.params.id));
  if (!chk.ok) return res.status(chk.status).json({ error: chk.reason });
  const b = req.body || {};
  const sets: string[] = [];
  const params: (string | number)[] = [];
  if (b.title !== undefined) { sets.push('title = ?'); params.push(String(b.title).trim()); }
  if (b.description !== undefined) { sets.push('description = ?'); params.push(b.description || null); }
  if (b.kind !== undefined) { if (!KINDS.includes(b.kind)) return res.status(400).json({ error: 'Invalid kind' }); sets.push('kind = ?'); params.push(b.kind); }
  if (b.total_points !== undefined) {
    const n = Number(b.total_points);
    if (!(n >= 0)) return res.status(400).json({ error: 'total_points must be a non-negative number' });
    sets.push('total_points = ?'); params.push(round2(n));
  }
  if (b.due_date !== undefined) { sets.push('due_date = ?'); params.push(b.due_date || null); }
  if (b.allow_late !== undefined) { sets.push('allow_late = ?'); params.push(bool(b.allow_late !== false)); }
  if (b.rubric !== undefined) {
    if (b.rubric === null) { sets.push('rubric = NULL'); }
    else if (Array.isArray(b.rubric)) { sets.push('rubric = ?'); params.push(JSON.stringify(b.rubric)); }
    else return res.status(400).json({ error: 'rubric must be an array' });
  }
  if (b.competency_id !== undefined) {
    const cid = b.competency_id === null || b.competency_id === '' ? null : Number(b.competency_id);
    if (cid !== null) {
      const c = await q('SELECT id FROM competencies WHERE id = ?', [cid]);
      if (!c) return res.status(400).json({ error: 'Invalid competency_id' });
    }
    sets.push('competency_id = ?'); params.push(cid);
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  sets.push(`updated_at = ${nowSql()}`);
  params.push(chk.a.id);
  await qr(`UPDATE assignments SET ${sets.join(', ')} WHERE id = ?`, params);
  await audit(req, 'ASSIGNMENT_UPDATE', 'assignment', chk.a.id, {});
  res.json({ ok: true });
}));

router.delete('/:id', requireRole(...STAFF_ROLES), asyncH(async (req, res) => {
  const chk = await canManageAssignment(req.user, Number(req.params.id));
  if (!chk.ok) return res.status(chk.status).json({ error: chk.reason });
  await qr('DELETE FROM assignments WHERE id = ?', [chk.a.id]);
  await audit(req, 'ASSIGNMENT_DELETE', 'assignment', chk.a.id, {});
  res.json({ ok: true });
}));

router.get('/:id/submissions', requireRole(...STAFF_ROLES), asyncH(async (req, res) => {
  const chk = await canManageAssignment(req.user, Number(req.params.id));
  if (!chk.ok) return res.status(chk.status).json({ error: chk.reason });
  const a = chk.a;
  const rows = await qa(
    `SELECT st.id AS student_id, st.lrn, st.first_name, st.last_name,
            asub.id AS submission_id, asub.status AS submission_status, asub.text_content, asub.link_url,
            asub.score, asub.feedback, asub.rubric_scores, asub.submitted_at, asub.graded_at
     FROM enrollments e
     JOIN students st ON st.id = e.student_id
     LEFT JOIN assignment_submissions asub ON asub.student_id = st.id AND asub.assignment_id = ?
     WHERE e.section_id = ? AND e.school_year = ? AND e.status = 'enrolled'
     ORDER BY st.last_name, st.first_name`,
    [a.id, a.section_id, a.school_year]);
  res.json({ assignment: { ...a, rubric: parseJson(a.rubric, null) }, data: rows });
}));

router.put('/:id/submissions/:studentId', requireRole(...STAFF_ROLES), asyncH(async (req, res) => {
  const chk = await canManageAssignment(req.user, Number(req.params.id));
  if (!chk.ok) return res.status(chk.status).json({ error: chk.reason });
  const a = chk.a;
  const b = req.body || {};
  const studentId = Number(req.params.studentId);
  const sub = await q('SELECT id FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?', [a.id, studentId]);
  if (!sub) return res.status(404).json({ error: 'No submission from this student' });
  const score = b.score === null || b.score === undefined ? null : Number(b.score);
  if (score !== null && !(score >= 0 && score <= Number(a.total_points))) {
    return res.status(400).json({ error: `score must be between 0 and ${a.total_points}` });
  }
  let rubricScores = null;
  if (b.rubric_scores !== undefined && b.rubric_scores !== null) {
    if (!Array.isArray(b.rubric_scores)) return res.status(400).json({ error: 'rubric_scores must be an array' });
    rubricScores = JSON.stringify(b.rubric_scores);
  }
  await qr(`UPDATE assignment_submissions SET status = 'graded', score = ?, feedback = ?, rubric_scores = ?,
            graded_by = ?, graded_at = ${nowSql()}, updated_at = ${nowSql()}
            WHERE id = ?`,
    [score, b.feedback || null, rubricScores, req.user.id, sub.id]);
  await audit(req, 'ASSIGNMENT_GRADE', 'assignment', a.id, { student_id: studentId, score });
  notifyEvent('assignment_graded', {
    student_id: studentId,
    data: {
      title: a.title,
      subject: a.subject_title || a.subject_code,
      score: score != null ? score : '—',
      total: a.total_points,
    },
  }).catch((err) => logger.error({ err: err.message, student_id: studentId }, '[ASSIGNMENTS] notifyEvent(assignment_graded) failed'));
  res.json({ ok: true });
}));

router.put('/:id/submissions/:studentId/return', requireRole(...STAFF_ROLES), asyncH(async (req, res) => {
  const chk = await canManageAssignment(req.user, Number(req.params.id));
  if (!chk.ok) return res.status(chk.status).json({ error: chk.reason });
  const a = chk.a;
  const studentId = Number(req.params.studentId);
  const sub = await q('SELECT id FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?', [a.id, studentId]);
  if (!sub) return res.status(404).json({ error: 'No submission from this student' });
  const b = req.body || {};
  await qr(`UPDATE assignment_submissions SET status = 'returned', score = NULL, feedback = ?, rubric_scores = NULL,
            updated_at = ${nowSql()} WHERE id = ?`,
    [b.feedback || null, sub.id]);
  await audit(req, 'ASSIGNMENT_RETURN', 'assignment', a.id, { student_id: studentId });
  res.json({ ok: true });
}));

export const assignmentsRoutes = router;