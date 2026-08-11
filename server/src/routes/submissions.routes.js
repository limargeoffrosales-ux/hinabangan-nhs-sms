const path = require('path');
const fs = require('fs');
const multer = require('multer');
const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole, ADMIN_ROLES, isAdminRole } = require('../auth');
const { asyncH, audit } = require('../utils');
const { DATA_DIR } = require('../config');
const { REPORT_TYPES } = require('../report-types');

const router = express.Router();
router.use(authenticate);

const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname || '').toLowerCase()}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
});

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
  row.files = await qa('SELECT id, filename, size_bytes, mime, uploaded_at FROM submission_files WHERE submission_id = ? ORDER BY id', [id]);
  row.workflow = workflowFor(row.group_name);
  row.my_review = req && canReview(req, row.workflow) && row.user_id !== req.user.id;
  row.my_approve = req && canApprove(req, row.workflow) && row.user_id !== req.user.id;
  return row;
}

router.get('/types', asyncH(async (req, res) => {
  const { frequency, group, deped } = req.query;
  let sql = 'SELECT * FROM report_types WHERE active = 1';
  const params = [];
  if (frequency) { sql += ' AND frequency = ?'; params.push(frequency); }
  if (group) { sql += ' AND group_name = ?'; params.push(group); }
  if (deped === '1') { sql += ' AND is_deped_form = 1'; }
  sql += ' ORDER BY sort_order, id';
  const rows = await qa(sql, params);
  res.json({ data: rows, groups: await qa('SELECT DISTINCT group_name FROM report_types ORDER BY group_name') });
}));

router.get('/workflows', asyncH(async (req, res) => {
  const rows = await qa(
    'SELECT w.report_type_id, t.group_name, t.code, w.review_roles, w.approve_roles FROM submission_workflows w JOIN report_types t ON t.id = w.report_type_id ORDER BY t.id');
  res.json({ data: rows.map((r) => ({ ...r, review: JSON.parse(r.review_roles), approve: JSON.parse(r.approve_roles) })) });
}));

router.get('/', asyncH(async (req, res) => {
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
  res.json({ data: usable });
}));

router.post('/', asyncH(async (req, res) => {
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
    `INSERT INTO report_submissions (report_type_id, user_id, teacher_id, school_year, period, status, notes, due_date, draft_body)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
    [type.id, req.user.id, teacherId, b.school_year || '2025-2026', b.period, b.notes || null, b.due_date || null, b.draft_body || null]);
  await audit(req, 'CREATE_SUBMISSION', 'report_submissions', id, { report: type.code, period: b.period });
  res.status(201).json({ id, detail: await submissionDetail(req, id) });
}));

router.post('/:id/files', upload.array('files', 10), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM report_submissions WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Submission not found' });
  if (row.user_id !== req.user.id && !isAdminRole(req.user.role)) {
    return res.status(403).json({ error: 'Only the owner can attach files' });
  }
  const files = req.files || [];
  const created = [];
  for (const f of files) {
    const fid = await qi(
      'INSERT INTO submission_files (submission_id, filename, stored_name, size_bytes, mime) VALUES (?, ?, ?, ?, ?)',
      [row.id, f.originalname, f.filename, f.size, f.mimetype]);
    created.push({ id: fid, filename: f.originalname });
  }
  await qr('UPDATE report_submissions SET updated_at = datetime(\'now\') WHERE id = ?', [row.id]);
  await audit(req, 'UPLOAD_FILES', 'report_submissions', row.id, { count: created.length });
  res.status(201).json({ files: created });
}));

router.get('/files/:fileId', asyncH(async (req, res) => {
  const f = await q(
    `SELECT f.*, r.user_id FROM submission_files f JOIN report_submissions r ON r.id = f.submission_id WHERE f.id = ?`,
    [req.params.fileId]);
  if (!f) return res.status(404).json({ error: 'File not found' });
  const sub = await q('SELECT * FROM report_submissions WHERE id = ?', [f.submission_id]);
  const wf = workflowFor((await q('SELECT group_name FROM report_types WHERE id = ?', [sub.report_type_id])).group_name);
  if (!canSee(req, sub, wf)) return res.status(403).json({ error: 'Not allowed' });
  const disk = path.join(UPLOAD_DIR, f.stored_name);
  if (!fs.existsSync(disk)) return res.status(404).json({ error: 'File missing on disk' });
  res.setHeader('Content-Type', f.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(f.filename)}"`);
  res.setHeader('X-Filename', encodeURIComponent(f.filename));
  fs.createReadStream(disk).pipe(res);
}));

router.patch('/:id', asyncH(async (req, res) => {
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
    'UPDATE report_submissions SET period = ?, notes = ?, due_date = ?, draft_body = ?, updated_at = datetime(\'now\') WHERE id = ?',
    [f('period', row.period), f('notes', row.notes), f('due_date', row.due_date), f('draft_body', row.draft_body), row.id]);
  await audit(req, 'UPDATE_SUBMISSION', 'report_submissions', row.id);
  res.json({ detail: await submissionDetail(req, row.id) });
}));

router.post('/:id/submit', asyncH(async (req, res) => {
  const row = await q('SELECT * FROM report_submissions WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Submission not found' });
  if (row.user_id !== req.user.id) return res.status(403).json({ error: 'Only the owner can submit' });
  if (row.status !== 'draft' && row.status !== 'returned') return res.status(409).json({ error: 'Already submitted' });
  await qr('UPDATE report_submissions SET status = \'submitted\', updated_at = datetime(\'now\') WHERE id = ?', [row.id]);
  await audit(req, 'SUBMIT_REPORT', 'report_submissions', row.id);
  res.json({ detail: await submissionDetail(req, row.id) });
}));

router.post('/:id/review', asyncH(async (req, res) => {
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
    `UPDATE report_submissions SET status = ?, review_note = ?, reviewer_id = ?, reviewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [next, note, req.user.id, row.id]);
  await audit(req, 'REVIEW_REPORT', 'report_submissions', row.id, { outcome: next, note });
  res.json({ detail: await submissionDetail(req, row.id) });
}));

router.post('/:id/approve', asyncH(async (req, res) => {
  const row = await q('SELECT * FROM report_submissions WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Submission not found' });
  const type = await q('SELECT group_name FROM report_types WHERE id = ?', [row.report_type_id]);
  const wf = workflowFor(type.group_name);
  if (!canApprove(req, wf)) return res.status(403).json({ error: 'You are not the approver for this report' });
  if (row.status !== 'reviewed') return res.status(409).json({ error: 'Report must be reviewed before approval' });
  await qr(
    `UPDATE report_submissions SET status = 'approved', approver_id = ?, approved_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [req.user.id, row.id]);
  await audit(req, 'APPROVE_REPORT', 'report_submissions', row.id);
  res.json({ detail: await submissionDetail(req, row.id) });
}));

router.post('/:id/return', asyncH(async (req, res) => {
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
    `UPDATE report_submissions SET status = 'returned', review_note = ?, reviewer_id = ?, reviewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
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
  const files = await qa('SELECT stored_name FROM submission_files WHERE submission_id = ?', [row.id]);
  for (const f of files) {
    const disk = path.join(UPLOAD_DIR, f.stored_name);
    if (fs.existsSync(disk)) fs.unlinkSync(disk);
  }
  await qr('DELETE FROM report_submissions WHERE id = ?', [row.id]);
  await audit(req, 'DELETE_SUBMISSION', 'report_submissions', row.id);
  res.json({ ok: true });
}));

function draftFor(code, ctx) {
  const school = 'Hinabangan National High School\nHinabangan, Samar\nSchool Year: ' + (ctx.school_year || '2025-2026');
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
  return `${school}\n\n${code.toUpperCase()} â€” REPORT (DRAFT)\nPeriod: ${period}\n\n` +
    `A. Background\nB. Details / Data\nC. Findings\nD. Recommendations\nE. Attachments\n\n${footer}`;
}

router.post('/generate-draft', asyncH(async (req, res) => {
  const b = req.body || {};
  const type = b.report_type_id
    ? await q('SELECT * FROM report_types WHERE id = ?', [b.report_type_id])
    : b.code ? await q('SELECT * FROM report_types WHERE code = ?', [b.code])
      : null;
  if (!type) return res.status(404).json({ error: 'Report type not found' });
  if (!type.auto_generate) return res.status(400).json({ error: 'This report type does not support auto-drafting' });
  const ctx = {
    user_name: req.user.name,
    school_year: b.school_year || '2025-2026',
    period: b.period || '',
    subject: b.subject || '____________',
    quarter: b.quarter || '1',
  };
  res.json({ code: type.code, name: type.name, draft_body: draftFor(type.code, ctx) });
}));

router.get('/compliance', asyncH(async (req, res) => {
  const schoolYear = req.query.school_year || '2025-2026';
  const all = await qa('SELECT id, username, name, role FROM users WHERE status = ?', ['active']);
  const staff = all.filter((u) => !isAdminRole(u.role));
  const template = await qa('SELECT id, code, group_name FROM report_types WHERE active = 1 AND required = 1');
  const subs = await qa(
    `SELECT user_id, report_type_id, status, due_date FROM report_submissions WHERE school_year = ?`,
    [schoolYear]);
  const today = new Date().toISOString().slice(0, 10);
  const kpis = { draft: 0, submitted: 0, reviewed: 0, approved: 0, returned: 0, overdue: 0, missing: 0 };
  const byUser = {};
  for (const s of subs) {
    kpis[s.status] = (kpis[s.status] || 0) + 1;
    if (s.due_date && s.due_date < today && s.status !== 'approved' && s.status !== 'returned') kpis.overdue++;
    if (!byUser[s.user_id]) byUser[s.user_id] = new Set();
    if (['submitted', 'reviewed', 'approved'].includes(s.status)) byUser[s.user_id].add(s.report_type_id);
  }
  const teachers = [];
  const dept = {};
  for (const u of staff) {
    const doneSet = byUser[u.id] || new Set();
    const done = doneSet.size;
    const missing = template.filter((t) => !doneSet.has(t.id)).map((t) => t.code);
    const pct = template.length ? Math.round((done / template.length) * 100) : 0;
    kpis.missing += missing.length;
    teachers.push({ user_id: u.id, username: u.username, name: u.name, role: u.role, required: template.length, done, percent: pct, missing });
    const d = (dept[u.role] = dept[u.role] || { users: 0, total: 0 });
    d.users++;
    d.total += pct;
  }
  const departments = Object.keys(dept).map((role) => ({
    role, teachers: dept[role].users, percent: Math.round(dept[role].total / dept[role].users),
  })).sort((a, b) => a.percent - b.percent);
  const overall = teachers.length ? Math.round(teachers.reduce((s, t) => s + t.percent, 0) / teachers.length) : 0;
  const coveredTypes = new Set();
  for (const u of staff) {
    for (const tId of byUser[u.id] || []) coveredTypes.add(tId);
  }
  const gaps = {};
  for (const t of template) {
    if (!gaps[t.group_name]) gaps[t.group_name] = { required: 0, covered: 0 };
    gaps[t.group_name].required++;
    if (coveredTypes.has(t.id)) gaps[t.group_name].covered++;
  }
  const groups = Object.keys(gaps).map((g) => ({
    group: g, required: gaps[g].required, covered: gaps[g].covered,
    percent: Math.round((gaps[g].covered / gaps[g].required) * 100),
  })).sort((a, b) => a.percent - b.percent);
  res.json({ school_year: schoolYear, overall, kpis, teachers, departments, groups });
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
  const files = await qa(
    `SELECT f.id, f.filename, f.size_bytes, f.uploaded_at, t.code FROM submission_files f
     JOIN report_submissions r ON r.id = f.submission_id
     JOIN report_types t ON t.id = r.report_type_id
     WHERE r.user_id = ? ORDER BY f.uploaded_at DESC LIMIT 50`,
    [targ]);
  const attendanceCount = (await q('SELECT COUNT(*) AS n FROM attendance WHERE recorded_by = ?', [targ]))?.n || 0;
  res.json({
    user: me,
    categories,
    counts,
    files,
    attendanceCount,
    total_submissions: subs.length,
  });
}));

module.exports = router;
