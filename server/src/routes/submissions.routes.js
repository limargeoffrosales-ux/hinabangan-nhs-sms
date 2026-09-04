const express = require('express');
const multer = require('multer');
const path = require('path');
const { q, qa, qi, qr, nowSql } = require('../db');
const { authenticate, requireRole, ADMIN_ROLES, isAdminRole } = require('../auth');
const { asyncH, audit, safeJsonParse } = require('../utils');
const { REPORT_TYPES } = require('../report-types');
const { uploadFile, deleteFile } = require('../storage');
const { UPLOAD_MAX_MB } = require('../config');

const router = express.Router();
router.use(authenticate);

const GROUP_WORKFLOWS = {
  'Daily Attendance': [['registrar', 'assistant_principal'], ['principal']],
  'Teaching Documents': [['assistant_principal'], ['principal']],
  'Classroom Monitoring': [['assistant_principal'], ['principal']],
  'Weekly': [['assistant_principal'], ['principal']],
  'Monthly': [['assistant_principal'], ['principal']],
  'Quarterly Academic': [['registrar'], ['principal']],
  'Quarterly Administrative': [['assistant_principal', 'registrar'], ['principal']],
  'Annual': [['assistant_principal'], ['principal']],
  'DepEd School Forms': [['registrar'], ['principal']],
  'Classroom Documents': [['assistant_principal'], ['principal']],
  'Assessment Documents': [['assistant_principal'], ['principal']],
  'Learner Intervention': [['guidance'], ['principal']],
  'Reading and Numeracy': [['assistant_principal'], ['principal']],
  'Research': [['assistant_principal'], ['principal']],
  'Professional Development': [['assistant_principal', 'hr'], ['principal']],
  'School Activities': [['assistant_principal'], ['principal']],
  'Property and Inventory': [['property_custodian'], ['principal']],
  'Guidance and Discipline': [['guidance'], ['principal']],
  'Health and Safety': [['nurse'], ['principal']],
  'Finance': [['cashier'], ['principal']],
  'Human Resource': [['hr'], ['principal']],
  'AI-Assisted Documents': [['assistant_principal'], ['principal']],
};
const DEFAULT_WORKFLOW = { review: ['assistant_principal'], approve: ['principal'] };
const workflowFor = (group) => {
  const w = GROUP_WORKFLOWS[group];
  if (!w) return DEFAULT_WORKFLOW;
  return { review: w[0], approve: w[1] };
};

function canSee(req, row, wf) {
  if (!row) return false;
  if (row.user_id === req.user.id) return true;
  if (isAdminRole(req.user.role)) return true;
  const roles = [...(wf.review || []), ...(wf.approve || [])];
  return roles.includes(req.user.role);
}
function canReview(req, wf) {
  if (isAdminRole(req.user.role)) return true;
  return (wf.review || []).includes(req.user.role);
}
function canApprove(req, wf) {
  if (isAdminRole(req.user.role)) return true;
  return (wf.approve || []).includes(req.user.role);
}

const SUB_STATUSES = ['draft', 'submitted', 'reviewed', 'approved', 'returned'];

async function submissionDetail(req, id) {
  const row = await q(
    `SELECT r.*, u.name AS user_name, u.username, u.role AS user_role,
            t.name AS report_name, t.code AS report_code, t.group_name, t.frequency,
            rv.name AS reviewer_name, ap.name AS approver_name
     FROM report_submissions r
     JOIN users u ON u.id = r.user_id
     JOIN report_types t ON t.id = r.report_type_id
     LEFT JOIN users rv ON rv.id = r.reviewer_id
     LEFT JOIN users ap ON ap.id = r.approver_id
     WHERE r.id = ?`,
    [id]);
  if (!row) return null;
  row.workflow = workflowFor(row.group_name);
  row.my_review = req && canReview(req, row.workflow) && row.user_id !== req.user.id;
  row.my_approve = req && canApprove(req, row.workflow) && row.user_id !== req.user.id;
  return row;
}

router.get('/types', requireRole('super_admin', 'school_admin', 'principal', 'assistant_principal', 'teacher'), asyncH(async (req, res) => {
  const { frequency, group, deped } = req.query;
  let sql = 'SELECT * FROM report_types WHERE active = TRUE';
  const params = [];
  if (frequency) { sql += ' AND frequency = ?'; params.push(frequency); }
  if (group) { sql += ' AND group_name = ?'; params.push(group); }
  if (deped === '1') { sql += ' AND is_deped_form = TRUE'; }
  sql += ' ORDER BY sort_order, id';
  const rows = await qa(sql, params);
  res.json({ data: rows, groups: await qa('SELECT DISTINCT group_name FROM report_types ORDER BY group_name') });
}));

router.get('/workflows', requireRole('super_admin', 'school_admin', 'principal', 'assistant_principal', 'teacher'), asyncH(async (req, res) => {
  const rows = await qa(
    'SELECT w.report_type_id, t.group_name, t.code, w.review_roles, w.approve_roles FROM submission_workflows w JOIN report_types t ON t.id = w.report_type_id ORDER BY t.id');
  res.json({ data: rows.map((r) => ({ ...r, review: safeJsonParse(r.review_roles, []), approve: safeJsonParse(r.approve_roles, []) })) });
}));

router.get('/teachers', requireRole('super_admin', 'school_admin', 'principal', 'assistant_principal', 'teacher'), asyncH(async (req, res) => {
  const rows = await qa(
    `SELECT id, username, name, role FROM users
     WHERE status = 'active' AND role NOT IN ('super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar')
     ORDER BY name`);
  res.json({ data: rows });
}));

router.get('/compliance', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
  const schoolYear = req.query.school_year || '2026-2027';
  const all = await qa('SELECT id, username, name, role FROM users WHERE status = ?', ['active']);
  const staff = all.filter((u) => !isAdminRole(u.role));
  const tasks = await qa(
    `SELECT r.user_id, r.report_type_id, r.status, r.due_date, t.code, t.name AS report_name, t.group_name
     FROM report_submissions r
     JOIN report_types t ON t.id = r.report_type_id
     WHERE r.school_year = ? AND r.assigned_by IS NOT NULL`,
    [schoolYear]);
  const today = new Date().toISOString().slice(0, 10);
  const kpis = { draft: 0, submitted: 0, reviewed: 0, approved: 0, returned: 0, overdue: 0, missing: 0 };
  const byUser = {};
  const taskByUser = {};
  const submissionRows = [];
  const decorate = (s) => {
    const complied = ['submitted', 'reviewed', 'approved'].includes(s.status);
    const overdue = s.due_date && s.due_date < today && !complied && s.status !== 'returned';
    const d = {
      report_type_id: s.report_type_id, code: s.code, report_name: s.report_name,
      group_name: s.group_name, status: s.status, due_date: s.due_date,
      complied, overdue,
    };
    submissionRows.push(d);
    return d;
  };
  for (const s of tasks) {
    kpis[s.status] = (kpis[s.status] || 0) + 1;
    if (s.due_date && s.due_date < today && s.status !== 'approved' && s.status !== 'returned') kpis.overdue++;
    (taskByUser[s.user_id] = taskByUser[s.user_id] || []).push(s);
    if (['submitted', 'reviewed', 'approved'].includes(s.status)) {
      (byUser[s.user_id] = byUser[s.user_id] || new Set()).add(s.report_type_id);
    }
  }
  const teachers = [];
  const dept = {};
  for (const u of staff) {
    const assigned = taskByUser[u.id] || [];
    const doneSet = byUser[u.id] || new Set();
    const done = doneSet.size;
    const missing = assigned.filter((t) => !doneSet.has(t.report_type_id)).map((t) => t.code);
    const pct = assigned.length ? Math.round((done / assigned.length) * 100) : 0;
    kpis.missing += missing.length;
    teachers.push({
      user_id: u.id, username: u.username, name: u.name, role: u.role,
      required: assigned.length, done, percent: pct, missing,
      submissions: assigned.map(decorate),
    });
    if (assigned.length) {
      const d = (dept[u.role] = dept[u.role] || { users: 0, total: 0 });
      d.users++;
      d.total += pct;
    }
  }
  const departments = Object.keys(dept).map((role) => ({
    role, teachers: dept[role].users, percent: Math.round(dept[role].total / dept[role].users),
  })).sort((a, b) => a.percent - b.percent);
  const withTasks = teachers.filter((t) => t.required > 0);
  const overall = withTasks.length ? Math.round(withTasks.reduce((s, t) => s + t.percent, 0) / withTasks.length) : 0;
  const gaps = {};
  for (const t of tasks) {
    const g = gaps[t.group_name] = gaps[t.group_name] || { required: 0, covered: 0 };
    g.required++;
    if (['submitted', 'reviewed', 'approved'].includes(t.status)) g.covered++;
  }
  const groups = Object.keys(gaps).map((g) => ({
    group: g, required: gaps[g].required, covered: gaps[g].covered,
    percent: Math.round((gaps[g].covered / gaps[g].required) * 100),
  })).sort((a, b) => a.percent - b.percent);
  res.json({ school_year: schoolYear, overall, kpis, teachers, departments, groups, assigned_tasks: tasks.length, submissions: submissionRows });
}));

router.get('/portfolio', asyncH(async (req, res) => {
  const targ = req.query.user_id || req.user.id;
  const me = await q('SELECT id, username, name, role FROM users WHERE id = ?', [targ]);
  if (!me) return res.status(404).json({ error: 'User not found' });
  if (String(targ) !== String(req.user.id) && !isAdminRole(req.user.role)) {
    return res.status(403).json({ error: 'Not allowed to view this portfolio' });
  }
  const subs = await qa(
    `SELECT r.*, t.name AS report_name, t.code, t.group_name, t.frequency, t.is_deped_form,
            rv.name AS reviewer_name, ap.name AS approver_name
     FROM report_submissions r JOIN report_types t ON t.id = r.report_type_id
     LEFT JOIN users rv ON rv.id = r.reviewer_id LEFT JOIN users ap ON ap.id = r.approver_id
     WHERE r.user_id = ? ORDER BY t.group_name, t.name`,
    [targ]);
  const categories = {};
  const counts = { draft: 0, submitted: 0, reviewed: 0, approved: 0, returned: 0 };
  for (const s of subs) {
    (categories[s.group_name] = categories[s.group_name] || []).push(s);
    counts[s.status] = (counts[s.status] || 0) + 1;
  }
  const attendanceCount = (await q('SELECT COUNT(*) AS n FROM attendance WHERE recorded_by = ?', [targ]))?.n || 0;
  res.json({
    user: me,
    categories,
    counts,
    attendanceCount,
    total_submissions: subs.length,
  });
}));

router.get('/', requireRole('super_admin', 'school_admin', 'principal', 'assistant_principal', 'teacher'), asyncH(async (req, res) => {
  const schoolYear = req.query.school_year || null;
  const teacherId = req.query.teacher_id || null;
  const status = req.query.status || null;
  const reportType = req.query.report_type_id || null;
  let sql =
    `SELECT r.*, u.name AS user_name, u.role AS user_role,
            t.name AS report_name, t.code AS report_code, t.group_name, t.frequency, t.is_deped_form,
            rv.name AS reviewer_name, ap.name AS approver_name
     FROM report_submissions r
     JOIN users u ON u.id = r.user_id
     JOIN report_types t ON t.id = r.report_type_id
     LEFT JOIN users rv ON rv.id = r.reviewer_id
     LEFT JOIN users ap ON ap.id = r.approver_id`;
  const where = [];
  const params = [];
  if (schoolYear) { where.push('r.school_year = ?'); params.push(schoolYear); }
  if (teacherId) { where.push('r.teacher_id = ?'); params.push(teacherId); }
  if (status) { where.push('r.status = ?'); params.push(status); }
  if (reportType) { where.push('r.report_type_id = ?'); params.push(reportType); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY r.updated_at DESC, r.id DESC';
  const rows = await qa(sql, params);
  const usable = [];
  for (const r of rows) {
    const wf = workflowFor(r.group_name);
    if (canSee(req, r, wf)) {
      r.my_review = canReview(req, wf) && r.user_id !== req.user.id;
      r.my_approve = canApprove(req, wf) && r.user_id !== req.user.id;
      usable.push(r);
    }
  }
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 25), 100);
  const offset = (page - 1) * limit;
  const total = usable.length;
  res.json({ data: usable.slice(offset, offset + limit), total, page, limit, totalPages: Math.ceil(total / limit) });
}));

router.post('/', requireRole('super_admin', 'school_admin', 'principal', 'assistant_principal', 'teacher'), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.report_type_id || !b.period) return res.status(400).json({ error: 'report_type_id and period are required' });
  const type = await q('SELECT * FROM report_types WHERE id = ?', [b.report_type_id]);
  if (!type) return res.status(404).json({ error: 'Report type not found' });
  let teacherId = null;
  if (b.teacher_id) {
    const t = await q('SELECT id FROM teachers WHERE id = ?', [b.teacher_id]);
    if (t) teacherId = b.teacher_id;
  }
  const id = await qi(
    `INSERT INTO report_submissions (report_type_id, user_id, teacher_id, school_year, period, status, notes, due_date, draft_body, files_json)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
    [type.id, req.user.id, teacherId, b.school_year || '2026-2027', b.period, b.notes || null, b.due_date || null, b.draft_body || null, b.files_json || null]);
  await audit(req, 'CREATE_SUBMISSION', 'report_submissions', id, { report: type.code, period: b.period });
  res.status(201).json({ id, detail: await submissionDetail(req, id) });
}));

router.patch('/:id', requireRole('super_admin', 'school_admin', 'principal', 'assistant_principal', 'teacher'), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM report_submissions WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Submission not found' });
  if (row.user_id !== req.user.id && !isAdminRole(req.user.role)) {
    return res.status(403).json({ error: 'Only the owner can edit this submission' });
  }
  if (row.status !== 'draft' && row.status !== 'returned' && !isAdminRole(req.user.role)) {
    return res.status(409).json({ error: 'Only draft or returned submissions can be edited' });
  }
  const b = req.body || {};
  const f = (k, d) => b[k] !== undefined ? b[k] : d;
  await qr(
    `UPDATE report_submissions SET period = ?, notes = ?, due_date = ?, draft_body = ?, files_json = ?, updated_at = ${nowSql()} WHERE id = ?`,
    [f('period', row.period), f('notes', row.notes), f('due_date', row.due_date), f('draft_body', row.draft_body), f('files_json', row.files_json), row.id]);
  await audit(req, 'UPDATE_SUBMISSION', 'report_submissions', row.id);
  res.json({ detail: await submissionDetail(req, row.id) });
}));

router.post('/:id/submit', requireRole('super_admin', 'school_admin', 'principal', 'assistant_principal', 'teacher'), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM report_submissions WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Submission not found' });
  if (row.user_id !== req.user.id) return res.status(403).json({ error: 'Only the owner can submit' });
  if (row.status !== 'draft' && row.status !== 'returned') return res.status(409).json({ error: 'Already submitted' });
  await qr(`UPDATE report_submissions SET status = 'submitted', updated_at = ${nowSql()} WHERE id = ?`, [row.id]);
  await audit(req, 'SUBMIT_REPORT', 'report_submissions', row.id);
  res.json({ detail: await submissionDetail(req, row.id) });
}));

router.post('/:id/review', requireRole('super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'guidance', 'teacher'), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM report_submissions WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Submission not found' });
  const type = await q('SELECT group_name FROM report_types WHERE id = ?', [row.report_type_id]);
  const wf = workflowFor(type.group_name);
  if (!canReview(req, wf)) return res.status(403).json({ error: 'You are not the reviewer for this report' });
  if (row.status !== 'submitted') return res.status(409).json({ error: 'Only submitted reports can be reviewed' });
  const approved = (req.body || {}).approved;
  const note = (req.body || {}).review_note || null;
  const next = approved ? 'reviewed' : 'returned';
  await qr(
    `UPDATE report_submissions SET status = ?, review_note = ?, reviewer_id = ?, reviewed_at = ${nowSql()}, updated_at = ${nowSql()} WHERE id = ?`,
    [next, note, req.user.id, row.id]);
  await audit(req, 'REVIEW_REPORT', 'report_submissions', row.id, { outcome: next, note });
  res.json({ detail: await submissionDetail(req, row.id) });
}));

router.post('/:id/approve', requireRole('super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'guidance', 'teacher'), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM report_submissions WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Submission not found' });
  const type = await q('SELECT group_name FROM report_types WHERE id = ?', [row.report_type_id]);
  const wf = workflowFor(type.group_name);
  if (!canApprove(req, wf)) return res.status(403).json({ error: 'You are not the approver for this report' });
  if (row.status !== 'reviewed') return res.status(409).json({ error: 'Report must be reviewed before approval' });
  await qr(
    `UPDATE report_submissions SET status = 'approved', approver_id = ?, approved_at = ${nowSql()}, updated_at = ${nowSql()} WHERE id = ?`,
    [req.user.id, row.id]);
  await audit(req, 'APPROVE_REPORT', 'report_submissions', row.id);
  res.json({ detail: await submissionDetail(req, row.id) });
}));

router.post('/:id/return', requireRole('super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'guidance', 'teacher'), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM report_submissions WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Submission not found' });
  const type = await q('SELECT group_name FROM report_types WHERE id = ?', [row.report_type_id]);
  const wf = workflowFor(type.group_name);
  if (row.user_id !== req.user.id && !canReview(req, wf) && !canApprove(req, wf)) {
    return res.status(403).json({ error: 'Not allowed to return this report' });
  }
  if (row.status === 'approved' || row.status === 'draft' || row.status === 'returned') {
    return res.status(409).json({ error: 'Cannot return this report at its current stage' });
  }
  await qr(
    `UPDATE report_submissions SET status = 'returned', review_note = ?, reviewer_id = ?, reviewed_at = ${nowSql()}, updated_at = ${nowSql()} WHERE id = ?`,
    [(req.body || {}).review_note || null, req.user.id, row.id]);
  await audit(req, 'RETURN_REPORT', 'report_submissions', row.id, { note: (req.body || {}).review_note || null });
  res.json({ detail: await submissionDetail(req, row.id) });
}));

router.delete('/:id', requireRole(...ADMIN_ROLES, 'teacher'), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM report_submissions WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Submission not found' });
  if (row.user_id !== req.user.id && !isAdminRole(req.user.role)) {
    return res.status(403).json({ error: 'Only the owner or an admin can delete' });
  }
  if (row.status !== 'draft' && !isAdminRole(req.user.role)) {
    return res.status(409).json({ error: 'Only draft submissions can be deleted' });
  }
  await qr('DELETE FROM report_submissions WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_SUBMISSION', 'report_submissions', row.id);
  res.json({ ok: true });
}));

function draftFor(code, ctx) {
  const school = 'Hinabangan National High School\nHinabangan, Samar\nSchool Year: ' + (ctx.school_year || '2026-2027');
  const by = ctx.user_name || '______________________';
  const period = ctx.period || '';
  const footer = 'Prepared by: ' + by + '\nNoted by / Approved by:\n\n______________________\n______________________';
  const is = (...codes) => codes.some((c) => code.includes(c));
  if (is('dll', 'dlp', 'lesson_exemplar', 'lesson_plan', 'weekly_learning_plan')) {
    return `${school}\n\nDAILY LESSON LOG / LESSON PLAN DRAFT\nPeriod: ${period}\n\n` +
      `I. OBJECTIVES\n  - Content and performance standards to be listed here.\n` +
      `II. SUBJECT MATTER\n  - Topic: ______________________   Subject: ${ctx.subject || '____________'}\n  - References and materials: ______________________\n` +
      `III. LEARNING PROCEDURE\n  A. Review / Motivation\n  B. Lesson proper (discussion, guided practice)\n  C. Application / Deepen\n  D. Generalization\n  E. Evaluation (formative task)\n  F. Agreement / Assignment\n` +
      `IV. REMARKS\n\nV. REFLECTION (learners to master / needing remediation)`;
  }
  if (is('narrative', 'accomplishment') || code === 'year_end_report') {
    return `${school}\n\n${code.includes('accomplishment') ? 'ACCOMPLISHMENT' : 'NARRATIVE'} REPORT (DRAFT)\nPeriod: ${period}\n\n` +
      `I. INTRODUCTION\n  - Brief background of the activity/period covered.\n` +
      `II. HIGHLIGHTS\n  - Key activities conducted and learner outcomes.\n` +
      `III. PROBLEMS ENCOUNTERED\n\nIV. RECOMMENDATIONS\n\nV. ANNEXES\n  - Photos, attendance sheets, and supporting documents.`;
  }
  if (is('parent_letter')) {
    return `${school}\n\n${new Date().toLocaleDateString()}\n\nDear Parent/Guardian of ______________________,\n\n` +
      `This letter is to inform you about ${ctx.period || ''} in connection with your child's\nacademic progress and well-being at ${school.split('\n')[0]}.\n\n` +
      `Please see the attached documentation and do not hesitate to contact the school\nfor any clarification.\n\nRespectfully yours,\n${by}`;
  }
  if (is('recommendation_letter')) {
    return `${school}\n\n${new Date().toLocaleDateString()}\n\nTo Whom It May Concern,\n\n` +
      `I wholeheartedly recommend ______________________ for ${ctx.period || 'the position/program'}.\n\n` +
      `The candidate has consistently demonstrated competence, professionalism, and commitment\nduring their time with us.\n\nVery truly yours,\n${by}\n______________________\nPosition: ______________________`;
  }
  if (is('meeting_minutes')) {
    return `${school}\n\nMEETING MINUTES (DRAFT)\nMeeting: ______________________\nDate: ${new Date().toLocaleDateString()}\n\n` +
      `A. CALL TO ORDER & ATTENDANCE\nB. AGENDA\n  1. ______________________\n  2. ______________________\nC. DISCUSSION NOTES\nD. AGREEMENTS / ACTION ITEMS\n  1. ______________________ - person responsible: _____ - deadline: ____\nE. NEXT MEETING\n\nMinutes taken by:\n${by}`;
  }
  if (is('certificate')) {
    return `${school}\n\nCERTIFICATE OF (COMPLETION|RECOGNITION|PARTICIPATION)\n\nThis is to certify that\n${by}\nhas satisfactorily ${ctx.period || 'participated in______________________'}\n\nGiven this day of ____________, 20__, at ${school.split('\n')[0]}.`;
  }
  if (is('exam', 'test_questions', 'rubric')) {
    return code.includes('rubric')
      ? `${school}\n\nRUBRIC DRAFT\nTask: ______________________\n\n` +
        `Criteria / Weight (e.g., 4 = Excellent ... 1 = Needs Improvement) with descriptors.\nTable: Criteria | 4 | 3 | 2 | 1`
      : `${school}\n\nEXAMINATION DRAFT (${ctx.period || 'Quarter ' + (ctx.quarter || '1')})\nSubject: ${ctx.subject || '____________'}\n\n` +
        `I. MULTIPLE CHOICE (15 items)\n1. ______________________ a. ___ b. ___ c. ___ d. ___\n\n` +
        `II. IDENTIFICATION (10 items)\n\nIII. ESSAY (2 items)\n\nIV. ANSWER KEY\n--------------------------`;
  }
  if (is('intervention', 'remediation', 'recovery', 'risk', 'learning_plan')) {
    return `${school}\n\nINTERVENTION / REMEDIATION PLAN (DRAFT)\nPeriod: ${period}\n\n` +
      `Learner(s) targeted: ______________________\nDifficulty observed: ______________________\n\n` +
      `Intervention / Strategy      | Frequency | Person in charge\n____________________________ | __________ | __________________\n\n` +
      `Monitoring and evidence: ______________________\nEvaluation date: ______________________`;
  }
  if (is('reading', 'phil_iri', 'egra', 'numeracy')) {
    return `${school}\n\nREADING / NUMERACY REPORT (DRAFT)\nPeriod: ${period}\n\n` +
      `Assessment used: ______________________  Date: ______________________\n\n` +
      `Learner | Pre-test | Post-test | Remarks\n_______ | ________ | _________ | _______\n\n` +
      `Next steps: ______________________`;
  }
  if (is('observation')) {
    return `${school}\n\nCLASSROOM OBSERVATION (DRAFT)\nTeacher observed: ______________________\nDate: ______________________\n\n` +
      `Indicator | Notes | Rating\n_________ | _____ | ______\n\nSummary and feedback to be completed by the observer.`;
  }
  if (is('budget', 'purchase', 'proposal', 'activity_proposal')) {
    return `${school}\n\nBUDGET / ACTIVITY PROPOSAL (DRAFT)\nTitle: ______________________\nDate / venue: ______________________\n\n` +
      `Objectives / Rationale\n\nItem | Qty | Unit cost | Amount\n____ | ___ | _________ | ______\n\nSource of funds / final approval: ______________________`;
  }
  if (is('leave')) {
    return `${school}\n\nLEAVE APPLICATION (DRAFT)\nApplicant: ${by}\nType of leave: ______________________\nInclusive dates: ______________________\n\n` +
      `Reason: ______________________\n\nApproved by (dept head): ______________\nRecommended by: ______________________\nApproved by: ______________________`;
  }
  return `${school}\n\n${code.toUpperCase()} — REPORT (DRAFT)\nPeriod: ${period}\n\n` +
    `A. Background\nB. Details / Data\nC. Findings\nD. Recommendations\nE. Attachments\n\n${footer}`;
}

router.post('/generate-draft', requireRole('super_admin', 'school_admin', 'principal', 'assistant_principal', 'teacher'), asyncH(async (req, res) => {
  const b = req.body || {};
  const type = b.report_type_id
    ? await q('SELECT * FROM report_types WHERE id = ?', [b.report_type_id])
    : b.code ? await q('SELECT * FROM report_types WHERE code = ?', [b.code])
      : null;
  if (!type) return res.status(404).json({ error: 'Report type not found' });
  if (!type.auto_generate) return res.status(400).json({ error: 'This report type does not support auto-drafting' });
  const ctx = {
    user_name: req.user.name,
    school_year: b.school_year || '2026-2027',
    period: b.period || '',
    subject: b.subject || '____________',
    quarter: b.quarter || '1',
  };
  res.json({ code: type.code, name: type.name, draft_body: draftFor(type.code, ctx) });
}));

// Admin-initiated task assignment — creates a submission task for each
// selected teacher. Compliance is computed only from these assigned tasks.
router.post('/assign', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.report_type_id || !b.period) return res.status(400).json({ error: 'report_type_id and period are required' });
  const type = await q('SELECT * FROM report_types WHERE id = ?', [b.report_type_id]);
  if (!type) return res.status(404).json({ error: 'Report type not found' });
  const userIds = Array.isArray(b.user_ids) ? [...new Set(b.user_ids.map(Number).filter(Boolean))] : [];
  if (!userIds.length) return res.status(400).json({ error: 'Select at least one teacher to assign the task to' });
  const users = await qa('SELECT id, username FROM users WHERE id IN (' + userIds.map(() => '?').join(',') + ') AND status = ?', [...userIds, 'active']);
  const validIds = new Set(users.map((u) => u.id));
  const sy = b.school_year || '2026-2027';
  const created = [];
  const skipped = [];
  for (const uid of userIds) {
    if (!validIds.has(uid)) { skipped.push({ user_id: uid, reason: 'no active user account' }); continue; }
    const dup = await q(
      'SELECT id FROM report_submissions WHERE user_id = ? AND report_type_id = ? AND school_year = ? AND period = ?',
      [uid, type.id, sy, b.period]);
    if (dup) { skipped.push({ user_id: uid, reason: 'already assigned' }); continue; }
    const id = await qi(
      `INSERT INTO report_submissions (report_type_id, user_id, teacher_id, school_year, period, status, notes, due_date, draft_body, assigned_by)
       VALUES (?, ?, NULL, ?, ?, 'draft', ?, ?, ?, ?)`,
      [type.id, uid, sy, b.period, b.notes || null, b.due_date || null, b.draft_body || null, req.user.id]);
    created.push(id);
  }
  await audit(req, 'ASSIGN_TASK', 'report_submissions', created[0] || null,
    { report: type.code, period: b.period, school_year: sy, assigned: created.length, skipped: skipped.length });
  res.status(201).json({ created, skipped, count: created.length });
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = /\.(jpg|jpeg|png|gif|webp|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip)$/i;
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv', 'application/zip',
    ];
    if (!allowedExts.test(ext)) return cb(new Error('File type not allowed'));
    if (!allowedMimes.includes(file.mimetype)) return cb(new Error('File MIME type not allowed'));
    cb(null, true);
  },
});

const ATTACH_ROLES = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'guidance', 'teacher'];

router.post('/:id/attachments', requireRole(...ATTACH_ROLES), upload.single('file'), asyncH(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const sub = await q('SELECT id FROM report_submissions WHERE id = ?', [req.params.id]);
  if (!sub) return res.status(404).json({ error: 'Submission not found' });
  const { key } = await uploadFile('submissions', req.file, req.file.originalname);
  const fileId = await qi(
    `INSERT INTO submission_files (submission_id, filename, stored_name, size_bytes, mime) VALUES (?, ?, ?, ?, ?)`,
    [sub.id, req.file.originalname, key, req.file.size, req.file.mimetype]);
  await audit(req, 'UPLOAD_SUBMISSION_FILE', 'submission_files', fileId, { submission_id: sub.id, key });
  res.json({ ok: true, file: { id: fileId, submission_id: sub.id, filename: req.file.originalname, stored_name: key, size_bytes: req.file.size, mime: req.file.mimetype } });
}));

router.get('/:id/attachments', requireRole(...ATTACH_ROLES), asyncH(async (req, res) => {
  const rows = await qa('SELECT * FROM submission_files WHERE submission_id = ? ORDER BY uploaded_at DESC', [req.params.id]);
  res.json({ data: rows });
}));

router.delete('/:id/attachments/:fileId', requireRole(...ATTACH_ROLES), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM submission_files WHERE id = ? AND submission_id = ?', [req.params.fileId, req.params.id]);
  if (!row) return res.status(404).json({ error: 'File not found' });
  deleteFile(row.stored_name).catch(() => {});
  await qr('DELETE FROM submission_files WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_SUBMISSION_FILE', 'submission_files', row.id, { submission_id: req.params.id, key: row.stored_name });
  res.json({ ok: true });
}));

module.exports = router;
