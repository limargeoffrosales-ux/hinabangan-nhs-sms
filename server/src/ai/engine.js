const { q, qa } = require('../db');

function wordsOf(text) {
  return String(text || '').split(/\s+/).filter(Boolean);
}

function countWords(text) {
  return wordsOf(text).length;
}

function sentences(text) {
  return String(text || '').split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
}

function improve(text, mode) {
  const src = String(text || '');
  if (!src.trim()) return { body: src, note: 'Nothing to improve.' };
  const wc = countWords(src);
  switch (mode) {
    case 'formalize': {
      let out = src.replace(/\bgonna\b/gi, 'going to').replace(/\bwanna\b/gi, 'want to');
      out = out.replace(/can't/gi, 'cannot').replace(/don't/gi, 'do not').replace(/won't/gi, 'will not');
      out = out.replace(/kids/gi, 'learners').replace(/guys/gi, 'everyone').replace(/ok(ay)?/gi, 'understood');
      out = out.replace(/ very /g, ' notably ').replace(/ big /g, ' significant ').replace(/ a lot /g, ' considerably ');
      return { body: out, note: 'Formalized tone; abbreviations expanded and casual words replaced.' };
    }
    case 'concise': {
      const out = sentences(src).map((s) => s.trim()).join(' ');
      return { body: out, note: `Compressed to ${countWords(out)} words from ${wc}.` };
    }
    case 'expand': {
      return { body: src, note: 'Add supporting details, examples, and specific dates under each section to expand content (AI expansion needs your input to stay accurate).' };
    }
    case 'bullet': {
      const items = sentences(src).map((s) => '  - ' + s.trim());
      return { body: items.join('\n'), note: 'Converted into bullet points.' };
    }
    case 'checklist': {
      return { body: src, note: 'Ensure each action includes a person responsible and a deadline for checklist-ready format.' };
    }
    default:
      return { body: src, note: 'No change applied.' };
  }
}

function summarize(text, maxSentences) {
  const src = String(text || '');
  const sents = sentences(src);
  if (sents.length <= (maxSentences || 3)) return { summary: src.trim(), note: 'Text is already concise.' };
  const scored = sents.map((s, i) => {
    const words = wordsOf(s);
    let score = words.length > 6 ? 2 : 0;
    const head = s.toLowerCase();
    if (/objectives?|highlights|findings|results|conclusion|summary|action|recommend/.test(head)) score += 3;
    if (i === 0 || i === sents.length - 1) score += 2;
    return { s, score, i };
  });
  const picked = scored.sort((a, b) => b.score - a.score).slice(0, maxSentences || 3)
    .sort((a, b) => a.i - b.i).map((x) => x.s.trim());
  return { summary: picked.join(' '), note: `Selected the ${picked.length} most information-dense sentences.` };
}

function gradeStatus(grade) {
  if (grade == null) return null;
  if (grade >= 90) return 'excellent';
  if (grade >= 85) return 'proficient';
  if (grade >= 80) return 'approaching';
  if (grade >= 75) return 'developing';
  return 'at_risk';
}

function readingLevelFor(level) {
  const map = { Independent: 1, Instructional: 2, Frustration: 3, 'Non-Reader': 4 };
  return map[level] || null;
}

const RISK_LABELS = ['High risk', 'Moderate risk', 'Low risk'];

async function insights(req) {
  const sy = '2025-2026';
  const out = { generated_at: new Date().toISOString(), sections: [] };

  const gradeRows = await qa(
    `SELECT g.student_id, s.first_name, s.last_name, s.sex, s.grade_level, sec.name AS section_name,
            AVG(g.computed_grade) AS avg_grade, MIN(g.computed_grade) AS min_grade
     FROM grades g
     JOIN students s ON s.id = g.student_id
     LEFT JOIN sections sec ON sec.id = g.section_id
     WHERE g.school_year = ? GROUP BY g.student_id`,
    [sy]);

  const attRows = await qa(
    `SELECT student_id,
            SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absents,
            COUNT(*) AS days
     FROM attendance GROUP BY student_id`);
  const attMap = {};
  for (const a of attRows) attMap[a.student_id] = { absents: Number(a.absents || 0), days: Number(a.days || 0) };

  const reading = await qa(
    `SELECT l.student_id, l.level, l.kind, l.score, l.max_score, s.first_name, s.last_name
     FROM learner_assessments l JOIN students s ON s.id = l.student_id
     WHERE l.kind = 'reading' ORDER BY l.id DESC`);
  const readingByStudent = {};
  for (const r of reading) {
    if (!readingByStudent[r.student_id] && r.level) readingByStudent[r.student_id] = r;
  }

  const atRisk = [];
  const leveled = [];
  for (const g of gradeRows) {
    const att = attMap[g.student_id] || { absents: 0, days: 0 };
    const attRate = att.days ? ((att.days - att.absents) / att.days) * 100 : 100;
    let risk = 0;
    const reasons = [];
    if (g.avg_grade < 75) { risk += 2; reasons.push(`Average ${g.avg_grade}% below passing`); }
    else if (g.avg_grade < 80) { risk += 1; reasons.push(`Average ${g.avg_grade}% near the passing line`); }
    if (att.absents >= 3) { risk += 1; reasons.push(`${att.absents} absences recorded`); }
    if (att.absents >= 6) risk += 1;
    const rl = readingByStudent[g.student_id];
    if (rl) {
      const lvl = readingLevelFor(rl.level);
      if (lvl && lvl >= 3) { risk += 1; reasons.push(`Reading at ${rl.level} level`); }
      if (rl.level === 'Independent') leveled.push('independent');
      if (rl.level === 'Instructional') leveled.push('instructional');
      if (rl.level === 'Frustration') leveled.push('frustration');
      if (rl.level === 'Non-Reader') leveled.push('non_reader');
    }
    const riskLabel = risk >= 3 ? 'High risk' : risk === 2 ? 'Moderate risk' : 'Low risk';
    atRisk.push({
      student_id: g.student_id,
      name: `${g.first_name} ${g.last_name}`,
      grade_level: g.grade_level, section: g.section_name,
      avg_grade: Math.round(g.avg_grade * 10) / 10,
      attendance_rate: Math.round(attRate),
      reading_level: rl ? rl.level : null,
      risk: riskLabel, risk_score: risk, reasons,
    });
  }
  atRisk.sort((a, b) => b.risk_score - a.risk_score);

  const interventionCount = await qa(
    'SELECT status, COUNT(*) AS n FROM intervention_plans GROUP BY status');
  const interventionByStatus = {};
  for (const i of interventionCount) interventionByStatus[i.status] = Number(i.n);

  const subCounts = await qa(
    `SELECT status, COUNT(*) AS n FROM report_submissions WHERE school_year = ? GROUP BY status`, [sy]);
  const submissionCounts = {};
  for (const s of subCounts) submissionCounts[s.status] = Number(s.n);

  const pendingReviews = await qa(
    `SELECT r.id, r.status, r.period, t.name AS report_name, u.name AS user_name
     FROM report_submissions r
     JOIN report_types t ON t.id = r.report_type_id
     JOIN users u ON u.id = r.user_id
     WHERE r.school_year = ? AND r.status = 'submitted' ORDER BY r.updated_at DESC LIMIT 6`, [sy]);
  const pendingApprovals = await qa(
    `SELECT r.id, r.status, r.period, t.name AS report_name, u.name AS user_name
     FROM report_submissions r
     JOIN report_types t ON t.id = r.report_type_id
     JOIN users u ON u.id = r.user_id
     WHERE r.school_year = ? AND r.status = 'reviewed' ORDER BY r.updated_at DESC LIMIT 6`, [sy]);

  const staff = (await qa("SELECT id, role FROM users WHERE status = 'active' AND role NOT IN ('super_admin','school_admin','principal','assistant_principal','registrar','student','parent')"));
  const required = (await qa('SELECT id FROM report_types WHERE active = 1 AND required = 1'));
  const done = await qa(
    `SELECT user_id, COUNT(DISTINCT report_type_id) AS n FROM report_submissions
     WHERE school_year = ? AND status IN ('submitted','reviewed','approved') GROUP BY user_id`, [sy]);
  const doneMap = {};
  for (const d of done) doneMap[d.user_id] = Number(d.n);
  const compliance = staff.length ? Math.round(staff.reduce((s, u) => s + Math.min(100, ((doneMap[u.id] || 0) / required.length) * 100), 0) / staff.length) : 0;

  out.sections.push({
    id: 'risk', title: 'Learner Risk Prediction', kind: 'students',
    summary: `${atRisk.filter((s) => s.risk === 'High risk').length} learners at high risk, ${atRisk.filter((s) => s.risk === 'Moderate risk').length} at moderate risk this quarter.`,
    data: atRisk.slice(0, 6),
  });

  out.sections.push({
    id: 'reading', title: 'Reading Level Distribution', kind: 'chart',
    summary: leveled.length ? `Instructional → ${leveled.filter((l) => l === 'instructional').length}, Frustration → ${leveled.filter((l) => l === 'frustration').length}.` : 'Encode PHIL-IRI/EGRA results in the Reading & Numeracy module to unlock predictions.',
    data: ['independent', 'instructional', 'frustration', 'non_reader'].map((k) => ({
      name: k.replace('_', ' '), value: leveled.filter((l) => l === k).length,
    })),
  });

  out.sections.push({
    id: 'compliance', title: 'Teacher Compliance Meter', kind: 'meter',
    summary: `School-wide compliance is at ${compliance}% for required report types.`,
    data: { percent: compliance, submitted: submissionCounts.submitted || 0, reviewed: submissionCounts.reviewed || 0, approved: submissionCounts.approved || 0 },
  });

  out.sections.push({
    id: 'approvals', title: 'Approval Center', kind: 'approvals',
    summary: `${(pendingReviews.length || 0) + (pendingApprovals.length || 0)} reports awaiting action.`,
    data: { pending_reviews: pendingReviews, pending_approvals: pendingApprovals },
  });

  out.sections.push({
    id: 'interventions', title: 'Interventions', kind: 'stats',
    summary: `${interventionByStatus.active || 0} active intervention plans on file.`,
    data: interventionByStatus,
  });

  const recs = [];
  const highRisk = atRisk.filter((s) => s.risk === 'High risk');
  if (highRisk.length) recs.push(`Schedule parent conferences for the ${highRisk.length} high-risk learners and start remediation before the next quarterly assessment.`);
  if (readingByStudent && Object.keys(readingByStudent).length && leveled.filter((l) => l === 'frustration' || l === 'non_reader').length) {
    recs.push('Expand the reading remediation program: learners at Frustration/Non-Reader levels need daily 20-minute guided reading sessions.');
  }
  if (compliance < 80) recs.push(`Compliance is at ${compliance}%. Remind staff of pending submissions and prioritize approval of reviewed documents.`);
  if ((submissionCounts.returned || 0) > 3) recs.push('Several submissions were returned. Consider a short briefing on common review findings to reduce rework.');
  if (!recs.length) recs.push('All monitored indicators look healthy. Continue regular monitoring and documentation.');
  out.sections.push({ id: 'recommendations', title: 'AI Recommendations', kind: 'list', data: recs });

  return out;
}

module.exports = { improve, summarize, insights, gradeStatus, wordsOf, countWords, sentences };
