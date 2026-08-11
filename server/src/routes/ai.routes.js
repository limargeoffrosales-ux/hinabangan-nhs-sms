const express = require('express');
const { q, qi } = require('../db');
const { authenticate } = require('../auth');
const { asyncH, audit } = require('../utils');
const { TEMPLATES, renderTemplate } = require('../ai/templates');
const { ask, SUGGESTED_QUESTIONS } = require('../ai/knowledge');
const { improve, summarize, insights } = require('../ai/engine');

const router = express.Router();
router.use(authenticate);

const INTENTS = [
  { id: 'greeting', test: (t) => /^(hello|hi|hey|good (morning|afternoon|evening|day)|kamusta|kumusta|magandang|salamat|thanks|thank you|opo|okay)\b/.test(t) },
  { id: 'doc', test: (t) => /(generate|create|draft|write|make|help me with)\s.*(lesson|dll|dlp|letter|report|certificate|minutes|exam|rubric|plan|memorandum|notice|program|script|email|las)/.test(t) },
  { id: 'analytics', test: (t) => /insight|risk|analytics|trend|predict|summary|overview|compliance|at risk|report to me/.test(t) },
  { id: 'policy', test: (t) => /\b(what|what's|who|who's|how|why|when|where|which|is there|are there)\b/.test(t) || /policy|deped|order|guideline|memo|d\.?o\.?\s*|s\.\s*\d{4}/.test(t) },
  { id: 'help', test: (t) => /help|what can you do|can.*do|feature|capab|menu|start/.test(t) },
];

const TAGLISH_REPLACEMENTS = [
  [/paki/gi, 'please '],
  [/magandang (umaga|hapon|gabi|araw)/gi, 'hello'],
  [/gumawa ka ng/gi, 'draft a'],
  [/gawaan mo ng/gi, 'draft a'],
  [/gawin mo ng/gi, 'draft a'],
  [/gusto ko ng/gi, 'i want a'],
  [/kailangan ko ng/gi, 'i need a'],
  [/ano ang mga/gi, 'what are the'],
  [/ano ang/gi, 'what is the'],
  [/ano ba/gi, 'what'],
  [/gumawa/gi, 'draft'],
  [/gawin/gi, 'draft'],
  [/\bgawa\b/gi, 'draft'],
  [/isulat|magsulat|sumulat/gi, 'write'],
  [/liham/gi, 'letter'],
  [/patakaran/gi, 'policy'],
  [/kompyutasyon ng grado/gi, 'grade'],
  [/grado|marka/gi, 'grade'],
  [/nanganganib|risiko/gi, 'risk'],
  [/ipaliwanag/gi, 'explain'],
  [/paano|\bpano\b/gi, 'how'],
  [/\bano\b/gi, 'what'],
  [/bakit/gi, 'why'],
  [/saan/gi, 'where'],
  [/kailan/gi, 'when'],
  [/sino/gi, 'who'],
  [/pwedeng|\bpwede\b/gi, 'can'],
  [/tulungan|\btulong\b/gi, 'help'],
  [/salamat/gi, 'thanks'],
  [/kamusta|kumusta/gi, 'hello'],
  [/\bng\b/gi, ' '],
  [/\bang\b/gi, ' '],
  [/\bmga\b/gi, ' '],
  [/\bsa\b/gi, ' '],
  [/\bpo\b/gi, ' '],
  [/\bopo\b/gi, ' '],
  [/\bako\b/gi, 'i '],
  [/\bmo\b/gi, 'your '],
];

const TAGLISH_MARKERS = /\b(ano|paano|\bpano\b|bakit|saan|kailan|sino|gumawa|gawin|gawa|isulat|magsulat|sumulat|liham|paki|po\b|opo|mga|magandang|kamusta|kumusta|salamat|ipaliwanag|pwede|pwedeng|tulong|tulungan|kailangan|gusto|nanganganib|risiko|hindi|wala)\b/i;

function taglishToEnglish(text) {
  let out = String(text || '');
  for (const [re, to] of TAGLISH_REPLACEMENTS) out = out.replace(re, to);
  return out.replace(/\s{2,}/g, ' ').trim();
}

function detectTaglish(message) {
  return TAGLISH_MARKERS.test(String(message || ''));
}

function detectIntent(message) {
  const raw = String(message || '').toLowerCase();
  const en = taglishToEnglish(raw);
  for (const i of INTENTS) if (i.test(raw) || i.test(en)) return i.id;
  return 'fallback';
}

router.get('/templates', asyncH(async (req, res) => {
  const groups = {};
  for (const t of TEMPLATES) {
    (groups[t.group] = groups[t.group] || []).push({ id: t.id, name: t.name, fields: t.fields });
  }
  res.json({ groups, count: TEMPLATES.length });
}));

router.post('/generate', asyncH(async (req, res) => {
  const b = req.body || {};
  const doc = renderTemplate(b.template_id, b.context || {});
  if (!doc) return res.status(404).json({ error: 'Template not found' });
  await audit(req, 'AI_GENERATE_DOC', 'templates', doc.id, { name: doc.name });
  res.json({ ...doc, words: doc.body.split(/\s+/).filter(Boolean).length });
}));

router.post('/improve', asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.text) return res.status(400).json({ error: 'text is required' });
  const r = improve(b.text, b.mode || 'formalize');
  res.json(r);
}));

router.post('/summarize', asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.text) return res.status(400).json({ error: 'text is required' });
  const r = summarize(b.text, Number(b.sentences) || 3);
  res.json(r);
}));

router.get('/policies', asyncH(async (req, res) => {
  const qs = taglishToEnglish((req.query.q || '').trim());
  if (!qs) {
    return res.json({ data: [], suggestions: SUGGESTED_QUESTIONS });
  }
  res.json({ data: [ask(qs)].filter(Boolean), suggestions: SUGGESTED_QUESTIONS });
}));

router.post('/assistant', asyncH(async (req, res) => {
  const message = String((req.body || {}).message || '').trim();
  if (!message) return res.status(400).json({ error: 'message is required' });
  const taglish = detectTaglish(message);
  const intent = detectIntent(message);
  let reply = '';
  let action = null;
  let data = null;
  const closer = taglish ? '\n\nKung may iba ka pang katanungan, itanong mo lang.' : '';

  if (intent === 'greeting') {
    reply =
      (taglish ? 'Magandang araw! Ako si Meridian, ang AI assistant ng paaralan.\n\n' : 'Good day! I am Meridian, the school AI assistant.\n\n') +
      'I can help you with:\n' +
      '1. DepEd policy questions (grading, PHIL-IRI, school forms, LRN)\n' +
      '2. Drafting official documents (DLL, DLP, certificates, letters, minutes)\n' +
      '3. School analytics and learner risk summaries\n\n' +
      'Try: "Ano ang grade weights ng SHS?" or "Gumawa ka ng DLL".';
    action = { kind: 'greeting' };
  } else if (intent === 'policy') {
    const hit = ask(taglishToEnglish(message));
    if (hit) {
      const intro = taglish ? `Naintindihan ko ang iyong tanong tungkol sa ${hit.topic}.\n\n` : '';
      reply = `${intro}${hit.topic} — ${hit.order}.\n\n${hit.answer}\n\n(Confidence: ${hit.confidence}%)`;
      action = { kind: 'policy', topic: hit.topic };
    } else {
      reply = taglish
        ? 'Pasensya na, hindi ko nakita ang partikular na patakaran ng DepEd tungkol diyan. Subukan ang pagtatanong tungkol sa grading, PHIL-IRI, school forms, ang LRN, o learning recovery.'
        : 'I could not find a specific DepEd policy on that. Try asking about grading, PHIL-IRI, school forms, the LRN, or learning recovery.';
      action = { kind: 'policy', topic: null };
    }
  } else if (intent === 'doc') {
    const en = taglishToEnglish(message.toLowerCase());
    const docMatch = /(lesson plan|dll|dlp|lesson exemplar|letter|report|certificate|minutes|exam|rubric|plan|memorandum|notice|program|script|email|las)/.exec(en);
    const want = docMatch ? docMatch[1] : null;
    const map = {
      'lesson plan': 'lesson_plan', 'dll': 'dll', 'dlp': 'dlp', 'lesson exemplar': 'lesson_exemplar',
      'certificate': 'certificate', 'letter': 'parent_letter', 'report': 'accomplishment_report',
      'minutes': 'meeting_minutes', 'exam': 'exam', 'rubric': 'rubric', 'plan': 'intervention_plan',
      'memorandum': 'memorandum', 'notice': 'notice', 'program': 'event_program', 'script': 'graduation_script',
      'email': 'email', 'las': 'las',
    };
    const tid = map[want];
    if (tid) {
      const doc = renderTemplate(tid, { prepared_by: req.user.name, noted_by: req.user.name });
      const intro = taglish ? `Nagawa ko na ang draft ng ${doc.name}. Buksan ang AI Documents para i-edit at i-export.\n\n` : `I drafted a ${doc.name} for you. Open the AI Documents workspace to edit and export it.\n\n`;
      reply = `${intro}Here is a preview:\n\n${doc.body.split('\n').slice(0, 12).join('\n')}\n...`;
      action = { kind: 'doc', template_id: tid, name: doc.name };
    } else {
      reply = taglish
        ? 'Maaari akong gumawa ng lesson plans, DLL/DLP, lesson exemplars, LAS, exams, rubrics, certificates, letters, minutes, memorandums, reports, programs, scripts, at emails. Subukan ang "Gumawa ka ng DLL" o "Gumawa ka ng certificate".'
        : 'I can draft lesson plans, DLL/DLP, lesson exemplars, LAS, exams, rubrics, certificates, letters, minutes, memorandums, reports, programs, scripts, and emails. Try "Draft a DLL" or "Generate a certificate".';
    }
  } else if (intent === 'analytics') {
    const i = await insights(req);
    const risk = i.sections.find((s) => s.id === 'risk');
    const comp = i.sections.find((s) => s.id === 'compliance');
    const recs = i.sections.find((s) => s.id === 'recommendations');
    const intro = taglish ? 'Narito ang buod ng datos ng paaralan.\n\n' : '';
    reply = `${intro}${risk ? risk.summary : ''}\n\n${comp ? comp.summary : ''}\n\nRecommended next steps:\n${(recs ? recs.data : ['Continue regular monitoring.']).map((r, idx) => `${idx + 1}. ${r}`).join('\n')}`;
    action = { kind: 'insights' };
    data = i;
  } else if (intent === 'help') {
    reply =
      'I am Meridian, the school AI assistant. I can:\n' +
      '1. Answer DepEd policy questions (grading, PHIL-IRI, school forms, child protection, LRN)\n' +
      '2. Draft official documents (lesson plans, DLL, certificates, letters, minutes, exams, rubrics)\n' +
      '3. Summarize analytics and predict learner risk\n' +
      '4. Explain the dashboard and recommend interventions\n\n' +
      'Try asking: "What are the grade weights for SHS?" or "Draft a certificate".\n\n' +
      'Maaari ka ring magtanong sa Filipino, halimbawa: "Ano ang policy sa grading?"';
    action = { kind: 'help' };
  } else {
    reply = taglish
      ? 'Pasensya na, hindi ko lubusang naintindihan ang tanong. Maaari mong subukan:\n' +
        '• "Ano ang policy sa classroom assessment?"\n' +
        '• "Gumawa ka ng DLL"\n' +
        '• "Ibuod ang risk ng mga estudyante"\n' +
        '• "Ano ang kaya mong gawin?"'
      : 'I understand text like:\n' +
        '• "What is the policy on classroom assessment?"\n' +
        '• "Generate a DLL for General Mathematics"\n' +
        '• "Summarize learner risk this quarter"\n' +
        '• "What can you do?"\n\n' +
        'Ask me anything about DepEd policies, documents, or school analytics.';
    action = { kind: 'fallback' };
  }
  reply += closer;

  await qi('INSERT INTO ai_chat_logs (user_id, role, message, intent) VALUES (?, ?, ?, ?)',
    [req.user.id, 'user', message.slice(0, 2000), intent]);
  await qi('INSERT INTO ai_chat_logs (user_id, role, message, intent) VALUES (?, ?, ?, ?)',
    [req.user.id, 'assistant', reply.slice(0, 2000), intent]);

  res.json({ reply, intent, action, data });
}));

router.get('/insights', asyncH(async (req, res) => {
  const i = await insights(req);
  res.json(i);
}));

module.exports = router;
