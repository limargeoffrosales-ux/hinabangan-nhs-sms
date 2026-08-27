const { q, qa } = require('../db');
const { getScaleForSubject, convertGrade, gpaFrom } = require('./scales');

const HONOR_KEY = 'honor_roll';

const HONOR_DEFAULTS = {
  highest: 98,
  high: 95,
  honors: 90,
  floors: { highest: 90, high: 90, honors: 80 },
};

const DESIGNATIONS = {
  with_highest_honors: 'With Highest Honors',
  with_high_honors: 'With High Honors',
  with_honors: 'With Honors',
};

function round2(n) {
  return n == null ? null : Math.round(n * 100) / 100;
}

// Honor-roll thresholds from app_settings (falls back to DepEd DO 36, s. 2016 defaults).
async function getHonorSettings() {
  const row = await q('SELECT value FROM app_settings WHERE key = ?', [HONOR_KEY]);
  try {
    const p = row ? JSON.parse(row.value) : {};
    return {
      highest: Number(p.highest) || HONOR_DEFAULTS.highest,
      high: Number(p.high) || HONOR_DEFAULTS.high,
      honors: Number(p.honors) || HONOR_DEFAULTS.honors,
      floors: {
        highest: Number(p.floors && p.floors.highest) || HONOR_DEFAULTS.floors.highest,
        high: Number(p.floors && p.floors.high) || HONOR_DEFAULTS.floors.high,
        honors: Number(p.floors && p.floors.honors) || HONOR_DEFAULTS.floors.honors,
      },
    };
  } catch (err) {
    return { ...HONOR_DEFAULTS, floors: { ...HONOR_DEFAULTS.floors } };
  }
}

async function saveHonorSettings(settings) {
  const clean = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : fallback;
  };
  const value = {
    highest: clean(settings.highest, HONOR_DEFAULTS.highest),
    high: clean(settings.high, HONOR_DEFAULTS.high),
    honors: clean(settings.honors, HONOR_DEFAULTS.honors),
    floors: {
      highest: clean(settings.floors && settings.floors.highest, HONOR_DEFAULTS.floors.highest),
      high: clean(settings.floors && settings.floors.high, HONOR_DEFAULTS.floors.high),
      honors: clean(settings.floors && settings.floors.honors, HONOR_DEFAULTS.floors.honors),
    },
  };
  await qa(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    [HONOR_KEY, JSON.stringify(value)]);
  return value;
}

// Per-subject annual final grade (average over terms 1-3) for a student + school year.
async function finalsForStudent(studentId, schoolYear) {
  const rows = await qa(
    `SELECT g.subject_id, su.code, su.title, su.units,
            ROUND(AVG(g.computed_grade), 2) AS final
     FROM grades g JOIN subjects su ON su.id = g.subject_id
     WHERE g.student_id = ? AND g.school_year = ? AND g.computed_grade IS NOT NULL
     GROUP BY g.subject_id ORDER BY su.code`,
    [studentId, schoolYear]);
  const scaleCache = {};
  const out = [];
  for (const r of rows) {
    const scale = scaleCache[r.subject_id] || (scaleCache[r.subject_id] = await getScaleForSubject(r.subject_id));
    const converted = convertGrade(r.final, scale);
    out.push({
      subject_id: Number(r.subject_id),
      code: r.code,
      title: r.title,
      units: Number(r.units || 0),
      final: Number(r.final),
      letter: converted ? converted.letter : null,
      points: converted ? converted.points : null,
      proficiency: converted ? converted.proficiency : null,
      passed: converted ? converted.passed : null,
      scale: scale ? scale.code : null,
      scale_credits_pass_only: scale ? !!scale.credits_pass_only : false,
    });
  }
  return out;
}

// Aggregate summary: GWA (unweighted mean of finals), unweighted GPA, weighted GPA (units),
// and credits (units passed; credits_pass_only per-subject scale).
function summarizeSubjects(subjects) {
  const graded = subjects.filter((s) => s.final != null);
  const gwa = graded.length ? round2(graded.reduce((a, s) => a + s.final, 0) / graded.length) : null;
  const gpa = gpaFrom(graded);
  let wNum = 0;
  let wDen = 0;
  for (const s of graded) {
    if (s.points == null) continue;
    const units = s.units || 0;
    wDen += units;
    const points = s.passed === false && s.scale_credits_pass_only ? 0 : s.points;
    wNum += points * units;
  }
  const weightedGpa = wDen ? round2(wNum / wDen) : null;
  const creditsEarned = graded
    .filter((s) => s.passed && (s.units || 0) > 0)
    .reduce((a, s) => a + s.units, 0);
  const creditsTotal = graded.reduce((a, s) => a + s.units, 0);
  return {
    gwa,
    gpa,
    weighted_gpa: weightedGpa,
    credits_earned: creditsEarned,
    credits_total: creditsTotal,
    subjects: graded,
  };
}

function honorDesignation(summary, settings) {
  if (summary.gwa == null) return null;
  const finals = summary.subjects.filter((s) => s.final != null).map((s) => s.final);
  if (!finals.length) return null;
  const minFinal = Math.min(...finals);
  const s = settings || HONOR_DEFAULTS;
  if (summary.gwa >= s.highest && minFinal >= s.floors.highest) return 'with_highest_honors';
  if (summary.gwa >= s.high && minFinal >= s.floors.high) return 'with_high_honors';
  if (summary.gwa >= s.honors && minFinal >= s.floors.honors) return 'with_honors';
  return null;
}

// Assign competition-style ranks (equal values share the rank of their first occurrence).
function assignRanks(rows, key = 'gwa') {
  rows.sort((a, b) => (b[key] == null ? -1 : b[key]) - (a[key] == null ? -1 : a[key]));
  let rank = 0;
  let prev = null;
  let prevRank = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][key] !== prev) {
      prev = rows[i][key];
      prevRank = i + 1;
    }
    rows[i].rank = prevRank;
  }
  return rows;
}

async function studentSummary(studentId, schoolYear) {
  const subjects = await finalsForStudent(studentId, schoolYear);
  return summarizeSubjects(subjects);
}

// Batch finals for multiple students in one query (avoids N+1 in portal/dashboard).
// Returns Map: studentId -> { summary, subjects }.
async function finalsForStudents(studentIds, schoolYear) {
  const result = new Map();
  if (!studentIds || !studentIds.length) return result;
  const ids = [...new Set(studentIds.map(Number))];
  const marks = ids.map(() => '?').join(',');
  const rows = await qa(
    `SELECT g.student_id, g.subject_id, su.code, su.title, su.units,
            ROUND(AVG(g.computed_grade), 2) AS final
     FROM grades g JOIN subjects su ON su.id = g.subject_id
     WHERE g.student_id IN (${marks}) AND g.school_year = ? AND g.computed_grade IS NOT NULL
     GROUP BY g.student_id, g.subject_id ORDER BY su.code`,
    [...ids, schoolYear]);
  const byStudent = {};
  for (const r of rows) {
    const sid = Number(r.student_id);
    (byStudent[sid] = byStudent[sid] || []).push(r);
  }
  for (const sid of ids) {
    const out = [];
    const scaleCache = {};
    for (const r of byStudent[sid] || []) {
      const scale = scaleCache[r.subject_id] || (scaleCache[r.subject_id] = await getScaleForSubject(r.subject_id));
      const converted = convertGrade(r.final, scale);
      out.push({
        subject_id: Number(r.subject_id),
        code: r.code,
        title: r.title,
        units: Number(r.units || 0),
        final: Number(r.final),
        letter: converted ? converted.letter : null,
        points: converted ? converted.points : null,
        proficiency: converted ? converted.proficiency : null,
        passed: converted ? converted.passed : null,
        scale: scale ? scale.code : null,
        scale_credits_pass_only: scale ? !!scale.credits_pass_only : false,
      });
    }
    result.set(sid, summarizeSubjects(out));
  }
  return result;
}

module.exports = {
  HONOR_DEFAULTS,
  DESIGNATIONS,
  round2,
  getHonorSettings,
  saveHonorSettings,
  finalsForStudent,
  summarizeSubjects,
  honorDesignation,
  assignRanks,
  studentSummary,
  finalsForStudents,
};
