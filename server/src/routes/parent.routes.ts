import express, { Request, Response, NextFunction } from 'express';
import { q, qa, qi, qr, nowSql } from '../db';
import { authenticate, requireRole } from '../auth';
import { asyncH, audit } from '../utils';
import { PARENT_ROLES } from '../constants';

const router = express.Router();
router.use(authenticate);

interface ParentStudentRequest extends Request {
  user: {
    id: number;
    role: string;
  };
}

// Get all students visible to this parent/guardian
router.get('/students', requireRole(...PARENT_ROLES), asyncH(async (req: ParentStudentRequest, res: Response) => {
  try {
    const students = await qa(
      `SELECT id, lrn, first_name, middle_name, last_name, grade_level, section_name,
       guardian_name, contact_number, address, consent_status, date_enrolled, date_graduated
       FROM students ORDER BY last_name, first_name`
    );
    res.json({ data: students });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}));

// Get a specific student's profile
router.get('/students/:studentId', requireRole(...PARENT_ROLES), asyncH(async (req: ParentStudentRequest, res: Response) => {
  const { studentId } = req.params;
  try {
    const student = await q(
      `SELECT id, lrn, first_name, middle_name, last_name, grade_level, section_name,
       guardian_name, contact_number, address, sex, date_enrolled, date_graduated,
       track_preference, special_program, parental_consent_status, emergency_contact_name,
       emergency_contact_number, emergency_contact_relation
       FROM students WHERE id = ?`,
      [studentId]
    );
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({ data: student });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}));

// Get student's grades
router.get('/students/:studentId/grades', requireRole(...PARENT_ROLES), asyncH(async (req: ParentStudentRequest, res: Response) => {
  const { studentId } = req.params;
  try {
    const grades = await qa(
      `SELECT g.*, s.subject_name, s.term, s.quarter
       FROM grades g
       JOIN subjects s ON s.id = g.subject_id
       WHERE g.student_id = ? ORDER BY s.term, s.quarter`,
      [studentId]
    );
    res.json({ data: grades });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}));

// Get student's attendance
router.get('/students/:studentId/attendance', requireRole(...PARENT_ROLES), asyncH(async (req: ParentStudentRequest, res: Response) => {
  const { studentId } = req.params;
  try {
    const attendance = await qa(
      `SELECT a.*, m.month_name
       FROM attendance a
       LEFT JOIN months m ON m.id = a.month_id
       WHERE a.student_id = ? ORDER BY a.month_id`,
      [studentId]
    );
    res.json({ data: attendance });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}));

// Get student's intervention plans
router.get('/students/:studentId/interventions', requireRole(...PARENT_ROLES), asyncH(async (req: ParentStudentRequest, res: Response) => {
  const { studentId } = req.params;
  try {
    const plans = await qa(
      `SELECT p.*, u.name AS recorder_name
       FROM intervention_plans p
       JOIN users u ON u.id = p.recorded_by
       WHERE p.student_id = ? ORDER BY p.updated_at DESC`,
      [studentId]
    );
    res.json({ data: plans });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}));

// Get student's consent forms
router.get('/students/:studentId/consents', requireRole(...PARENT_ROLES), asyncH(async (req: ParentStudentRequest, res: Response) => {
  const { studentId } = req.params;
  try {
    const forms = await qa(
      `SELECT f.*, cr.signed, cr.signed_at, cr.signature
       FROM consent_forms f
       LEFT JOIN consent_responses cr ON cr.form_id = f.id AND cr.student_id = ?
       WHERE f.status = 'active'
       ORDER BY f.created_at DESC`,
      [studentId]
    );
    res.json({ data: forms });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}));

// Get parent's access logs for their children
router.get('/access-logs', requireRole(...PARENT_ROLES), asyncH(async (req: ParentStudentRequest, res: Response) => {
  const { studentId, userId, action, from, to } = req.query;
  const conditions: string[] = [];
  const params: (string | number | Date)[] = [];
  
  const getString = (val: unknown): string | undefined => {
    if (Array.isArray(val)) return val[0];
    if (typeof val === 'string') return val;
    return undefined;
  };
  
  if (studentId) { conditions.push('dal.student_id = ?'); params.push(Number(getString(studentId))); }
  if (userId) { conditions.push('dal.user_id = ?'); params.push(Number(getString(userId))); }
  if (action) { conditions.push('dal.action = ?'); params.push(getString(action)!); }
  if (from) { conditions.push('dal.created_at >= ?'); params.push(new Date(getString(from)!)); }
  if (to) { conditions.push('dal.created_at <= ?'); params.push(new Date(getString(to)!)); }
  
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  try {
    const rows = await qa(
      `SELECT dal.*, u.name AS user_name, s.first_name, s.last_name
       FROM data_access_logs dal
       LEFT JOIN users u ON u.id = dal.user_id
       LEFT JOIN students s ON s.id = dal.student_id
       ${where}
       ORDER BY dal.created_at DESC LIMIT 50`,
      params
    );
    const totalRow = await qa(
      `SELECT COUNT(*) AS n FROM data_access_logs dal 
       LEFT JOIN users u ON u.id = dal.user_id 
       LEFT JOIN students s ON s.id = dal.student_id ${where}`,
      params
    );
    res.json({ data: rows, total: totalRow[0]?.n ?? 0, limit: 50, offset: 0 });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}));

// Get consents signed by this parent/guardian
router.get('/consents/signed', requireRole(...PARENT_ROLES), asyncH(async (req: ParentStudentRequest, res: Response) => {
  try {
    const responses = await qa(
      `SELECT cr.*, f.title AS form_title, f.form_type, s.first_name AS student_first, s.last_name AS student_last, s.lrn
       FROM consent_responses cr
       JOIN consent_forms f ON f.id = cr.form_id
       LEFT JOIN students s ON s.id = cr.student_id
       WHERE cr.user_id = ?
       ORDER BY cr.signed_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json({ data: responses });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}));

// Get pending erasure requests (parents can view but not approve)
router.get('/erasure-requests/pending', requireRole(...PARENT_ROLES), asyncH(async (req: ParentStudentRequest, res: Response) => {
  const studentId = typeof req.query.studentId === 'string' ? req.query.studentId : undefined;
  const where = studentId ? 'WHERE student_id = ?' : '';
  const params = studentId ? [Number(studentId)] : [];
  try {
    const requests = await qa(
      `SELECT er.*, s.first_name AS student_first, s.last_name AS student_last, s.lrn,
              u.name AS requested_by_name
       FROM data_erasure_requests er
       LEFT JOIN students s ON s.id = er.student_id
       LEFT JOIN users u ON u.id = er.requested_by
       ${where}
       ORDER BY er.created_at DESC LIMIT 10`,
      params
    );
    res.json({ data: requests });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}));

export default router;