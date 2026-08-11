const express = require('express');
const { q, qa, qi, qr } = require('../db');
const { authenticate, requireRole, ADMIN_ROLES, isAdminRole } = require('../auth');
const { asyncH, audit } = require('../utils');

const router = express.Router();
router.use(authenticate);

const WRITE = [...ADMIN_ROLES, 'teacher'];

router.get('/questions', asyncH(async (req, res) => {
  const { subject_id, qtype, competency } = req.query;
  let sql = `SELECT qb.*, s.title AS subject_title FROM question_bank qb
             LEFT JOIN subjects s ON s.id = qb.subject_id`;
  const where = [];
  const params = [];
  if (subject_id) { where.push('qb.subject_id = ?'); params.push(subject_id); }
  if (qtype) { where.push('qb.qtype = ?'); params.push(qtype); }
  if (competency) { where.push('qb.competency LIKE ?'); params.push('%' + competency + '%'); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY qb.id DESC LIMIT 300';
  const rows = await qa(sql, params);
  res.json({ data: rows.map((r) => ({ ...r, options: r.options ? JSON.parse(r.options) : null })) });
}));

router.post('/questions', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.question) return res.status(400).json({ error: 'question is required' });
  const id = await qi(
    `INSERT INTO question_bank (user_id, subject_id, grade_level, competency, qtype, question, options, answer, difficulty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, b.subject_id || null, b.grade_level || null, b.competency || null,
      b.qtype || 'mcq', b.question, b.options ? JSON.stringify(b.options) : null,
      b.answer || null, Number(b.difficulty) || 2]);
  await audit(req, 'ADD_QUESTION', 'question_bank', id, { qtype: b.qtype });
  res.status(201).json({ id });
}));

router.patch('/questions/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM question_bank WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Question not found' });
  if (row.user_id !== req.user.id && !isAdminRole(req.user.role)) {
    return res.status(403).json({ error: 'Only the author or an admin can edit' });
  }
  const b = req.body || {};
  const f = (k) => b[k] !== undefined ? b[k] : row[k];
  await qr(
    `UPDATE question_bank SET subject_id = ?, grade_level = ?, competency = ?, qtype = ?, question = ?, options = ?, answer = ?, difficulty = ? WHERE id = ?`,
    [f('subject_id'), f('grade_level'), f('competency'), f('qtype'), f('question'),
      f('options'), f('answer'), f('difficulty'), row.id]);
  res.json({ ok: true });
}));

router.delete('/questions/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM question_bank WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Question not found' });
  if (row.user_id !== req.user.id && !isAdminRole(req.user.role)) {
    return res.status(403).json({ error: 'Only the author or an admin can delete' });
  }
  await qr('DELETE FROM question_bank WHERE id = ?', [row.id]);
  res.json({ ok: true });
}));

router.post('/questions/use/:id', asyncH(async (req, res) => {
  await qr('UPDATE question_bank SET used_count = used_count + 1 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

router.get('/rubrics', asyncH(async (req, res) => {
  const rows = await qa(
    `SELECT rb.*, s.title AS subject_title, u.name AS user_name FROM rubrics rb
     LEFT JOIN subjects s ON s.id = rb.subject_id JOIN users u ON u.id = rb.user_id
     ORDER BY rb.id DESC`);
  res.json({ data: rows.map((r) => ({ ...r, criteria: r.criteria ? JSON.parse(r.criteria) : null })) });
}));

router.post('/rubrics', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.title) return res.status(400).json({ error: 'title is required' });
  const id = await qi(
    'INSERT INTO rubrics (user_id, title, subject_id, task, criteria) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, b.title, b.subject_id || null, b.task || null,
      b.criteria ? JSON.stringify(b.criteria) : null]);
  await audit(req, 'ADD_RUBRIC', 'rubrics', id);
  res.status(201).json({ id });
}));

router.delete('/rubrics/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM rubrics WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Rubric not found' });
  if (row.user_id !== req.user.id && !isAdminRole(req.user.role)) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  await qr('DELETE FROM rubrics WHERE id = ?', [row.id]);
  res.json({ ok: true });
}));

router.get('/tos', asyncH(async (req, res) => {
  const rows = await qa(
    `SELECT t.*, s.title AS subject_title, u.name AS user_name FROM tos_records t
     LEFT JOIN subjects s ON s.id = t.subject_id JOIN users u ON u.id = t.user_id
     ORDER BY t.id DESC`);
  res.json({ data: rows.map((r) => ({ ...r, data: r.data ? JSON.parse(r.data) : null })) });
}));

router.post('/tos', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.data) return res.status(400).json({ error: 'title and data are required' });
  const id = await qi(
    'INSERT INTO tos_records (user_id, title, subject_id, quarter, data) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, b.title, b.subject_id || null, Number(b.quarter) || 1, JSON.stringify(b.data)]);
  await audit(req, 'ADD_TOS', 'tos_records', id);
  res.status(201).json({ id });
}));

router.delete('/tos/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM tos_records WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'TOS not found' });
  if (row.user_id !== req.user.id && !isAdminRole(req.user.role)) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  await qr('DELETE FROM tos_records WHERE id = ?', [row.id]);
  res.json({ ok: true });
}));

router.get('/analyses', asyncH(async (req, res) => {
  const rows = await qa(
    `SELECT a.*, s.title AS subject_title, u.name AS user_name FROM item_analyses a
     LEFT JOIN subjects s ON s.id = a.subject_id JOIN users u ON u.id = a.user_id
     ORDER BY a.id DESC`);
  res.json({ data: rows.map((r) => ({
    ...r, data: r.data ? JSON.parse(r.data) : null, computed: r.computed ? JSON.parse(r.computed) : null,
  })) });
}));

router.post('/analyses', requireRole(...WRITE), asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.data) return res.status(400).json({ error: 'title and data are required' });
  const total_items = Number(b.total_items) || (b.data.items ? b.data.items.length : 0);
  const learners = Number(b.learners) || 0;
  const id = await qi(
    `INSERT INTO item_analyses (user_id, title, school_year, subject_id, total_items, learners, data, computed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, b.title, b.school_year || '2025-2026', b.subject_id || null,
      total_items, learners, JSON.stringify(b.data), b.computed ? JSON.stringify(b.computed) : null]);
  await audit(req, 'ADD_ITEM_ANALYSIS', 'item_analyses', id);
  res.status(201).json({ id });
}));

router.delete('/analyses/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const row = await q('SELECT * FROM item_analyses WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Analysis not found' });
  if (row.user_id !== req.user.id && !isAdminRole(req.user.role)) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  await qr('DELETE FROM item_analyses WHERE id = ?', [row.id]);
  res.json({ ok: true });
}));

router.post('/item-analysis', asyncH(async (req, res) => {
  const b = req.body || {};
  const items = b.items || [];
  const learners = Number(b.learners) || 1;
  if (!items.length || learners < 1) return res.status(400).json({ error: 'items and learners are required' });
  const upper = Math.ceil(learners * 0.27);
  const lower = Math.ceil(learners * 0.27);
  const results = items.map((it, idx) => {
    const correctUpper = Math.min(Number(it.correct_upper) || 0, upper);
    const correctLower = Math.min(Number(it.correct_lower) || 0, lower);
    const pUpper = upper ? correctUpper / upper : 0;
    const pLower = lower ? correctLower / lower : 0;
    const difficulty = (pUpper + pLower) / 2;
    const discrimination = pUpper - pLower;
    const dLevel = discrimination >= 0.4 ? 'Very Good' : discrimination >= 0.3 ? 'Good' :
      discrimination >= 0.2 ? 'Fair' : discrimination > 0 ? 'Poor' : 'Discard/Review';
    const dRating = difficulty >= 0.75 ? 'Easy' : difficulty >= 0.40 ? 'Average' : 'Difficult';
    return {
      item_no: idx + 1,
      competency: it.competency || null,
      difficulty: Math.round(difficulty * 100) / 100,
      difficulty_level: dRating,
      discrimination: Math.round(discrimination * 100) / 100,
      discrimination_level: dLevel,
      correct_upper: correctUpper, correct_lower: correctLower,
      interpretation: pUpper >= pLower ? 'Item discriminates normally' : 'Reversed discrimination — review the item and its answer key',
    };
  });
  const avgDiff = results.reduce((s, r) => s + r.difficulty, 0) / results.length;
  res.json({
    computed: {
      results,
      average_difficulty: Math.round(avgDiff * 100) / 100,
      interpretation: avgDiff >= 0.75 ? 'Overall: easy test. Consider revising items or increasing rigor.'
        : avgDiff >= 0.4 ? 'Overall: test difficulty is appropriate.'
          : 'Overall: difficult test. Consider reviewing instruction for these competencies.',
      poor_items: results.filter((r) => r.discrimination < 0.2).length,
    },
  });
}));

router.post('/ai/questions', asyncH(async (req, res) => {
  const b = req.body || {};
  const count = Math.min(Number(b.count) || 5, 15);
  const topic = String(b.topics || b.topic || 'key concepts of the lesson').trim();
  const level = ['easy', 'average', 'hard'];
  const verbs = { easy: ['Identify', 'Recall', 'List', 'Define', 'Name'], average: ['Explain', 'Compare', 'Apply', 'Describe', 'Interpret'], hard: ['Analyze', 'Evaluate', 'Justify', 'Design', 'Critique'] };
  const stems = {
    easy: ['Which of the following best defines {topic}?', 'Which term best describes {topic}?', 'Which of the following is an example of {topic}?'],
    average: ['Which scenario best illustrates the application of {topic}?', 'What is the most accurate explanation of {topic}?', 'Which statement about {topic} is correct?'],
    hard: ['Given the situation, which is the most defensible conclusion about {topic}?', 'Evaluate the following statement about {topic}:', 'Which approach best addresses a problem involving {topic}?'],
  };
  const options = ['The correct answer', 'A plausible but incorrect option', 'A partially correct option', 'An obviously incorrect option'];
  const questions = [];
  for (let i = 0; i < count; i++) {
    const lv = level[i % 3];
    const stem = stems[lv][Math.floor(Math.random() * stems[lv].length)].replace('{topic}', topic);
    questions.push({
      question: `${stem}`,
      options: [...options].sort(() => Math.random() - 0.5),
      level: lv,
      note: `AI-drafted item on "${topic}". Review and replace the options with discipline-specific distractors before use.`,
    });
  }
  res.json({ questions, suggestion: 'AI-drafted items are a starting point — always validate against your lesson objectives and competencies.' });
}));

module.exports = router;