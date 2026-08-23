const express = require('express');
const { q, qa } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');
const { ensureTeacherSeesStudent } = require('../scope');
const ai = require('../ai');

const router = express.Router();
router.use(authenticate);

const STAFF = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'teacher', 'guidance'];
const ADMIN = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];

router.get('/status', asyncH(async (_req, res) => {
  res.json(ai.getProviderInfo());
}));

router.post('/chat', requireRole(...STAFF, 'student', 'parent'), asyncH(async (req, res) => {
  const { messages, context } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }
  let ctx = context || '';
  if (req.user) ctx += '\nLogged in as: ' + req.user.name + ' (role: ' + req.user.role + ')';
  try {
    const reply = await ai.chatMessage(
      messages.map(m => ({ role: m.role || 'user', content: m.content })),
      ctx
    );
    await audit(req, 'AI_CHAT', 'ai', null, { message_count: messages.length });
    res.json({ reply });
  } catch (e) {
    if (e.message.includes('AI not configured')) {
      return res.status(503).json({ error: 'AI service not configured. Set GROQ_API_KEY in your environment variables.' });
    }
    throw e;
  }
}));

router.post('/report', requireRole(...ADMIN, 'teacher'), asyncH(async (req, res) => {
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
    console.error('[AI_REPORT] Error:', e.message, e.status || '');
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

router.post('/lesson-plan', requireRole(...STAFF), asyncH(async (req, res) => {
  const plan = await ai.generateLessonPlan(req.body || {});
  await audit(req, 'AI_LESSON_PLAN', 'ai', null, { subject_id: req.body?.subject_id, topic: req.body?.topic });
  res.json(plan);
}));

router.post('/exam', requireRole(...STAFF), asyncH(async (req, res) => {
  const exam = await ai.generateExam(req.body || {});
  await audit(req, 'AI_EXAM', 'ai', null, { subject_id: req.body?.subject_id, topic: req.body?.topic });
  res.json(exam);
}));

router.post('/analyze', requireRole(...ADMIN, 'teacher', 'guidance'), asyncH(async (req, res) => {
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

router.post('/enrollment-suggest', requireRole(...ADMIN, 'teacher'), asyncH(async (req, res) => {
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

router.post('/form-137', requireRole(...ADMIN, 'teacher', 'registrar'), asyncH(async (req, res) => {
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
    console.error('[AI_FORM_137] Error:', e.message);
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

module.exports = router;
