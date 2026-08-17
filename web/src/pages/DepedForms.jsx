import { useEffect, useState } from 'react';
import { Printer, FileSpreadsheet, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, ErrorBanner } from '../components/ui';
import { printElementHtml } from '../lib/export';
import DOMPurify from 'dompurify';

const FORMS = ['SF1', 'SF2', 'SF3', 'SF4', 'SF5', 'SF6', 'SF7', 'SF8', 'SF9', 'SF10', 'FORM A'];
const FORM_NAMES = {
  SF1: 'School Register', SF2: 'Daily Attendance', SF3: 'Books Issued & Returned',
  SF4: 'Monthly Learner Movement & Attendance', SF5: 'Report on Promotion',
  SF6: 'Summarized Report on Promotion', SF7: 'School Personnel Assignment',
  SF8: 'Learner Health & Nutrition', SF9: 'Learner Progress Report Card', SF10: 'Learner Permanent Record',
  'FORM A': 'Summary of Grades per Section',
};
const SY = '2026-2027';
const SY_START = Number(SY.slice(0, 4));
const TERMS = [1, 2, 3];
const TERM_LABELS = { 1: 'First Term', 2: 'Second Term', 3: 'Third Term' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ATT_MARKS = { present: '√', late: 'L', excused: 'E', absent: 'X' };

function termLabel(t) {
  return TERM_LABELS[t] || `Term ${t}`;
}

function yearOfMonth(m) {
  return m >= 1 && m <= 5 ? SY_START + 1 : SY_START;
}

const blank = '<span style="border-bottom:1px solid #000;display:inline-block;min-width:110px">&nbsp;</span>';

function h(...lines) {
  return lines.filter(Boolean).join('\n');
}

// Official DepEd school form header (Region VIII / Schools Division of Samar)
function depedHeader(sectionLine) {
  return h(
    `<div class="center" style="font-size:11pt;line-height:1.45">` +
      `<div>Republic of the Philippines</div>` +
      `<div><b>Department of Education</b></div>` +
      `<div>REGION VIII (EASTERN VISAYAS)</div>` +
      `<div>SCHOOLS DIVISION OF SAMAR</div>` +
      `<div><b>HINABANGAN NATIONAL HIGH SCHOOL</b></div>` +
      `<div>Hinabangan, Samar</div>` +
      `<div>School ID: 301245&nbsp;&nbsp;&nbsp;School Year: ${SY}</div>` +
      (sectionLine ? `<div style="margin-top:4px"><b>${sectionLine}</b></div>` : '') +
    `</div>`,
  );
}

function proficiency(avg) {
  if (avg == null) return '';
  if (avg >= 90) return 'Advanced (A)';
  if (avg >= 85) return 'Proficient (P)';
  if (avg >= 80) return 'Approaching Proficiency (AP)';
  if (avg >= 75) return 'Developing (D)';
  return 'Beginning (B)';
}

function promotedStatus(avg) {
  if (avg == null) return '';
  return avg >= 75 ? 'Promoted' : 'Retained';
}

export default function DepedForms() {
  const [form, setForm] = useState('SF1');
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [roster, setRoster] = useState([]);
  const [cards, setCards] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/sections?school_year=' + SY), api('/teachers?limit=200')])
      .then(([s, t]) => {
        setSections(s.data);
        setTeachers(t.data);
        setSectionId(s.data[0]?.id || '');
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!sectionId) return;
    api(`/sections/${sectionId}/students`).then((r) => setRoster(r.data)).catch((e) => setError(e.message));
  }, [sectionId]);

  async function loadCards() {
    if (!sectionId) return;
    setBusy(true);
    setError('');
    try {
      let att = [];
      try {
        att = (await api(`/attendance?section_id=${sectionId}`)).data || [];
      } catch {
        att = [];
      }
      setAttendance(att);
      const data = {};
      for (const st of roster) {
        data[st.id] = {};
        data[st.id].enrolled = [];
        data[st.id].enrolledByYear = {};
        try {
          const enr = await api(`/enrollments/student/${st.id}`);
          for (const e of enr.data || []) {
            if (e.status !== 'enrolled') continue;
            data[st.id].enrolledByYear[e.school_year] = e.subjects || [];
            if (e.school_year === SY) data[st.id].enrolled = e.subjects || [];
          }
        } catch {
          // keep empty; forms fall back to graded subjects
        }
        for (const t of TERMS) {
          const r = await api(`/grades/report-card/${st.id}?school_year=${SY}&term=${t}`);
          data[st.id][t] = r;
        }
        data[st.id].years = [];
        if (form === 'SF10') {
          const years = (await api(`/grades/years/${st.id}`)).data || [];
          for (const y of years) {
            const yc = {};
            for (const t of TERMS) {
              yc[t] = await api(`/grades/report-card/${st.id}?school_year=${y.school_year}&term=${t}`);
            }
            data[st.id].years.push({ school_year: y.school_year, terms: yc });
          }
        }
      }
      setCards(data);
      setPreview(true);
    } catch (e) {
      setError('Report card data unavailable — encode grades in Class Records first.');
    } finally {
      setBusy(false);
    }
  }

  const cap = (s) => String(s || '').toUpperCase();
  const fullName = (st) => `${cap(st.last_name)}, ${cap(st.first_name)} ${cap(st.middle_name || '')}`.replace(/\s+/g, ' ').trim();
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const age = (st) => {
    if (!st.birth_date) return '';
    const b = new Date(st.birth_date);
    const diff = Math.floor((Date.now() - b.getTime()) / (365.25 * 24 * 3600 * 1000));
    return diff > 0 && diff < 100 ? diff : '';
  };
  const termsAvg = (c) => c && TERMS.some((t) => c[t]?.general_average != null)
    ? Math.round((TERMS.reduce((s, t) => s + (c[t]?.general_average || 0), 0) / TERMS.length) * 100) / 100
    : null;
  const finalGrade = (c, code) => {
    const vals = TERMS.map((t) => {
      const row = c && c[t]?.subjects.find((y) => y.code === code);
      return row && row.computed_grade != null ? Number(row.computed_grade) : null;
    }).filter((n) => n != null);
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null;
  };
  const masterSubjects = (c) => {
    const enr = (c && c.enrolled) || [];
    if (enr.length) return enr;
    const seen = new Map();
    for (const t of TERMS) for (const x of (c && c[t]?.subjects) || []) if (!seen.has(x.code)) seen.set(x.code, x);
    return [...seen.values()];
  };
  const termOrder = { first: 1, second: 2, third: 3, all: 4 };
  const sortByTerm = (a, b) => (termOrder[a.term] ?? 9) - (termOrder[b.term] ?? 9) || String(a.title).localeCompare(String(b.title));
  const inSY = (d) => {
    const y = String(d || '').slice(0, 4);
    return y === String(SY_START) || y === String(SY_START + 1);
  };
  const monthRec = (st) => {
    const m = MONTHS.indexOf(month) + 1;
    const prefix = `${yearOfMonth(m)}-${String(m).padStart(2, '0')}`;
    return attendance.filter((r) => r.student_id === st.id && String(r.date).startsWith(prefix));
  };
  const yearRec = (st) => attendance.filter((r) => r.student_id === st.id && inSY(r.date));

  function build() {
    const sec = sections.find((s) => String(s.id) === String(sectionId));
    const sectionLine = sec ? `${sec.grade_level} - ${sec.name} (Strand: ${sec.strand || 'N/A'})` : '';
    const trackLine = sec?.strand ? `Track: ${sec.strand.includes('TechPro') ? 'TVL' : 'Academic'} · Strand: ${sec.strand}` : '';

    if (form === 'SF1') {
      const rows = roster.map((st, i) =>
        `<tr><td class="c">${i + 1}</td><td>${st.lrn || ''}</td><td>${fullName(st)}</td><td class="c">${st.sex || ''}</td>` +
        `<td class="c">${st.birth_date || ''}</td><td class="c">${age(st)}</td><td>${st.religion || ''}</td>` +
        `<td>${blank}</td><td>${st.address || ''}</td><td>${st.guardian_name || ''}</td><td>${st.guardian_relation || ''}</td><td class="c">${st.status || 'Enrolled'}</td></tr>`).join('');
      return {
        title: 'SF1 – School Register',
        body: h(
          depedHeader(sectionLine),
          `<div class="center" style="margin:8px 0"><b>SCHOOL REGISTER (SF1)</b><br/>School Year ${SY}</div>`,
          `<table><thead><tr>` +
            `<th>No.</th><th>LRN</th><th>Name of Learner (Last, First, Middle)</th><th>Sex</th><th>Date of Birth</th><th>Age</th>` +
            `<th>Religion</th><th>IP Group (if any)</th><th>Address</th><th>Parent/Guardian</th><th>Relationship</th><th>Status</th>` +
          `</tr></thead><tbody>${rows}</tbody></table>`,
          `<p class="center" style="margin-top:14px">Prepared by: ${blank}&nbsp;&nbsp;&nbsp;Checked by: ${blank}&nbsp;&nbsp;&nbsp;Noted by: ${blank}</p>`),
      };
    }
    if (form === 'SF2') {
      const monthDays = new Date(yearOfMonth(MONTHS.indexOf(month) + 1), MONTHS.indexOf(month) + 1, 0).getDate();
      const dayCells = Array.from({ length: monthDays }, (_, d) => `<th class="c" style="font-size:8pt">${d + 1}</th>`).join('');
      const rows = roster.map((st, i) => {
        const attMap = {};
        for (const r of monthRec(st)) attMap[Number(String(r.date).slice(8, 10))] = r.status;
        let present = 0, absent = 0;
        for (const s2 of Object.values(attMap)) {
          if (s2 === 'present' || s2 === 'late') present++;
          else absent++;
        }
        const cells = Array.from({ length: monthDays }, (_, d) => {
          const s = attMap[d + 1];
          return `<td class="c" style="font-size:8pt">${s ? ATT_MARKS[s] || '' : ''}</td>`;
        }).join('');
        return `<tr><td class="c">${i + 1}</td><td>${st.lrn || ''}</td><td>${fullName(st)}</td>` +
          `<td class="c">${st.sex || ''}</td>${cells}` +
          `<td class="c"><b>${present || ''}</b></td><td class="c">${absent || ''}</td></tr>`;
      }).join('');
      return {
        title: 'SF2 – Daily Attendance',
        body: h(
          depedHeader(sectionLine),
          `<div class="center" style="margin:8px 0"><b>DAILY ATTENDANCE REPORT (SF2)</b><br/>For the Month of: ${month} ${yearOfMonth(MONTHS.indexOf(month) + 1)} &nbsp; School Year ${SY}</div>`,
          `<table style="font-size:8pt"><thead><tr><th rowspan="2">No.</th><th rowspan="2">LRN</th><th rowspan="2">Name of Learner</th><th rowspan="2">Sex</th><th colspan="${monthDays}" class="c">Days of the Month</th><th rowspan="2">Total Days Present</th><th rowspan="2">No. of Times Absent</th></tr><tr>${dayCells}</tr></thead><tbody>${rows}</tbody></table>`,
          `<p style="font-size:9pt;margin-top:8px"><b>Legend:</b> <b>√</b> = present &nbsp; <b>L</b> = late/tardy &nbsp; <b>E</b> = excused &nbsp; <b>X</b> = absent. Totals are computed from recorded attendance.</p>` +
          `<p class="center" style="margin-top:14px">Prepared by (Adviser): ${blank}&nbsp;&nbsp;&nbsp;Noted by (School Head): ${blank}</p>`),
      };
    }
    if (form === 'SF3') {
      const rows = roster.map((st, i) =>
        `<tr><td class="c">${i + 1}</td><td>${st.lrn || ''}</td><td>${fullName(st)}</td><td>${blank}</td><td>${blank}</td><td>${blank}</td><td>${blank}</td><td>${blank}</td><td>${blank}</td></tr>`).join('');
      return {
        title: 'SF3 – Books Issued & Returned',
        body: h(
          depedHeader(sectionLine),
          `<div class="center" style="margin:8px 0"><b>BOOKS ISSUED AND RETURNED (SF3)</b><br/>School Year ${SY}</div>`,
          `<table><thead><tr><th>No.</th><th>LRN</th><th>Name of Learner</th><th>Title of Book</th><th>Accession No.</th><th>Date Issued</th><th>Date Returned</th><th>Condition (on issue)</th><th>Condition (on return)</th></tr></thead><tbody>${rows}</tbody></table>`,
          `<p class="center" style="margin-top:14px">Prepared by (Librarian): ${blank}&nbsp;&nbsp;&nbsp;Noted by: ${blank}</p>`),
      };
    }
    if (form === 'SF4') {
      const rows = roster.map((st, i) =>
        `<tr><td class="c">${i + 1}</td><td>${st.lrn || ''}</td><td>${fullName(st)}</td><td class="c">${st.sex || ''}</td><td class="c">${st.birth_date || ''}</td><td class="c">${st.status || 'Enrolled'}</td><td></td><td></td><td></td></tr>`).join('');
      return {
        title: 'SF4 – Monthly Learner Movement & Attendance',
        body: h(
          depedHeader(sectionLine),
          `<div class="center" style="margin:8px 0"><b>MONTHLY REPORT ON LEARNER MOVEMENT AND ATTENDANCE (SF4)</b><br/>Month of: ${month} ${yearOfMonth(MONTHS.indexOf(month) + 1)} &nbsp; School Year ${SY}</div>`,
          `<table><thead><tr><th>No.</th><th>LRN</th><th>Name of Learner</th><th>Sex</th><th>Date of Birth</th><th>Status</th><th>Date Transferred In</th><th>Date Transferred Out</th><th>Remarks</th></tr></thead><tbody>${rows}</tbody></table>`,
          `<p style="margin-top:8px;font-size:10pt"><b>Summary:</b> Total Enrolled: <b>${roster.length}</b> &nbsp; Transferred In: ${blank} &nbsp; Transferred Out: ${blank} &nbsp; Dropped: ${blank}</p>` +
          `<p class="center" style="margin-top:14px">Prepared by: ${blank}&nbsp;&nbsp;&nbsp;Checked by: ${blank}</p>`),
      };
    }
    if (form === 'SF5') {
      const rows = (roster || []).map((st, i) => {
        const avg = termsAvg(cards && cards[st.id]);
        return `<tr><td class="c">${i + 1}</td><td>${st.lrn || ''}</td><td>${fullName(st)}</td><td class="c">${st.sex || ''}</td>` +
          `<td class="c">${avg ?? ''}</td><td>${proficiency(avg)}</td><td class="c">${promotedStatus(avg)}</td></tr>`;
      }).join('');
      return {
        title: 'SF5 – Report on Promotion',
        body: h(
          depedHeader(sectionLine),
          `<div class="center" style="margin:8px 0"><b>REPORT ON PROMOTION AND LEVEL OF PROFICIENCY (SF5)</b><br/>School Year ${SY}${trackLine ? `<br/>${trackLine}` : ''}</div>`,
          cards
            ? `<table><thead><tr><th>No.</th><th>LRN</th><th>Name of Learner</th><th>Sex</th><th>General Average</th><th>Level of Proficiency</th><th>Promotion Status</th></tr></thead><tbody>${rows}</tbody></table>`
            : `<p>Click "Generate from grades" first.</p>`),
      };
    }
    if (form === 'SF6') {
      let promoted = 0, retained = 0, noData = 0;
      const band = { adv: 0, prof: 0, appr: 0, dev: 0, beg: 0 };
      for (const st of roster || []) {
        const avg = termsAvg(cards && cards[st.id]);
        if (avg == null) { noData++; continue; }
        else if (avg >= 75) promoted++;
        else retained++;
        if (avg >= 90) band.adv++;
        else if (avg >= 85) band.prof++;
        else if (avg >= 80) band.appr++;
        else if (avg >= 75) band.dev++;
        else band.beg++;
      }
      return {
        title: 'SF6 – Summarized Report on Promotion',
        body: h(
          depedHeader(sectionLine),
          `<div class="center" style="margin:8px 0"><b>SUMMARIZED REPORT ON PROMOTION (SF6)</b><br/>School Year ${SY}</div>`,
          `<table><thead><tr><th>Grade Level / Section</th><th>Total Enrolled</th><th>Promoted</th><th>Retained</th><th>Level of Proficiency: Advanced</th><th>Proficient</th><th>Approaching</th><th>Developing</th><th>Beginning</th></tr></thead>` +
          `<tbody><tr><td>${sec ? sec.grade_level + ' - ' + sec.name : ''}</td><td class="c">${roster.length}</td><td class="c">${promoted || ''}</td><td class="c">${retained || ''}</td>` +
          `<td class="c">${band.adv}</td><td class="c">${band.prof}</td><td class="c">${band.appr}</td><td class="c">${band.dev}</td><td class="c">${band.beg}</td>` +
          `</tr></tbody></table>`,
          `<p class="center" style="margin-top:14px">Prepared by: ${blank}&nbsp;&nbsp;&nbsp;Certified by (School Head): ${blank}</p>`),
      };
    }
    if (form === 'SF7') {
      const rows = teachers.map((t, i) =>
        `<tr><td class="c">${i + 1}</td><td>${t.employee_no || ''}</td><td>${fullName(t)}</td><td class="c">${t.sex || ''}</td><td>${t.position || ''}</td><td>${t.room || ''}</td></tr>`).join('');
      return {
        title: 'SF7 – School Personnel Assignment',
        body: h(
          depedHeader(),
          `<div class="center" style="margin:8px 0"><b>SCHOOL PERSONNEL ASSIGNMENT (SF7)</b><br/>School Year ${SY}</div>`,
          `<table><thead><tr><th>No.</th><th>Employee No.</th><th>Name of Personnel</th><th>Sex</th><th>Position</th><th>Grade/Class Assigned</th></tr></thead><tbody>${rows}</tbody></table>`,
          `<p class="center" style="margin-top:14px">Prepared by: ${blank}&nbsp;&nbsp;&nbsp;Noted by: ${blank}</p>`),
      };
    }
    if (form === 'SF8') {
      const rows = roster.map((st, i) =>
        `<tr><td class="c">${i + 1}</td><td>${st.lrn || ''}</td><td>${fullName(st)}</td><td class="c">${st.sex || ''}</td>` +
        `<td class="c">${st.birth_date || ''}</td><td class="c">${age(st)}</td><td>${blank}</td><td>${blank}</td><td>${blank}</td><td>${blank}</td></tr>`).join('');
      return {
        title: 'SF8 – Learner Health & Nutrition',
        body: h(
          depedHeader(sectionLine),
          `<div class="center" style="margin:8px 0"><b>LEARNER HEALTH AND NUTRITION REPORT (SF8)</b><br/>School Year ${SY}</div>`,
          `<table><thead><tr><th>No.</th><th>LRN</th><th>Name of Learner</th><th>Sex</th><th>Date of Birth</th><th>Age</th>` +
          `<th>Height (cm)</th><th>Weight (kg)</th><th>BMI</th><th>Nutritional Status</th></tr></thead><tbody>${rows}</tbody></table>`,
          `<p style="font-size:9pt;margin-top:8px"><b>Nutritional status codes:</b> NW = Normal &nbsp; W = Wasted &nbsp; SW = Severely Wasted &nbsp; OW = Overweight &nbsp; OB = Obese &nbsp; UW = Underweight</p>` +
          `<p class="center" style="margin-top:14px">Prepared by (School Nurse / Adviser): ${blank}&nbsp;&nbsp;&nbsp;Noted by: ${blank}</p>`),
      };
    }
    if (form === 'SF9' || form === 'SF10') {
      const subjectHeader = (tCount) =>
        `<tr><th>Learning Area / Subject</th>${Array.from({ length: tCount }, (_, t) => `<th class="c">${TERM_LABELS[t + 1]}</th>`).join('')}<th class="c">Final Grade</th><th class="c">Remarks</th></tr>`;
      const yearTable = (yc, heading) => {
        const subs = masterSubjects(yc).sort(sortByTerm);
        const ga = termsAvg(yc);
        const sRows = subs.map((x) => {
          const perT = TERMS.map((t) => {
            const ts = yc[t]?.subjects.find((y) => y.code === x.code);
            return ts && ts.computed_grade != null ? Number(ts.computed_grade) : null;
          });
          const finals = perT.filter((n) => n != null);
          const final = finals.length ? Math.round((finals.reduce((a, b) => a + b, 0) / finals.length) * 100) / 100 : '';
          let remark = '';
          for (const t of [...TERMS].reverse()) {
            const ts = yc[t]?.subjects.find((y) => y.code === x.code);
            if (ts && ts.remarks) { remark = ts.remarks; break; }
          }
          return `<tr><td>${esc(x.title)}</td>` +
            perT.map((g) => `<td class="c">${g != null ? g : ''}</td>`).join('') +
            `<td class="c"><b>${final}</b></td><td class="c">${esc(remark)}</td></tr>`;
        }).join('');
        const head = heading ? `<h4 style="font-size:10pt;margin:6px 0">${heading}</h4>` : '';
        return `${head}${subs.length
          ? `<table style="font-size:9pt"><thead>${subjectHeader(3)}</thead><tbody>${sRows}</tbody>` +
            `<tfoot><tr><th>General Average</th><td class="c" colspan="3"><b>${ga ?? ''}</b></td><td class="c">${proficiency(ga)}</td><td></td></tr></tfoot></table>`
          : '<p style="font-size:9pt">No subjects with encoded grades.</p>'}`;
      };
      const learnerInfo = (st, i) => `<div style="font-size:10pt;margin:2px 0">
        <b>${i + 1}. ${fullName(st)}</b> &nbsp; LRN: ${st.lrn || ''} &nbsp; Sex: ${st.sex || ''} &nbsp; Birthdate: ${st.birth_date || ''} &nbsp; Age: ${age(st)} &nbsp; Religion: ${st.religion || ''}</div>`;
      const signatures = `<div style="margin-top:8px;font-size:10pt;display:flex;justify-content:space-between">
        <div>Parent/Guardian Signature: ${blank}</div>
        <div>Adviser: ${blank}</div>
        <div>School Head: ${blank}</div></div>`;
      const sectionDays = new Set(attendance
        .filter((r) => String(r.section_id) === String(sectionId) && inSY(r.date))
        .map((r) => r.date)).size;
      const rows = (roster || []).map((st, i) => {
        const c = cards && cards[st.id];
        if (form === 'SF9') {
          const stAtt = yearRec(st);
          const present = stAtt.filter((r) => r.status === 'present').length;
          const tardy = stAtt.filter((r) => r.status === 'late').length;
          const absent = stAtt.filter((r) => r.status === 'absent' || r.status === 'excused').length;
          const general = termsAvg(c);
          const attendanceHtml = `<div style="margin:4px 0;font-size:10pt"><b>Attendance:</b> School Days: <b>${sectionDays}</b> &nbsp; Days Present: ${present} &nbsp; Days Tardy: ${tardy} &nbsp; Days Absent: ${absent}</div>`;
          const promo = general == null ? '' : `<div style="margin:4px 0;font-size:10pt"><b>Promotion Status:</b> ${promotedStatus(general)} &nbsp;|&nbsp; <b>Level of Proficiency:</b> ${proficiency(general)}</div>`;
          return `<div style="border:1px solid #000;padding:10px;margin:8px 0;page-break-inside:avoid">
            ${learnerInfo(st, i)}${yearTable(c, '')}${attendanceHtml}${promo}${signatures}</div>`;
        }
        const years = (c && c.years) || [];
        const schoolRows = years.length
          ? years.map((y) => `<tr><td>Senior High School</td><td>${esc(blank)}</td><td>${esc(blank)}</td><td>${esc(blank)}</td><td class="c">${y.school_year}</td></tr>`).join('')
          : `<tr><td colspan="5">No recorded school years — encode grades first.</td></tr>`;
        const yearHtml = years.map((y) => yearTable(
          { enrolled: (c.enrolledByYear || {})[y.school_year] || [], 1: (y.terms || {})[1], 2: (y.terms || {})[2], 3: (y.terms || {})[3] },
          `School Year ${y.school_year} — Senior High School`)).join('');
        return `<div style="border:1px solid #000;padding:10px;margin:8px 0;page-break-inside:avoid">
          ${learnerInfo(st, i)}
          <h4 style="font-size:10pt;margin:6px 0">Schools Attended</h4>
          <table style="font-size:9pt"><thead><tr><th>Level</th><th>School Name</th><th>School Address</th><th>School ID</th><th>Inclusive Years</th></tr></thead><tbody>${schoolRows}</tbody></table>
          ${yearHtml}${signatures}</div>`;
      }).join('');
      return {
        title: form === 'SF9' ? 'SF9 – Learner Progress Report Card' : 'SF10 – Learner Permanent Record',
        body: h(
          depedHeader(sectionLine),
          `<div class="center" style="margin:8px 0"><b>${form === 'SF9' ? 'LEARNER PROGRESS REPORT CARD (SF9)' : 'LEARNER PERMANENT RECORD (SF10)'}</b><br/>School Year ${SY} · Three-Term System${trackLine ? `<br/>${trackLine}` : ''}</div>`,
          cards ? rows : `<p>Click "Generate from grades" first.</p>`),
      };
    }
    if (form === 'FORM A') {
      const colList = [];
      const colSeen = new Set();
      for (const st of roster) {
        for (const x of masterSubjects(cards && cards[st.id])) {
          if (!colSeen.has(x.code)) { colSeen.add(x.code); colList.push({ code: x.code, title: x.title, term: x.term }); }
        }
      }
      colList.sort(sortByTerm);
      const head = `<tr><th>No.</th><th>LRN</th><th>Name of Learner</th><th>Sex</th>` +
        colList.map((x) => `<th class="c" style="font-size:8pt">${esc(x.title)}</th>`).join('') +
        `<th class="c">General Average</th><th>Level of Proficiency</th><th>Remarks</th></tr>`;
      const rows = (roster || []).map((st, i) => {
        const c = cards && cards[st.id];
        const avg = termsAvg(c);
        return `<tr><td class="c">${i + 1}</td><td>${st.lrn || ''}</td><td>${fullName(st)}</td><td class="c">${st.sex || ''}</td>` +
          colList.map((x) => {
            const f = finalGrade(c, x.code);
            return `<td class="c">${f != null ? f : ''}</td>`;
          }).join('') +
          `<td class="c"><b>${avg ?? ''}</b></td><td>${proficiency(avg)}</td><td>${promotedStatus(avg)}</td></tr>`;
      }).join('');
      const sectionAvg = (nums) => {
        const vals = nums.filter((n) => n != null);
        return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : '';
      };
      const subjAvgs = colList.map((x) => sectionAvg((roster || []).map((st) => finalGrade(cards && cards[st.id], x.code))));
      const gaAvg = sectionAvg((roster || []).map((st) => termsAvg(cards && cards[st.id])));
      const summaryRow = `<tr><td class="c" colspan="4" style="text-align:right"><b>SECTION AVERAGE</b></td>` +
        subjAvgs.map((v) => `<td class="c"><b>${v != null ? v : ''}</b></td>`).join('') +
        `<td class="c"><b>${gaAvg != null ? gaAvg : ''}</b></td><td>${proficiency(gaAvg)}</td><td></td></tr>`;
      return {
        title: 'FORM A – Summary of Grades per Section',
        body: h(
          depedHeader(sectionLine),
          `<div class="center" style="margin:8px 0"><b>FORM A — MASTER LIST OF LEARNERS WITH THEIR GRADES</b><br/>${sec ? sec.grade_level + ' - ' + sec.name : ''} &nbsp; School Year ${SY} &nbsp; Three-Term System</div>`,
          cards
            ? `<table style="font-size:9pt"><thead>${head}</thead><tbody>${rows}${summaryRow}</tbody></table>`
            : `<p>Click "Generate from grades" first.</p>`,
          `<p class="center" style="margin-top:14px">Prepared by (Adviser): ${blank}&nbsp;&nbsp;&nbsp;Checked by (Registrar): ${blank}&nbsp;&nbsp;&nbsp;Noted by (School Head): ${blank}</p>`),
      };
    }
    return { title: form, body: '' };
  }

  const built = build();
  const doc = { ...built, body: built.body ? DOMPurify.sanitize(built.body) : built.body };

  return (
    <div>
      <PageHead title="DepEd School Forms" sub="SF1–SF10 + Form A following the official DepEd format (3-term calendar), live-populated, with print/PDF export.">
        <button className="btn btn-primary" onClick={() => printElementHtml(doc.title, doc.body)}>
          <Printer size={15} /> Print / Save as PDF
        </button>
      </PageHead>
      <ErrorBanner error={error} />

      <div className="card">
        <div className="form-row">
          <label>Form
            <select value={form} onChange={(e) => { setForm(e.target.value); setCards(null); setPreview(false); }}>
              {FORMS.map((f) => <option key={f} value={f}>{f} — {FORM_NAMES[f]}</option>)}
            </select>
          </label>
          <label>Section
            <select value={sectionId} onChange={(e) => { setSectionId(e.target.value); setCards(null); setPreview(false); }}>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.grade_level}){s.strand ? ` — ${s.strand}` : ''}</option>)}
            </select>
          </label>
          {['SF2', 'SF4'].includes(form) && (
            <label>Month
              <select value={month} onChange={(e) => setMonth(e.target.value)}>
                {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
          )}
          {['SF5', 'SF6', 'SF9', 'SF10', 'FORM A'].includes(form) && (
            <label className="form-inline">
              <button className="btn" onClick={() => loadCards()} disabled={busy || !sectionId}>
                {busy ? <Loader2 size={14} className="spin" /> : <FileSpreadsheet size={14} />} {cards ? 'Refresh from grades' : 'Generate from grades'}
              </button>
            </label>
          )}
        </div>
        {!preview && ['SF5', 'SF6', 'SF9', 'SF10', 'FORM A'].includes(form) && (
          <div className="notice warn">This form is populated from encoded class records — all three terms (3-term calendar). Click <b>Generate from grades</b> to pull live data; SF9/SF10 use each learner's enrolled subjects.</div>
        )}
        <div className="sub" style={{ margin: '8px 0' }}>SF2, SF3, SF4 and SF8 include blank grids for day-to-day encoding — print and fill as needed. Use Print / Save as PDF for your SF submission copies.</div>
      </div>

      <div className="card form-preview linux">
        <div className="preview-label">Live preview — {doc.title}</div>
        <div className="preview-body" dangerouslySetInnerHTML={{ __html: doc.body }} />
      </div>
    </div>
  );
}
