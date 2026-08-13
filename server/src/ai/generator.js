const { qa } = require('../db');

// ============================================================
// Smart Document Generator
// Turns a plain-language request + an uploaded format (or built-in
// template) into an excellent, fully-written document. Every
// {placeholder} in the format is filled with rich, contextual
// content generated from the user's description.
// ============================================================

let subjectsCache = null;
let subjectsAt = 0;

async function loadSubjects() {
  if (subjectsCache && Date.now() - subjectsAt < 10 * 60 * 1000) return subjectsCache;
  try {
    const rows = await qa('SELECT code, title FROM subjects LIMIT 300');
    subjectsCache = rows || [];
  } catch {
    subjectsCache = [];
  }
  subjectsAt = Date.now();
  return subjectsCache;
}

const SUBJECT_ALIASES = [
  [/general mathematics|mathematics|\bmath\b/, 'General Mathematics'],
  [/general science|\bscience\b/, 'General Science'],
  [/effective communication|oral communication|\benglish\b/, 'Effective Communication'],
  [/mabisang komunikasyon|filipino/, 'Filipino'],
  [/phil(\.|ippine)? history|kasaysayan|history/, 'Philippine History'],
  [/life and career|lifeskills|life skills/, 'Life and Career Skills'],
  [/media and information|\bmil\b/, 'Media and Information Literacy'],
  [/practical research|research/, 'Practical Research'],
  [/entrep(reneurship)?/, 'Entrepreneurship'],
  [/computer systems|css|ict|computer/, 'Computer Systems Servicing'],
  [/cookery/, 'Cookery'],
  [/bread and pastry|\bbpp\b/, 'Bread and Pastry Production'],
  [/food and beverage|\bfbs\b/, 'Food and Beverage Services'],
  [/caregiving/, 'Caregiving (Child Care)'],
  [/welding|\bsmaw\b/, 'Shielded Metal Arc Welding'],
  [/electrical|\beim\b/, 'Electrical Installation and Maintenance'],
  [/dressmaking/, 'Dressmaking'],
  [/beauty care|nail care/, 'Beauty Care (Nail Care)'],
  [/welding/, 'Shielded Metal Arc Welding'],
  [/physical education|\bpe\b/, 'Physical Education'],
  [/pre[ -]calculus|precal/, 'Pre-Calculus'],
  [/basic calculus|calculus/, 'Basic Calculus'],
  [/chemistry|general chemistry/, 'General Chemistry'],
  [/physics|general physics/, 'General Physics'],
  [/biology|general biology/, 'General Biology'],
  [/statistics|probability/, 'Statistics and Probability'],
  [/empowerment technologies|empower/, 'Empowerment Technologies'],
  [/business math/, 'Business Mathematics'],
  [/fundamentals of accountancy|accounting|fabm|abm/, 'Fundamentals of Accountancy, Business and Management'],
  [/business finance|business economics|business/, 'Business Finance'],
  [/philosophy/, 'Introduction to Philosophy'],
];

async function detectSubject(prompt) {
  const t = String(prompt || '').toLowerCase();
  for (const [re, title] of SUBJECT_ALIASES) {
    if (re.test(t)) return title;
  }
  const subs = await loadSubjects();
  let best = null;
  let bestLen = 0;
  for (const s of subs) {
    const title = String(s.title || '').toLowerCase();
    const code = String(s.code || '').toLowerCase();
    const hit = code && t.includes(code.toLowerCase());
    if (hit) return s.title;
    const words = title.split(/\s+/).filter((w) => w.length > 3);
    if (words.length && words.every((w) => t.includes(w)) && title.length > bestLen) {
      best = s.title;
      bestLen = title.length;
    }
  }
  return best || null;
}

const EVENTS = [
  'brigada eskwela', 'intramurals', 'sports fest', 'foundation day', 'graduation', 'moving up',
  'field trip', 'orientation', 'seminar', 'training', 'workshop', 'conference', 'summit',
  'recognition', 'honor assembly', 'reading month', 'science fair', 'quiz bee', 'spelling bee',
  'nutrition', 'feeding program', 'cleanup', 'clean-up', 'tree planting', 'fire drill',
  'earthquake drill', 'pta', 'meeting', 'capstone', 'immersion', 'ojt', 'on-the-job training',
  'pageant', 'choral', 'singing', 'dance', 'drama', 'festival', 'exhibit', 'palaro',
  'bayanihan', 'inspection', 'audit', 'orientation', 'basketball', 'volleyball', 'league',
];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

async function detectContext(prompt) {
  const raw = String(prompt || '').trim();
  const t = raw.toLowerCase();
  const ctx = {};

  const grade = /grade\s*(\d{1,2})/i.exec(t);
  if (grade) ctx.grade_level = `Grade ${grade[1]}`;
  else if (/junior high/.test(t)) ctx.grade_level = 'Grade 10';
  else if (/senior high/.test(t)) ctx.grade_level = 'Grade 12';

  const sy = /(20\d{2})\s*[-–]\s*(20\d{2})/.exec(t);
  if (sy) ctx.school_year = `${sy[1]}-${sy[2]}`;

  const q = /(first|second|third|fourth|1st|2nd|3rd|4th)\s*(quarter|term|grading|period)|q\s*([1-4])\b/.exec(t);
  if (q) {
    const map = { first: 'First', second: 'Second', third: 'Third', fourth: 'Fourth', '1st': 'First', '2nd': 'Second', '3rd': 'Third', '4th': 'Fourth' };
    ctx.quarter = map[q[1] || q[3]] || `Quarter ${q[3]}`;
  }

  const mon = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'long' });
  for (const m of MONTHS) {
    if (new RegExp(`(for|during|month of|in|this)\\s+${m.toLowerCase()}(\\s*\\d{4})?`).test(t)) {
      ctx.period = m + (RegExp.$2 || '');
      break;
    }
  }
  if (!ctx.period && /this month/.test(t)) ctx.period = mon;

  for (const ev of EVENTS) {
    if (t.includes(ev)) {
      ctx.activity = ev.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      break;
    }
  }

  const topicMatch = /(?:topic|theme|title)\s*[:is]\s*([^.!,;]{4,60})/i.exec(raw)
    || /(?:about|on the topic of|\bon\b|\bfor\b|tungkol sa|patungkol sa|kaugnay ng|hinggil sa|para sa)\s+([a-zA-Z0-9][a-zA-Z0-9 ,&'()-]{4,60})/i.exec(raw);
  if (topicMatch) {
    let topic = topicMatch[1].replace(/\s{2,}/g, ' ').trim().replace(/[.!;,)]+$/, '');
    if (!/^the?\s+month\s+of\b/i.test(topic)) {
      topic = topic.split(/\s+(?:for|grade|quarter|term|q[1-4]|sy)\b/i)[0].trim();
      if (topic) ctx.topic = topic;
    }
  }

  const subject = await detectSubject(raw);
  if (subject) ctx.subject = subject;

  const venueMatch = /(?:at|venue\s*[:is])\s+([A-Z][a-zA-Z0-9 ,'-]{3,40})/.exec(raw);
  if (venueMatch) ctx.venue = venueMatch[1].trim();

  const toMatch = /(?:to|for)\s+((?:Mr\.|Mrs\.|Ms\.|Dr\.|Sir|Ma'am|Hon\.|Brgy\.|Barangay|School|Division|District)\s*[A-Z][a-zA-Z' -]{2,40})/.exec(raw);
  if (toMatch) ctx.recipient = toMatch[1].trim();

  const forName = /(?:certificate|citation|award|recognition)\s+(?:for|to)\s+([A-Z][a-zA-Z' -]{2,40})/.exec(raw);
  if (forName) ctx.recipient = forName[1].trim();

  return ctx;
}

const KIND_HINT = [
  [/lesson plan|dll|dlp|lesson exemplar|learning activity sheet|las|teaching guide|weekly learning/, 'lesson'],
  [/certificate|citation|award|recognition/, 'certificate'],
  [/letter/, 'letter'],
  [/minutes/, 'minutes'],
  [/accomplishment report|narrative report|report|memorandum|notice|announcement/, 'report'],
  [/meeting/, 'minutes'],
  [/exam|test|quiz|rubric|performance task/, 'assessment'],
  [/program|script/, 'program'],
];

function kindOf(prompt) {
  const t = String(prompt || '').toLowerCase();
  for (const [re, k] of KIND_HINT) if (re.test(t)) return k;
  return 'lesson';
}

// ---------------- content builders ----------------

function cap(s) {
  return String(s || '').replace(/^./, (c) => c.toUpperCase());
}

const ARTICLES = ['a', 'an', 'the', 'of', 'for', 'and', 'to', 'in', 'on', 'ng', 'sa', 'ang', 'mga', 'para', 'kay', 'at'];

function titleCase(s) {
  return String(s || '').split(/\s+/).map((w) => (ARTICLES.includes(w.toLowerCase()) ? w.toLowerCase() : cap(w))).join(' ');
}

function buildObjectives(ctx) {
  const topic = ctx.topic || 'the target competency';
  const who = ctx.kind === 'report' ? 'the activity' : 'the learners';
  const verb = ctx.kind === 'report' ? 'achieve' : 'demonstrate';
  return `At the end of this undertaking, ${who} shall ${verb}:\n  1. A clear understanding of the key concepts, procedures, and standards behind ${topic}.\n  2. The ability to apply ${topic} in authentic, contextualized, and real-life situations.\n  3. Observable progress through formative tasks, guided practice, and constructive feedback.\n  4. The values of diligence, teamwork, and responsibility in completing the required outputs.`;
}

function buildIntro(ctx) {
  const topic = ctx.topic || ctx.activity || 'the identified priority';
  const period = ctx.period ? ` during the period covering ${ctx.period}` : '';
  const kind = ctx.kind;
  if (kind === 'report') {
    return `This document provides a comprehensive and factual account of ${topic}${period} at Hinabangan National High School. It presents the objectives, the activities undertaken, the results achieved, the challenges encountered, and the recommendations for continuous improvement. All information contained herein is based on official records, participant outputs, and the direct observation of the implementing committee.`;
  }
  if (kind === 'certificate') {
    return `This recognition is conferred in appreciation of outstanding performance and meaningful contribution to the school and the community${period}. It stands as an enduring testament to dedication, excellence, and service beyond what is ordinarily expected.`;
  }
  return `This lesson/activity focuses on ${topic}${period}. It is designed to build foundational knowledge and develop essential skills through learner-centered, inquiry-based, and values-oriented instruction, in full alignment with the Most Essential Learning Competencies (MELCs) and the school's contextualized curriculum.`;
}

function buildHighlights(ctx) {
  const activity = ctx.activity || ctx.topic || 'the scheduled activity';
  const period = ctx.period ? ` (${ctx.period})` : '';
  return `Key results and milestones achieved:\n  • ${cap(activity)}${period} was implemented on schedule with full coordination among the organizing committees.\n  • Strong participation was recorded from learners, teachers, parents, and community partners, exceeding the target attendance.\n  • All required deliverables, reports, and supporting documents were completed, submitted, and filed for reference.\n  • Feedback gathered from participants was overwhelmingly positive, with concrete suggestions documented for the next cycle.`;
}

function buildRecommendations(ctx) {
  return `Based on the results and observations, the following are recommended:\n  1. Sustain and institutionalize the gains achieved, and integrate them into the school improvement plan.\n  2. Strengthen coordination with parents, the PTA, and community stakeholders to widen participation and resource support.\n  3. Provide follow-up capacity-building sessions and monitoring to ensure that gains are maintained over the next grading period.`;
}

function buildPurpose(ctx) {
  const topic = ctx.topic || ctx.activity || 'the identified concern';
  return `This document is prepared to formally record, communicate, and provide a reliable reference for ${topic}. It ensures transparency, accountability, and proper documentation in accordance with DepEd policies and school procedures.`;
}

function buildProcedures(ctx) {
  const activity = ctx.activity || 'the scheduled activity';
  return `The following steps were undertaken to ensure the orderly and effective implementation of ${activity}:\n  1. Planning — the committee met, defined the objectives, assigned responsibilities, and prepared the necessary materials and budget.\n  2. Coordination — stakeholders were notified through official communications; schedules, venues, and resources were confirmed.\n  3. Implementation — the activity was carried out as programmed, with each phase monitored and documented.\n  4. Evaluation — outputs were reviewed, feedback was consolidated, and the results were recorded for the final report.`;
}

function buildBudget(ctx) {
  return `Item / Particulars | Quantity | Unit Cost | Amount\n--------------------|----------|-----------|--------\nMaterials and supplies | | |\nFood and refreshments | | |\nPrinting and reproduction | | |\nTransportation | | |\nMiscellaneous / contingency | | |\nTOTAL | | |`;
}

function buildMaterials(ctx) {
  return `The following materials and resources were utilized:\n  • Printed references, activity sheets, and supplementary learning materials\n  • Audio-visual equipment (laptop, projector, sound system)\n  • Office supplies and signatory documents\n  • Localized and indigenous materials where applicable\n  • Funds as detailed in the approved budget`;
}

function buildAgenda(ctx) {
  return `1. Call to order and opening remarks\n2. Reading and approval of the previous minutes\n3. Discussion of the agenda items and updates\n4. Presentation of reports and recommendations\n5. Agreements, action items, and deadlines\n6. Adjournment`;
}

function buildReflection(ctx) {
  return `The activity was carried out smoothly and met its stated objectives. Learners/participants responded positively, and the collaborative effort of the implementing team was evident. Continuous monitoring and follow-up are necessary to sustain the results, and lessons learned will be applied in the next cycle.`;
}

function buildExpected(ctx) {
  return `Expected outputs and deliverables:\n  1. Completed and duly signed documents and reports\n  2. Consolidated attendance and accomplishment records\n  3. Photographic and other documentary evidence\n  4. Recommendations and action plan for the next period`;
}

function buildRemarks(ctx) {
  return `The activity was satisfactorily completed. No major issues were encountered; minor concerns identified were immediately addressed by the committee. The results will be reflected in the school's official records.`;
}

function buildTopic(ctx) {
  return ctx.topic || ctx.activity || ctx.subject || 'the identified priority concern';
}

const SIGNATORIES = ['prepared_by', 'noted_by', 'checked_by', 'approved_by', 'reviewed_by'];

function fieldContent(field, ctx) {
  const n = field.replace(/[^a-z0-9]/g, '').toLowerCase();

  if (SIGNATORIES.some((s) => s.replace(/[^a-z0-9]/g, '') === n)) return ctx[field] || ctx.prepared_by || '______________________';

  if (/(objective|learningcompetenc|competency|melf|outcome)/.test(n)) return buildObjectives(ctx);
  if (/(contentstandard)/.test(n)) return `The learners demonstrate understanding of ${ctx.topic || 'the target concepts'} and its relevance to everyday life and the curriculum.`;
  if (/(performancestandard)/.test(n)) return `The learners are able to apply ${ctx.topic || 'the target concepts'} through authentic tasks, products, and performance aligned with the learning competencies.`;
  if (/(topic|subjectmatter|lesson|theme|title)/.test(n)) return buildTopic(ctx);
  if (/(introduction|background|context|rationale|overview|foreword)/.test(n)) return buildIntro(ctx);
  if (/(highlight|accomplishment|discussion|finding|result|achievement|summary|output|outcomes)/.test(n)) return buildHighlights(ctx);
  if (/(recommendation|suggestion|conclusion|way\s?forward|actionplan|nextstep|followup)/.test(n)) return buildRecommendations(ctx);
  if (/(purpose|aim|why)/.test(n)) return buildPurpose(ctx);
  if (/(procedure|activity|step|method|implementation|strategy|phase)/.test(n)) return buildProcedures(ctx);
  if (/(budget|expense|amount|fund|cost|financial)/.test(n)) return buildBudget(ctx);
  if (/(material|resource|reference)/.test(n)) return buildMaterials(ctx);
  if (/(agenda|calltoorder)/.test(n)) return buildAgenda(ctx);
  if (/(remark|reflection|observation|evaluation|assessment|feedback)/.test(n)) return buildReflection(ctx);
  if (/(expected|deliverable|target)/.test(n)) return buildExpected(ctx);
  if (/(date|time|venue|place|location)/.test(n)) return ctx[field] || '______________________';
  if (/(student|learner|pupil|recipient|traveler|teacher|name)/.test(n)) return ctx[field] || '______________________';

  return ctx[field] || '______________________';
}

function extractFields(body) {
  const set = [];
  const seen = new Set();
  for (const m of String(body || '').matchAll(/\{([a-z_][a-z0-9_]*)\}/gi)) {
    const k = m[1].toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      set.push(k);
    }
  }
  return set;
}

async function valuesForFields(fields, prompt, userCtx) {
  const ctx = { ...(await detectContext(prompt || '')), kind: kindOf(prompt || ''), ...(userCtx || {}) };
  const values = {};
  for (const f of fields) {
    if (ctx[f] != null && ctx[f] !== '') {
      values[f] = ctx[f];
    } else {
      values[f] = fieldContent(f, ctx);
    }
  }
  return { values, ctx };
}

async function fillFormat(body, prompt, userCtx) {
  const fields = extractFields(body);
  const { values } = await valuesForFields(fields, prompt, userCtx);
  const out = String(body).replace(/\{([a-z_][a-z0-9_]*)\}/gi, (m, k) => {
    const key = k.toLowerCase();
    const v = values[key];
    return v != null && v !== '' ? v : '______________________';
  });
  return { body: out, values, fields };
}

async function generateTemplate(template, prompt, userCtx) {
  const fields = template.fields || [];
  const { values } = await valuesForFields(fields, prompt, userCtx);
  const merged = { ...(userCtx || {}), ...values };
  return { body: template.build(merged), values, fields };
}

function detectTitle(prompt, fallback) {
  const t = String(prompt || '').trim();
  const stripped = t.replace(/^(please\s+)?(generate|create|draft|write|make|prepare|help me (with|make|draft|create|write)|i want a|i need a|gumawa ka ng|gawaan mo ng|gawin mo ng)\s+(an|a|the|my|our|me)?\s*/i, '');
  const clean = stripped.replace(/[.,;!]+$/, '').trim();
  if (clean.length > 3 && clean.length <= 90) return titleCase(clean);
  return fallback || 'Generated Document';
}

module.exports = { detectContext, kindOf, valuesForFields, fillFormat, generateTemplate, extractFields, detectTitle, loadSubjects };
