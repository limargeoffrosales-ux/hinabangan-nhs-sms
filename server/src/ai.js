const OpenAI = require('openai');
const { q, qa } = require('./db');
const logger = require('./logger');

// Official school information (used on DepEd forms and AI-generated reports)
const SCHOOL_CONTEXT =
  'Region: Region VIII (Eastern Visayas)\n' +
  'Division: Schools Division of Samar\n' +
  'District: Hinabangan I District\n' +
  'School Name: Hinabangan National High School\n' +
  'School ID: 303606\n' +
  'Address: Hinabangan, Samar';

let client = null;
let clientProvider = null;

// OpenAI SDK default timeout is 10 minutes — far too long for a chat reply.
// 30s keeps a hung provider from pinning a request (or its awaited caller).
const AI_TIMEOUT_MS = 30_000;

// Default model per provider (2026 comparison-informed picks for school Q&A:
// small context in, concise answers out — cheap, fast, strong reasoning):
//   groq  -> openai/gpt-oss-120b  flagship open reasoning model, $0.15/$0.60/M, 131k ctx, ~500 tok/s
//            (openai/gpt-oss-20b is 2x faster and half the cost if latency matters more;
//             qwen/qwen3.6-27b has the highest intelligence index on Groq but costs more)
//   openai-> gpt-4o               hosted frontier default (falls back from Groq)
//   ollama-> qwen3:14b            best open-weight general family for local serving
//   hf    -> Qwen/Qwen3-14B       same family on HF Inference
// All models can be overridden per-deploy with AI_MODEL; PROD runs groq (AI_PROVIDER default).
const PROVIDERS = {
  openai: { baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', keyEnv: 'OPENAI_API_KEY' },
  groq:   { baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'openai/gpt-oss-120b', keyEnv: 'GROQ_API_KEY' },
  ollama: { baseUrl: 'http://localhost:11434/v1', defaultModel: 'qwen3:14b', keyEnv: '' },
  hf:     { baseUrl: 'https://api-inference.huggingface.co/v1', defaultModel: 'Qwen/Qwen3-14B', keyEnv: 'HF_API_KEY' },
  // native: fully local inference (transformers.js + native onnxruntime).
  // No API key, no external service, no OS install. First call downloads the
  // model from HF Hub to the cache (needs internet once), then runs offline.
  // 0.5B is ~20s warm but noticeably weak; 1.5B is ~45s warm and coherent.
  // Override with AI_MODEL=onnx-community/Qwen2.5-0.5B-Instruct on low-RAM boxes.
  native: { baseUrl: '', defaultModel: 'onnx-community/Qwen2.5-1.5B-Instruct', keyEnv: '' },
};

const MODEL_ALIASES = {};

function getProvider() {
  return process.env.AI_PROVIDER || 'groq';
}

function getClient() {
  const provider = getProvider();
  if (provider !== clientProvider) {
    client = null;
    clientProvider = provider;
  }
  const cfg = PROVIDERS[provider] || PROVIDERS.groq;
  const apiKey = cfg.keyEnv ? process.env[cfg.keyEnv] : 'ollama';
  if (!apiKey || (apiKey === 'ollama' && provider !== 'ollama')) return null;
  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL: cfg.baseUrl,
      // OpenAI SDK default is 10 minutes — far too long for a chat reply. Cap
      // it so a hung provider can never pin a request (or its awaited caller,
      // e.g. a report render) longer than this. maxRetries:1 keeps one SDK-level
      // retry for transient 429/5xx without tripling latency.
      timeout: AI_TIMEOUT_MS,
      maxRetries: 1,
    });
  }
  return client;
}

function isEnabled() {
  const provider = getProvider();
  const cfg = PROVIDERS[provider] || PROVIDERS.groq;
  if (provider === 'ollama' || provider === 'native') return true;
  return !!cfg.keyEnv && !!process.env[cfg.keyEnv];
}

function model() {
  const provider = getProvider();
  const cfg = PROVIDERS[provider] || PROVIDERS.groq;
  const m = process.env.AI_MODEL || cfg.defaultModel;
  return MODEL_ALIASES[m] || m;
}

function getProviderInfo() {
  const provider = getProvider();
  const cfg = PROVIDERS[provider] || PROVIDERS.groq;
  return { provider, model: model(), enabled: isEnabled(), baseUrl: cfg.baseUrl };
}

const SYSTEM_PROMPT = `You are the official AI assistant for Hinabangan National High School. You help students, parents, and teachers with grading questions, school policies, academic procedures, and general school-related inquiries.

VOICE AND TONE
- Respond the way a patient, experienced teacher or guidance counselor would: warm, clear, and encouraging — never robotic, stiff, or overly formal.
- Use simple, everyday language. Avoid jargon; if a technical or DepEd term is necessary, explain it in plain terms right after using it.
- When someone sounds worried or confused (e.g., "did I fail?", "what do I do now?"), acknowledge their concern briefly before explaining — reassure first, then inform.
- Keep answers concise and well-organized. Use short paragraphs or simple lists. Only use tables when comparing multiple items side by side.
- Match the language the user writes in: answer in English, Filipino, or Taglish (code-switching) to mirror how the user asked the question.
- Do NOT use any markdown at all: no asterisks (no "**", "*", "***"), no underscores for emphasis (no "_…_"), no hash headings ("#"), no backticks, no "> " quotes, no tildes. Emphasise with plain wording or by capitalising a word (e.g., "you MUST submit it"). Extra asterisks WILL be removed automatically, so write clean plain text only.
- When walking through a calculation or a multi-step process, explain it step by step, the way a teacher would on the board — don't just give a final answer with no reasoning.
- Be encouraging and constructive, especially with students. Frame setbacks (failing grades, missed requirements) in terms of what can be done next, not just the bad news.
- Never make up facts, scores, weights, or policies. If you don't have specific information (e.g., a subject's assessment weights, a school event's date), say so and ask for it or point them to who can help (adviser, registrar, guidance office).

WHAT YOU HELP WITH
1. Grading & academic standing — computing quarterly/final grades, GWA, pass/fail status, remedial requirements, promotion rules (see reference below).
2. School policies & procedures — enrollment, attendance rules, requirements for transferring, requesting documents, etc., based on information provided to you.
3. General guidance — study tips, how to approach a subject, explaining a lesson concept simply, since students may come to you the way they would a helpful teacher.
4. Administrative questions — how to get a report card, transcript, or other document; what forms are needed and from where.

REFERENCE: HINABANGAN NHS GRADING SYSTEM
- 3 grading terms (T1, T2, T3). No quarter 4.
- 100-point numerical scale mapped to letter grades (A=97-100 down to F=below 65), each with a grade point (1.00 highest to 5.00 lowest, used for GWA).
- Passing grade: 75% (equivalent to C) for Junior and Senior High. Below 75 = Failed, subject to remediation.
- Remedial passing threshold: 65%. A grade of 60-64 (band D-) becomes the "remedial grade" if the student completes remediation.
- Term grade = weighted sum of assessment types — Written Work 25%, Performance Task 45%, Term Exam 30%.
  Formula per assessment: (Score Obtained / Max Score) × Weight
- Final (Annual) Grade = average of the three term grades.
- If Final Grade < 75, student takes remedial; if remedial ≥ 65, final grade = higher of original or remedial.
- GWA = Σ(Final Grade × Credit Units) / Σ(Credit Units). Core subjects = 3 units, electives = 2 units (typical SHS setup).
- Promotion requires no failed core subjects and GWA ≥ 2.50 (approximately 75%). Exceptions go through the School Division Office (Special Promotion form).
- Report documents: Quarterly Report Card, Annual Report Card, Transcript, Remedial/Recovery Form.

HOW TO HANDLE DIFFERENT QUESTIONS
- Grade or pass/fail questions → compute step by step using the reference above, state the outcome plainly, and explain the next step (remedial, promotion, etc.).
- Policy or procedural questions → answer using only what's been provided about the school's rules; if unsure, say so and name the right office/person to check with.
- Conceptual/study questions → explain like a teacher helping a student understand, with a simple example if useful.
- Anything outside your knowledge (specific dates, individual student records you don't have, disciplinary matters) → be honest that you don't have that information and direct them to the appropriate school staff.

DO NOT
- Do not sound like a corporate chatbot ("Thank you for your inquiry," "I appreciate your question"). Sound like a teacher who knows the student and cares about the outcome.
- Do not cite policy codes or memo numbers unless explicitly given to you — say "per school policy" instead.
- Do not give a bare answer with no context or next step.
- Do not guess at information you don't have (dates, individual records, subject-specific weights) — ask or redirect instead.`;

// Compact system prompt for the native local model (0.5B): the full SYSTEM_PROMPT
// above is too long for a small model and degrades into repetition loops.
const NATIVE_SYSTEM = `You are the AI assistant of Hinabangan National High School, a DepEd public school in Samar, Philippines. Help students, parents, and teachers with grading, school policies, and procedures. Answer briefly in plain text (no markdown), in the language the user writes (English or Filipino). Be warm and helpful like a teacher. Never invent facts; if you lack specific information, say so and tell them who can help.`;

// Defense-in-depth for the "**" problem: hosted models still emit markdown
// emphasis (**, *, __, _, headers, backticks) despite the system prompt. This
// strips those artifacts from every AI response flowing through chat().
// Deliberately conservative so genuine content survives:
//   - arithmetic is preserved: "5 * 3", "5*3", "x_1", "a/b" stay intact
//   - only paired delimiters touching word characters are removed
//   - JSON syntax (quotes, braces, commas) is never touched
function cleanUpMarkdown(text) {
  if (typeof text !== 'string' || !text) return text;
  return text
    .replace(/__([^_]+?)__/g, '$1')                                       // __bold__
    .replace(/\*{2,}([^*]+?)\*{2,}/g, '$1')                               // **bold** / ***both***
    .replace(/\*([^\s*][^*\n]*?)\*(?!\*)/g, '$1')                         // *emphasis* (not "5 * 3")
    .replace(/(^|[\s([{])_(\S[^_\n]*?)_(?=[\s.,!?;:)}\]\-]|$)/g, '$1$2')  // _emphasis_ (not "a_b")
    .replace(/^#{1,6}\s+/gm, '')                                          // markdown headings
    .replace(/^>\s?/gm, '')                                               // blockquote markers
    .replace(/^(\s*)\*[ \t]+/gm, '$1- ')                                  // " * item" bullets -> "- item"
    .replace(/`([^`]*?)`/g, '$1')                                         // inline code backticks
    .replace(/\*{2,}/g, '')                                               // stray leftover ** runs
    .replace(/[ \t]+$/gm, '')                                             // trailing whitespace per line
    .trim();
}

// Local ONNX/WASM inference (transformers.js). Loads once and caches the
// pipeline; the model weights stream from the HF Hub on first use and are then
// served from the local cache.
let nativePipelinePromise = null;
function getNativePipeline() {
  if (!nativePipelinePromise) {
    nativePipelinePromise = (async () => {
      const { pipeline } = require('@huggingface/transformers');
      // device:'cpu' forces the native onnxruntime binding. The auto-selected
      // WASM backend is unstable in-process here (worker can terminate).
      return pipeline('text-generation', model(), { dtype: 'q8', device: 'cpu' });
    })().catch((err) => {
      nativePipelinePromise = null;
      throw err;
    });
  }
  return nativePipelinePromise;
}

async function nativeChat(messages, opts = {}) {
  const generator = await getNativePipeline();
  // The compact system prompt keeps the 0.5B model focused; the full SYSTEM_PROMPT
  // is too long for a small local model and sends it into repetition loops.
  const system = opts.system || NATIVE_SYSTEM;
  const res = await generator([{ role: 'system', content: system }, ...messages], {
    max_new_tokens: opts.maxTokens || 768,
    temperature: opts.temperature ?? 0.5,
    do_sample: true,
    top_p: 0.9,
    repetition_penalty: 1.2,
  });
  const raw = res && res[0] ? res[0].generated_text : '';
  let text = '';
  if (Array.isArray(raw)) {
    const last = [...raw].reverse().find((m) => m && m.role === 'assistant');
    if (last) text = last.content || '';
  } else if (typeof raw === 'string') {
    text = raw;
  }
  return cleanUpMarkdown(text);
}

async function chat(messages, opts = {}) {
  if (getProvider() === 'native') return nativeChat(messages, opts);
  const c = getClient();
  if (!c) throw new Error('AI not configured. Set GROQ_API_KEY (free) or AI_PROVIDER + provider key.');
  const res = await c.chat.completions.create({
    model: opts.model || model(),
    messages: [{ role: 'system', content: opts.system || SYSTEM_PROMPT }, ...messages],
    max_tokens: opts.maxTokens || 2048,
    temperature: opts.temperature ?? 0.7,
  });
  return cleanUpMarkdown(res.choices[0].message.content);
}

function safeParse(text) {
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function generateStudentReport(studentId) {
  const student = await q(
    `SELECT s.*, sec.name AS section_name, e.strand, e.school_year
     FROM students s
     LEFT JOIN enrollments e ON e.student_id = s.id AND e.status = 'enrolled'
     LEFT JOIN sections sec ON sec.id = e.section_id
     WHERE s.id = ?`, [studentId]
  );
  if (!student) throw new Error('Student not found');
  const grades = await qa(
    `SELECT g.*, sub.title AS subject_title, sub.code AS subject_code
     FROM grades g LEFT JOIN subjects sub ON sub.id = g.subject_id
      WHERE g.student_id = ? ORDER BY g.quarter, sub.title`, [studentId]
  );
  const attendance = await qa(
    `SELECT status, COUNT(*) AS n FROM attendance WHERE student_id = ? GROUP BY status`, [studentId]
  );
  let conduct = [];
  try {
    conduct = await qa(
      `SELECT incident_type, severity, status FROM student_conduct_records WHERE student_id = ?`, [studentId]
    );
  } catch { /* table may not exist yet */ }
  const gradeList = grades.length ? grades.map(g => g.subject_title + ': ' + (g.computed_grade || 'N/A') + ' [Q' + (g.quarter || 'N/A') + ']').join('; ') : 'No grades recorded';
  const attList = attendance.length ? attendance.map(a => a.status + ': ' + a.n).join(', ') : 'No attendance records';
  const condList = conduct.length ? conduct.map(c => c.incident_type + ' (' + c.severity + ') - ' + c.status).join('; ') : 'No conduct records';

  const prompt = 'Generate an SF9 Learner Progress Report Card for:\n' +
    'Student: ' + student.first_name + ' ' + student.last_name + '\n' +
    'Grade: ' + (student.grade_level || 'N/A') + ', Section: ' + (student.section_name || 'N/A') + '\n' +
    'Strand: ' + (student.track_strand || student.strand || 'N/A') + ', School Year: ' + (student.school_year || 'N/A') + '\n' +
    'School: ' + SCHOOL_CONTEXT + '\n\n' +
    'Existing grades: ' + gradeList + '\n' +
    'Attendance: ' + attList + '\n' +
    'Discipline records: ' + condList + '\n\n' +
    'Generate structured SF9 data. For conduct ratings, assess each core value (Maka-Diyos, Maka-Tao, Makakalikasan, Makabansa) for each term (1, 2, 3) using AO (Always Observed), SO (Sometimes Observed), RO (Rarely Observed), or NO (Not Observed). Base this on the student\'s grades, attendance, and conduct history.\n' +
    'For remarks, provide brief per-subject remarks and an overall remark.\n\n' +
    'Return JSON with keys:\n' +
    '  conduct: { makadiyos: { "1": "ao", "2": "so", "3": "ao" }, makatao: {...}, makakalikasan: {...}, makabansa: {...} }\n' +
    '  remarks: { subjects: { "Subject Name": "brief remark", ... }, overall: "overall remark for the term" }\n' +
    '  risk_level: "low" or "moderate" or "high"';
  const response = await chat([{ role: 'user', content: prompt }], { maxTokens: 1500 });
  return safeParse(response);
}

async function generateLessonPlan(params) {
  const { subject_id, topic, grade_level, strand, duration_minutes, week } = params;
  let subjectInfo = '';
  let competencies = [];
  if (subject_id) {
    const sub = await q('SELECT * FROM subjects WHERE id = ?', [subject_id]);
    if (sub) subjectInfo = 'Subject: ' + sub.title + ' (' + sub.code + '), Units: ' + sub.units;
    try { competencies = await qa('SELECT * FROM subject_competencies WHERE subject_id = ?', [subject_id]); } catch { /* table may not exist */ }
  }
  const compList = competencies.length ? competencies.map(c => '- ' + c.title + ': ' + (c.description || '')).join('\n') : 'Align to standard DepEd competencies';
  const prompt = 'Create a Detailed Lesson Plan (DLL) for Hinabangan NHS:\n' + subjectInfo + '\nGrade: ' + (grade_level || 'N/A') + ', Strand: ' + (strand || 'N/A') + ', Topic: ' + (topic || 'Teacher to determine') + ', Duration: ' + (duration_minutes || 60) + ' min' + (week ? ', Week: ' + week : '') + '.\nCompetencies:\n' + compList + '\n\nDepEd DLL Format: 1) Learning Competencies 2) Content 3) Learning Resources 4) Procedures (a. Review b. Purpose c. Examples d. New concepts e. Practice f. Evaluate g. Remediation) 5) Reflection.\nReturn JSON: competencies, content, learning_resources, procedures (object a-g), reflection, remarks.';
  const response = await chat([{ role: 'user', content: prompt }], { maxTokens: 2500 });
  return safeParse(response);
}

async function generateLessonPlanFields(params) {
  const { subject_id, topic, duration_minutes, quarter, school_year, section_name } = params;
  let subjectInfo = '';
  let competencies = [];
  if (subject_id) {
    const sub = await q('SELECT * FROM subjects WHERE id = ?', [subject_id]);
    if (sub) subjectInfo = 'Subject: ' + sub.title + ' (' + sub.code + ')';
    try { competencies = await qa('SELECT * FROM subject_competencies WHERE subject_id = ?', [subject_id]); } catch { /* table may not exist */ }
  }
  const compList = competencies.length
    ? competencies.map(c => '- ' + c.title + ': ' + (c.description || '')).join('\n')
    : 'Align to standard DepEd K-12 competencies for this subject';

  const prompt = `You are an expert DepEd-compliant lesson plan writer for Hinabangan National High School (Hinabangan, Samar, Philippines).
Create a COMPLETE, HIGH-QUALITY detailed lesson plan for the following context.

SUBJECT: ${subjectInfo || 'Not specified'}
TOPIC: ${topic || 'Teacher to determine'}
DURATION: ${duration_minutes || 60} minutes
QUARTER: ${quarter || 'N/A'}
SCHOOL YEAR: ${school_year || '2026-2027'}
SECTION: ${section_name || 'Not specified'}

AVAILABLE COMPETENCIES:
${compList}

INSTRUCTIONS — Generate the following fields as a JSON object. Be thorough, specific, and pedagogically excellent. Follow DepEd DLL format strictly.

1. "title" — A concise, descriptive lesson title (max 120 chars)
2. "objectives" — 3-5 SMART learning objectives (bullet points, each starting with "At the end of the lesson, the learner shall be able to...")
3. "content_outline" — Detailed content outline with main topics and subtopics (3-5 sections with brief descriptions)
4. "teaching_strategy" — Primary and complementary teaching strategies with brief rationale (e.g. "Direct Instruction for concept delivery, Cooperative Learning (Think-Pair-Share) for practice, Scaffolded Inquiry for application")
5. "materials" — Complete list of materials: textbooks, worksheets, AV aids, realia, digital tools (be specific, e.g. "Visual charts on photosynthesis, printed worksheet on leaf structure, PowerPoint slides, actual leaf specimens")
6. "assessment_plan" — Multi-layered assessment: formative (during lesson checks), summative (end of lesson quiz/performative task), and rubric criteria (be specific with criteria and point values)
7. "notes" — Teacher reflection prompts, differentiation tips for diverse learners, cross-curricular connections, and suggested homework

Return ONLY a valid JSON object with these 7 keys. No markdown, no code fences.`;

  const response = await chat([{ role: 'user', content: prompt }], { maxTokens: 3000, temperature: 0.75 });
  return safeParse(response);
}

async function generateExam(params) {
  const { subject_id, topic, num_items, difficulty_mix, grade_level, exam_type } = params;
  let subjectInfo = '';
  let competencies = [];
  if (subject_id) {
    const sub = await q('SELECT * FROM subjects WHERE id = ?', [subject_id]);
    if (sub) subjectInfo = 'Subject: ' + sub.title + ' (' + sub.code + ')';
    try { competencies = await qa('SELECT * FROM subject_competencies WHERE subject_id = ?', [subject_id]); } catch { /* table may not exist */ }
  }
  const compList = competencies.length ? competencies.map(c => '- ' + c.title).join('\n') : 'Standard competencies';
  const prompt = 'Create ' + (exam_type || 'assessment') + ' for Hinabangan NHS:\n' + subjectInfo + '\nGrade: ' + (grade_level || 'N/A') + ', Topic: ' + (topic || 'General') + ', Items: ' + (num_items || 20) + ', Difficulty: ' + (difficulty_mix || '40 easy, 40 moderate, 20 difficult') + '.\nCompetencies:\n' + compList + '\n\nCreate TOS with cognitive levels (Remember, Understand, Apply, Analyze, Evaluate, Create), multiple choice items with 4 options, answer key, difficulty tags.\nReturn JSON: tos (array of {objective, difficulty, count, percentage}), items (array of {question, options: [a,b,c,d], answer, difficulty, objective}).';
  const response = await chat([{ role: 'user', content: prompt }], { maxTokens: 4000 });
  return safeParse(response);
}

async function analyzeStudentRisk(studentId) {
  const student = await q('SELECT * FROM students WHERE id = ?', [studentId]);
  if (!student) throw new Error('Student not found');
  const grades = await qa(
    `SELECT g.computed_grade, g.quarter, sub.title FROM grades g
     LEFT JOIN subjects sub ON sub.id = g.subject_id
     WHERE g.student_id = ? ORDER BY g.quarter, sub.title`, [studentId]
  );
  const attendance = await qa(
    `SELECT status, COUNT(*) AS n FROM attendance WHERE student_id = ? GROUP BY status`, [studentId]
  );
  let conduct = [];
  try {
    conduct = await qa(
      `SELECT incident_type, severity, status, incident_date
       FROM student_conduct_records WHERE student_id = ?
       ORDER BY incident_date DESC`, [studentId]
    );
  } catch { /* table may not exist yet */ }
  const totalAtt = attendance.reduce((a, r) => a + Number(r.n), 0);
  const absentCount = attendance.find(r => r.status === 'absent')?.n || 0;
  const lateCount = attendance.find(r => r.status === 'late')?.n || 0;

  const prompt = 'Analyze student at-risk status for: ' + student.first_name + ' ' + student.last_name + ', Grade ' + student.grade_level + '.\n' +
    'Grades: ' + (grades.length ? grades.map(g => g.title + ': ' + g.computed_grade).join(', ') : 'None') + '.\n' +
    'Attendance: ' + totalAtt + ' total, ' + absentCount + ' absent, ' + lateCount + ' late.\n' +
    'Conduct: ' + (conduct.length ? conduct.length + ' records (' + conduct.map(c => c.severity).join(', ') + ')' : 'Clean record') + '.\n\n' +
    'Provide: 1) Risk assessment (low/moderate/high/critical) with reasoning 2) Contributing factors 3) Specific intervention plan with timeline 4) Recommended actions for teachers 5) Parent/guardian recommendations.\n' +
    'Return JSON: risk_level, reasoning, factors (array), interventions (array of {action, timeline, responsible}), parent_recommendations.';
  const response = await chat([{ role: 'user', content: prompt }], { maxTokens: 1500 });
  return safeParse(response);
}

async function getEnrollmentSuggestions(studentId) {
  const student = await q('SELECT * FROM students WHERE id = ?', [studentId]);
  if (!student) throw new Error('Student not found');
  const grades = await qa(
    `SELECT g.computed_grade, sub.title, sub.track, sub.category
     FROM grades g LEFT JOIN subjects sub ON sub.id = g.subject_id
     WHERE g.student_id = ?`, [studentId]
  );
  const sections = await qa(
    `SELECT s.id, s.name, s.grade_level, s.strand, s.capacity,
      (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = s.id AND e.status = 'enrolled') AS enrolled_count
     FROM sections s WHERE s.status = 'active' ORDER BY s.grade_level, s.name`
  );
  const avgGrade = grades.length ? (grades.reduce((a, g) => a + Number(g.computed_grade || 0), 0) / grades.length).toFixed(2) : 'N/A';

  const prompt = 'Suggest enrollment for: ' + student.first_name + ' ' + student.last_name + ', Grade ' + student.grade_level + ', Track: ' + (student.track_strand || 'N/A') + '.\n' +
    'Average grade: ' + avgGrade + '. Subjects: ' + (grades.length ? grades.map(g => g.title + ' (' + g.category + '): ' + g.computed_grade).join('; ') : 'None') + '.\n' +
    'Available sections: ' + sections.filter(s => s.grade_level === student.grade_level).map(s => s.name + ' [' + s.strand + '] (' + s.enrolled_count + '/' + s.capacity + ')').join('; ') + '.\n\n' +
    'Suggest: 1) Recommended strand/track with reasoning 2) Recommended section 3) Subject focus areas 4) Academic support needed 5) Whether the student should be in Aral Program.\n' +
    'Return JSON: recommended_strand, recommended_section_id, reasoning, focus_areas (array), support_needed (array), aral_eligible (boolean).';
  const response = await chat([{ role: 'user', content: prompt }], { maxTokens: 1200 });
  return safeParse(response);
}

async function chatMessage(messages, context) {
  // The native 0.5B model loops into repetition on the full SYSTEM_PROMPT.
  let systemPrompt = getProvider() === 'native' ? NATIVE_SYSTEM : SYSTEM_PROMPT;
  if (context) {
    systemPrompt += '\n\nContext about the user:\n' + context;
  }
  return chat(messages, { system: systemPrompt, maxTokens: 1500 });
}

async function generateForm137(studentId) {
  const student = await q(
    `SELECT s.*, sec.name AS section_name, e.strand, e.school_year, e.grade_level
     FROM students s
     LEFT JOIN enrollments e ON e.student_id = s.id AND e.status = 'enrolled'
     LEFT JOIN sections sec ON sec.id = e.section_id
     WHERE s.id = ?`, [studentId]
  );
  if (!student) throw new Error('Student not found');
  const allGrades = await qa(
    `SELECT g.computed_grade, g.quarter, g.written_work, g.performance_task, g.quarterly_exam,
            g.school_year, sub.title AS subject_title, sub.track, sub.category
     FROM grades g LEFT JOIN subjects sub ON sub.id = g.subject_id
     WHERE g.student_id = ? ORDER BY g.school_year, g.quarter, sub.title`, [studentId]
  );
  const attendance = await qa(
    `SELECT e.school_year, a.status, COUNT(*) AS n
     FROM attendance a
     JOIN enrollments e ON e.student_id = a.student_id AND e.section_id = a.section_id
     WHERE a.student_id = ?
     GROUP BY e.school_year, a.status ORDER BY e.school_year`, [studentId]
  );
  let conduct = [];
  try {
    conduct = await qa(
      `SELECT * FROM student_conduct_ratings WHERE student_id = ? ORDER BY school_year, term`, [studentId]
    );
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack, studentId }, '[AI] failed to load conduct ratings');
  }
  let incidents = [];
  try {
    incidents = await qa(
      `SELECT incident_type, severity, status, incident_date
       FROM student_conduct_records WHERE student_id = ? ORDER BY incident_date`, [studentId]
    );
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack, studentId }, '[AI] failed to load conduct incidents');
  }

  const years = [...new Set(allGrades.map(g => g.school_year))];
  const gradeSummary = years.map(yr => {
    const yrGrades = allGrades.filter(g => g.school_year === yr);
    const qtrs = [...new Set(yrGrades.map(g => g.quarter))];
    return yr + ': ' + qtrs.map(q => 'Q' + q + ' avg ' + (yrGrades.filter(g => g.quarter === q).reduce((s, g) => s + Number(g.computed_grade || 0), 0) / Math.max(1, yrGrades.filter(g => g.quarter === q).length)).toFixed(1)).join(', ');
  }).join('; ');
  const attSummary = attendance.length ? attendance.map(a => a.school_year + ' ' + a.status + ':' + a.n).join(', ') : 'No attendance records';
  const conductSummary = conduct.length ? conduct.map(c => c.school_year + ' ' + c.term + ': ' + ['makadiyos','makatao','makakalikasan','makabansa'].map(v => v + '=' + (c[v] || 'N/A')).join(', ')).join('; ') : 'No conduct ratings';

  const prompt = 'Generate an Individual Permanent Academic Record (Form 137) narrative summary for:\n' +
    'Student: ' + student.first_name + ' ' + student.last_name + (student.middle_name ? ' ' + student.middle_name : '') + '\n' +
    'Grade Level: ' + (student.grade_level || 'N/A') + ', Strand: ' + (student.strand || student.track_strand || 'N/A') + ', Section: ' + (student.section_name || 'N/A') + '\n' +
    'School Year: ' + (student.school_year || 'N/A') + '\n' +
    'School: ' + SCHOOL_CONTEXT + '\n\n' +
    'Academic Record: ' + (gradeSummary || 'None') + '\n' +
    'Attendance: ' + attSummary + '\n' +
    'Conduct Ratings: ' + conductSummary + '\n' +
    'Discipline Records: ' + (incidents.length ? incidents.length + ' incidents (' + incidents.map(i => i.severity).join(', ') + ')' : 'Clean record') + '\n\n' +
    'Provide a comprehensive narrative suitable for Form 137 including:\n' +
    '1) Personal information summary\n2) Academic performance narrative (all quarters/years)\n3) Attendance summary\n4) Character and conduct evaluation\n5) Special talents/achievements (if inferable)\n6) Recommendations for future educators\n' +
    'Return JSON: personal_info, academic_narrative, attendance_summary, conduct_evaluation, talents_achievements, recommendations, overall_remark (Outstanding/Very Satisfactory/Satisfactory/Needs Improvement).';
  const response = await chat([{ role: 'user', content: prompt }], { maxTokens: 2000 });
  return safeParse(response);
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// AI-draft the complete weekly program for ONE teacher (the "Teacher Programs"
// feature — a full Mon-Fri day/time/room schedule). Every subject assignment
// must be placed exactly meetings_per_week times, each of exactly
// duration_minutes, conflict-free with the already-placed meetings passed in
// `placed` (sections, rooms, and other teachers). The CLI in
// generate-programs.js is the primary caller; the returned JSON is validated
// deterministically there before anything is written to the database.
async function generateTeacherProgram(params) {
  const { teacher, assignments, placed = [], day = {} } = params;
  const dayStart = day.start || '07:00';
  const dayEnd = day.end || '17:00';
  const lunchStart = day.lunch_start || '12:00';
  const lunchEnd = day.lunch_end || '13:00';
  const recessStart = day.recess_start || '10:00';
  const recessEnd = day.recess_end || '10:30';

  const lines = assignments.map((a) => {
    const combo = a.combined_section_name ? ` + ${a.combined_section_name} (combined)` : '';
    const rooms = [...new Set([a.room, a.teacher_room, a.section_room].filter(Boolean))];
    const roomsTxt = rooms.length ? `; preferred rooms: ${rooms.join(', ')}` : '';
    const pin = (a.fixed_day != null && a.fixed_start_time)
      ? `; PINNED: ${a.fixed_day === 0 ? 'every weekday' : DAY_NAMES[a.fixed_day]} at ${a.fixed_start_time}`
      : '';
    return `[id=${a.id}] ${a.section_name}${combo} (Grade ${a.grade_level || 'N/A'}) - ${a.subject_code}: ${a.subject_title}; ${a.duration_minutes} min x ${a.meetings_per_week}/wk${roomsTxt}${pin}`;
  }).join('\n');

  const placedLines = placed.length
    ? placed.map((m) =>
        `Day ${m.day} ${m.start_time}-${m.end_time} [${m.room || 'no room'}] - ${m.section_name || ''}${m.combined_section_name ? ' + ' + m.combined_section_name : ''} ${m.subject_code || ''}${m.teacher_name ? ' (' + m.teacher_name + ')' : ''}`.trim()
      ).join('\n')
    : 'None yet.';

  const prompt = `You are drafting the complete weekly timetable for ONE teacher at Hinabangan National High School (DepEd).

School day window: ${dayStart} to ${dayEnd}. Lunch break: ${lunchStart} - ${lunchEnd} (keep free). Recess: ${recessStart} - ${recessEnd} (keep free).
Days: Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5. Start times on a 30-minute grid aligned to the window. Meetings must NEVER overlap lunch, recess, or run outside the window.

Teacher: ${teacher.name}${teacher.room ? ` (room: ${teacher.room})` : ''}

Subject assignments (place EVERY meeting: each assignment needs EXACTLY its meetings-per-week count of meetings):
${lines}

Meetings already placed by other teachers/sections/rooms (DO NOT clash with these - no same teacher, section, combined section, or room at the same time):
${placedLines}

Rules:
- Meeting count per assignment: ${assignments.map((a) => `assignment ${a.id} = ${a.meetings_per_week}`).join(', ')}.
- Meeting length per assignment: ${assignments.map((a) => `assignment ${a.id} = ${a.duration_minutes} min`).join(', ')}. end_time must equal start_time + duration.
- Combined-section assignments need a single meeting that serves BOTH sections.
- The teacher can teach in only one room at any moment; a section (or combined pair) is in only one class at a time.
- Pinned assignments (marked PINNED) keep their fixed day/time; fit the remaining meetings around them.
- prefer a room from the assignment's preferred room list; otherwise choose a plausible room name.

Output ONLY one JSON object (no markdown, no code fences, no commentary):
{"meetings":[{"id":<assignment_id>,"day":1,"start_time":"HH:MM","end_time":"HH:MM","room":"Room name"}]}`;

  const response = await chat([{ role: 'user', content: prompt }], {
    system: 'You are a flawless school-timetable assistant. You always return strictly valid JSON and never produce markdown, extra text, extra meetings, or overlapping meetings.',
    maxTokens: 5000,
    temperature: 0.2,
  });
  return safeParse(response);
}

module.exports = {
  isEnabled, chat, generateStudentReport, generateLessonPlan, generateLessonPlanFields,
  generateExam, analyzeStudentRisk, getEnrollmentSuggestions, chatMessage, generateForm137,
  generateTeacherProgram, getProviderInfo, PROVIDERS, cleanUpMarkdown,
};
