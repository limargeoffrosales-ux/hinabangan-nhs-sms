const express = require('express');
const multer = require('multer');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');
const oneroster = require('../data-exchange/oneroster');
const { exportEntity } = require('../data-exchange/exporters');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticate);
router.use(requireRole('super_admin', 'school_admin'));

const ENTITIES = [
  { name: 'students', label: 'Students' },
  { name: 'teachers', label: 'Teachers' },
  { name: 'sections', label: 'Sections' },
  { name: 'gradebook', label: 'Gradebook (requires section_id, subject_id, school_year, term)' },
  { name: 'attendance', label: 'Attendance summary (requires section_id, school_year)' },
  { name: 'transcript', label: 'Transcript of records (requires student_id, school_year; add mode=international&scale_id= for the international format)' },
];

// List of OneRoster files + supported export entities.
router.get('/oneroster', asyncH(async (req, res) => {
  const files = await oneroster.listFiles();
  res.json({ oneroster: files, exportEntities: ENTITIES });
}));

// Download a single OneRoster v1.2 CSV file.
router.get('/oneroster/:file', asyncH(async (req, res) => {
  const name = String(req.params.file).replace(/\.csv$/i, '');
  if (!oneroster.FILES.some((f) => f.name === name)) {
    return res.status(404).json({ error: 'Unknown OneRoster file' });
  }
  const { csv, rows } = await oneroster.buildFileCsv(name);
  await audit(req, 'export', 'oneroster', name, { rows });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
  res.send(csv);
}));

// Import a OneRoster CSV file (preview first, then apply).
router.post('/oneroster/import', upload.single('file'), asyncH(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name: file)' });
  let fileType = String(req.body.fileType || '').trim().toLowerCase();
  if (!fileType && req.file.originalname) {
    fileType = req.file.originalname.replace(/\.csv$/i, '').toLowerCase();
  }
  const def = oneroster.FILES.find((f) => f.name === fileType);
  if (!def) return res.status(400).json({ error: `Unknown OneRoster file type: ${fileType}` });
  if (!def.importable) return res.status(400).json({ error: `Import is not supported for '${fileType}' (export only)` });

  const text = req.file.buffer.toString('utf8');
  let rows;
  try {
    rows = await oneroster.parseCsv(text);
  } catch (e) {
    return res.status(400).json({ error: `Invalid CSV: ${e.message}` });
  }
  if (!rows.length) return res.status(400).json({ error: 'CSV has no data rows' });

  const mode = req.body.mode === 'apply' ? 'apply' : 'preview';
  const plan = await oneroster.planImport(fileType, rows);
  if (plan.error) return res.status(400).json(plan);

  if (mode === 'preview') {
    return res.json({ ...plan, mode, preview: plan.plans });
  }
  const applied = await oneroster.applyImport(fileType, plan.plans);
  await audit(req, 'import', 'oneroster', fileType,
    { rows: applied.total, ok: applied.ok, errors: applied.errors });
  return res.json({ ...applied, mode });
}));

// Generic data export: students | teachers | sections | gradebook | attendance | transcript
router.get('/export/:entity', asyncH(async (req, res) => {
  const entity = String(req.params.entity).toLowerCase();
  if (!ENTITIES.some((e) => e.name === entity)) {
    return res.status(404).json({ error: 'Unknown export entity' });
  }
  const format = String(req.query.format || 'csv').toLowerCase();
  if (!['csv', 'xlsx', 'pdf'].includes(format)) {
    return res.status(400).json({ error: 'format must be csv, xlsx or pdf' });
  }
  let result;
  try {
    result = await exportEntity(entity, format, req.query);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  await audit(req, 'export', entity, null, { format, rows: result.data.rows.length });
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition',
    `attachment; filename="${entity}-${Date.now()}.${format}"`);
  res.send(result.buffer);
}));

module.exports = router;
