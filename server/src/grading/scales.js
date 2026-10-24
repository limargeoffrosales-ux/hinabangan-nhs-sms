const { q, qa, qi, qr, bool } = require('../db');

const SCALE_TYPES = ['numeric', 'letter', 'gpa', 'ib', 'cambridge', 'custom'];
const DEFAULT_WEIGHTS = { written_work: 25, performance_task: 45, quarterly_exam: 30 };

function parseScale(row) {
  if (!row) return null;
  let weights = DEFAULT_WEIGHTS;
  let bands = [];
  try { if (row.weights) weights = JSON.parse(row.weights); } catch (e) { /* keep default */ }
  try { if (row.bands) bands = JSON.parse(row.bands); } catch (e) { /* keep empty */ }
  return {
    id: Number(row.id),
    name: row.name,
    code: row.code,
    scale_type: row.scale_type || 'numeric',
    description: row.description || '',
    passing_grade: Number(row.passing_grade),
    weights,
    bands: Array.isArray(bands) ? bands : [],
    credits_pass_only: !!row.credits_pass_only,
    is_system: !!row.is_system,
    is_default: !!row.is_default,
    active: !!row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getScale(id) {
  const row = await q('SELECT * FROM grading_scales WHERE id = ?', [id]);
  return parseScale(row);
}

async function getScaleByCode(code) {
  const row = await q('SELECT * FROM grading_scales WHERE code = ?', [code]);
  return parseScale(row);
}

// Scale lookups are read-heavy and change rarely, but getScaleForSubject costs
// two queries per call. The grading aggregations call it once per subject per
// student, so a 60x10 class list meant ~1200 queries against a table with a
// handful of rows. Memoize per request-lifetime window and expose a batch
// resolver so a whole list costs one query per distinct subject.
const SCALE_CACHE_TTL_MS = 30 * 1000;
let subjectScaleCache = new Map(); // subjectId -> { at, scale }
let defaultScaleCache = null;

function invalidateScaleCaches() {
  subjectScaleCache = new Map();
  defaultScaleCache = null;
}

async function getDefaultScale() {
  if (defaultScaleCache && Date.now() - defaultScaleCache.at < SCALE_CACHE_TTL_MS) {
    return defaultScaleCache.scale;
  }
  let row = await q('SELECT * FROM grading_scales WHERE is_default = TRUE AND active = TRUE ORDER BY id LIMIT 1');
  if (!row) row = await q('SELECT * FROM grading_scales WHERE active = TRUE ORDER BY id LIMIT 1');
  const scale = parseScale(row);
  defaultScaleCache = { at: Date.now(), scale };
  return scale;
}

async function getScaleForSubject(subjectId) {
  if (subjectId != null) {
    const hit = subjectScaleCache.get(Number(subjectId));
    if (hit && Date.now() - hit.at < SCALE_CACHE_TTL_MS) return hit.scale;
    const subj = await q('SELECT scale_id FROM subjects WHERE id = ?', [subjectId]);
    if (subj && subj.scale_id != null) {
      const scale = await getScale(subj.scale_id);
      if (scale && scale.active) {
        subjectScaleCache.set(Number(subjectId), { at: Date.now(), scale });
        return scale;
      }
    }
  }
  return getDefaultScale();
}

/**
 * Resolve scales for many subjects at once — one query for all subject rows,
 * plus one per distinct scale rather than one per (student x subject).
 * @param {Array<number|string>} subjectIds
 * @returns {Promise<Map<number, object>>}
 */
async function getScalesForSubjects(subjectIds) {
  /** @type {Map<number, object>} */
  const out = new Map();
  const ids = [...new Set((subjectIds || []).map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  if (!ids.length) return out;
  const fallback = await getDefaultScale();
  const rows = await qa(
    `SELECT s.id, s.scale_id FROM subjects s WHERE s.id IN (${ids.map(() => '?').join(',')})`,
    ids);
  const scaleIds = [...new Set(rows.map((r) => Number(r.scale_id)).filter((n) => Number.isFinite(n) && n > 0))];
  /** @type {Map<number, object>} */
  const byScaleId = new Map();
  if (scaleIds.length) {
    const scaleRows = await qa(
      `SELECT * FROM grading_scales WHERE id IN (${scaleIds.map(() => '?').join(',')}) AND active = TRUE`,
      scaleIds);
    for (const s of scaleRows) byScaleId.set(Number(s.id), parseScale(s));
  }
  for (const r of rows) {
    const scale = byScaleId.get(Number(r.scale_id)) || fallback;
    out.set(Number(r.id), scale);
    subjectScaleCache.set(Number(r.id), { at: Date.now(), scale });
  }
  return out;
}

async function listScales() {
  const rows = await qa('SELECT * FROM grading_scales ORDER BY is_default DESC, is_system DESC, id');
  return rows.map(parseScale);
}

function normalizeWeights(weights) {
  const w = {};
  for (const k of ['written_work', 'performance_task', 'quarterly_exam']) {
    w[k] = weights && Number(weights[k]) > 0 ? Number(weights[k]) : DEFAULT_WEIGHTS[k];
  }
  return w;
}

function validateScaleData(data) {
  const errors = [];
  const name = String(data.name || '').trim();
  if (!name) errors.push('name is required');
  const code = String(data.code || '').trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  if (!code) errors.push('code is required');
  const scaleType = SCALE_TYPES.includes(data.scale_type) ? data.scale_type : 'numeric';
  const passingGrade = data.passing_grade !== undefined && data.passing_grade !== '' ? Number(data.passing_grade) : 75;
  if (!(passingGrade >= 0 && passingGrade <= 100)) errors.push('passing_grade must be 0-100');
  const weights = normalizeWeights(data.weights);
  let bands = [];
  if (Array.isArray(data.bands)) {
    bands = data.bands.map((b) => ({
      min: Number(b.min),
      max: Number(b.max),
      letter: b.letter != null ? String(b.letter) : '',
      points: b.points != null && b.points !== '' ? Number(b.points) : null,
      label: b.label != null ? String(b.label) : '',
    })).filter((b) => !Number.isNaN(b.min) && !Number.isNaN(b.max));
  }
  return { errors, data: { name, code, scale_type: scaleType, passing_grade: passingGrade, weights, bands } };
}

async function createScale(data) {
  const { errors, data: d } = validateScaleData(data);
  if (errors.length) throw Object.assign(new Error(errors.join(', ')), { status: 400 });
  const existing = await q('SELECT id FROM grading_scales WHERE code = ?', [d.code]);
  if (existing) throw Object.assign(new Error(`A scale with code '${d.code}' already exists`), { status: 409 });
  invalidateScaleCaches();
  const id = await qi(
    `INSERT INTO grading_scales (name, code, scale_type, description, passing_grade, weights, bands,
       credits_pass_only, is_system, is_default, active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE, FALSE, TRUE, CURRENT_TIMESTAMP)`,
    [d.name, d.code, d.scale_type, String(data.description || '').trim(),
      d.passing_grade, JSON.stringify(d.weights), JSON.stringify(d.bands),
      bool(data.credits_pass_only !== undefined ? data.credits_pass_only : true)]);
  return getScale(id);
}

async function updateScale(id, data) {
  const scale = await getScale(id);
  if (!scale) throw Object.assign(new Error('Scale not found'), { status: 404 });
  const { errors, data: d } = validateScaleData({
    ...data,
    name: data.name !== undefined ? data.name : scale.name,
    code: data.code !== undefined ? data.code : scale.code,
    scale_type: data.scale_type !== undefined ? data.scale_type : scale.scale_type,
    passing_grade: data.passing_grade !== undefined ? data.passing_grade : scale.passing_grade,
    weights: data.weights || scale.weights,
    bands: data.bands !== undefined ? data.bands : scale.bands,
  });
  if (errors.length) throw Object.assign(new Error(errors.join(', ')), { status: 400 });
  if (data.code !== undefined && data.code.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-') !== scale.code) {
    const clash = await q('SELECT id FROM grading_scales WHERE code = ? AND id <> ?', [d.code, id]);
    if (clash) throw Object.assign(new Error(`A scale with code '${d.code}' already exists`), { status: 409 });
  }
  const creditsPass = bool(data.credits_pass_only !== undefined ? data.credits_pass_only : scale.credits_pass_only);
  await qr(
    `UPDATE grading_scales
     SET name = ?, code = ?, scale_type = ?, description = ?, passing_grade = ?,
         weights = ?, bands = ?, credits_pass_only = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [d.name, d.code, d.scale_type, String(data.description !== undefined ? data.description : scale.description).trim(),
      d.passing_grade, JSON.stringify(d.weights), JSON.stringify(d.bands), creditsPass, id]);
  invalidateScaleCaches();
  return getScale(id);
}

async function deleteScale(id) {
  const scale = await getScale(id);
  if (!scale) throw Object.assign(new Error('Scale not found'), { status: 404 });
  if (scale.is_system) throw Object.assign(new Error('Built-in scales cannot be deleted'), { status: 400 });
  const used = await q('SELECT COUNT(*) AS n FROM subjects WHERE scale_id = ?', [id]);
  if (used && Number(used.n) > 0) {
    throw Object.assign(new Error('This scale is assigned to subjects and cannot be deleted'), { status: 409 });
  }
  if (scale.is_default) {
    const fallback = await q('SELECT id FROM grading_scales WHERE id <> ? AND active = TRUE ORDER BY id LIMIT 1', [id]);
    if (fallback) await setDefault(fallback.id);
  }
  await qr('DELETE FROM grading_scales WHERE id = ?', [id]);
  invalidateScaleCaches();
  return { ok: true };
}

async function setDefault(codeOrId, byCode) {
  const target = byCode ? await getScaleByCode(codeOrId) : await getScale(codeOrId);
  if (!target) throw Object.assign(new Error('Scale not found'), { status: 404 });
  await qr('UPDATE grading_scales SET is_default = FALSE');
  await qr('UPDATE grading_scales SET is_default = TRUE WHERE id = ?', [target.id]);
  invalidateScaleCaches();
  return getScale(target.id);
}

// Convert a numeric grade (0-100) into the scale's letter / points / proficiency.
function convertGrade(value, scale) {
  if (value == null || value === '') return null;
  const v = Number(value);
  if (Number.isNaN(v)) return null;
  const passing = Number(scale.passing_grade);
  const bands = Array.isArray(scale.bands) ? scale.bands : [];
  // Look up by descending `min` rather than requiring min <= v <= max. Band
  // definitions written with one-decimal maxima (…89.9) leave fractional gaps,
  // so an exact min/max match returned null for values like 89.95 — the grade
  // then counted toward GWA but was dropped from GPA and showed no letter.
  const band =
    bands
      .filter((b) => Number.isFinite(Number(b.min)) && v >= Number(b.min))
      .sort((a, b) => Number(b.min) - Number(a.min))[0] || null;
  return {
    value: v,
    passed: v >= passing,
    passing_grade: passing,
    letter: band && band.letter ? String(band.letter) : null,
    points: band && band.points != null && band.points !== '' ? Number(band.points) : null,
    proficiency: band && band.label ? String(band.label) : null,
  };
}

// GPA = mean of grade points across subjects that have a points mapping.
function gpaFrom(subjects) {
  const pts = (subjects || []).map((s) => s.points).filter((p) => p != null);
  if (!pts.length) return null;
  return Math.round(pts.reduce((a, b) => a + b, 0) / pts.length * 100) / 100;
}

module.exports = {
  SCALE_TYPES, DEFAULT_WEIGHTS, parseScale, getScale, getScaleByCode, getDefaultScale,
  getScaleForSubject, getScalesForSubjects, invalidateScaleCaches, listScales, createScale,
  updateScale, deleteScale, setDefault, convertGrade, gpaFrom,
};
