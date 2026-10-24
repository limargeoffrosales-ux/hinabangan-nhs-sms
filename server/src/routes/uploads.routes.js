const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticate, requireRole, ROLES } = require('../auth');
const { asyncH, audit } = require('../utils');
const { uploadFile, deleteFile, getPrivateDownloadUrl, fileKeyFromUrl } = require('../storage');
const { UPLOAD_MAX_MB } = require('../config');
const { optimizeUpload } = require('../image');
const { q, qr } = require('../db');
const { ensureTeacherSeesStudent, linkedStudentIds } = require('../scope');
const { hasMagic } = require('../upload-guard');
const logger = require('../logger');

const router = express.Router();
router.use(authenticate);

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

// ── Student photo upload ────────────────────────────────────────
// POST /uploads/student-photo/:studentId
router.post('/student-photo/:studentId', requireRole('super_admin', 'school_admin', 'registrar', 'teacher'), upload.single('photo'), asyncH(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!hasMagic(req.file)) return res.status(400).json({ error: 'File content does not match its declared type.' });
  req.file = await optimizeUpload(req.file, { maxDimension: 800 });
  const studentId = Number(req.params.studentId);
  const student = await q('SELECT id, photo_url FROM students WHERE id = ?', [studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  if (req.role === 'teacher') {
    const chk = await ensureTeacherSeesStudent(req.user, studentId);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }

  // Delete old photo if exists
  const oldKey = fileKeyFromUrl(student.photo_url);
  if (oldKey) {
    deleteFile(oldKey).catch((err) => logger.error({ err: err?.message, stack: err?.stack, key: oldKey }, '[UPLOADS] failed to delete old student photo'));
  }

  const { key, url } = await uploadFile('students', req.file, req.file.originalname);
  const photoUrl = url || `/api/v1/uploads/file/${key}`;
  await qr('UPDATE students SET photo_url = ? WHERE id = ?', [photoUrl, studentId]);
  await audit(req, 'UPLOAD_STUDENT_PHOTO', 'students', studentId, { key });
  res.json({ ok: true, url: photoUrl, key });
}));

// ── General file upload ─────────────────────────────────────────
// POST /uploads/file?folder=submissions
const STAFF_UPLOAD = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'teacher'];
router.post('/file', requireRole(...STAFF_UPLOAD), upload.single('file'), asyncH(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!hasMagic(req.file)) return res.status(400).json({ error: 'File content does not match its declared type.' });
  req.file = await optimizeUpload(req.file);
  const folder = (req.query.folder || 'general').replace(/[^a-z0-9_-]/gi, '');
  const { key, url } = await uploadFile(folder, req.file, req.file.originalname);
  await audit(req, 'UPLOAD_FILE', 'uploads', null, { key, folder, size: req.file.size });
  res.json({ ok: true, key, url: url || `/api/v1/uploads/file/${key}`, size: req.file.size, name: req.file.originalname });
}));

// ── Serve uploaded file ─────────────────────────────────────────
// Redirects to the public bucket when configured, or to a short-lived
// presigned URL once the bucket is private. Route is behind authenticate, so
// file access requires a valid session AND an authorization check: staff roles
// may fetch any stored file, while portal roles (student/parent/guardian) may
// only fetch files belonging to their own/linked students (photos, enrollment
// documents) or broadcast media attached to announcements / published sports
// posts / achievements.
// GET /uploads/file/:key(*)

// Roles that handle student records and may read sensitive files (photos,
// birth certificates, enrollment documents) for any student. Every other
// authenticated staff role (cashier, accounting, hr, ict, property_custodian,
// security) previously passed the blanket `STAFF_FILE_ROLES` check and could
// fetch ANY stored file by key — a much wider grant than their duties require.
const STUDENT_DATA_FILE_ROLES = new Set([
  'super_admin', 'region_admin', 'division_admin', 'school_admin',
  'principal', 'assistant_principal', 'registrar', 'teacher', 'guidance',
]);

// Storage keys are `${folder}/${id}.${ext}`, so the folder prefix is a reliable
// signal for what a file holds.
const SENSITIVE_FILE_PREFIXES = ['enrollment_docs', 'photos', 'students', 'birth_certificate'];

function isSensitiveFileKey(key) {
  const folder = String(key || '').split('/')[0].toLowerCase();
  return SENSITIVE_FILE_PREFIXES.includes(folder);
}

const STAFF_FILE_ROLES = new Set(ROLES.filter((r) => r !== 'student' && r !== 'parent'));

async function canReadFile(user, key) {
  if (!key) return false;
  if (STAFF_FILE_ROLES.has(user.role)) {
    // Non-student-data staff keep broad access to operational uploads (receipts,
    // forms, incident photos) but not to student PII documents.
    if (STUDENT_DATA_FILE_ROLES.has(user.role) || !isSensitiveFileKey(key)) return true;
    return false;
  }

  const ids = await linkedStudentIds(user);
  if (!ids || ids.length === 0) return false;

  const marks = ids.map(() => '?').join(',');
  const urlLike = `%/${key}`;

  const selfPhoto = await q(
    'SELECT 1 FROM students WHERE id IN (' + marks + ') AND photo_url LIKE ? LIMIT 1',
    [...ids, urlLike]);
  if (selfPhoto) return true;

  const doc = await q(
    `SELECT 1 FROM enrollment_documents d JOIN enrollments e ON e.id = d.enrollment_id
     WHERE e.student_id IN (${marks}) AND (d.file_key = ? OR d.file_url LIKE ?) LIMIT 1`,
    [...ids, key, urlLike]);
  if (doc) return true;

  try {
    // Media is stored as a JSON array of {url, type, name}. CAST(media AS TEXT)
    // keeps the containment check dialect-agnostic (PG jsonb -> text, SQLite text).
    const like = `%${key}%`;
    const broadcast = await q(
      `SELECT 1 WHERE
          EXISTS (SELECT 1 FROM announcements WHERE CAST(media AS TEXT) LIKE ?)
       OR EXISTS (SELECT 1 FROM sports_posts WHERE status IN ('published', 'pinned') AND CAST(media AS TEXT) LIKE ?)
       OR EXISTS (SELECT 1 FROM achievements WHERE CAST(media AS TEXT) LIKE ?)
       LIMIT 1`,
      [like, like, like]);
    if (broadcast) return true;
  } catch (e) {
    logger.warn({ err: e.message, key }, '[UPLOADS] broadcast media scan failed');
  }

  return false;
}

router.get('/file/*', asyncH(async (req, res) => {
  const key = req.params[0];
  if (!key) return res.status(400).json({ error: 'Key required' });
  const allowed = await canReadFile(req.user, key);
  if (!allowed) return res.status(403).json({ error: 'You do not have access to this file' });
  // Always presign: getDownloadUrl would hand back a public-bucket URL when
  // R2_PUBLIC_URL is set, which anyone could open without a session and which
  // would silently defeat the canReadFile check above.
  const url = await getPrivateDownloadUrl(key);
  if (!url) return res.status(404).json({ error: 'File not found or storage not configured' });
  res.redirect(url);
}));

// ── Delete uploaded file ────────────────────────────────────────
// DELETE /uploads/file?key=
router.delete('/file', requireRole('super_admin', 'school_admin'), asyncH(async (req, res) => {
  const key = req.query.key;
  if (!key) return res.status(400).json({ error: 'key is required' });
  await deleteFile(key);
  await audit(req, 'DELETE_FILE', 'uploads', null, { key });
  res.json({ ok: true });
}));

module.exports = router;
