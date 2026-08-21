const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');
const { uploadFile, deleteFile, getPublicUrl } = require('../storage');
const { UPLOAD_MAX_MB } = require('../config');
const { q, qi, qr } = require('../db');

const router = express.Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip)$/i;
    if (allowed.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error(`File type not allowed. Max ${UPLOAD_MAX_MB}MB.`));
  },
});

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const FILE_TYPES = [
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'application/zip',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
];

// ── Student photo upload ────────────────────────────────────────
// POST /uploads/student-photo/:studentId
router.post('/student-photo/:studentId', requireRole('super_admin', 'school_admin', 'registrar', 'teacher'), upload.single('photo'), asyncH(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!PHOTO_TYPES.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Only JPG, PNG, or WebP images are allowed' });
  }
  const studentId = Number(req.params.studentId);
  const student = await q('SELECT id, photo_url FROM students WHERE id = ?', [studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  // Delete old photo if exists
  if (student.photo_url && student.photo_url.includes('/')) {
    const oldKey = student.photo_url.split('/').slice(-2).join('/');
    deleteFile(oldKey).catch(() => {});
  }

  const { key, url } = await uploadFile('students', req.file, req.file.originalname);
  const photoUrl = url || `/api/v1/uploads/file/${key}`;
  await qr('UPDATE students SET photo_url = ? WHERE id = ?', [photoUrl, studentId]);
  await audit(req, 'UPLOAD_STUDENT_PHOTO', 'students', studentId, { key });
  res.json({ ok: true, url: photoUrl, key });
}));

// ── General file upload ─────────────────────────────────────────
// POST /uploads/file?folder=submissions
router.post('/file', upload.single('file'), asyncH(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!FILE_TYPES.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'File type not allowed' });
  }
  const folder = (req.query.folder || 'general').replace(/[^a-z0-9_-]/gi, '');
  const { key, url } = await uploadFile(folder, req.file, req.file.originalname);
  await audit(req, 'UPLOAD_FILE', 'uploads', null, { key, folder, size: req.file.size });
  res.json({ ok: true, key, url: url || `/api/v1/uploads/file/${key}`, size: req.file.size, name: req.file.originalname });
}));

// ── Serve uploaded file (fallback for non-public buckets) ───────
// GET /uploads/file/:key(*)
router.get('/file/*', asyncH(async (req, res) => {
  const key = req.params[0];
  if (!key) return res.status(400).json({ error: 'Key required' });
  const url = getPublicUrl(key);
  if (url) return res.redirect(url);
  res.status(404).json({ error: 'File not found or public URL not configured' });
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
