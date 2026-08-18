import { useEffect, useState } from 'react';
import { Download, Printer, FileSpreadsheet } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Spinner, ErrorBanner } from '../components/ui';
import { printElementHtml, downloadBlob } from '../lib/export';

const FORMS = [
  { code: 'sf1', label: 'SF1', title: 'School Register', orient: 'landscape' },
  { code: 'sf2', label: 'SF2', title: 'Daily Attendance', orient: 'landscape' },
  { code: 'sf3', label: 'SF3', title: 'Books Issued & Returned', orient: 'landscape' },
  { code: 'sf4', label: 'SF4', title: 'Monthly Learner Movement', orient: 'landscape' },
  { code: 'sf5', label: 'SF5', title: 'Report on Promotion', orient: 'landscape' },
  { code: 'sf6', label: 'SF6', title: 'Summarized Promotion', orient: 'landscape' },
  { code: 'sf7', label: 'SF7', title: 'Personnel Assignment', orient: 'landscape' },
  { code: 'sf8', label: 'SF8', title: 'Health & Nutrition', orient: 'landscape' },
  { code: 'sf9', label: 'SF9', title: 'Report Card', orient: 'portrait' },
  { code: 'sf10', label: 'SF10', title: 'Permanent Record', orient: 'portrait' },
];

function formHeaderHtml(info, formCode, formTitle) {
  return `
<div style="text-align:center;margin-bottom:8pt;">
  <div style="font-size:10pt;font-weight:bold;">REPUBLIC OF THE PHILIPPINES</div>
  <div style="font-size:9pt;">Department of Education</div>
  <div style="font-size:8pt;">${info.region || 'Region ____'}</div>
  <div style="font-size:8pt;">${info.division || 'Division ____'}</div>
  <div style="font-size:8pt;">${info.district || 'District ____'}</div>
  <div style="font-size:9pt;font-weight:bold;margin-top:4pt;">${info.school_name || 'Hinabangan National High School'}</div>
  <div style="font-size:8pt;">School ID: ${info.school_id || '______'}</div>
</div>
<div style="text-align:center;margin:6pt 0;">
  <span style="font-size:9pt;font-weight:bold;">School Form ${formCode.toUpperCase().replace('sf','SF ')} (${formCode.toUpperCase()})</span>
  <span style="font-size:9pt;margin-left:10pt;font-weight:bold;">${formTitle}</span>
</div>`;
}

function signatureBlockHtml(preparedBy, preparedTitle, approvedBy, approvedTitle) {
  return `
<table class="sig"><tr>
  <td><br/><br/>____________________________________<br/><strong>${preparedBy || '______________________'}</strong><br/>${preparedTitle || 'Class Adviser'}</td>
  <td><br/><br/>____________________________________<br/><strong>${approvedBy || '______________________'}</strong><br/>${approvedTitle || 'School Head'}</td>
</tr></table>`;
}

function blankRows(n, cols) {
  let html = '';
  for (let i = 0; i < n; i++) {
    html += '<tr>' + Array(cols).fill('<td>&nbsp;</td>').join('') + '</tr>';
  }
  return html;
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function e(s) { return escapeHtml(s); }

function printForm(code, title, html, orient) {
  printElementHtml(`${code.toUpperCase()} - ${title}`, html, { orientation: orient, paper: 'legal' });
}

function downloadBlank(code, title, html, orient) {
  const css = `@page{size:legal ${orient};margin:0.5in}body{font-family:'Times New Roman',serif;font-size:11pt;line-height:1.3;color:#000}table{border-collapse:collapse;width:100%;margin:6pt 0}td,th{border:1px solid #000;padding:3pt;font-size:9pt;vertical-align:top}.center{text-align:center}.c{text-align:center}.b{font-weight:bold}.small{font-size:8.5pt}.h1{font-size:13pt;font-weight:bold}.sig{width:100%;border:none}.sig td{border:none;text-align:center;font-size:10pt;padding:10pt 4pt 0}.no-border td,.no-border th{border:none}`;
  const full = `<!doctype html><html><head><meta charset="utf-8"><title>${e(code.toUpperCase())} - ${e(title)}</title><style>${css}</style></head><body>${html}</body></html>`;
  downloadBlob(`\ufeff${full}`, `HNHS-${code.toUpperCase()}-${title.replace(/[^a-zA-Z0-9]/g, '-')}-blank.html`, 'text/html;charset=utf-8');
}

export default function DepedForms() {
  const [tab, setTab] = useState('sf1');
  const [info, setInfo] = useState({});
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [sectionId, setSectionId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [term, setTerm] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/deped-forms/school-info').then(r => setInfo(r)).catch(() => {});
    api('/sections').then(r => setSections(r.data || r.rows || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (sectionId) {
      api(`/enrollments?section_id=${sectionId}`).then(r => {
        const rows = r.data || r.rows || [];
        setStudents(rows.map(e => ({ id: e.student_id || e.id, ...e })));
      }).catch(() => setStudents([]));
    }
  }, [sectionId]);

  useEffect(() => {
    setData(null);
    setError(null);
    if (tab === 'sf1' && sectionId) {
      setLoading(true);
      api(`/deped-forms/sf1?section_id=${sectionId}&school_year=${info.school_year || ''}`).then(r => { setData(r); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); });
    } else if (tab === 'sf2' && sectionId) {
      setLoading(true);
      api(`/deped-forms/sf2?section_id=${sectionId}&month=${month}&year=${year}`).then(r => { setData(r); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); });
    } else if (tab === 'sf5' && sectionId) {
      setLoading(true);
      api(`/deped-forms/sf5?section_id=${sectionId}&term=${term}`).then(r => { setData(r); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); });
    } else if (tab === 'sf6') {
      setLoading(true);
      api('/deped-forms/sf6').then(r => { setData(r); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); });
    } else if (tab === 'sf7') {
      setLoading(true);
      api('/deped-forms/sf7').then(r => { setData(r); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); });
    } else if (tab === 'sf9' && (studentId || sectionId)) {
      setLoading(true);
      const url = studentId ? `/deped-forms/sf9?student_id=${studentId}` : `/deped-forms/sf9?section_id=${sectionId}&term=${term}`;
      api(url).then(r => { setData(r); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); });
    } else if (tab === 'sf10' && studentId) {
      setLoading(true);
      api(`/deped-forms/sf10?student_id=${studentId}`).then(r => { setData(r); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); });
    }
  }, [tab, sectionId, studentId, month, year, term]);

  const form = FORMS.find(f => f.code === tab);

  return (
    <div>
      <PageHead title="DepEd School Forms (SF1–SF10)" sub="Official DepEd form layouts — view, download PDF, or download blank templates for printing." />
      <ErrorBanner error={error} />

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
        {FORMS.map(f => (
          <button key={f.code} className={`btn ${tab === f.code ? 'btn-primary' : ''}`} style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setTab(f.code)}>
            {f.label}
          </button>
        ))}
      </div>

      {(tab === 'sf1' || tab === 'sf2' || tab === 'sf5' || tab === 'sf9') && (
        <div className="card" style={{ padding: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ fontSize: 13 }}>Section
              <select className="input" style={{ marginLeft: 6, minWidth: 180 }} value={sectionId} onChange={e => setSectionId(e.target.value)}>
                <option value="">Select Section</option>
                {sections.map(s => <option key={s.id} value={s.id}>Grade {s.grade_level} — {s.name}</option>)}
              </select>
            </label>
            {(tab === 'sf2') && <>
              <label style={{ fontSize: 13 }}>Month
                <select className="input" style={{ marginLeft: 6 }} value={month} onChange={e => setMonth(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('en', { month: 'long' })}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 13 }}>Year
                <input type="number" className="input" style={{ marginLeft: 6, width: 80 }} value={year} onChange={e => setYear(Number(e.target.value))} />
              </label>
            </>}
            {(tab === 'sf5' || tab === 'sf9') && (
              <label style={{ fontSize: 13 }}>Term
                <select className="input" style={{ marginLeft: 6 }} value={term} onChange={e => setTerm(e.target.value)}>
                  <option value="">All</option>
                  <option value="Q1">Q1</option><option value="Q2">Q2</option><option value="Q3">Q3</option><option value="Q4">Q4</option>
                  <option value="Final">Final</option>
                </select>
              </label>
            )}
            {(tab === 'sf9' && sectionId) && (
              <label style={{ fontSize: 13 }}>Student
                <select className="input" style={{ marginLeft: 6, minWidth: 200 }} value={studentId} onChange={e => setStudentId(e.target.value)}>
                  <option value="">All students in section</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.last_name}, {s.first_name}</option>)}
                </select>
              </label>
            )}
          </div>
        </div>
      )}

      {(tab === 'sf10') && (
        <div className="card" style={{ padding: 12, marginBottom: 16 }}>
          <label style={{ fontSize: 13 }}>Student
            <select className="input" style={{ marginLeft: 6, minWidth: 280 }} value={studentId} onChange={e => setStudentId(e.target.value)}>
              <option value="">Select Student for Permanent Record</option>
              {sections.length > 0 && sections.map(s => (
                <option key={s.id} value="">-- Grade {s.grade_level} — {s.name} (select section first) --</option>
              ))}
            </select>
          </label>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
            For SF10, use the Students page to find the student ID, then select them here. (Full integration coming soon.)
          </div>
        </div>
      )}

      {loading && <Spinner />}
      {!loading && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className="btn" onClick={() => form && printForm(form.code, form.title, renderForm(tab, data, info, { sectionId, studentId, month, year, term, sections, students }), form.orient)}>
            <Printer size={14} /> Download PDF
          </button>
          <button className="btn" onClick={() => form && downloadBlank(form.code, form.title, renderBlankForm(tab, info, { sectionId, sections }), form.orient)}>
            <Download size={14} /> Download Blank Form
          </button>
        </div>
      )}

      <div className="card" style={{ padding: 16, overflow: 'auto' }}>
        {loading ? null : renderForm(tab, data, info, { sectionId, studentId, month, year, term, sections, students })}
      </div>
    </div>
  );
}

function renderForm(tab, data, info, ctx) {
  switch (tab) {
    case 'sf1': return renderSF1(data, info, ctx);
    case 'sf2': return renderSF2(data, info, ctx);
    case 'sf3': return renderSF3(data, info, ctx);
    case 'sf4': return renderSF4(data, info, ctx);
    case 'sf5': return renderSF5(data, info, ctx);
    case 'sf6': return renderSF6(data, info, ctx);
    case 'sf7': return renderSF7(data, info, ctx);
    case 'sf8': return renderSF8(data, info, ctx);
    case 'sf9': return renderSF9(data, info, ctx);
    case 'sf10': return renderSF10(data, info, ctx);
    default: return <p>Select a form tab above.</p>;
  }
}

function renderBlankForm(tab, info, ctx) {
  switch (tab) {
    case 'sf1': return renderSF1Blank(info, ctx);
    case 'sf2': return renderSF2Blank(info, ctx);
    case 'sf3': return renderSF3Blank(info, ctx);
    case 'sf4': return renderSF4Blank(info, ctx);
    case 'sf5': return renderSF5Blank(info, ctx);
    case 'sf6': return renderSF6Blank(info, ctx);
    case 'sf7': return renderSF7Blank(info, ctx);
    case 'sf8': return renderSF8Blank(info, ctx);
    case 'sf9': return renderSF9Blank(info, ctx);
    case 'sf10': return renderSF10Blank(info, ctx);
    default: return '<p>Select a form.</p>';
  }
}

/* ── SF1: School Register ─────────────────────────────────── */

function renderSF1(data, info) {
  const students = data?.students || [];
  const sec = data?.section;
  return `
${formHeaderHtml(info, 'sf1', 'School Register')}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${e(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School Year:</strong> ${e(info.school_year || '____-____')}</td></tr>
  <tr><td style="border:none"><strong>Grade Level:</strong> ${sec ? e(String(sec.grade_level)) : '____'}</td>
      <td style="border:none"><strong>Section:</strong> ${sec ? e(sec.name) : '____'}</td></tr>
</table>
<div class="small" style="margin-bottom:4pt;"><em>BoSY Date: ____________ &nbsp; EoSY Date: ____________</em></div>
<table>
<thead><tr>
  <th rowspan="2" style="width:25pt">LRN</th>
  <th rowspan="2" style="min-width:120pt">Name (Last, First, Middle)</th>
  <th rowspan="2" style="width:18pt">Sex<br/>(M/F)</th>
  <th rowspan="2" style="width:40pt">Birthdate<br/>(mm/dd/yy)</th>
  <th rowspan="2" style="width:50pt">Birthplace<br/>(Province)</th>
  <th rowspan="2" style="width:18pt">Age</th>
  <th rowspan="2" style="width:35pt">Mother<br/>Tongue</th>
  <th rowspan="2" style="width:18pt">IP</th>
  <th rowspan="2" style="width:50pt">Address</th>
  <th colspan="3" style="width:100pt">Name of Parents</th>
  <th rowspan="2" style="width:40pt">Contact<br/>Number</th>
  <th rowspan="2" style="width:35pt">Remarks</th>
</tr><tr>
  <th style="width:50pt;font-size:7pt">Father</th>
  <th style="width:50pt;font-size:7pt">Mother (Maiden)</th>
  <th style="width:50pt;font-size:7pt">Guardian</th>
</tr></thead>
<tbody>
${students.length ? students.map((s, i) => `<tr>
  <td class="c">${e(s.lrn || '')}</td>
  <td>${e(s.last_name)}, ${e(s.first_name)}${s.extension_name ? ', ' + e(s.extension_name) : ''}, ${e(s.middle_name || '')}</td>
  <td class="c">${e(s.sex || '')}</td>
  <td class="c">${e(s.birthdate || '')}</td>
  <td>${e(s.birthplace || '')}</td>
  <td class="c">${e(String(s.age || ''))}</td>
  <td>${e(s.mother_tongue || '')}</td>
  <td class="c">${e(s.indigenous_people || '')}</td>
  <td class="small">${e(s.address || '')}</td>
  <td class="small">${e(s.father_name || '')}</td>
  <td class="small">${e(s.mother_name || '')}</td>
  <td class="small">${e(s.guardian_name || '')}</td>
  <td class="c">${e(s.contact_number || s.parent_contact || '')}</td>
  <td class="c">${e(s.remarks || '')}</td>
</tr>`).join('') : blankRows(30, 14)}
</tbody></table>
<div class="small" style="margin:6pt 0;"><strong>Legend:</strong> T/O=Transferred Out, T/I=Transferred In, B/A=Balik-Aral, DRP=Dropped, LWD=Learner with Disability, LE=Late Enrollment, ACL=Accelerated, CCT=CCT Recipient</div>
${signatureBlockHtml(sec?.adviser_name, 'Class Adviser', '', 'School Head')}`;
}

function renderSF1Blank(info, ctx) {
  const sec = (ctx.sections || []).find(s => String(s.id) === String(ctx.sectionId));
  return `
${formHeaderHtml(info, 'sf1', 'School Register')}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${e(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School Year:</strong> ${e(info.school_year || '____-____')}</td></tr>
  <tr><td style="border:none"><strong>Grade Level:</strong> ${sec ? e(String(sec.grade_level)) : '____'}</td>
      <td style="border:none"><strong>Section:</strong> ${sec ? e(sec.name) : '____'}</td></tr>
</table>
<div class="small" style="margin-bottom:4pt;"><em>BoSY Date: ____________ &nbsp; EoSY Date: ____________</em></div>
<table>
<thead><tr>
  <th rowspan="2" style="width:25pt">LRN</th>
  <th rowspan="2" style="min-width:120pt">Name (Last, First, Middle)</th>
  <th rowspan="2" style="width:18pt">Sex<br/>(M/F)</th>
  <th rowspan="2" style="width:40pt">Birthdate<br/>(mm/dd/yy)</th>
  <th rowspan="2" style="width:50pt">Birthplace<br/>(Province)</th>
  <th rowspan="2" style="width:18pt">Age</th>
  <th rowspan="2" style="width:35pt">Mother<br/>Tongue</th>
  <th rowspan="2" style="width:18pt">IP</th>
  <th rowspan="2" style="width:50pt">Address</th>
  <th colspan="3" style="width:100pt">Name of Parents</th>
  <th rowspan="2" style="width:40pt">Contact<br/>Number</th>
  <th rowspan="2" style="width:35pt">Remarks</th>
</tr><tr>
  <th style="width:50pt;font-size:7pt">Father</th>
  <th style="width:50pt;font-size:7pt">Mother (Maiden)</th>
  <th style="width:50pt;font-size:7pt">Guardian</th>
</tr></thead>
<tbody>${blankRows(30, 14)}</tbody></table>
<div class="small" style="margin:6pt 0;"><strong>Legend:</strong> T/O, T/I, B/A, DRP, LWD, LE, ACL, CCT</div>
${signatureBlockHtml('', 'Class Adviser', '', 'School Head')}`;
}

/* ── SF2: Daily Attendance ─────────────────────────────────── */

function renderSF2(data, info) {
  const students = data?.students || [];
  const att = data?.attendance || [];
  const m = data?.month || new Date().getMonth() + 1;
  const y = data?.year || new Date().getFullYear();
  const daysInMonth = new Date(y, m, 0).getDate();
  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const attMap = {};
  for (const a of att) {
    const d = new Date(a.date).getDate();
    if (!attMap[a.student_id]) attMap[a.student_id] = {};
    attMap[a.student_id][d] = a.status === 'present' ? '/' : a.status === 'late' ? 'L' : 'O';
  }

  const monthName = new Date(y, m - 1).toLocaleString('en', { month: 'long' });

  return `
${formHeaderHtml(info, 'sf2', 'Daily Attendance Report of Learners')}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${e(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>Month:</strong> ${monthName} ${y}</td></tr>
  <tr><td style="border:none"><strong>Grade Level:</strong> ____</td><td style="border:none"><strong>Section:</strong> ____</td></tr>
</table>
<div class="small" style="margin-bottom:4pt;"><em>Legend: / = Present, O = Absent, L = Late</em></div>
<div style="overflow-x:auto;">
<table style="font-size:7pt;">
<thead><tr>
  <th rowspan="2" style="min-width:80pt">Name</th>
  ${dayHeaders.map(d => `<th style="width:12pt;padding:1pt">${d}</th>`).join('')}
  <th style="width:18pt">Tardy</th>
  <th style="width:18pt">Absent</th>
  <th style="width:30pt">Remarks</th>
</tr></thead>
<tbody>
${students.length ? students.map(s => {
  const totalAbsent = dayHeaders.filter(d => attMap[s.id]?.[d] === 'O').length;
  const totalTardy = dayHeaders.filter(d => attMap[s.id]?.[d] === 'L').length;
  return `<tr>
    <td class="small">${e(s.last_name)}, ${e(s.first_name)}</td>
    ${dayHeaders.map(d => `<td class="c">${attMap[s.id]?.[d] || ''}</td>`).join('')}
    <td class="c">${totalTardy || ''}</td>
    <td class="c">${totalAbsent || ''}</td>
    <td></td>
  </tr>`;
}).join('') : blankRows(30, daysInMonth + 3)}
</tbody></table></div>
${signatureBlockHtml('', 'Class Adviser', '', 'School Head')}`;
}

function renderSF2Blank(info) {
  const daysInMonth = 31;
  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  return `
${formHeaderHtml(info, 'sf2', 'Daily Attendance Report of Learners')}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${e(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>Month:</strong> ________________</td></tr>
  <tr><td style="border:none"><strong>Grade Level:</strong> ____</td><td style="border:none"><strong>Section:</strong> ____</td></tr>
</table>
<div class="small" style="margin-bottom:4pt;"><em>Legend: / = Present, O = Absent, L = Late</em></div>
<div style="overflow-x:auto;">
<table style="font-size:7pt;">
<thead><tr>
  <th rowspan="2" style="min-width:80pt">Name</th>
  ${dayHeaders.map(d => `<th style="width:12pt;padding:1pt">${d}</th>`).join('')}
  <th style="width:18pt">Tardy</th>
  <th style="width:18pt">Absent</th>
  <th style="width:30pt">Remarks</th>
</tr></thead>
<tbody>${blankRows(30, daysInMonth + 3)}</tbody></table></div>
${signatureBlockHtml('', 'Class Adviser', '', 'School Head')}`;
}

/* ── SF3: Books Issued & Returned ─────────────────────────── */

function renderSF3(data, info) {
  return `
${formHeaderHtml(info, 'sf3', 'Books Issued and Returned')}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${e(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School Year:</strong> ${e(info.school_year || '____-____')}</td></tr>
  <tr><td style="border:none"><strong>Grade Level:</strong> ____</td><td style="border:none"><strong>Section:</strong> ____</td></tr>
</table>
<table>
<thead><tr>
  <th style="width:25pt">LRN</th><th style="min-width:80pt">Name</th>
  <th style="min-width:80pt">Title of Textbook</th><th style="width:35pt">Date Issued</th>
  <th style="width:35pt">Date Returned</th><th style="width:25pt">Condition</th>
  <th style="width:20pt">Code</th><th style="width:30pt">Action</th>
  <th style="width:20pt">M</th><th style="width:20pt">F</th><th style="width:25pt">Total</th>
</tr></thead>
<tbody>${blankRows(30, 11)}</tbody></table>
<div class="small" style="margin:6pt 0;"><strong>Legend:</strong> FM=Force Majeure, TDO=Transferred/Dropped Out, NEG=Negligence &nbsp; | &nbsp; LLTR=Letter from Learner, TLTR=Teacher Letter, PTL=Paid by Learner</div>
${signatureBlockHtml('', 'Class Adviser / Teacher', '', 'School Head')}`;
}

function renderSF3Blank(info) { return renderSF3(null, info); }

/* ── SF4: Monthly Learner Movement ─────────────────────────── */

function renderSF4(data, info) {
  return `
${formHeaderHtml(info, 'sf4', "Monthly Learner's Movement and Attendance")}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${e(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School Year:</strong> ${e(info.school_year || '____-____')}</td></tr>
  <tr><td style="border:none"><strong>Grade Level:</strong> ____</td><td style="border:none"><strong>Section:</strong> ____</td></tr>
  <tr><td style="border:none"><strong>Curriculum:</strong> K to 12 BEC</td><td style="border:none"><strong>Month:</strong> ________________</td></tr>
</table>
<table>
<thead><tr>
  <th style="min-width:50pt">Indicator</th><th style="width:20pt">Code</th>
  <th style="min-width:60pt">Male</th><th style="min-width:60pt">Female</th><th style="min-width:60pt">Total</th>
</tr></thead>
<tbody>
  <tr><td>Enrolment as of 1st Friday of June</td><td class="c"></td><td></td><td></td><td></td></tr>
  <tr><td>Late Enrollees (within the month)</td><td class="c">LE</td><td></td><td></td><td></td></tr>
  <tr><td>Registered Learners as of end of month</td><td class="c"></td><td></td><td></td><td></td></tr>
  <tr><td>Transferred In</td><td class="c">T/I</td><td></td><td></td><td></td></tr>
  <tr><td>Transferred Out</td><td class="c">T/O</td><td></td><td></td><td></td></tr>
  <tr><td>Dropped Out</td><td class="c">DRP</td><td></td><td></td><td></td></tr>
  <tr><td>Balik-Aral</td><td class="c">B/A</td><td></td><td></td><td></td></tr>
  <tr><td>Archived</td><td class="c">ARC</td><td></td><td></td><td></td></tr>
  <tr><td>Accelerated</td><td class="c">ACL</td><td></td><td></td><td></td></tr>
  <tr><td>Learners with Disability</td><td class="c">LWD</td><td></td><td></td><td></td></tr>
  <tr><td><strong>TOTAL</strong></td><td class="c"></td><td></td><td></td><td></td></tr>
</tbody></table>
<div class="small" style="margin:6pt 0;"><strong>Remarks:</strong> ________________________________________________</div>
${signatureBlockHtml('', 'Class Adviser', '', 'School Head')}`;
}

function renderSF4Blank(info) { return renderSF4(null, info); }

/* ── SF5: Report on Promotion ─────────────────────────────── */

function renderSF5(data, info) {
  const students = data?.students || [];
  const subjects = data?.subjects || [];
  const grades = data?.grades || [];
  const gradeMap = {};
  for (const g of grades) {
    const key = `${g.student_id}_${g.subject_id}`;
    gradeMap[key] = g;
  }

  return `
${formHeaderHtml(info, 'sf5', 'Report on Promotion and Level of Proficiency')}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${e(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School Year:</strong> ${e(info.school_year || '____-____')}</td></tr>
  <tr><td style="border:none"><strong>Grade Level:</strong> ____</td><td style="border:none"><strong>Section:</strong> ____</td></tr>
  <tr><td style="border:none"><strong>Curriculum:</strong> K to 12 BEC / MATATAG</td><td style="border:none"></td></tr>
</table>
<table style="font-size:7pt;">
<thead><tr>
  <th style="width:25pt">LRN</th><th style="min-width:80pt">Name (LN, FN, MN)</th><th style="width:18pt">Sex</th>
  ${subjects.map(s => `<th style="min-width:50pt">${e(s.name)}</th>`).join('')}
  <th style="min-width:30pt">Gen. Avg.</th><th style="min-width:35pt">Remarks</th>
</tr></thead>
<tbody>
${students.length ? students.map(s => {
  const rowGrades = subjects.map(sub => gradeMap[`${s.id}_${sub.id}`] || {});
  const avg = rowGrades.reduce((sum, g) => sum + (Number(g.computed_grade) || 0), 0) / (subjects.length || 1);
  const avgVal = avg || avg === 0 ? avg.toFixed(1) : '';
  const remark = avg >= 75 ? 'Promoted' : avg >= 60 ? 'Conditionally Promoted' : avg > 0 ? 'Retained' : '';
  return `<tr>
    <td></td>
    <td>${e(s.last_name)}, ${e(s.first_name)}${s.extension_name ? ', ' + e(s.extension_name) : ''}, ${e(s.middle_name || '')}</td>
    <td></td>
    ${rowGrades.map(g => `<td class="c">${g.computed_grade != null ? Number(g.computed_grade).toFixed(1) : ''}</td>`).join('')}
    <td class="c"><strong>${avgVal}</strong></td>
    <td class="c small">${remark}</td>
  </tr>`;
}).join('') : blankRows(30, subjects.length + 5)}
</tbody></table>
<div class="small" style="margin:6pt 0;">
  <strong>Remarks:</strong> Promoted (≥75) | Conditionally Promoted (60–74) | Retained (<60) &nbsp; | &nbsp;
  <strong>Proficiency Levels:</strong> Advanced | Proficient | Approaching Proficient | Beginning
</div>
${signatureBlockHtml('', 'Class Adviser', '', 'School Head')}`;
}

function renderSF5Blank(info) { return renderSF5(null, info); }

/* ── SF6: Summarized Promotion ─────────────────────────────── */

function renderSF6(data, info) {
  const rows = Array.isArray(data) ? data : [];
  return `
${formHeaderHtml(info, 'sf6', 'Summarized Report on Promotion and Level of Proficiency')}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${e(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School Year:</strong> ${e(info.school_year || '____-____')}</td></tr>
  <tr><td style="border:none"><strong>Curriculum:</strong> K to 12 BEC</td><td style="border:none"></td></tr>
</table>
<table>
<thead><tr>
  <th style="min-width:60pt">Grade Level / Section</th>
  <th style="width:30pt">Enrolled</th>
  <th style="width:30pt">Promoted</th>
  <th style="width:30pt">Conditional</th>
  <th style="width:30pt">Retained</th>
  <th style="width:30pt">T/O</th>
  <th style="width:30pt">DRP</th>
  <th style="width:30pt">LWD</th>
  <th style="width:30pt">ACL</th>
  <th style="width:30pt">Total</th>
</tr></thead>
<tbody>
${rows.length ? rows.map(r => {
  const total = Number(r.promotion?.promoted || 0) + Number(r.promotion?.conditional || 0) + Number(r.promotion?.retained || 0);
  const enrolled = r.enrollments?.reduce((s, e) => s + Number(e.cnt || 0), 0) || 0;
  return `<tr>
    <td>${e(r.section?.grade_level)} — ${e(r.section?.name)}</td>
    <td class="c">${enrolled}</td>
    <td class="c">${r.promotion?.promoted || 0}</td>
    <td class="c">${r.promotion?.conditional || 0}</td>
    <td class="c">${r.promotion?.retained || 0}</td>
    <td class="c"></td><td class="c"></td><td class="c"></td><td class="c"></td>
    <td class="c"><strong>${total}</strong></td>
  </tr>`;
}).join('') : blankRows(15, 10)}
</tbody></table>
${signatureBlockHtml('', 'School Head', '', 'Division Director')}`;
}

function renderSF6Blank(info) { return renderSF6(null, info); }

/* ── SF7: Personnel Assignment ─────────────────────────────── */

function renderSF7(data, info) {
  const teachers = data?.teachers || [];
  const assignments = data?.assignments || {};

  return `
${formHeaderHtml(info, 'sf7', 'School Personnel Assignment List and Basic Profile')}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${e(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School Year:</strong> ${e(info.school_year || '____-____')}</td></tr>
</table>
<table style="font-size:7pt;">
<thead><tr>
  <th style="width:25pt">#</th><th style="min-width:80pt">Name</th>
  <th style="min-width:50pt">Position</th><th style="width:35pt">Employment Status</th>
  <th style="min-width:50pt">Area of Specialization</th><th style="min-width:80pt">Subjects Taught</th>
  <th style="min-width:50pt">Advisory Class</th><th style="min-width:50pt">Daily Program</th>
  <th style="width:30pt">Avg. Min/Day</th><th style="min-width:40pt">Remarks</th>
</tr></thead>
<tbody>
${teachers.length ? teachers.map((t, i) => {
  const asgn = assignments[t.id] || [];
  return `<tr>
    <td class="c">${i + 1}</td>
    <td>${e(t.user_name || t.name || '')}</td>
    <td>${e(t.position || '')}</td>
    <td>${e(t.employment_status || '')}</td>
    <td>${e(t.specialization || '')}</td>
    <td class="small">${asgn.map(a => e(a.subject_name)).join(', ')}</td>
    <td>${asgn.find(a => a.advisory_class) ? e(asgn.find(a => a.advisory_class).advisory_class) : ''}</td>
    <td class="small">${asgn.map(a => e(a.schedule || '')).join('<br/>')}</td>
    <td class="c">${asgn.reduce((s, a) => s + Number(a.minutes_per_day || 0), 0) || ''}</td>
    <td></td>
  </tr>`;
}).join('') : blankRows(20, 10)}
</tbody></table>
${signatureBlockHtml('', 'School Head', '', 'HR Officer')}`;
}

function renderSF7Blank(info) { return renderSF7(null, info); }

/* ── SF8: Health & Nutrition ─────────────────────────────── */

function renderSF8(data, info) {
  return `
${formHeaderHtml(info, 'sf8', "Learner's Basic Health and Nutrition Report")}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${e(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School Year:</strong> ${e(info.school_year || '____-____')}</td></tr>
  <tr><td style="border:none"><strong>Grade Level:</strong> ____</td><td style="border:none"><strong>Section:</strong> ____</td></tr>
</table>
<table style="font-size:7pt;">
<thead><tr>
  <th style="width:25pt">LRN</th><th style="min-width:80pt">Name (LN, FN, MN)</th><th style="width:18pt">Sex</th>
  <th style="width:35pt">Height<br/>(cm)</th><th style="width:35pt">Weight<br/>(kg)</th>
  <th style="width:30pt">BMI</th><th style="width:40pt">Nutritional Status</th>
  <th style="width:30pt">Remarks</th><th style="width:30pt">CCT</th>
</tr></thead>
<tbody>${blankRows(30, 9)}</tbody></table>
<div class="small" style="margin:6pt 0;">
  <strong>Nutritional Status:</strong> UW=Underweight | NW=Normal Weight | OW=Overweight | OB=Obese<br/>
  <strong>BMI Categories (Age 12-18):</strong> Underweight (&lt;18.5) | Normal (18.5–24.9) | Overweight (25–29.9) | Obese (≥30)
</div>
${signatureBlockHtml('', 'Class Adviser / School Nurse', '', 'School Head')}`;
}

function renderSF8Blank(info) { return renderSF8(null, info); }

/* ── SF9: Report Card ─────────────────────────────────────── */

function renderSF9(data, info) {
  if (data?.learner) {
    const l = data.learner;
    const s = l.student;
    const e = l.enrollment;
    const grades = l.grades || [];
    const att = l.attendance || {};
    const sy = info.school_year || '____-____';
    return renderSF9Card(s, e, grades, att, sy, info);
  }
  if (data?.learners) {
    return data.learners.map((l, i) => {
      return `<div style="margin-bottom:12pt;"><em style="font-size:9pt;color:#666;">Learner ${i + 1}: ${e(l.last_name)}, ${e(l.first_name)} — select individual student to view full report card.</em></div>`;
    }).join('') || '<p>Select a student or section to populate the report card.</p>';
  }
  return '<p>Select a student or section to populate the report card.</p>';
}

function renderSF9Card(s, enrollment, grades, att, sy, info) {
  return `
${formHeaderHtml(info, 'sf9', "Learner's Progress Report Card (Form 138)")}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${e(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School Year:</strong> ${e(sy)}</td></tr>
  <tr><td style="border:none"><strong>Grade Level:</strong> ${enrollment ? e(String(enrollment.grade_level)) : '____'}</td>
      <td style="border:none"><strong>Section:</strong> ${enrollment ? e(enrollment.section_name) : '____'}</td></tr>
</table>
<table style="font-size:8pt;margin-bottom:8pt;">
  <tr><td style="border:none;width:25%"><strong>Name:</strong></td><td style="border:none">${e(s.last_name)}, ${e(s.first_name)}${s.extension_name ? ', ' + e(s.extension_name) : ''}</td>
      <td style="border:none;width:20%"><strong>LRN:</strong></td><td style="border:none">${e(s.lrn || '')}</td></tr>
  <tr><td style="border:none"><strong>Semester:</strong></td><td style="border:none">____</td>
      <td style="border:none"><strong>Quarter:</strong></td><td style="border:none">____</td></tr>
</table>
<strong>Learning Areas and Grades</strong>
<table style="font-size:8pt;">
<thead><tr>
  <th style="min-width:100pt">Learning Area</th>
  <th style="width:30pt">WW<br/>(25%)</th>
  <th style="width:30pt">PT<br/>(50%)</th>
  <th style="width:30pt">QA<br/>(25%)</th>
  <th style="width:30pt">Final<br/>Grade</th>
  <th style="width:30pt">Remarks</th>
</tr></thead>
<tbody>
${grades.length ? grades.map(g => {
  const finalGrade = Number(g.computed_grade) || 0;
  const remark = finalGrade >= 75 ? 'Passed' : 'Did Not Pass';
  return `<tr>
    <td>${e(g.subject_name)}</td>
    <td class="c"></td><td class="c"></td><td class="c"></td>
    <td class="c"><strong>${finalGrade ? finalGrade.toFixed(1) : ''}</strong></td>
    <td class="c">${finalGrade ? remark : ''}</td>
  </tr>`;
}).join('') : blankRows(10, 6)}
</tbody></table>
<table style="font-size:8pt;margin-top:8pt;width:50%;">
  <tr><td style="border:none"><strong>General Average:</strong></td><td style="border:none" class="c"><strong>${grades.length ? (grades.reduce((s, g) => s + (Number(g.computed_grade) || 0), 0) / grades.length).toFixed(1) : ''}</strong></td></tr>
</table>
<strong style="font-size:8pt;">Attendance</strong>
<table style="font-size:8pt;width:50%;margin-top:4pt;">
  <thead><tr><th>Days Present</th><th>Days Absent</th><th>Days Tardy</th></tr></thead>
  <tbody><tr>
    <td class="c">${att.days_present || ''}</td>
    <td class="c">${att.days_absent || ''}</td>
    <td class="c">${att.days_late || ''}</td>
  </tr></tbody>
</table>
<div style="margin-top:12pt;font-size:8pt;">
  <strong>Conduct and Values:</strong><br/>
  <em>Observed values: Maka-Diyos, Maka-Tao, Makakalikasan, Makabansa</em>
</div>
${signatureBlockHtml(enrollment?.adviser_name || '', 'Class Adviser', '', 'School Head')}`;
}

function renderSF9Blank(info) {
  return `
${formHeaderHtml(info, 'sf9', "Learner's Progress Report Card (Form 138)")}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${e(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School Year:</strong> ____-____</td></tr>
  <tr><td style="border:none"><strong>Grade Level:</strong> ____</td><td style="border:none"><strong>Section:</strong> ____</td></tr>
</table>
<table style="font-size:8pt;margin-bottom:8pt;">
  <tr><td style="border:none;width:25%"><strong>Name:</strong></td><td style="border:none">____________________________</td>
      <td style="border:none;width:20%"><strong>LRN:</strong></td><td style="border:none">____________</td></tr>
  <tr><td style="border:none"><strong>Semester:</strong></td><td style="border:none">____</td>
      <td style="border:none"><strong>Quarter:</strong></td><td style="border:none">____</td></tr>
</table>
<strong>Learning Areas and Grades</strong>
<table style="font-size:8pt;">
<thead><tr>
  <th style="min-width:100pt">Learning Area</th>
  <th style="width:30pt">WW<br/>(25%)</th><th style="width:30pt">PT<br/>(50%)</th>
  <th style="width:30pt">QA<br/>(25%)</th><th style="width:30pt">Final<br/>Grade</th>
  <th style="width:30pt">Remarks</th>
</tr></thead>
<tbody>${blankRows(12, 6)}</tbody></table>
<table style="font-size:8pt;margin-top:8pt;width:50%;">
  <tr><td style="border:none"><strong>General Average:</strong></td><td style="border:none" class="c"><strong></strong></td></tr>
</table>
<strong style="font-size:8pt;">Attendance</strong>
<table style="font-size:8pt;width:50%;margin-top:4pt;">
  <thead><tr><th>Days Present</th><th>Days Absent</th><th>Days Tardy</th></tr></thead>
  <tbody><tr><td class="c"></td><td class="c"></td><td class="c"></td></tr></tbody>
</table>
<div style="margin-top:12pt;font-size:8pt;"><strong>Conduct and Values:</strong><br/>
<em>Observed values: Maka-Diyos, Maka-Tao, Makakalikasan, Makabansa</em></div>
${signatureBlockHtml('', 'Class Adviser', '', 'School Head')}`;
}

/* ── SF10: Permanent Record (Form 137) ─────────────────────── */

function renderSF10(data, info) {
  if (!data?.learner) return '<p>Select a student to view their Permanent Academic Record (Form 137).</p>';
  const l = data.learner;
  const s = l.student;
  const enrollments = l.enrollments || [];
  const grades = l.grades || [];
  const attendance = l.attendance || [];

  const byYear = {};
  for (const e of enrollments) {
    const sy = e.school_year || 'N/A';
    if (!byYear[sy]) byYear[sy] = { enrollment: e, grades: [], attendance: null };
    byYear[sy].grades = grades.filter(g => g.section_name === e.section_name);
    byYear[sy].attendance = attendance.find(a => a.section_name === e.section_name);
  }

  return `
${formHeaderHtml(info, 'sf10', "Learner's Permanent Academic Record (Form 137)")}
<table style="font-size:8pt;margin-bottom:8pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${e(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School ID:</strong> ${e(info.school_id || '')}</td></tr>
</table>

<strong style="font-size:9pt;">I. Learner Information</strong>
<table style="font-size:8pt;">
  <tr><td style="width:25%"><strong>Name:</strong></td><td>${e(s.last_name)}, ${e(s.first_name)}${s.extension_name ? ', ' + e(s.extension_name) : ''}, ${e(s.middle_name || '')}</td></tr>
  <tr><td><strong>LRN:</strong></td><td>${e(s.lrn || '')}</td></tr>
  <tr><td><strong>Birthdate:</strong></td><td>${e(s.birthdate || '')}</td>
      <td style="width:15%"><strong>Sex:</strong></td><td>${e(s.sex || '')}</td></tr>
  <tr><td><strong>Address:</strong></td><td colspan="3">${e(s.address || '')}</td></tr>
  <tr><td><strong>Father:</strong></td><td>${e(s.father_name || '')}</td>
      <td><strong>Mother:</strong></td><td>${e(s.mother_name || '')}</td></tr>
  <tr><td><strong>Guardian:</strong></td><td>${e(s.guardian_name || '')}</td>
      <td><strong>Contact:</strong></td><td>${e(s.contact_number || s.parent_contact || '')}</td></tr>
</table>

<strong style="font-size:9pt;margin-top:8pt;display:block;">II. Education Record</strong>
<table style="font-size:7pt;">
<thead><tr>
  <th style="min-width:40pt">School Year</th>
  <th style="min-width:40pt">Grade Level</th>
  <th style="min-width:40pt">Section</th>
  <th style="min-width:40pt">Subjects / Grades</th>
  <th style="width:30pt">Gen. Avg.</th>
  <th style="width:40pt">Attendance<br/>Present / Absent</th>
  <th style="width:40pt">Remarks<br/>Promoted/Retained</th>
  <th style="min-width:40pt">School Last Attended</th>
</tr></thead>
<tbody>
${Object.keys(byYear).length ? Object.entries(byYear).map(([sy, d]) => {
  const avg = d.grades.length ? (d.grades.reduce((s, g) => s + (Number(g.computed_grade) || 0), 0) / d.grades.length).toFixed(1) : '';
  const promoted = avg && Number(avg) >= 75 ? 'Promoted' : avg ? 'Retained' : '';
  return `<tr>
    <td>${e(sy)}</td>
    <td class="c">${d.enrollment?.grade_level || ''}</td>
    <td>${d.enrollment?.section_name || ''}</td>
    <td class="small">${d.grades.map(g => `${e(g.subject_name)}: ${Number(g.computed_grade).toFixed(1)}`).join('<br/>')}</td>
    <td class="c"><strong>${avg}</strong></td>
    <td class="c">${d.attendance ? `${d.attendance.days_present || 0} / ${d.attendance.days_absent || 0}` : ''}</td>
    <td class="c">${promoted}</td>
    <td>${e(info.school_name)}</td>
  </tr>`;
}).join('') : blankRows(6, 8)}
</tbody></table>

<strong style="font-size:9pt;margin-top:8pt;display:block;">III. Behavior / Conduct</strong>
<table style="font-size:8pt;">
<thead><tr><th>School Year</th><th>Conduct Rating</th><th>Values Education</th></tr></thead>
<tbody>${blankRows(4, 3)}</tbody></table>

<div class="small" style="margin:8pt 0;"><em>Note: SF10 is for Grades 1 & 7 only (K to 12). For other levels, the existing Form 137 format is used. SHS incoming Grade 11 uses SF10-SHS format per DO 69, s. 2016.</em></div>
${signatureBlockHtml('', 'Class Adviser', '', 'School Head / Registrar')}`;
}

function renderSF10Blank(info) {
  return `
${formHeaderHtml(info, 'sf10', "Learner's Permanent Academic Record (Form 137)")}
<table style="font-size:8pt;margin-bottom:8pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${e(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School ID:</strong> ${e(info.school_id || '')}</td></tr>
</table>
<strong style="font-size:9pt;">I. Learner Information</strong>
<table style="font-size:8pt;">
  <tr><td style="width:25%"><strong>Name:</strong></td><td>________________________________</td></tr>
  <tr><td><strong>LRN:</strong></td><td>____________</td></tr>
  <tr><td><strong>Birthdate:</strong></td><td>____________</td><td style="width:15%"><strong>Sex:</strong></td><td>____</td></tr>
  <tr><td><strong>Address:</strong></td><td colspan="3">________________________________</td></tr>
  <tr><td><strong>Father:</strong></td><td>________________________________</td><td><strong>Mother:</strong></td><td>________________________________</td></tr>
  <tr><td><strong>Guardian:</strong></td><td>________________________________</td><td><strong>Contact:</strong></td><td>____________</td></tr>
</table>
<strong style="font-size:9pt;margin-top:8pt;display:block;">II. Education Record</strong>
<table style="font-size:7pt;">
<thead><tr>
  <th style="min-width:40pt">School Year</th><th style="min-width:40pt">Grade Level</th>
  <th style="min-width:40pt">Section</th><th style="min-width:40pt">Subjects / Grades</th>
  <th style="width:30pt">Gen. Avg.</th><th style="width:40pt">Attendance</th>
  <th style="width:40pt">Remarks</th><th style="min-width:40pt">School Last Attended</th>
</tr></thead>
<tbody>${blankRows(8, 8)}</tbody></table>
<strong style="font-size:9pt;margin-top:8pt;display:block;">III. Behavior / Conduct</strong>
<table style="font-size:8pt;">
<thead><tr><th>School Year</th><th>Conduct Rating</th><th>Values Education</th></tr></thead>
<tbody>${blankRows(4, 3)}</tbody></table>
${signatureBlockHtml('', 'Class Adviser', '', 'School Head / Registrar')}`;
}
