const express = require('express');
const multer = require('multer');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');
const oneroster = require('../data-exchange/oneroster');
const { exportEntity } = require('../data-exchange/exporters');

const { parseCsv } = require('../data-exchange/csv');
const bcrypt = require('bcryptjs');
const { q, qa, qi, qr } = require('../db');

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

// Simple CSV import for students (non-OneRoster format)
router.post('/import/students', upload.single('file'), asyncH(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name: file)' });
  const text = req.file.buffer.toString('utf8');
  let rows;
  try { rows = await parseCsv(text); } catch (e) { return res.status(400).json({ error: `Invalid CSV: ${e.message}` }); }
  if (!rows.length) return res.status(400).json({ error: 'CSV has no data rows' });

  const COL_MAP = {
    'lrn': 'lrn', 'LRN': 'lrn', 'global_id': 'global_learner_id', 'Global ID': 'global_learner_id',
    'first_name': 'first_name', 'First Name': 'first_name', 'givenName': 'first_name',
    'middle_name': 'middle_name', 'Middle Name': 'middle_name', 'middleName': 'middle_name',
    'last_name': 'last_name', 'Last Name': 'last_name', 'familyName': 'last_name',
    'sex': 'sex', 'Sex': 'sex', 'gender': 'sex', 'Gender': 'sex',
    'birth_date': 'birth_date', 'Birth Date': 'birth_date', 'birthDate': 'birth_date',
    'grade_level': 'grade_level', 'Grade Level': 'grade_level', 'grade': 'grade_level',
    'track_strand': 'track_strand', 'Strand/Track': 'track_strand', 'strand': 'track_strand',
    'status': 'status', 'Status': 'status',
    'address': 'address', 'Address': 'address',
    'contact': 'contact', 'Contact': 'contact',
    'religion': 'religion', 'Religion': 'religion',
    'guardian_name': 'guardian_name', 'Guardian Name': 'guardian_name',
    'guardian_contact': 'guardian_contact', 'Guardian Contact': 'guardian_contact',
    'guardian_relation': 'guardian_relation', 'Guardian Relation': 'guardian_relation',
    'suffix': 'suffix', 'Suffix': 'suffix',
  };

  const preview = [];
  const errors = [];
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i];
    const mapped = {};
    for (const [csvCol, dbCol] of Object.entries(COL_MAP)) {
      if (r[csvCol] !== undefined && r[csvCol] !== '') mapped[dbCol] = r[csvCol];
    }
    const rowErrors = [];
    if (!mapped.first_name) rowErrors.push('first_name is required');
    if (!mapped.last_name) rowErrors.push('last_name is required');
    if (rowErrors.length) errors.push({ row: i + 1, errors: rowErrors });
    preview.push({ row: i + 1, data: mapped, errors: rowErrors });
  }

  if (req.body.mode !== 'apply') {
    return res.json({ mode: 'preview', total: rows.length, preview, errors, previewed: preview.length });
  }

  let created = 0, updated = 0, importErrors = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const mapped = {};
    for (const [csvCol, dbCol] of Object.entries(COL_MAP)) {
      if (r[csvCol] !== undefined && r[csvCol] !== '') mapped[dbCol] = String(r[csvCol]).trim();
    }
    if (!mapped.first_name || !mapped.last_name) {
      importErrors.push({ row: i + 1, error: 'missing first_name or last_name' });
      continue;
    }
    try {
      if (mapped.lrn) {
        const existing = await q('SELECT id FROM students WHERE lrn = ?', [mapped.lrn]);
        if (existing) {
          await qr(`UPDATE students SET first_name=?, middle_name=?, last_name=?, suffix=?, sex=?, birth_date=?, grade_level=?, track_strand=?, status=?, address=?, contact=?, religion=?, guardian_name=?, guardian_contact=?, guardian_relation=?, global_learner_id=COALESCE(?, global_learner_id) WHERE lrn=?`,
            [mapped.first_name, mapped.middle_name||null, mapped.last_name, mapped.suffix||null, mapped.sex||null, mapped.birth_date||null, mapped.grade_level||null, mapped.track_strand||null, mapped.status||'active', mapped.address||null, mapped.contact||null, mapped.religion||null, mapped.guardian_name||null, mapped.guardian_contact||null, mapped.guardian_relation||null, mapped.global_learner_id||null, mapped.lrn]);
          updated++;
        } else {
          await qi(`INSERT INTO students (lrn, global_learner_id, first_name, middle_name, last_name, suffix, sex, birth_date, grade_level, track_strand, status, address, contact, religion, guardian_name, guardian_contact, guardian_relation) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [mapped.lrn, mapped.global_learner_id||null, mapped.first_name, mapped.middle_name||null, mapped.last_name, mapped.suffix||null, mapped.sex||null, mapped.birth_date||null, mapped.grade_level||null, mapped.track_strand||null, mapped.status||'active', mapped.address||null, mapped.contact||null, mapped.religion||null, mapped.guardian_name||null, mapped.guardian_contact||null, mapped.guardian_relation||null]);
          created++;
        }
      } else {
        await qi(`INSERT INTO students (lrn, global_learner_id, first_name, middle_name, last_name, suffix, sex, birth_date, grade_level, track_strand, status, address, contact, religion, guardian_name, guardian_contact, guardian_relation) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [null, mapped.global_learner_id||null, mapped.first_name, mapped.middle_name||null, mapped.last_name, mapped.suffix||null, mapped.sex||null, mapped.birth_date||null, mapped.grade_level||null, mapped.track_strand||null, mapped.status||'active', mapped.address||null, mapped.contact||null, mapped.religion||null, mapped.guardian_name||null, mapped.guardian_contact||null, mapped.guardian_relation||null]);
        created++;
      }
    } catch (e) {
      importErrors.push({ row: i + 1, error: e.message });
    }
  }
  await audit(req, 'import', 'students', null, { total: rows.length, created, updated, errors: importErrors.length });
  return res.json({ mode: 'apply', total: rows.length, created, updated, errors: importErrors });
}));

// Simple CSV import for teachers (non-OneRoster format)
router.post('/import/teachers', upload.single('file'), asyncH(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name: file)' });
  const text = req.file.buffer.toString('utf8');
  let rows;
  try { rows = await parseCsv(text); } catch (e) { return res.status(400).json({ error: `Invalid CSV: ${e.message}` }); }
  if (!rows.length) return res.status(400).json({ error: 'CSV has no data rows' });

  const COL_MAP = {
    'employee_no': 'employee_no', 'Employee No': 'employee_no', 'employeeNo': 'employee_no',
    'first_name': 'first_name', 'First Name': 'first_name', 'givenName': 'first_name',
    'middle_name': 'middle_name', 'Middle Name': 'middle_name', 'middleName': 'middle_name',
    'last_name': 'last_name', 'Last Name': 'last_name', 'familyName': 'last_name',
    'sex': 'sex', 'Sex': 'sex', 'gender': 'sex',
    'position': 'position', 'Position': 'position',
    'email': 'email', 'Email': 'email',
    'contact': 'contact', 'Contact': 'contact',
    'specialization': 'specialization', 'Specialization': 'specialization',
    'qualification': 'qualification', 'Qualification': 'qualification',
  };

  const preview = [];
  const errors = [];
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i];
    const mapped = {};
    for (const [csvCol, dbCol] of Object.entries(COL_MAP)) {
      if (r[csvCol] !== undefined && r[csvCol] !== '') mapped[dbCol] = r[csvCol];
    }
    const rowErrors = [];
    if (!mapped.first_name) rowErrors.push('first_name is required');
    if (!mapped.last_name) rowErrors.push('last_name is required');
    if (rowErrors.length) errors.push({ row: i + 1, errors: rowErrors });
    preview.push({ row: i + 1, data: mapped, errors: rowErrors });
  }

  if (req.body.mode !== 'apply') {
    return res.json({ mode: 'preview', total: rows.length, preview, errors, previewed: preview.length });
  }

  let created = 0, updated = 0, importErrors = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const mapped = {};
    for (const [csvCol, dbCol] of Object.entries(COL_MAP)) {
      if (r[csvCol] !== undefined && r[csvCol] !== '') mapped[dbCol] = String(r[csvCol]).trim();
    }
    if (!mapped.first_name || !mapped.last_name) {
      importErrors.push({ row: i + 1, error: 'missing first_name or last_name' });
      continue;
    }
    try {
      const name = [mapped.first_name, mapped.middle_name, mapped.last_name].filter(Boolean).join(' ');
      if (mapped.employee_no) {
        const existing = await q('SELECT id FROM teachers WHERE employee_no = ?', [mapped.employee_no]);
        if (existing) {
          await qr('UPDATE teachers SET first_name=?, middle_name=?, last_name=?, sex=?, position=?, email=?, contact=?, specialization=?, qualification=? WHERE employee_no=?',
            [mapped.first_name, mapped.middle_name||null, mapped.last_name, mapped.sex||null, mapped.position||null, mapped.email||null, mapped.contact||null, mapped.specialization||null, mapped.qualification||null, mapped.employee_no]);
          updated++;
        } else {
          await qi('INSERT INTO teachers (employee_no, first_name, middle_name, last_name, sex, position, email, contact, specialization, qualification, status) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            [mapped.employee_no, mapped.first_name, mapped.middle_name||null, mapped.last_name, mapped.sex||null, mapped.position||null, mapped.email||null, mapped.contact||null, mapped.specialization||null, mapped.qualification||null, 'active']);
          created++;
        }
      } else {
        await qi('INSERT INTO teachers (employee_no, first_name, middle_name, last_name, sex, position, email, contact, specialization, qualification, status) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          [null, mapped.first_name, mapped.middle_name||null, mapped.last_name, mapped.sex||null, mapped.position||null, mapped.email||null, mapped.contact||null, mapped.specialization||null, mapped.qualification||null, 'active']);
        created++;
      }
    } catch (e) {
      importErrors.push({ row: i + 1, error: e.message });
    }
  }
  await audit(req, 'import', 'teachers', null, { total: rows.length, created, updated, errors: importErrors.length });
  return res.json({ mode: 'apply', total: rows.length, created, updated, errors: importErrors });
}));

module.exports = router;
