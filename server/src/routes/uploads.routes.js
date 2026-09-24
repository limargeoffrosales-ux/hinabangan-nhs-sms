const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticate, requireRole, ROLES } = require('../auth');
const { asyncH, audit } = require('../utils');
const { uploadFile, deleteFile, getDownloadUrl, fileKeyFromUrl } = require('../storage');
const { UPLOAD_MAX_MB } = require('../config');
const { optimizeUpload } = require('../image');
const { q, qr } = require('../db');
const { ensureTeacherSeesStudent, linkedStudentIds } = require('../scope');
const logger = require('../logger');

// Sniff the real file signature instead of trusting the client Content-Type
// (OWASP File Upload Cheat Sheet). Rejects content that does not match the
// declared type.
function hasMagic(file) {
  const b = file && file.buffer;
  if (!b || b.length === 0) return false;
  const sw = (off, arr) => b.length >= off + arr.length && arr.every((x, i) => b[off + i] === x);
  const ascii = (off, s) => b.toString('latin1', off, off + s.length) === s;
  switch (file.mimetype) {
    case 'image/png':
      return sw(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/jpeg':
      return sw(0, [0xff, 0xd8, 0xff]);
    case 'image/gif':
      return ascii(0, 'GIF87a') || ascii(0, 'GIF89a');
    case 'image/webp':
      return sw(0, [0x52, 0x49, 0x46, 0x46]) && sw(8, [0x57, 0x45, 0x42, 0x50]);
    case 'application/pdf':
      return ascii(0, '%PDF-');
    case 'application/msword':
    case 'application/vnd.ms-excel':
    case 'application/vnd.ms-powerpoint':
      return sw(0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    case 'video/mp4':
    case 'video/quicktime':
    case 'video/x-m4v':
      return ascii(4, 'ftyp');
    case 'video/webm':
    case 'video/x-matroska':
      return sw(0, [0x1a, 0x45, 0xdf, 0xa3]);
    case 'video/x-msvideo':
      return ascii(0, 'RIFF') && ascii(8, 'AVI ');
    case 'application/zip':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return sw(0, [0x50, 0x4b, 0x03, 0x04]) || sw(0, [0x50, 0x4b, 0x05, 0x06]);
    case 'text/plain':
    case 'text/csv':
      return !b.includes(0);
    default:
      return false;
  }
}

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
    deleteFile(oldKey).catch((err) => logger.error({ err: err.message, key: oldKey }, '[UPLOADS] failed to delete old student photo'));
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

const STAFF_FILE_ROLES = new Set(ROLES.filter((r) => r !== 'student' && r !== 'parent'));

async function canReadFile(user, key) {
  if (!key) return false;
  if (STAFF_FILE_ROLES.has(user.role)) return true;

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
  const url = await getDownloadUrl(key);
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
