const express = require('express');
const multer = require('multer');
const path = require('path');
const { q, qa, qi, qr, boolLiteral } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');
const { getCurrentSchoolYear, DEFAULT_SCHOOL_YEAR } = require('../schoolYear');
const { teacherForUser } = require('../scope');
const { requireLm, loadSpace } = require('../middleware/lms-authz');
const { uploadFile, deleteFile, fileKeyFromUrl, getPrivateDownloadUrl } = require('../storage');
const { UPLOAD_MAX_MB } = require('../config');
const { optimizeUpload } = require('../image');
const { hasMagic } = require('../upload-guard');
const logger = require('../logger');

const router = express.Router();
router.use(authenticate);
router.use(requireLm());

const WRITE = ['teacher'];
const MATERIAL_TYPES = ['reading', 'presentation', 'document', 'video', 'link', 'activity', 'other'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = /\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|m4v|avi|mkv|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip)$/i;
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v',
      'video/x-msvideo', 'video/x-matroska',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv', 'application/zip',
    ];
    if (!allowedExts.test(ext)) return cb(new Error(`File type not allowed. Max ${UPLOAD_MAX_MB}MB.`));
    if (!allowedMimes.includes(file.mimetype)) return cb(new Error(`File MIME type "${file.mimetype}" not allowed.`));
    cb(null, true);
  },
});

// target_student_ids is JSONB on PG (returned as a JS array) and TEXT on SQLite
// (returned as a JSON string). Treat null/empty as "everyone in the space".
function targetIncludes(target, studentId) {
  if (target === null || target === undefined || target === '') return true;
  let arr = target;
  if (typeof arr === 'string') {
    try { arr = JSON.parse(arr); } catch { arr = String(target).split(','); }
  }
  if (!Array.isArray(arr) || arr.length === 0) return true;
  return arr.map(Number).includes(Number(studentId));
}

function normalizeTarget(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const arr = (Array.isArray(raw) ? raw : String(raw).split(',')).map((x) => Number(x)).filter(Boolean);
  return arr.length ? JSON.stringify(arr) : null;
}

async function ownsSpace(req) {
  const t = await teacherForUser(req.user);
  return t && Number(req.space.teacher_id) === Number(t.id);
}

// ---- Spaces ----

router.get('/spaces', asyncH(async (req, res) => {
  const sy = req.query.school_year || getCurrentSchoolYear() || DEFAULT_SCHOOL_YEAR;
  if (req.role === 'teacher') {
    const t = await teacherForUser(req.user);
    if (!t) return res.json({ data: [] });
    const rows = await qa(
      `SELECT s.*, sec.name AS section_name, sec.grade_level, sec.strand,
              sub.code AS subject_code, sub.title AS subject_title
       FROM lm_spaces s
       LEFT JOIN sections sec ON sec.id = s.section_id
       LEFT JOIN subjects sub ON sub.id = s.subject_id
       WHERE s.teacher_id = ? AND s.school_year = ?
       ORDER BY sec.name, sub.title`,
      [t.id, sy]
    );
    return res.json({ data: rows });
  }

  if (req.role === 'student') {
    const st = await q('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!st) return res.json({ data: [] });
    const rows = await qa(
      `SELECT s.*, sec.name AS section_name, sec.grade_level, sec.strand,
              sub.code AS subject_code, sub.title AS subject_title,
              t.first_name AS teacher_first, t.last_name AS teacher_last
       FROM lm_spaces s
       JOIN enrollments e ON e.section_id = s.section_id AND e.school_year = s.school_year AND e.status = 'enrolled'
       JOIN enrollment_subjects es ON es.enrollment_id = e.id AND es.subject_id = s.subject_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       LEFT JOIN subjects sub ON sub.id = s.subject_id
       LEFT JOIN teachers t ON t.id = s.teacher_id
       WHERE e.student_id = ? AND s.school_year = ?
       ORDER BY sec.name, sub.title`,
      [st.id, sy]
    );
    return res.json({ data: rows });
  }

  return res.json({ data: [] });
}));

router.post('/spaces/sync', requireRole(...WRITE), asyncH(async (req, res) => {
  const t = await teacherForUser(req.user);
  if (!t) return res.status(403).json({ error: 'No teacher profile linked to your account' });
  const sy = req.query.school_year || getCurrentSchoolYear() || DEFAULT_SCHOOL_YEAR;
  const cas = await qa(
    `SELECT ca.*, sec.name AS section_name, sub.title AS subject_title
     FROM class_assignments ca
     LEFT JOIN sections sec ON sec.id = ca.section_id
     LEFT JOIN subjects sub ON sub.id = ca.subject_id
     WHERE ca.teacher_id = ? AND ca.school_year = ?`,
    [t.id, sy]
  );
  let created = 0;
  for (const ca of cas) {
    const found = await q(
      'SELECT id FROM lm_spaces WHERE teacher_id = ? AND section_id = ? AND subject_id = ? AND school_year = ?',
      [t.id, ca.section_id, ca.subject_id, sy]
    );
    if (found) continue;
    const title = `${ca.section_name || 'Section'} - ${ca.subject_title || 'Subject'}`;
    const id = await qi(
      `INSERT INTO lm_spaces (school_year, section_id, subject_id, teacher_id, class_assignment_id, title)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sy, ca.section_id, ca.subject_id, t.id, ca.id || null, title]
    );
    await audit(req, 'CREATE_LM_SPACE', 'lm_spaces', id, { class_assignment_id: ca.id });
    created += 1;
  }
  res.json({ ok: true, created, existing: cas.length - created, total: cas.length });
}));

router.get('/spaces/:spaceId', loadSpace, asyncH(async (req, res) => {
  res.json(req.space);
}));

// ---- Modules ----

router.get('/spaces/:spaceId/modules', loadSpace, asyncH(async (req, res) => {
  const rows = await qa(
    `SELECT id, space_id, title, description, quarter, week_or_module, order_index, published,
            created_at, updated_at
     FROM lm_modules WHERE space_id = ? ORDER BY order_index, id`,
    [req.space.id]
  );
  if (req.role === 'student') {
    const st = req.lmStudent || await q('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    return res.json({ data: st ? rows : [] });
  }
  res.json({ data: rows });
}));

router.post('/spaces/:spaceId/modules', requireRole(...WRITE), loadSpace, asyncH(async (req, res) => {
  if (!(await ownsSpace(req))) return res.status(403).json({ error: 'Forbidden' });
  const title = String(req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Title required' });
  const quarter = req.body.quarter ? Number(req.body.quarter) : null;
  if (quarter !== null && ![1, 2, 3].includes(quarter)) return res.status(400).json({ error: 'quarter must be 1-3' });
  const moduleId = await qi(
    `INSERT INTO lm_modules (space_id, title, description, quarter, week_or_module, order_index, published, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ${boolLiteral(req.body.published)}, ?)`,
    [
      req.space.id, title,
      req.body.description || null,
      quarter,
      req.body.week_or_module || null,
      req.body.order_index != null ? Number(req.body.order_index) : 0,
      req.user.id,
    ]
  );
  await audit(req, 'CREATE_LM_MODULE', 'lm_modules', moduleId, { space_id: req.space.id });
  res.json({ id: moduleId });
}));

router.patch('/spaces/:spaceId/modules/:moduleId', requireRole(...WRITE), loadSpace, asyncH(async (req, res) => {
  if (!(await ownsSpace(req))) return res.status(403).json({ error: 'Forbidden' });
  const moduleId = Number(req.params.moduleId);
  const mod = await q('SELECT id FROM lm_modules WHERE id = ? AND space_id = ?', [moduleId, req.space.id]);
  if (!mod) return res.status(404).json({ error: 'Not found' });
  const fields = [];
  const vals = [];
  if (req.body.title != null) { fields.push('title = ?'); vals.push(String(req.body.title).trim()); }
  if (req.body.description != null) { fields.push('description = ?'); vals.push(req.body.description || null); }
  if (req.body.week_or_module != null) { fields.push('week_or_module = ?'); vals.push(req.body.week_or_module || null); }
  if (req.body.quarter != null) {
    const quarter = Number(req.body.quarter);
    if (![1, 2, 3].includes(quarter)) return res.status(400).json({ error: 'quarter must be 1-3' });
    fields.push('quarter = ?'); vals.push(quarter);
  }
  if (req.body.order_index != null) { fields.push('order_index = ?'); vals.push(Number(req.body.order_index)); }
  if (req.body.published != null) { fields.push(`published = ${boolLiteral(req.body.published)}`); }
  if (!fields.length) return res.json({ ok: true });
  vals.push(req.user.id, moduleId);
  await qr(`UPDATE lm_modules SET ${fields.join(', ')}, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, vals);
  await audit(req, 'UPDATE_LM_MODULE', 'lm_modules', moduleId, { space_id: req.space.id });
  res.json({ ok: true });
}));

router.delete('/spaces/:spaceId/modules/:moduleId', requireRole(...WRITE), loadSpace, asyncH(async (req, res) => {
  if (!(await ownsSpace(req))) return res.status(403).json({ error: 'Forbidden' });
  const moduleId = Number(req.params.moduleId);
  const mod = await q('SELECT id FROM lm_modules WHERE id = ? AND space_id = ?', [moduleId, req.space.id]);
  if (!mod) return res.status(404).json({ error: 'Not found' });
  await qr('DELETE FROM lm_modules WHERE id = ?', [moduleId]);
  await audit(req, 'DELETE_LM_MODULE', 'lm_modules', moduleId, { space_id: req.space.id });
  res.json({ ok: true });
}));

// ---- Materials ----

router.get('/spaces/:spaceId/materials', loadSpace, asyncH(async (req, res) => {
  const rows = await qa(
    `SELECT m.id, m.space_id, m.module_id, m.title, m.body, m.type, m.url, m.drive_url, m.youtube_url,
            m.published, m.is_remedial, m.is_enrichment, m.is_differentiated, m.competency_id,
            m.dll_url, m.lesson_plan_url, m.target_student_ids, m.sort_order, m.created_at, m.updated_at
     FROM lm_materials m WHERE m.space_id = ? ORDER BY m.sort_order, m.id`,
    [req.space.id]
  );
  if (req.role === 'student') {
    const st = await q('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!st) return res.json({ data: [] });
    return res.json({
      data: rows.filter((r) => r.published && targetIncludes(r.target_student_ids, st.id)),
    });
  }
  res.json({ data: rows });
}));

router.post('/spaces/:spaceId/materials', requireRole(...WRITE), loadSpace, asyncH(async (req, res) => {
  if (!(await ownsSpace(req))) return res.status(403).json({ error: 'Forbidden' });
  const title = String(req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Title required' });
  const type = req.body.type || 'reading';
  if (!MATERIAL_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid material type' });
  const materialId = await qi(
    `INSERT INTO lm_materials
       (space_id, module_id, title, body, type, url, drive_url, youtube_url, published,
        is_remedial, is_enrichment, is_differentiated, competency_id, dll_url, lesson_plan_url,
        target_student_ids, sort_order, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${boolLiteral(req.body.published)}, ${boolLiteral(req.body.is_remedial)},
             ${boolLiteral(req.body.is_enrichment)}, ${boolLiteral(req.body.is_differentiated)}, ?, ?, ?, ?, ?, ?)`,
    [
      req.space.id,
      req.body.module_id ? Number(req.body.module_id) : null,
      title,
      req.body.body || null,
      type,
      req.body.url || null,
      req.body.drive_url || null,
      req.body.youtube_url || null,
      req.body.competency_id ? Number(req.body.competency_id) : null,
      req.body.dll_url || null,
      req.body.lesson_plan_url || null,
      normalizeTarget(req.body.target_student_ids),
      req.body.sort_order != null ? Number(req.body.sort_order) : 0,
      req.user.id,
    ]
  );
  await audit(req, 'CREATE_LM_MATERIAL', 'lm_materials', materialId, { space_id: req.space.id });
  res.json({ id: materialId });
}));

router.patch('/spaces/:spaceId/materials/:materialId', requireRole(...WRITE), loadSpace, asyncH(async (req, res) => {
  if (!(await ownsSpace(req))) return res.status(403).json({ error: 'Forbidden' });
  const materialId = Number(req.params.materialId);
  const m = await q('SELECT id FROM lm_materials WHERE id = ? AND space_id = ?', [materialId, req.space.id]);
  if (!m) return res.status(404).json({ error: 'Not found' });
  const fields = [];
  const vals = [];
  if (req.body.title != null) { fields.push('title = ?'); vals.push(String(req.body.title).trim()); }
  if (req.body.body != null) { fields.push('body = ?'); vals.push(req.body.body || null); }
  if (req.body.type != null) {
    if (!MATERIAL_TYPES.includes(req.body.type)) return res.status(400).json({ error: 'Invalid type' });
    fields.push('type = ?'); vals.push(req.body.type);
  }
  if (req.body.url != null) { fields.push('url = ?'); vals.push(req.body.url || null); }
  if (req.body.drive_url != null) { fields.push('drive_url = ?'); vals.push(req.body.drive_url || null); }
  if (req.body.youtube_url != null) { fields.push('youtube_url = ?'); vals.push(req.body.youtube_url || null); }
  if (req.body.competency_id != null) { fields.push('competency_id = ?'); vals.push(Number(req.body.competency_id) || null); }
  if (req.body.dll_url != null) { fields.push('dll_url = ?'); vals.push(req.body.dll_url || null); }
  if (req.body.lesson_plan_url != null) { fields.push('lesson_plan_url = ?'); vals.push(req.body.lesson_plan_url || null); }
  if (req.body.module_id != null) { fields.push('module_id = ?'); vals.push(Number(req.body.module_id) || null); }
  if (req.body.sort_order != null) { fields.push('sort_order = ?'); vals.push(Number(req.body.sort_order)); }
  if (req.body.target_student_ids != null) { fields.push('target_student_ids = ?'); vals.push(normalizeTarget(req.body.target_student_ids)); }
  if (req.body.published != null) fields.push(`published = ${boolLiteral(req.body.published)}`);
  if (req.body.is_remedial != null) fields.push(`is_remedial = ${boolLiteral(req.body.is_remedial)}`);
  if (req.body.is_enrichment != null) fields.push(`is_enrichment = ${boolLiteral(req.body.is_enrichment)}`);
  if (req.body.is_differentiated != null) fields.push(`is_differentiated = ${boolLiteral(req.body.is_differentiated)}`);
  if (!fields.length) return res.json({ ok: true });
  vals.push(req.user.id, materialId);
  await qr(`UPDATE lm_materials SET ${fields.join(', ')}, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, vals);
  await audit(req, 'UPDATE_LM_MATERIAL', 'lm_materials', materialId, { space_id: req.space.id });
  res.json({ ok: true });
}));

router.delete('/spaces/:spaceId/materials/:materialId', requireRole(...WRITE), loadSpace, asyncH(async (req, res) => {
  if (!(await ownsSpace(req))) return res.status(403).json({ error: 'Forbidden' });
  const materialId = Number(req.params.materialId);
  const m = await q('SELECT id FROM lm_materials WHERE id = ? AND space_id = ?', [materialId, req.space.id]);
  if (!m) return res.status(404).json({ error: 'Not found' });
  const atts = await qa('SELECT id, stored_key FROM lm_attachments WHERE material_id = ?', [materialId]);
  for (const a of atts) {
    if (a.stored_key) {
      deleteFile(a.stored_key).catch((err) => logger.error({ err: err?.message }, '[LMS] delete attachment failed'));
    }
    await qr('DELETE FROM lm_attachments WHERE id = ?', [a.id]);
  }
  await qr('DELETE FROM lm_materials WHERE id = ?', [materialId]);
  await audit(req, 'DELETE_LM_MATERIAL', 'lm_materials', materialId, { space_id: req.space.id });
  res.json({ ok: true });
}));

// ---- Attachments ----

router.get('/spaces/:spaceId/materials/:materialId/attachments', loadSpace, asyncH(async (req, res) => {
  const materialId = Number(req.params.materialId);
  const m = await q('SELECT id, published, target_student_ids FROM lm_materials WHERE id = ? AND space_id = ?', [materialId, req.space.id]);
  if (!m) return res.status(404).json({ error: 'Not found' });
  if (req.role === 'student') {
    const st = await q('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!st || !m.published || !targetIncludes(m.target_student_ids, st.id)) return res.json({ data: [] });
  }
  const atts = await qa(
    'SELECT id, material_id, original_name, mime_type, size_bytes, stored_key, created_at FROM lm_attachments WHERE material_id = ? ORDER BY id',
    [materialId]
  );
  res.json({ data: atts });
}));

router.post('/spaces/:spaceId/materials/:materialId/attachments', requireRole(...WRITE), loadSpace, upload.single('file'), asyncH(async (req, res) => {
  if (!(await ownsSpace(req))) return res.status(403).json({ error: 'Forbidden' });
  const materialId = Number(req.params.materialId);
  const m = await q('SELECT id FROM lm_materials WHERE id = ? AND space_id = ?', [materialId, req.space.id]);
  if (!m) return res.status(404).json({ error: 'Not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!hasMagic(req.file)) return res.status(400).json({ error: 'File content does not match its declared type.' });
  req.file = await optimizeUpload(req.file);
  const { key, url } = await uploadFile('lms', req.file, req.file.originalname);
  const aid = await qi(
    'INSERT INTO lm_attachments (material_id, original_name, stored_key, mime_type, size_bytes, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    [materialId, req.file.originalname, key, req.file.mimetype, req.file.size, req.user.id]
  );
  await audit(req, 'UPLOAD_LM_ATTACHMENT', 'lm_attachments', aid, { material_id: materialId, key });
  res.json({ id: aid, key, url: url || `/api/v1/uploads/file/${key}`, name: req.file.originalname, size: req.file.size });
}));

router.delete('/attachments/:attachmentId', requireRole(...WRITE), asyncH(async (req, res) => {
  const aid = Number(req.params.attachmentId);
  const a = await q(
    'SELECT a.id, a.stored_key, m.space_id FROM lm_attachments a JOIN lm_materials m ON m.id = a.material_id WHERE a.id = ?',
    [aid]
  );
  if (!a) return res.status(404).json({ error: 'Not found' });
  const space = await q('SELECT id, teacher_id FROM lm_spaces WHERE id = ?', [a.space_id]);
  const t = await teacherForUser(req.user);
  if (!t || !space || Number(space.teacher_id) !== Number(t.id)) return res.status(403).json({ error: 'Forbidden' });
  if (a.stored_key) {
    deleteFile(a.stored_key).catch((err) => logger.error({ err: err?.message }, '[LMS] delete attachment failed'));
  }
  await qr('DELETE FROM lm_attachments WHERE id = ?', [aid]);
  await audit(req, 'DELETE_LM_ATTACHMENT', 'lm_attachments', aid, { key: a.stored_key });
  res.json({ ok: true });
}));

router.get('/attachments/:attachmentId/download', asyncH(async (req, res) => {
  const aid = Number(req.params.attachmentId);
  const a = await q(
    `SELECT a.id, a.stored_key, a.original_name, a.material_id,
            m.space_id, m.published, m.target_student_ids
     FROM lm_attachments a JOIN lm_materials m ON m.id = a.material_id WHERE a.id = ?`,
    [aid]
  );
  if (!a) return res.status(404).json({ error: 'Not found' });
  const space = await q(
    'SELECT id, teacher_id, section_id, subject_id, school_year FROM lm_spaces WHERE id = ?',
    [a.space_id]
  );
  if (!space) return res.status(404).json({ error: 'Not found' });

  if (req.role === 'teacher') {
    const t = await teacherForUser(req.user);
    if (!t || Number(space.teacher_id) !== Number(t.id)) return res.status(403).json({ error: 'Forbidden' });
  } else if (req.role === 'student') {
    const st = await q('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!st) return res.status(403).json({ error: 'Forbidden' });
    if (!a.published) return res.status(403).json({ error: 'Not published' });
    if (!targetIncludes(a.target_student_ids, st.id)) return res.status(403).json({ error: 'Not targeted' });
    const enr = await q(
      `SELECT 1 FROM enrollments e
       JOIN enrollment_subjects es ON es.enrollment_id = e.id
       WHERE e.student_id = ? AND e.section_id = ? AND e.school_year = ? AND es.subject_id = ?
         AND e.status = 'enrolled' LIMIT 1`,
      [st.id, space.section_id, space.school_year, space.subject_id]
    );
    if (!enr) return res.status(403).json({ error: 'Not enrolled' });
  } else {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const key = a.stored_key || fileKeyFromUrl(a.stored_key);
  if (!key) return res.status(404).json({ error: 'Key not found' });
  const url = await getPrivateDownloadUrl(key);
  if (!url) return res.status(404).json({ error: 'File not found' });
  await qr('INSERT INTO lm_downloads (material_id, attachment_id, user_id, ip, user_agent) VALUES (?, ?, ?, ?, ?)',
    [a.material_id || null, aid, req.user.id, req.ip || null, String(req.headers['user-agent'] || '').slice(0, 300)]).catch(() => {});
  await audit(req, 'DOWNLOAD_LM_ATTACHMENT', 'lm_attachments', aid, { key });
  res.redirect(url);
}));

module.exports = router;
module.exports.targetIncludes = targetIncludes;
module.exports.normalizeTarget = normalizeTarget;
