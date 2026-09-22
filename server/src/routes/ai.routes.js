const express = require('express');
const db = require('../db');
const { q, qa, qi, qr } = db;
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');
const { ensureTeacherSeesStudent } = require('../scope');
const { userRateLimit } = require('../middleware/rate-limit');
const logger = require('../logger');
const ai = require('../ai');

const router = express.Router();
router.use(authenticate);

// AI access matrix (deliberate per-role decision):
//   /chat                -> staff + student + parent (generic policy Q&A; no tenant data in prompts)
//   /lesson-plan, /exam  -> staff
//   /report              -> admin + teacher
//   /analyze             -> admin + teacher + guidance
//   /enrollment-suggest  -> admin + teacher
//   /form-137            -> admin + teacher + registrar
//   /chat-logs[/stats]   -> admin
// Each endpoint enforces its own requireRole allow-list; there is no global
// super-admin gate. Student-scope checks apply to teachers only (guidance is a
// school-wide role in the single-school model).

const aiUserLimiter = userRateLimit({ windowMs: 60_000, limit: 10, message: { error: 'AI request limit reached. Try again in a minute.' } });

const STAFF = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'teacher', 'guidance'];
const ADMIN = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];

// Fail-closed consent gate: transmitting student data to external AI providers
// is disabled unless 'ai_student_data_consent' is explicitly enabled in
// app_settings (Settings page), i.e. after the school has obtained the required
// parental/guardian consent. Prompts also have LRN/address/contact stripped.
// Operator escape hatch: AI_ALLOW_STUDENT_DATA=1 skips the gate for this
// deployment (local/dev/demo). Production keeps the fail-closed default unless
// the operator explicitly opts in.
async function assertStudentDataConsent(req, res) {
  if (process.env.AI_ALLOW_STUDENT_DATA === '1') return null;
  const row = await q("SELECT value FROM app_settings WHERE key = 'ai_student_data_consent'");
  if (!row || String(row.value).trim() !== '1') {
    await audit(req, 'AI_STUDENT_DATA_BLOCKED', 'ai', null, { reason: 'consent not enabled' });
    return res.status(403).json({ error: 'AI processing of student data is disabled until data-consent is enabled by an administrator.' });
  }
  return null;
}

function egressAudit(req, endpoint, studentId, studentName, fields) {
  audit(req, 'AI_STUDENT_DATA_EGRESS', 'ai', null, { endpoint, student_id: studentId, student_name: studentName, pii_fields: fields }).catch(() => {});
}

router.get('/status', asyncH(async (_req, res) => {
  res.json(ai.getProviderInfo());
}));

// Admin toggle for AI student-data processing (consent gate). Disabled by
// default; enable only after parental/guardian consent has been obtained.
router.put('/consent-setting', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
  const enabled = req.body?.enabled ? '1' : '0';
  await qr(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    ['ai_student_data_consent', enabled]);
  await audit(req, 'AI_CONSENT_SETTING', 'ai', null, { enabled });
  res.json({ ok: true, enabled: enabled === '1' });
}));

router.post('/chat', requireRole(...STAFF, 'student', 'parent'), aiUserLimiter, asyncH(async (req, res) => {
  const { messages, context } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }
  let ctx = context || '';
  // PII guardrail (docs/29): never hand the user's real name to the hosted AI
  // provider — send only their role, so the assistant knows how to answer.
  if (req.user) ctx += '\nLogged in as: user (role: ' + req.user.role + ')';

  const lastUserMsg = messages[messages.length - 1];
  const userText = lastUserMsg?.content || '';
  qi('INSERT INTO ai_chat_logs (user_id, role, message) VALUES (?, ?, ?)', [req.user.id, 'user', userText]).catch((err) => {
    logger.error({ err: err.message }, '[AI_CHAT] failed to persist user log');
  });

  try {
    const reply = await ai.chatMessage(
      messages.map(m => ({ role: m.role || 'user', content: m.content })),
      ctx
    );
    qi('INSERT INTO ai_chat_logs (user_id, role, message) VALUES (?, ?, ?)', [req.user.id, 'assistant', reply]).catch((err) => {
      logger.error({ err: err.message }, '[AI_CHAT] failed to persist assistant log');
    });
    await audit(req, 'AI_CHAT', 'ai', null, { message_count: messages.length });
    res.json({ reply });
  } catch (e) {
    if (e.message.includes('AI not configured')) {
      return res.status(503).json({ error: 'AI service not configured. Set GROQ_API_KEY in your environment variables.' });
    }
    throw e;
  }
}));

router.post('/report', requireRole(...ADMIN, 'teacher'), aiUserLimiter, asyncH(async (req, res) => {
  const { student_id } = req.body || {};
  if (!student_id) return res.status(400).json({ error: 'student_id required' });
  if (req.user.role === 'teacher') {
    const chk = await ensureTeacherSeesStudent(req.user, student_id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }
  const blocked = await assertStudentDataConsent(req, res);
  if (blocked) return blocked;
  const st = await q('SELECT first_name, last_name FROM students WHERE id = ?', [student_id]);
  if (!st) return res.status(404).json({ error: 'Student not found' });
  try {
    const report = await ai.generateStudentReport(student_id);
    egressAudit(req, 'report', student_id, st.first_name + ' ' + st.last_name, ['name']);
    await audit(req, 'AI_REPORT', 'ai', null, { student_id });
    res.json(report);
  } catch (e) {
    logger.error({ student_id, err: e.message }, '[AI_REPORT] Error:');
    if (e.message.includes('AI not configured') || e.message.includes('GROQ_API_KEY')) {
      return res.status(503).json({ error: 'AI service not configured. Set GROQ_API_KEY in your environment variables.' });
    }
    if (e.status === 401 || e.status === 403) {
      return res.status(503).json({ error: 'AI provider rejected the API key. Check GROQ_API_KEY value.' });
    }
    if (e.status === 429) {
      return res.status(429).json({ error: 'AI rate limit exceeded. Try again in a moment.' });
    }
    return res.status(500).json({ error: 'AI report generation failed. Try again.' });
  }
}));

router.post('/lesson-plan', requireRole(...STAFF), aiUserLimiter, asyncH(async (req, res) => {
  const plan = await ai.generateLessonPlan(req.body || {});
  await audit(req, 'AI_LESSON_PLAN', 'ai', null, { subject_id: req.body?.subject_id, topic: req.body?.topic });
  res.json(plan);
}));

router.post('/exam', requireRole(...STAFF), aiUserLimiter, asyncH(async (req, res) => {
  const exam = await ai.generateExam(req.body || {});
  await audit(req, 'AI_EXAM', 'ai', null, { subject_id: req.body?.subject_id, topic: req.body?.topic });
  res.json(exam);
}));

router.post('/analyze', requireRole(...ADMIN, 'teacher', 'guidance'), aiUserLimiter, asyncH(async (req, res) => {
  const { student_id } = req.body || {};
  if (!student_id) return res.status(400).json({ error: 'student_id required' });
  if (req.user.role === 'teacher') {
    const chk = await ensureTeacherSeesStudent(req.user, student_id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }
  const blocked = await assertStudentDataConsent(req, res);
  if (blocked) return blocked;
  const st = await q('SELECT first_name, last_name FROM students WHERE id = ?', [student_id]);
  if (!st) return res.status(404).json({ error: 'Student not found' });
  const analysis = await ai.analyzeStudentRisk(student_id);
  egressAudit(req, 'analyze', student_id, st.first_name + ' ' + st.last_name, ['name']);
  await audit(req, 'AI_ANALYZE', 'ai', null, { student_id });
  res.json(analysis);
}));

router.post('/enrollment-suggest', requireRole(...ADMIN, 'teacher'), aiUserLimiter, asyncH(async (req, res) => {
  const { student_id } = req.body || {};
  if (!student_id) return res.status(400).json({ error: 'student_id required' });
  if (req.user.role === 'teacher') {
    const chk = await ensureTeacherSeesStudent(req.user, student_id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }
  const blocked = await assertStudentDataConsent(req, res);
  if (blocked) return blocked;
  const st = await q('SELECT first_name, last_name FROM students WHERE id = ?', [student_id]);
  if (!st) return res.status(404).json({ error: 'Student not found' });
  const suggestion = await ai.getEnrollmentSuggestions(student_id);
  egressAudit(req, 'enrollment-suggest', student_id, st.first_name + ' ' + st.last_name, ['name']);
  await audit(req, 'AI_ENROLL_SUGGEST', 'ai', null, { student_id });
  res.json(suggestion);
}));

router.post('/form-137', requireRole(...ADMIN, 'teacher', 'registrar'), aiUserLimiter, asyncH(async (req, res) => {
  const { student_id } = req.body || {};
  if (!student_id) return res.status(400).json({ error: 'student_id required' });
  if (req.user.role === 'teacher') {
    const chk = await ensureTeacherSeesStudent(req.user, student_id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }
  const blocked = await assertStudentDataConsent(req, res);
  if (blocked) return blocked;
  const st = await q('SELECT first_name, last_name FROM students WHERE id = ?', [student_id]);
  if (!st) return res.status(404).json({ error: 'Student not found' });
  try {
    const report = await ai.generateForm137(student_id);
    egressAudit(req, 'form-137', student_id, st.first_name + ' ' + st.last_name, ['name']);
    await audit(req, 'AI_FORM_137', 'ai', null, { student_id });
    res.json(report);
  } catch (e) {
    logger.error({ student_id, err: e.message }, '[AI_FORM_137] Error:');
    if (e.message.includes('AI not configured') || e.message.includes('GROQ_API_KEY')) {
      return res.status(503).json({ error: 'AI service not configured.' });
    }
    if (e.status === 401 || e.status === 403) {
      return res.status(503).json({ error: 'AI provider rejected the API key.' });
    }
    if (e.status === 429) {
      return res.status(429).json({ error: 'AI rate limit exceeded. Try again in a moment.' });
    }
    return res.status(500).json({ error: 'Form 137 generation failed. Try again.' });
  }
}));

router.get('/chat-logs', requireRole(...ADMIN), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const countSql = db.dialect === 'pg'
    ? 'SELECT COUNT(*)::int AS total FROM ai_chat_logs'
    : 'SELECT COUNT(*) AS total FROM ai_chat_logs';
  const [rows, countRow] = await Promise.all([
    qa('SELECT l.*, u.name AS user_name, u.username FROM ai_chat_logs l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.created_at DESC LIMIT ? OFFSET ?', [limit, offset]),
    q(countSql),
  ]);
  res.json({ data: rows, total: Number(countRow?.total || 0), limit, offset });
}));

router.get('/chat-logs/stats', requireRole(...ADMIN), asyncH(async (_req, res) => {
  const isPg = db.dialect === 'pg';
  const totalRow = await q(isPg
    ? 'SELECT COUNT(*)::int AS total FROM ai_chat_logs'
    : 'SELECT COUNT(*) AS total FROM ai_chat_logs');
  const usersRow = await q(isPg
    ? 'SELECT COUNT(DISTINCT user_id)::int AS distinct_users FROM ai_chat_logs'
    : 'SELECT COUNT(DISTINCT user_id) AS distinct_users FROM ai_chat_logs');
  const recentRow = await q(isPg
    ? "SELECT COUNT(*)::int AS last_24h FROM ai_chat_logs WHERE created_at >= now() - interval '24 hours'"
    : "SELECT COUNT(*) AS last_24h FROM ai_chat_logs WHERE created_at >= datetime('now', '-24 hours')");
  res.json({
    total_messages: Number(totalRow?.total || 0),
    distinct_users: Number(usersRow?.distinct_users || 0),
    last_24h: Number(recentRow?.last_24h || 0),
  });
}));

module.exports = router;
