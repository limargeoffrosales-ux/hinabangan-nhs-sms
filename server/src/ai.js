const OpenAI = require('openai');
const { q, qa } = require('./db');

let client = null;

const PROVIDERS = {
  openai: { baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', keyEnv: 'OPENAI_API_KEY' },
  groq:   { baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'openai/gpt-oss-20b', keyEnv: 'GROQ_API_KEY' },
  ollama: { baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3.2', keyEnv: '' },
  hf:     { baseUrl: 'https://api-inference.huggingface.co/v1', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct', keyEnv: 'HF_API_KEY' },
};

function getProvider() {
  return process.env.AI_PROVIDER || 'groq';
}

function getClient() {
  const provider = getProvider();
  const cfg = PROVIDERS[provider] || PROVIDERS.groq;
  const apiKey = cfg.keyEnv ? process.env[cfg.keyEnv] : 'ollama';
  if (!apiKey || apiKey === 'ollama' && provider !== 'ollama') return null;
  if (!client) {
    client = new OpenAI({ apiKey, baseURL: cfg.baseUrl });
  }
  return client;
}

function isEnabled() {
  const provider = getProvider();
  const cfg = PROVIDERS[provider] || PROVIDERS.groq;
  if (provider === 'ollama') return true;
  return !!cfg.keyEnv && !!process.env[cfg.keyEnv];
}

function model() {
  const provider = getProvider();
  const cfg = PROVIDERS[provider] || PROVIDERS.groq;
  return process.env.AI_MODEL || cfg.defaultModel;
}

function getProviderInfo() {
  const provider = getProvider();
  const cfg = PROVIDERS[provider] || PROVIDERS.groq;
  return { provider, model: model(), enabled: isEnabled(), baseUrl: cfg.baseUrl };
}

const SYSTEM_PROMPT = 'You are MeridianEd AI, an educational assistant for Hinabangan National High School (Philippines). You help teachers, administrators, students, and parents with school-related tasks. You follow DepEd guidelines and the SHS curriculum. Be concise, professional, and helpful.';

async function chat(messages, opts = {}) {
  const c = getClient();
  if (!c) throw new Error('AI not configured. Set GROQ_API_KEY (free) or AI_PROVIDER + provider key.');
  const res = await c.chat.completions.create({
    model: opts.model || model(),
    messages: [{ role: 'system', content: opts.system || SYSTEM_PROMPT }, ...messages],
    max_tokens: opts.maxTokens || 2048,
    temperature: opts.temperature ?? 0.7,
  });
  return res.choices[0].message.content;
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

  const prompt = 'Generate a narrative student report card for: ' + student.first_name + ' ' + student.last_name + ', Grade ' + student.grade_level + ', Strand: ' + (student.track_strand || student.strand || 'N/A') + ', Section: ' + (student.section_name || 'N/A') + ', SY: ' + (student.school_year || 'N/A') + '. Grades: ' + gradeList + '. Attendance: ' + attList + '. Conduct: ' + condList + '. Provide: 1) Narrative summary 2) Strengths 3) Improvements 4) Recommendations 5) Interventions if at risk. Return JSON with keys: summary, strengths, improvements, recommendations, interventions, risk_level (low/moderate/high).';
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
    competencies = await qa('SELECT * FROM subject_competencies WHERE subject_id = ?', [subject_id]);
  }
  const compList = competencies.length ? competencies.map(c => '- ' + c.title + ': ' + (c.description || '')).join('\n') : 'Align to standard DepEd competencies';
  const prompt = 'Create a Detailed Lesson Plan (DLL) for Hinabangan NHS:\n' + subjectInfo + '\nGrade: ' + (grade_level || 'N/A') + ', Strand: ' + (strand || 'N/A') + ', Topic: ' + (topic || 'Teacher to determine') + ', Duration: ' + (duration_minutes || 60) + ' min' + (week ? ', Week: ' + week : '') + '.\nCompetencies:\n' + compList + '\n\nDepEd DLL Format: 1) Learning Competencies 2) Content 3) Learning Resources 4) Procedures (a. Review b. Purpose c. Examples d. New concepts e. Practice f. Evaluate g. Remediation) 5) Reflection.\nReturn JSON: competencies, content, learning_resources, procedures (object a-g), reflection, remarks.';
  const response = await chat([{ role: 'user', content: prompt }], { maxTokens: 2500 });
  return safeParse(response);
}

async function generateExam(params) {
  const { subject_id, topic, num_items, difficulty_mix, grade_level, exam_type } = params;
  let subjectInfo = '';
  let competencies = [];
  if (subject_id) {
    const sub = await q('SELECT * FROM subjects WHERE id = ?', [subject_id]);
    if (sub) subjectInfo = 'Subject: ' + sub.title + ' (' + sub.code + ')';
    competencies = await qa('SELECT * FROM subject_competencies WHERE subject_id = ?', [subject_id]);
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
  let systemPrompt = SYSTEM_PROMPT;
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
  } catch {}
  let incidents = [];
  try {
    incidents = await qa(
      `SELECT incident_type, severity, status, incident_date
       FROM student_conduct_records WHERE student_id = ? ORDER BY incident_date`, [studentId]
    );
  } catch {}

  const years = [...new Set(allGrades.map(g => g.school_year))];
  const gradeSummary = years.map(yr => {
    const yrGrades = allGrades.filter(g => g.school_year === yr);
    const qtrs = [...new Set(yrGrades.map(g => g.quarter))];
    return yr + ': ' + qtrs.map(q => 'Q' + q + ' avg ' + (yrGrades.filter(g => g.quarter === q).reduce((s, g) => s + Number(g.computed_grade || 0), 0) / Math.max(1, yrGrades.filter(g => g.quarter === q).length)).toFixed(1)).join(', ');
  }).join('; ');
  const attSummary = attendance.length ? attendance.map(a => a.school_year + ' ' + a.status + ':' + a.n).join(', ') : 'No attendance records';
  const conductSummary = conduct.length ? conduct.map(c => c.school_year + ' ' + c.term + ': ' + ['makadiyos','makatao','makakalikasan','makabansa'].map(v => v + '=' + (c[v] || 'N/A')).join(', ')).join('; ') : 'No conduct ratings';

  const prompt = 'Generate an Individual Permanent Academic Record (Form 137) narrative summary for:\n' +
    'Student: ' + student.first_name + ' ' + student.last_name + (student.middle_name ? ' ' + student.middle_name : '') + ', LRN: ' + (student.lrn || 'N/A') + '\n' +
    'Grade Level: ' + (student.grade_level || 'N/A') + ', Strand: ' + (student.strand || student.track_strand || 'N/A') + ', Section: ' + (student.section_name || 'N/A') + '\n' +
    'School Year: ' + (student.school_year || 'N/A') + '\n' +
    'Sex: ' + (student.sex || 'N/A') + ', Birthdate: ' + (student.birthdate || 'N/A') + ', Address: ' + (student.address || 'N/A') + '\n\n' +
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

module.exports = {
  isEnabled, chat, generateStudentReport, generateLessonPlan,
  generateExam, analyzeStudentRisk, getEnrollmentSuggestions, chatMessage, generateForm137,
  getProviderInfo, PROVIDERS,
};
