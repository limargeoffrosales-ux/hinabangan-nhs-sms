const express = require('express');
const { q, qa } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH } = require('../utils');
const { ensureTeacherSeesStudent } = require('../scope');
const { getScaleForSubject, getDefaultScale, convertGrade, gpaFrom } = require('../grading/scales');

const router = express.Router();
router.use(authenticate);
const READ = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'teacher'];

// International transcript export: generates a PDF/Excel/CSV of a student's
// subjects with converted letter grades, grade points, credits, and GPA.
router.get('/export/transcript', requireRole(...READ), asyncH(async (req, res) => {
  const studentId = Number(req.query.student_id);
  const schoolYear = String(req.query.school_year || '').trim();
  const format = String(req.query.format || 'pdf').toLowerCase();
  if (!studentId || !Number.isInteger(studentId)) return res.status(400).json({ error: 'student_id is required' });
  if (!schoolYear) return res.status(400).json({ error: 'school_year is required' });
  if (!['pdf', 'excel', 'csv'].includes(format)) return res.status(400).json({ error: 'format must be pdf, excel, or csv' });

  const student = await q('SELECT id, first_name, middle_name, last_name, suffix, sex, lrn, birth_date, grade_level FROM students WHERE id = ?', [studentId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  if (req.role === 'teacher') {
    const chk = await ensureTeacherSeesStudent(req.user, studentId);
    if (!chk.ok) return res.status(403).json({ error: chk.reason });
  }

  const grades = await qa(
    `SELECT su.code, su.title, su.units, g.computed_grade, g.quarter, g.subject_id
     FROM grades g
     JOIN subjects su ON su.id = g.subject_id
     WHERE g.student_id = ? AND g.school_year = ?
     ORDER BY su.code, g.quarter`,
    [studentId, schoolYear]);

  const defaultScale = await getDefaultScale();
  const scaleIds = [...new Set(grades.map((g) => g.subject_id || null))].filter((x) => x != null);
  const scaleCache = {};
  for (const sid of scaleIds) scaleCache[sid] = await getScaleForSubject(sid);

  const rows = grades.map((g) => {
    const scale = g.subject_id ? (scaleCache[g.subject_id] || defaultScale) : defaultScale;
    const conv = convertGrade(g.computed_grade, scale);
    return {
      code: g.code || '',
      title: g.title || '',
      term: g.quarter,
      numeric: g.computed_grade != null ? Number(g.computed_grade) : null,
      letter: conv && conv.letter != null ? conv.letter : '',
      points: conv && conv.points != null ? conv.points : null,
      credits: g.computed_grade != null && (!scale.credits_pass_only || (conv && conv.passed))
        ? (g.units != null ? Number(g.units) : 1)
        : 0,
      passed: conv ? conv.passed : null,
      scale_name: scale && scale.name ? scale.name : '',
    };
  });

  const gpa = gpaFrom(rows);
  const summary = {
    student_name: [student.first_name, student.middle_name, student.last_name, student.suffix].filter(Boolean).join(' '),
    lrn: student.lrn,
    birth_date: student.birth_date || null,
    grade_level: student.grade_level || '',
    school_year: schoolYear,
    gpa,
    credits_earned: rows.reduce((a, r) => a + (r.passed ? r.credits : 0), 0),
    total_subjects: new Set(rows.map((r) => (r.code || r.title))).size,
  };

  if (format === 'csv') return sendCsv(res, rows, summary);
  if (format === 'excel') return sendExcel(res, rows, summary);
  return sendPdf(res, rows, summary);
}));

const HEADERS = ['Code', 'Subject', 'Term', 'Numeric', 'Letter', 'Grade Points', 'Credits'];

function sendCsv(res, rows, summary) {
  let csv = `Student,${summary.student_name}\n`;
  csv += `LRN,${summary.lrn}\n`;
  csv += `Grade Level,${summary.grade_level}\n`;
  csv += `School Year,${summary.school_year}\n`;
  csv += `GPA,${summary.gpa != null ? summary.gpa : ''}\n`;
  csv += `Credits Earned,${summary.credits_earned}\n\n`;
  csv += HEADERS.join(',') + '\n';
  for (const r of rows) {
    csv += `${csvCell(r.code)},${csvCell(r.title)},${r.term},${r.numeric ?? ''},${csvCell(r.letter)},${r.points ?? ''},${r.credits}\n`;
  }
  const buf = Buffer.from('\uFEFF' + csv, 'utf8');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="transcript-${slug(summary.student_name)}-${summary.school_year}.csv"`);
  res.send(buf);
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function sendExcel(res, rows, summary) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Transcript');
  ws.addRow(['International Transcript']);
  ws.mergeCells('A1:G1');
  ws.getCell('A1').font = { bold: true, size: 16 };
  ws.addRow(['Student', summary.student_name]);
  ws.addRow(['LRN', summary.lrn]);
  ws.addRow(['Grade Level', summary.grade_level]);
  ws.addRow(['School Year', summary.school_year]);
  ws.addRow(['GPA', summary.gpa != null ? summary.gpa : '']);
  ws.addRow(['Credits Earned', summary.credits_earned]);
  ws.addRow([]);
  ws.addRow(HEADERS);
  const headRow = ws.getRow(ws.rowCount);
  headRow.font = { bold: true };
  for (const r of rows) {
    ws.addRow([r.code, r.title, r.term, r.numeric ?? '', r.letter, r.points ?? '', r.credits]);
  }
  ws.columns.forEach((c, i) => { c.width = [12, 30, 8, 9, 9, 12, 9][i] || 12; });
  const buf = await wb.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="transcript-${slug(summary.student_name)}-${summary.school_year}.xlsx"`);
  res.send(Buffer.from(buf));
}

function sendPdf(res, rows, summary) {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ margin: 45 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  doc.on('end', () => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="transcript-${slug(summary.student_name)}-${summary.school_year}.pdf"`);
    res.send(Buffer.concat(chunks));
  });

  doc.fontSize(18).text('International Transcript', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(11);
  doc.text(`Student: ${summary.student_name}`);
  doc.text(`LRN: ${summary.lrn || '—'}`);
  doc.text(`Grade Level: ${summary.grade_level || '—'}`);
  doc.text(`School Year: ${summary.school_year}`);
  doc.text(`GPA: ${summary.gpa != null ? summary.gpa : '—'}`);
  doc.text(`Credits Earned: ${summary.credits_earned}`);
  doc.moveDown();

  const top = doc.y;
  const cols = ['Code', 'Subject', 'Term', 'Numeric', 'Letter', 'Points', 'Credits'];
  const widths = [65, 250, 40, 55, 50, 55, 50];
  cols.forEach((c, i) => {
    doc.font('Helvetica-Bold').text(c, xPos(widths, i), top, { width: widths[i] });
  });
  doc.moveTo(45, doc.y + 4).lineTo(45 + sumWidths(widths), doc.y + 4).stroke();
  let y = doc.y + 10;
  for (const r of rows) {
    if (y > doc.page.height - 60) { doc.addPage(); y = 50; }
    const cells = [r.code, r.title, r.term, r.numeric != null ? String(r.numeric) : '', r.letter, r.points != null ? String(r.points) : '', String(r.credits)];
    cells.forEach((c, i) => {
      doc.font('Helvetica').text(c, xPos(widths, i), y, { width: widths[i] });
    });
    y = doc.y + 6;
  }
  doc.end();
}

function sumWidths(widths) { return widths.reduce((a, b) => a + b, 0); }
function xPos(widths, idx) { return 45 + widths.slice(0, idx).reduce((a, b) => a + b, 0); }
function slug(name) { return String(name || 'student').replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, ''); }

module.exports = router;