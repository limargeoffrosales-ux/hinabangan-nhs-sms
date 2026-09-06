const express = require('express');
const { q, qa, qi, dialect } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');
const { ensureTeacherSeesStudent } = require('../scope');
const { userRateLimit } = require('../middleware/rate-limit');
const logger = require('../logger');
const ai = require('../ai');

const router = express.Router();
router.use(authenticate);

// AI is a privileged assistant: only the super admin may query the model.
router.use(requireRole('super_admin'));

const aiUserLimiter = userRateLimit({ windowMs: 60_000, limit: 10, message: { error: 'AI request limit reached. Try again in a minute.' } });

const STAFF = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'teacher', 'guidance'];
const ADMIN = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];

router.get('/status', asyncH(async (_req, res) => {
  res.json(ai.getProviderInfo());
}));

router.post('/chat', requireRole(...STAFF, 'student', 'parent'), aiUserLimiter, asyncH(async (req, res) => {
  const { messages, context } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }
  let ctx = context || '';
  if (req.user) ctx += '\nLogged in as: ' + req.user.name + ' (role: ' + req.user.role + ')';

  const lastUserMsg = messages[messages.length - 1];
  const userText = lastUserMsg?.content || '';
  qi('INSERT INTO ai_chat_logs (user_id, role, message) VALUES (?, ?, ?)', [req.user.id, 'user', userText]).catch(() => {});

  try {
    const reply = await ai.chatMessage(
      messages.map(m => ({ role: m.role || 'user', content: m.content })),
      ctx
    );
    qi('INSERT INTO ai_chat_logs (user_id, role, message) VALUES (?, ?, ?)', [req.user.id, 'assistant', reply]).catch(() => {});
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
  if (['teacher', 'guidance'].includes(req.user.role)) {
    const chk = await ensureTeacherSeesStudent(req.user, student_id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }
  try {
    const report = await ai.generateStudentReport(student_id);
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
    return res.status(500).json({ error: 'AI report generation failed: ' + e.message });
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
  if (['teacher', 'guidance'].includes(req.user.role)) {
    const chk = await ensureTeacherSeesStudent(req.user, student_id);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }
  const analysis = await ai.analyzeStudentRisk(student_id);
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
  const suggestion = await ai.getEnrollmentSuggestions(student_id);
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
  try {
    const report = await ai.generateForm137(student_id);
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
    return res.status(500).json({ error: 'Form 137 generation failed: ' + e.message });
  }
}));

router.get('/chat-logs', requireRole(...ADMIN), asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const countSql = dialect === 'pg'
    ? 'SELECT COUNT(*)::int AS total FROM ai_chat_logs'
    : 'SELECT COUNT(*) AS total FROM ai_chat_logs';
  const [rows, countRow] = await Promise.all([
    qa('SELECT l.*, u.name AS user_name, u.username FROM ai_chat_logs l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.created_at DESC LIMIT ? OFFSET ?', [limit, offset]),
    q(countSql),
  ]);
  res.json({ data: rows, total: Number(countRow?.total || 0), limit, offset });
}));

router.get('/chat-logs/stats', requireRole(...ADMIN), asyncH(async (_req, res) => {
  const isPg = dialect === 'pg';
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
