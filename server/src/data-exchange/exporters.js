const { q, qa } = require('../db');
const { toCsv } = require('./csv');
const { getDefaultScale, getScale, convertGrade, gpaFrom } = require('../grading/scales');

const SCHOOL_NAME = 'Hinabangan National High School';

const COLUMN_LABELS = {
  students: ['Global ID', 'LRN', 'First Name', 'Middle Name', 'Last Name', 'Sex', 'Birth Date',
    'Grade Level', 'Strand/Track', 'Section', 'Status'],
  teachers: ['Employee No', 'First Name', 'Middle Name', 'Last Name', 'Sex', 'Position', 'Email',
    'Contact', 'Status', 'Login Username'],
  sections: ['Name', 'Grade Level', 'Strand', 'Adviser', 'Room', 'Capacity', 'School Year', 'Status'],
  gradebook: ['LRN', 'Last Name', 'First Name', 'Written Work', 'Performance Task', 'Quarterly Exam',
    'Computed Grade', 'Remarks'],
  attendance: ['LRN', 'Last Name', 'First Name', 'Present', 'Absent', 'Late', 'Days', 'Attendance Rate %'],
  transcript: ['Subject Code', 'Subject', 'Q1', 'Q2', 'Q3', 'Average', 'Remarks'],
  transcript_international: ['Subject Code', 'Subject', 'Credits', 'Credits Earned', 'Q1', 'Q2', 'Q3', 'Final Grade', 'Letter Grade', 'Grade Points', 'Remarks'],
};

async function buildRows(entity, params) {
  const year = String(params.school_year || '').match(/(\d{4})/g);
  const syStart = year ? `${year[0]}-06-01` : null;
  const syEnd = year ? `${Number(year[0]) + 1}-03-31` : null;

  switch (entity) {
    case 'students': {
      const rows = await qa(
        `SELECT s.global_learner_id, s.lrn, s.first_name, s.middle_name, s.last_name, s.sex,
                s.birth_date, s.grade_level, s.track_strand, s.status,
                (SELECT sec.name FROM enrollments e JOIN sections sec ON sec.id = e.section_id
                  WHERE e.student_id = s.id AND e.status = 'enrolled' ORDER BY e.id DESC LIMIT 1) AS section
         FROM students s ORDER BY s.grade_level, s.last_name, s.first_name`);
      return {
        columns: COLUMN_LABELS.students,
        rows: rows.map((r) => ({
          'Global ID': r.global_learner_id || '', 'LRN': r.lrn, 'First Name': r.first_name,
          'Middle Name': r.middle_name || '', 'Last Name': r.last_name, 'Sex': r.sex || '',
          'Birth Date': r.birth_date || '', 'Grade Level': r.grade_level || '',
          'Strand/Track': r.track_strand || '', 'Section': r.section || '', 'Status': r.status || '',
        })),
      };
    }
    case 'teachers': {
      const rows = await qa(
        `SELECT t.employee_no, t.first_name, t.middle_name, t.last_name, t.sex, t.position,
                t.email, t.contact, t.status, u.username
         FROM teachers t LEFT JOIN users u ON u.id = t.user_id
         ORDER BY t.last_name, t.first_name`);
      return {
        columns: COLUMN_LABELS.teachers,
        rows: rows.map((r) => ({
          'Employee No': r.employee_no || '', 'First Name': r.first_name,
          'Middle Name': r.middle_name || '', 'Last Name': r.last_name, 'Sex': r.sex || '',
          'Position': r.position || '', 'Email': r.email || '', 'Contact': r.contact || '',
          'Status': r.status || '', 'Login Username': r.username || '',
        })),
      };
    }
    case 'sections': {
      const rows = await qa(
        `SELECT s.name, s.grade_level, s.strand, s.room, s.capacity, s.school_year, s.status,
                t.last_name || ', ' || t.first_name AS adviser
         FROM sections s LEFT JOIN teachers t ON t.id = s.adviser_teacher_id
         ORDER BY s.grade_level, s.name`);
      return {
        columns: COLUMN_LABELS.sections,
        rows: rows.map((r) => ({
          'Name': r.name, 'Grade Level': r.grade_level || '', 'Strand': r.strand || '',
          'Adviser': r.adviser || '', 'Room': r.room || '', 'Capacity': r.capacity || '',
          'School Year': r.school_year || '', 'Status': r.status || '',
        })),
      };
    }
    case 'gradebook': {
      const { section_id, subject_id, school_year, term } = params;
      if (!section_id || !subject_id || !school_year || !term) {
        throw new Error('gradebook requires section_id, subject_id, school_year and term');
      }
      const rows = await qa(
        `SELECT st.lrn, st.last_name, st.first_name, g.written_work, g.performance_task,
                g.quarterly_exam, g.computed_grade, g.remarks
         FROM grades g JOIN students st ON st.id = g.student_id
         WHERE g.section_id = ? AND g.subject_id = ? AND g.school_year = ? AND g.quarter = ?
         ORDER BY st.last_name, st.first_name`,
        [section_id, subject_id, school_year, term]);
      return {
        columns: COLUMN_LABELS.gradebook,
        rows: rows.map((r) => ({
          'LRN': r.lrn, 'Last Name': r.last_name, 'First Name': r.first_name,
          'Written Work': r.written_work, 'Performance Task': r.performance_task,
          'Quarterly Exam': r.quarterly_exam, 'Computed Grade': r.computed_grade, 'Remarks': r.remarks || '',
        })),
      };
    }
    case 'attendance': {
      const { section_id, school_year } = params;
      if (!section_id || !school_year) throw new Error('attendance requires section_id and school_year');
      const rows = await qa(
        `SELECT st.lrn, st.last_name, st.first_name,
                SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent,
                SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late,
                COUNT(*) AS days
         FROM attendance a JOIN students st ON st.id = a.student_id
         WHERE a.section_id = ? AND a.date >= ? AND a.date <= ?
         GROUP BY st.id ORDER BY st.last_name, st.first_name`,
        [section_id, syStart, syEnd]);
      return {
        columns: COLUMN_LABELS.attendance,
        rows: rows.map((r) => {
          const rate = r.days ? Math.round((r.present / r.days) * 1000) / 10 : 0;
          return {
            'LRN': r.lrn, 'Last Name': r.last_name, 'First Name': r.first_name,
            'Present': r.present, 'Absent': r.absent, 'Late': r.late, 'Days': r.days, 'Attendance Rate %': rate,
          };
        }),
      };
    }
    case 'transcript': {
      const { student_id, school_year, mode, scale_id } = params;
      if (!student_id || !school_year) throw new Error('transcript requires student_id and school_year');
      const student = await q(
        `SELECT s.id, s.lrn, s.global_learner_id, s.first_name, s.middle_name, s.last_name,
                s.grade_level, s.track_strand
         FROM students s WHERE s.id = ?`, [student_id]);
      if (!student) throw new Error('Student not found');
      const rows = await qa(
        `SELECT su.id AS subject_id, su.code, su.title, su.units,
                MAX(CASE WHEN g.quarter = 1 THEN g.computed_grade END) AS q1,
                MAX(CASE WHEN g.quarter = 2 THEN g.computed_grade END) AS q2,
                MAX(CASE WHEN g.quarter = 3 THEN g.computed_grade END) AS q3,
                ROUND(AVG(g.computed_grade), 2) AS avg
         FROM grades g JOIN subjects su ON su.id = g.subject_id
         WHERE g.student_id = ? AND g.school_year = ?
         GROUP BY su.id ORDER BY su.code`,
        [student_id, school_year]);
      const studentName = `${student.last_name}, ${student.first_name} ${student.middle_name || ''}`.trim();
      if (String(mode || '').toLowerCase() !== 'international') {
        const avg = rows.length ? rows.reduce((a, r) => a + Number(r.avg), 0) / rows.length : 0;
        const gwa = Math.round(avg * 100) / 100;
        return {
          title: 'Transcript of Records',
          meta: {
            school: SCHOOL_NAME,
            student: studentName,
            lrn: student.lrn, globalId: student.global_learner_id || '',
            gradeLevel: student.grade_level || '', strand: student.track_strand || '',
            schoolYear: school_year, gwa,
          },
          columns: COLUMN_LABELS.transcript,
          rows: rows.map((r) => ({
            'Subject Code': r.code, 'Subject': r.title, 'Q1': r.q1, 'Q2': r.q2, 'Q3': r.q3,
            'Average': r.avg,
            'Remarks': r.avg != null ? (Number(r.avg) >= 75 ? 'PASSED' : 'FAILED') : '',
          })),
        };
      }
      const scale = scale_id ? await getScale(scale_id) : await getDefaultScale();
      if (!scale) throw new Error('Grading scale not found');
      const passing = Number(scale.passing_grade);
      const intlRows = rows.map((r) => {
        const finalG = r.avg != null ? Number(r.avg) : null;
        const conv = finalG != null ? convertGrade(finalG, scale) : null;
        const units = Number(r.units || 0);
        return {
          'Subject Code': r.code,
          'Subject': r.title,
          'Credits': units,
          'Credits Earned': conv && conv.passed ? units : 0,
          'Q1': r.q1, 'Q2': r.q2, 'Q3': r.q3,
          'Final Grade': finalG,
          'Letter Grade': conv ? (conv.letter || '') : '',
          'Grade Points': conv && conv.points != null ? conv.points : '',
          'Remarks': finalG != null ? (finalG >= passing ? 'PASSED' : 'FAILED') : '',
          points: conv && conv.points != null ? conv.points : null,
        };
      });
      const gpa = gpaFrom(intlRows);
      const creditsEarned = intlRows.reduce((a, r) => a + Number(r['Credits Earned']), 0);
      const graded = intlRows.filter((r) => r['Final Grade'] != null);
      const gwa = graded.length
        ? Math.round(graded.reduce((a, r) => a + Number(r['Final Grade']), 0) / graded.length * 100) / 100
        : 0;
      return {
        title: 'International Transcript of Records',
        meta: {
          school: SCHOOL_NAME,
          student: studentName,
          lrn: student.lrn, globalId: student.global_learner_id || '',
          gradeLevel: student.grade_level || '', strand: student.track_strand || '',
          schoolYear: school_year, gwa, gpa, scale: scale.name, creditsEarned,
        },
        columns: COLUMN_LABELS.transcript_international,
        rows: intlRows,
      };
    }
    default:
      throw new Error(`Unknown export entity: ${entity}`);
  }
}

async function renderXlsx(title, columns, rows) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(String(title || 'Export').slice(0, 31));
  ws.columns = columns.map((c) => ({ header: c, key: c, width: Math.max(12, Math.min(28, c.length + 10)) }));
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: 'middle' };
  for (const r of rows) ws.addRow(r);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(rows.length + 1, 2), column: columns.length } };
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function renderPdf(title, columns, rows, meta) {
  const PDFDocument = require('pdfkit');
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(16).text(String(title || 'Export'), { align: 'center' });
    doc.moveDown(0.4);
    if (meta && meta.school) {
      doc.font('Helvetica').fontSize(10).fillColor('#444444');
      doc.text(meta.school, { align: 'center' });
      doc.moveDown(0.8);
      doc.fillColor('black');
      if (meta.student) {
        doc.font('Helvetica').fontSize(11);
        doc.text(`Student: ${meta.student}`);
        doc.text(`LRN: ${meta.lrn || '—'}   Global ID: ${meta.globalId || '—'}`);
        doc.text(`Grade Level: ${meta.gradeLevel || '—'}   Strand: ${meta.strand || '—'}   School Year: ${meta.schoolYear || '—'}`);
        doc.moveDown(0.6);
      }
    }

    // Column widths proportional to content length, capped, scaled to page.
    const pageW = doc.page.width - 80;
    const raw = columns.map((c) => Math.min(38, Math.max(8, c.length + 4)));
    const scale = pageW / raw.reduce((a, b) => a + b, 0);
    const widths = raw.map((w) => Math.max(24, Math.round(w * scale)));

    const fontSize = rows.length > 40 ? 7 : 9;
    let y = doc.y;
    const rowH = fontSize + 5;
    const colX = [];
    let x = 40;
    for (const w of widths) { colX.push(x); x += w; }

    const drawHeader = () => {
      doc.font('Helvetica-Bold').fontSize(fontSize);
      columns.forEach((c, i) => {
        doc.text(String(c), colX[i], y, { width: widths[i] - 4 });
      });
      y += rowH;
      doc.moveTo(40, y).lineTo(40 + pageW, y).stroke();
    };

    const pageBreak = () => {
      doc.addPage();
      y = doc.y;
      drawHeader();
    };

    drawHeader();
    doc.font('Helvetica').fontSize(fontSize);
    for (const r of rows) {
      if (y > doc.page.height - 60) pageBreak();
      columns.forEach((c, i) => {
        let v = r[c];
        if (v == null) v = '';
        if (typeof v === 'number') v = Math.round(v * 100) / 100;
        doc.text(String(v), colX[i], y, { width: widths[i] - 4 });
      });
      y += rowH;
    }

    if (meta && (meta.gwa !== undefined || meta.gpa !== undefined)) {
      y += 14;
      doc.font('Helvetica-Bold').fontSize(11);
      const parts = [];
      if (meta.gpa !== undefined && meta.gpa !== null) parts.push(`GPA: ${meta.gpa}`);
      if (meta.gwa !== undefined) parts.push(`GWA: ${meta.gwa}`);
      if (meta.scale) parts.push(`Scale: ${meta.scale}`);
      if (meta.creditsEarned !== undefined) parts.push(`Credits Earned: ${meta.creditsEarned}`);
      doc.text(parts.join('   |   '), 40, y);
    }

    doc.end();
  });
}

async function exportEntity(entity, format, params) {
  const data = await buildRows(entity, params);
  const formatFmt = String(format || 'csv').toLowerCase();
  if (formatFmt === 'csv') {
    const csv = await toCsv(data.columns, data.rows);
    return { buffer: Buffer.from(csv, 'utf8'), contentType: 'text/csv; charset=utf-8', data };
  }
  if (formatFmt === 'xlsx') {
    const buffer = await renderXlsx(data.title || entity, data.columns, data.rows);
    return { buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data };
  }
  if (formatFmt === 'pdf') {
    const buffer = await renderPdf(data.title || entity, data.columns, data.rows, data.meta);
    return { buffer, contentType: 'application/pdf', data };
  }
  throw new Error(`Unsupported format: ${format} (use csv, xlsx or pdf)`);
}

module.exports = { exportEntity, buildRows, SCHOOL_NAME };
