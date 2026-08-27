import { useEffect, useState, useCallback } from 'react';
import { Download, Printer, Pencil } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Spinner, ErrorBanner } from '../components/ui';
import { printElementHtml, downloadBlob } from '../lib/export';
import DOMPurify from 'dompurify';

const FORMS = [
  { code: 'sf1', label: 'SF1', title: 'School Register', orient: 'landscape' },
  { code: 'sf2', label: 'SF2', title: 'Daily Attendance', orient: 'landscape' },
  { code: 'sf3', label: 'SF3', title: 'Books Issued & Returned', orient: 'landscape' },
  { code: 'sf4', label: 'SF4', title: 'Monthly Learner Movement', orient: 'landscape' },
  { code: 'sf5', label: 'SF5', title: 'Report on Promotion', orient: 'landscape' },
  { code: 'sf6', label: 'SF6', title: 'Summarized Promotion', orient: 'landscape' },
  { code: 'sf7', label: 'SF7', title: 'Personnel Assignment', orient: 'landscape' },
  { code: 'sf8', label: 'SF8', title: 'Health & Nutrition', orient: 'landscape' },
  { code: 'sf9', label: 'SF9', title: 'Report Card', orient: 'landscape' },
  { code: 'sf10', label: 'SF10', title: 'Permanent Record', orient: 'portrait' },
  { code: 'sog', label: 'SOG', title: 'Summary of Grades', orient: 'landscape' },
  { code: 'sas', label: 'SAS', title: 'Attendance Summary', orient: 'landscape' },
  { code: 'sid', label: 'SID', title: 'Student ID', orient: 'landscape' },
];

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formHeaderHtml(info, formCode, formTitle) {
  return `
<div style="text-align:center;margin-bottom:8pt;">
  <div style="font-size:10pt;font-weight:bold;">REPUBLIC OF THE PHILIPPINES</div>
  <div style="font-size:9pt;">Department of Education</div>
  <div style="font-size:8pt;">${esc(info.region || 'Region ____')}</div>
  <div style="font-size:8pt;">${esc(info.division || 'Division ____')}</div>
  <div style="font-size:8pt;">${esc(info.district || 'District ____')}</div>
  <div style="font-size:9pt;font-weight:bold;margin-top:4pt;">${esc(info.school_name || 'Hinabangan National High School')}</div>
  <div style="font-size:8pt;">School ID: ${esc(info.school_id || '______')}</div>
</div>
<div style="text-align:center;margin:6pt 0;">
  <span style="font-size:9pt;font-weight:bold;">${formTitle}</span>
</div>`;
}

function signatureBlockHtml(preparedBy, preparedTitle, approvedBy, approvedTitle) {
  return `
<table class="sig"><tr>
  <td><br/><br/>____________________________________<br/><strong>${esc(preparedBy || '______________________')}</strong><br/>${esc(preparedTitle || 'Class Adviser')}</td>
  <td><br/><br/>____________________________________<br/><strong>${esc(approvedBy || '______________________')}</strong><br/>${esc(approvedTitle || 'School Head')}</td>
</tr></table>`;
}

function blankRows(n, cols) {
  let html = '';
  for (let i = 0; i < n; i++) {
    html += '<tr>' + Array(cols).fill('<td>&nbsp;</td>').join('') + '</tr>';
  }
  return html;
}

function printForm(code, title, html, orient) {
  printElementHtml(`${code.toUpperCase()} - ${title}`, html, { orientation: orient, paper: 'legal' });
}

async function batchPrintSF9(sectionId, info) {
  try {
    const res = await api(`/deped-forms/sf9/full?section_id=${sectionId}`);
    const learners = res.learners || [];
    if (!learners.length) return alert('No learners found for this section.');
    const cards = learners.map(lr => renderSF9Card(lr.student, lr.enrollment, lr.grades, lr.monthlyAttendance || [], info.school_year || '____-____', info, lr.conduct || []));
    const css = `@page{size:legal landscape;margin:0.3in}body{font-family:'Times New Roman',serif;font-size:10pt;line-height:1.2;color:#000;margin:0;padding:0}table{border-collapse:collapse;width:100%}td,th{border:1px solid #000;padding:2pt 3pt;font-size:7.5pt;vertical-align:top}.center{text-align:center}.c{text-align:center}.b{font-weight:bold}.small{font-size:7pt}.sig{width:100%;border:none}.sig td{border:none;text-align:center;font-size:9pt;padding:8pt 3pt 0}.sf9-page{page-break-after:always;width:100%;height:100vh;display:flex}.sf9-page:last-child{page-break-after:auto}`;
    const full = `<!doctype html><html><head><meta charset="utf-8"><title>SF9 - Report Cards - Batch</title><style>${css}</style></head><body>${cards.join('\n')}</body></html>`;
    const w = window.open('', '_blank');
    w.document.write(full);
    w.document.close();
    setTimeout(() => w.print(), 500);
  } catch (e) {
    alert('Error loading batch report cards: ' + e.message);
  }
}

function downloadBlankForm(code, title, html, orient, info) {
  const css = `@page{size:legal ${orient};margin:0.5in}body{font-family:'Times New Roman',serif;font-size:11pt;line-height:1.3;color:#000}table{border-collapse:collapse;width:100%;margin:6pt 0}td,th{border:1px solid #000;padding:3pt;font-size:9pt;vertical-align:top}.center{text-align:center}.c{text-align:center}.b{font-weight:bold}.small{font-size:8.5pt}.h1{font-size:13pt;font-weight:bold}.sig{width:100%;border:none}.sig td{border:none;text-align:center;font-size:10pt;padding:10pt 4pt 0}.no-border td,.no-border th{border:none}`;
  const full = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(code.toUpperCase())} - ${esc(title)}</title><style>${css}</style></head><body>${html}</body></html>`;
  const prefix = (info?.school_name || 'HNHS').replace(/[^A-Z]/gi, '').substring(0, 8).toUpperCase();
  downloadBlob(`\ufeff${full}`, `${prefix}-${code.toUpperCase()}-${title.replace(/[^a-zA-Z0-9]/g, '-')}-blank.html`, 'text/html;charset=utf-8');
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
  const [schoolYear, setSchoolYear] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [conductOpen, setConductOpen] = useState(false);
  const [conductRatings, setConductRatings] = useState({ makadiyos: '', makatao: '', makakalikasan: '', makabansa: '' });
  const [conductSaving, setConductSaving] = useState(false);

  useEffect(() => {
    api('/deped-forms/school-info').then(r => {
      setInfo(r);
      if (!schoolYear && r.school_year) setSchoolYear(r.school_year);
    }).catch(() => {});
    api('/sections').then(r => setSections(r.data || r.rows || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (sectionId) {
      api(`/enrollments?section_id=${sectionId}`).then(r => {
        const rows = r.data || r.rows || [];
        setStudents(rows.map(row => ({ id: row.student_id || row.id, ...row })));
      }).catch(() => setStudents([]));
    }
  }, [sectionId]);

  useEffect(() => {
    setData(null);
    setError(null);
    if (tab === 'sf1' && sectionId) {
      setLoading(true);
      api(`/deped-forms/sf1?section_id=${sectionId}&school_year=${info.school_year || ''}`).then(r => { setData(r); setLoading(false); }).catch(err => { setError(err.message); setLoading(false); });
    } else if (tab === 'sf2' && sectionId) {
      setLoading(true);
      api(`/deped-forms/sf2?section_id=${sectionId}&month=${month}&year=${year}`).then(r => { setData(r); setLoading(false); }).catch(err => { setError(err.message); setLoading(false); });
    } else if (tab === 'sf3' && sectionId) {
      setLoading(true);
      api(`/deped-forms/sf3?section_id=${sectionId}`).then(r => { setData(r); setLoading(false); }).catch(err => { setError(err.message); setLoading(false); });
    } else if (tab === 'sf4' && sectionId) {
      setLoading(true);
      api(`/deped-forms/sf4?section_id=${sectionId}&month=${month}&year=${year}`).then(r => { setData(r); setLoading(false); }).catch(err => { setError(err.message); setLoading(false); });
    } else if (tab === 'sf5' && sectionId) {
      setLoading(true);
      api(`/deped-forms/sf5?section_id=${sectionId}&term=${term}`).then(r => { setData(r); setLoading(false); }).catch(err => { setError(err.message); setLoading(false); });
    } else if (tab === 'sf6') {
      setLoading(true);
      api('/deped-forms/sf6').then(r => { setData(r); setLoading(false); }).catch(err => { setError(err.message); setLoading(false); });
    } else if (tab === 'sf7' && schoolYear) {
      setLoading(true);
      api(`/deped-forms/sf7?school_year=${schoolYear}`).then(r => { setData(r); setLoading(false); }).catch(err => { setError(err.message); setLoading(false); });
    } else if (tab === 'sf8' && sectionId) {
      setLoading(true);
      api(`/deped-forms/sf8?section_id=${sectionId}&school_year=${schoolYear || ''}`).then(r => { setData(r); setLoading(false); }).catch(err => { setError(err.message); setLoading(false); });
    } else if (tab === 'sf9' && (studentId || sectionId)) {
      setLoading(true);
      const url = studentId ? `/deped-forms/sf9/full?student_id=${studentId}` : `/deped-forms/sf9/full?section_id=${sectionId}`;
      api(url).then(r => { setData(r); setLoading(false); }).catch(err => { setError(err.message); setLoading(false); });
    } else if (tab === 'sf10' && studentId) {
      setLoading(true);
      api(`/deped-forms/sf10?student_id=${studentId}`).then(r => { setData(r); setLoading(false); }).catch(err => { setError(err.message); setLoading(false); });
    } else if (tab === 'sog' && sectionId) {
      setLoading(true);
      api(`/deped-forms/summary-of-grades?section_id=${sectionId}`).then(r => { setData(r); setLoading(false); }).catch(err => { setError(err.message); setLoading(false); });
    } else if (tab === 'sas' && sectionId) {
      setLoading(true);
      api(`/deped-forms/attendance-summary?section_id=${sectionId}`).then(r => { setData(r); setLoading(false); }).catch(err => { setError(err.message); setLoading(false); });
    } else if (tab === 'sid' && studentId) {
      setLoading(true);
      api(`/deped-forms/student-id?student_id=${studentId}`).then(r => { setData(r); setLoading(false); }).catch(err => { setError(err.message); setLoading(false); });
    }
  }, [tab, sectionId, studentId, month, year, term, schoolYear, info.school_year]);

  useEffect(() => {
    if (Array.isArray(data?.learner?.conduct) && data.learner.conduct.length > 0) {
      const c = data.learner.conduct.find(r => r.term === term) || data.learner.conduct[0];
      setConductRatings({ makadiyos: c.makadiyos || '', makatao: c.makatao || '', makakalikasan: c.makakalikasan || '', makabansa: c.makabansa || '' });
    } else if (data?.learner?.conduct) {
      const c = data.learner.conduct;
      setConductRatings({ makadiyos: c.makadiyos || '', makatao: c.makatao || '', makakalikasan: c.makakalikasan || '', makabansa: c.makabansa || '' });
    } else {
      setConductRatings({ makadiyos: '', makatao: '', makakalikasan: '', makabansa: '' });
    }
  }, [data]);

  const saveConduct = useCallback(async () => {
    if (!studentId || !term) return alert('Select a term (Q1–Q4) first.');
    setConductSaving(true);
    try {
      await api('/deped-forms/sf9/conduct', {
        method: 'PUT',
        body: { student_id: Number(studentId), school_year: info.school_year || schoolYear || '', term, ...conductRatings }
      });
      setConductOpen(false);
      const url = `/deped-forms/sf9?student_id=${studentId}`;
      setLoading(true);
      api(url).then(r => { setData(r); setLoading(false); }).catch(err => { setError(err.message); setLoading(false); });
    } catch (e) {
      alert('Error saving conduct: ' + e.message);
    } finally {
      setConductSaving(false);
    }
  }, [studentId, term, conductRatings, info.school_year, schoolYear]);

  const form = FORMS.find(f => f.code === tab);
  const ctx = { sectionId, studentId, month, year, term, sections, students };
  const html = renderForm(tab, data, info, ctx);
  const blankHtml = renderBlankForm(tab, info, ctx);

  return (
    <div>
      <PageHead title="DepEd School Forms (SF1–SF10 + Summary of Grades)" sub="Official DepEd form layouts — view, download PDF, or download blank templates for printing." />
      <ErrorBanner error={error} />

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
        {FORMS.map(f => (
          <button key={f.code} className={`btn ${tab === f.code ? 'btn-primary' : ''}`} style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setTab(f.code)}>
            {f.label}
          </button>
        ))}
      </div>

      {(tab === 'sf1' || tab === 'sf2' || tab === 'sf3' || tab === 'sf4' || tab === 'sf5' || tab === 'sf8' || tab === 'sf9' || tab === 'sog' || tab === 'sas') && (
        <div className="card" style={{ padding: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ fontSize: 13 }}>Section
              <select className="input" style={{ marginLeft: 6, minWidth: 180 }} value={sectionId} onChange={ev => setSectionId(ev.target.value)}>
                <option value="">Select Section</option>
                {sections.map(sec => <option key={sec.id} value={sec.id}>Grade {sec.grade_level} — {sec.name}</option>)}
              </select>
            </label>
            {(tab === 'sf2' || tab === 'sf4') && <>
              <label style={{ fontSize: 13 }}>Month
                <select className="input" style={{ marginLeft: 6 }} value={month} onChange={ev => setMonth(Number(ev.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('en', { month: 'long' })}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 13 }}>Year
                <input type="number" className="input" style={{ marginLeft: 6, width: 80 }} value={year} onChange={ev => setYear(Number(ev.target.value))} />
              </label>
            </>}
            {(tab === 'sf5') && (
              <label style={{ fontSize: 13 }}>Term
                <select className="input" style={{ marginLeft: 6 }} value={term} onChange={ev => setTerm(ev.target.value)}>
                  <option value="">All</option>
                  <option value="Q1">Q1</option><option value="Q2">Q2</option><option value="Q3">Q3</option><option value="Q4">Q4</option>
                  <option value="Final">Final</option>
                </select>
              </label>
            )}
            {(tab === 'sf9' && sectionId) && (
              <label style={{ fontSize: 13 }}>Student
                <select className="input" style={{ marginLeft: 6, minWidth: 200 }} value={studentId} onChange={ev => setStudentId(ev.target.value)}>
                  <option value="">All students in section</option>
                  {students.map(st => <option key={st.id} value={st.id}>{st.last_name}, {st.first_name}</option>)}
                </select>
              </label>
            )}
          </div>
        </div>
      )}

      {(tab === 'sf10') && (
        <div className="card" style={{ padding: 12, marginBottom: 16 }}>
          <label style={{ fontSize: 13 }}>Student
            <select className="input" style={{ marginLeft: 6, minWidth: 280 }} value={studentId} onChange={ev => setStudentId(ev.target.value)}>
              <option value="">Select Student for Permanent Record</option>
              {students.map(st => <option key={st.id} value={st.id}>{st.last_name}, {st.first_name}</option>)}
            </select>
          </label>
        </div>
      )}

      {(tab === 'sid') && (
        <div className="card" style={{ padding: 12, marginBottom: 16 }}>
          <label style={{ fontSize: 13 }}>Student
            <select className="input" style={{ marginLeft: 6, minWidth: 280 }} value={studentId} onChange={ev => setStudentId(ev.target.value)}>
              <option value="">Select Student for ID Card</option>
              {students.map(st => <option key={st.id} value={st.id}>{st.last_name}, {st.first_name}</option>)}
            </select>
          </label>
        </div>
      )}

      {(tab === 'sf7') && (
        <div className="card" style={{ padding: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ fontSize: 13 }}>School Year
              <input className="input" style={{ marginLeft: 6, width: 140 }} value={schoolYear} onChange={ev => setSchoolYear(ev.target.value)} placeholder="2026-2027" />
            </label>
          </div>
        </div>
      )}

      {loading && <Spinner />}
      {!loading && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => form && printForm(form.code, form.title, html, form.orient)}>
            <Printer size={14} /> Download PDF
          </button>
          {tab !== 'sid' && (
            <button className="btn" onClick={() => form && downloadBlankForm(form.code, form.title, blankHtml, form.orient, info)}>
              <Download size={14} /> Download Blank Form
            </button>
          )}
          {tab === 'sf9' && sectionId && !studentId && (
            <button className="btn btn-primary" onClick={() => batchPrintSF9(sectionId, info)}>
              <Printer size={14} /> Print All Report Cards
            </button>
          )}
          {tab === 'sf9' && studentId && (
            <button className="btn" onClick={() => setConductOpen(true)}>
              <Pencil size={14} /> Edit Conduct
            </button>
          )}
        </div>
      )}

      <div className="card" style={{ padding: 16, overflow: 'auto' }}>
        {loading ? null : <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }) }} />}
      </div>

      {conductOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => !conductSaving && setConductOpen(false)}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 420, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Conduct and Values Rating</h3>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#666' }}>
              {term ? `Term: ${term}` : 'Select a term first'} — {info.school_year || schoolYear || 'No school year'}
            </p>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 4px', borderBottom: '2px solid #ddd' }}>Value</th>
                  {['AO', 'SO', 'RO', 'NO'].map(v => (
                    <th key={v} style={{ textAlign: 'center', padding: '6px 4px', borderBottom: '2px solid #ddd' }}>{v}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['makadiyos', 'Maka-Diyos'],
                  ['makatao', 'Maka-Tao'],
                  ['makakalikasan', 'Makakalikasan'],
                  ['makabansa', 'Makabansa']
                ].map(([key, label]) => (
                  <tr key={key}>
                    <td style={{ padding: '6px 4px', borderBottom: '1px solid #eee' }}>{label}</td>
                    {['ao', 'so', 'ro', 'no'].map(v => (
                      <td key={v} style={{ textAlign: 'center', padding: '6px 4px', borderBottom: '1px solid #eee' }}>
                        <input type="radio" name={`conduct-${key}`} value={v} checked={conductRatings[key] === v}
                          onChange={() => setConductRatings(prev => ({ ...prev, [key]: v }))} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn" onClick={() => setConductOpen(false)} disabled={conductSaving}>Cancel</button>
              <button className="btn btn-primary" onClick={saveConduct} disabled={conductSaving || !term}>
                {conductSaving ? 'Saving...' : 'Save Ratings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderForm(tab, data, info, ctx) {
  switch (tab) {
    case 'sf1': return renderSF1(data, info);
    case 'sf2': return renderSF2(data, info, ctx);
    case 'sf3': return renderSF3(data, info);
    case 'sf4': return renderSF4(data, info);
    case 'sf5': return renderSF5(data, info, ctx);
    case 'sf6': return renderSF6(data, info);
    case 'sf7': return renderSF7(data, info);
    case 'sf8': return renderSF8(data, info);
    case 'sf9': return renderSF9(data, info);
    case 'sf10': return renderSF10(data, info);
    case 'sog': return renderSOG(data, info);
    case 'sas': return renderSAS(data, info);
    case 'sid': return renderSID(data, info);
    default: return '<p>Select a form tab above.</p>';
  }
}

function renderBlankForm(tab, info, ctx) {
  switch (tab) {
    case 'sf1': return renderSF1Blank(info, ctx);
    case 'sf2': return renderSF2Blank(info, ctx);
    case 'sf3': return renderSF3Blank(info);
    case 'sf4': return renderSF4Blank(info);
    case 'sf5': return renderSF5Blank(info);
    case 'sf6': return renderSF6Blank(info);
    case 'sf7': return renderSF7Blank(info);
    case 'sf8': return renderSF8Blank(info);
    case 'sf9': return renderSF9Blank(info);
    case 'sf10': return renderSF10Blank(info);
    case 'sog': return renderSOGBlank(info, ctx);
    case 'sas': return '<p>Select a section to generate the attendance summary.</p>';
    case 'sid': return '<p>Select a student to generate their ID card.</p>';
    default: return '<p>Select a form.</p>';
  }
}

/* ── SF1: School Register ─────────────────────────────────── */

function renderSF1(data, info) {
  const students = data?.students || [];
  const sec = data?.section;
  return `
${formHeaderHtml(info, 'sf1', 'School Form 1 (SF1) — School Register')}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${esc(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School Year:</strong> ${esc(info.school_year || '____-____')}</td></tr>
  <tr><td style="border:none"><strong>Grade Level:</strong> ${sec ? esc(String(sec.grade_level)) : '____'}</td>
      <td style="border:none"><strong>Section:</strong> ${sec ? esc(sec.name) : '____'}</td></tr>
</table>
<div class="small" style="margin-bottom:4pt;"><em>BoSY Date: ____________ &nbsp; EoSY Date: ____________</em></div>
<table style="font-size:7pt;">
<thead><tr>
  <th rowspan="2" style="width:25pt">LRN</th>
  <th rowspan="2" style="min-width:100pt">Name (Last, First, Middle)</th>
  <th rowspan="2" style="width:14pt">Sex<br/>(M/F)</th>
  <th rowspan="2" style="width:35pt">Birthdate<br/>(mm/dd/yy)</th>
  <th rowspan="2" style="width:14pt">Age</th>
  <th rowspan="2" style="width:25pt">Mother<br/>Tongue</th>
  <th rowspan="2" style="width:14pt">IP</th>
  <th rowspan="2" style="width:25pt">Learner<br/>Status</th>
  <th rowspan="2" style="width:25pt">Learner<br/>Type</th>
  <th rowspan="2" style="width:50pt">Address</th>
  <th colspan="3" style="width:80pt">Name of Parents</th>
  <th rowspan="2" style="width:35pt">Contact<br/>Number</th>
  <th rowspan="2" style="width:25pt">Remarks</th>
</tr><tr>
  <th style="width:40pt;font-size:6pt">Father</th>
  <th style="width:40pt;font-size:6pt">Mother (Maiden)</th>
  <th style="width:40pt;font-size:6pt">Guardian</th>
</tr></thead>
<tbody>
${students.length ? students.map(st => `<tr>
  <td class="c">${esc(st.lrn || '')}</td>
  <td class="small">${esc(st.last_name)}, ${esc(st.first_name)}${st.extension_name ? ', ' + esc(st.extension_name) : ''}, ${esc(st.middle_name || '')}</td>
  <td class="c">${esc(st.sex || '')}</td>
  <td class="c">${esc(st.birthdate || '')}</td>
  <td class="c">${esc(String(st.age || ''))}</td>
  <td>${esc(st.mother_tongue || '')}</td>
  <td class="c">${esc(st.indigenous_people || '')}</td>
  <td class="c">${esc(st.learner_status || '')}</td>
  <td class="c">${esc(st.learner_type || 'Regular')}</td>
  <td class="small">${esc(st.address || '')}</td>
  <td class="small">${esc(st.father_name || '')}</td>
  <td class="small">${esc(st.mother_name || '')}</td>
  <td class="small">${esc(st.guardian_name || '')}</td>
  <td class="c">${esc(st.contact_number || st.parent_contact || '')}</td>
  <td class="c">${esc(st.remarks || '')}</td>
</tr>`).join('') : blankRows(30, 15)}
</tbody></table>
<div class="small" style="margin:6pt 0;"><strong>Legend:</strong> T/O=Transferred Out, T/I=Transferred In, B/A=Balik-Aral, DRP=Dropped, LWD=Learner with Disability, LE=Late Enrollment, ACL=Accelerated, CCT=CCT Recipient<br/>
<strong>Learner Status:</strong> New, Old, Transferee, Balik-Aral &nbsp;|&nbsp; <strong>Learner Type:</strong> Regular, Irregular, SPED, ALS</div>
${signatureBlockHtml(sec?.adviser_name, 'Class Adviser', '', 'School Head')}`;
}

function renderSF1Blank(info, ctx) {
  const sec = (ctx.sections || []).find(s => String(s.id) === String(ctx.sectionId));
  return `
${formHeaderHtml(info, 'sf1', 'School Form 1 (SF1) — School Register')}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${esc(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School Year:</strong> ${esc(info.school_year || '____-____')}</td></tr>
  <tr><td style="border:none"><strong>Grade Level:</strong> ${sec ? esc(String(sec.grade_level)) : '____'}</td>
      <td style="border:none"><strong>Section:</strong> ${sec ? esc(sec.name) : '____'}</td></tr>
</table>
<div class="small" style="margin-bottom:4pt;"><em>BoSY Date: ____________ &nbsp; EoSY Date: ____________</em></div>
<table style="font-size:7pt;">
<thead><tr>
  <th rowspan="2" style="width:25pt">LRN</th>
  <th rowspan="2" style="min-width:100pt">Name (Last, First, Middle)</th>
  <th rowspan="2" style="width:14pt">Sex<br/>(M/F)</th>
  <th rowspan="2" style="width:35pt">Birthdate<br/>(mm/dd/yy)</th>
  <th rowspan="2" style="width:14pt">Age</th>
  <th rowspan="2" style="width:25pt">Mother<br/>Tongue</th>
  <th rowspan="2" style="width:14pt">IP</th>
  <th rowspan="2" style="width:25pt">Learner<br/>Status</th>
  <th rowspan="2" style="width:25pt">Learner<br/>Type</th>
  <th rowspan="2" style="width:50pt">Address</th>
  <th colspan="3" style="width:80pt">Name of Parents</th>
  <th rowspan="2" style="width:35pt">Contact<br/>Number</th>
  <th rowspan="2" style="width:25pt">Remarks</th>
</tr><tr>
  <th style="width:40pt;font-size:6pt">Father</th>
  <th style="width:40pt;font-size:6pt">Mother (Maiden)</th>
  <th style="width:40pt;font-size:6pt">Guardian</th>
</tr></thead>
<tbody>${blankRows(30, 15)}</tbody></table>
<div class="small" style="margin:6pt 0;"><strong>Legend:</strong> T/O, T/I, B/A, DRP, LWD, LE, ACL, CCT<br/>
<strong>Learner Status:</strong> New, Old, Transferee, Balik-Aral &nbsp;|&nbsp; <strong>Learner Type:</strong> Regular, Irregular, SPED, ALS</div>
${signatureBlockHtml('', 'Class Adviser', '', 'School Head')}`;
}

/* ── SF2: Daily Attendance ─────────────────────────────────── */

function renderSF2(data, info, ctx) {
  const students = data?.students || [];
  const att = data?.attendance || [];
  const m = data?.month || new Date().getMonth() + 1;
  const y = data?.year || new Date().getFullYear();
  const daysInMonth = new Date(y, m, 0).getDate();
  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const sym = s => s === 'present' ? '/' : s === 'late' ? 'L' : s === 'half_day' ? 'HD' : 'O';
  const hasSession = att.some(a => a.session === 'AM' || a.session === 'PM');
  const attMap = { AM: {}, PM: {}, ALL: {} };
  for (const row of att) {
    const d = new Date(row.date).getDate();
    const sess = row.session || 'ALL';
    if (!attMap[sess]) attMap[sess] = {};
    if (!attMap[sess][row.student_id]) attMap[sess][row.student_id] = {};
    attMap[sess][row.student_id][d] = sym(row.status);
  }
  const monthName = new Date(y, m - 1).toLocaleString('en', { month: 'long' });
  const sec = (ctx?.sections || []).find(s => String(s.id) === String(ctx?.sectionId));
  const rows = [];
  for (const st of students) {
    if (hasSession) {
      for (const sess of ['AM', 'PM']) {
        const src = attMap[sess][st.id] || attMap['ALL'][st.id] || {};
        const totalAbsent = dayHeaders.filter(d => src[d] === 'O').length;
        const totalTardy = dayHeaders.filter(d => src[d] === 'L').length;
        rows.push(`<tr>
          <td class="small" style="white-space:nowrap">${esc(st.last_name)}, ${esc(st.first_name)} <em style="font-size:6pt;color:#888">(${sess})</em></td>
          ${dayHeaders.map(d => `<td class="c">${src[d] || ''}</td>`).join('')}
          <td class="c">${totalTardy || ''}</td>
          <td class="c">${totalAbsent || ''}</td>
          <td></td>
        </tr>`);
      }
    } else {
      const src = attMap['ALL'][st.id] || {};
      const totalAbsent = dayHeaders.filter(d => src[d] === 'O').length;
      const totalTardy = dayHeaders.filter(d => src[d] === 'L').length;
      rows.push(`<tr>
        <td class="small">${esc(st.last_name)}, ${esc(st.first_name)}</td>
        ${dayHeaders.map(d => `<td class="c">${src[d] || ''}</td>`).join('')}
        <td class="c">${totalTardy || ''}</td>
        <td class="c">${totalAbsent || ''}</td>
        <td></td>
      </tr>`);
    }
  }
  return `
${formHeaderHtml(info, 'sf2', 'School Form 2 (SF2) \u2014 Daily Attendance Report of Learners')}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${esc(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>Month:</strong> ${monthName} ${y}</td></tr>
  <tr><td style="border:none"><strong>Grade Level:</strong> ${sec ? esc(String(sec.grade_level)) : '____'}</td><td style="border:none"><strong>Section:</strong> ${sec ? esc(sec.name) : '____'}</td></tr>
</table>
<div class="small" style="margin-bottom:4pt;"><em>Legend: / = Present, O = Absent, L = Late, HD = Half Day${hasSession ? ' | AM = Morning, PM = Afternoon' : ''}</em></div>
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
${rows.length ? rows.join('') : blankRows(30, daysInMonth + 4)}
</tbody></table></div>
${signatureBlockHtml(sec?.adviser_name || '', 'Class Adviser', '', 'School Head')}`;
}

function renderSF2Blank(info) {
  const dayHeaders = Array.from({ length: 31 }, (_, i) => i + 1);
  return `
${formHeaderHtml(info, 'sf2', 'School Form 2 (SF2) — Daily Attendance Report of Learners')}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${esc(info.school_name)}</td>
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
<tbody>${blankRows(30, 35)}</tbody></table></div>
${signatureBlockHtml('', 'Class Adviser', '', 'School Head')}`;
}

/* ── SF3: Books Issued & Returned ─────────────────────────── */

function renderSF3(data, info) {
  const students = data?.students || [];
  const books = data?.books || [];
  const sec = (data?.section) || null;
  return `
${formHeaderHtml(info, 'sf3', 'School Form 3 (SF3) — Books Issued and Returned')}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${esc(info?.school_name || 'Hinabangan National High School')}</td>
      <td style="border:none;width:50%"><strong>School Year:</strong> ${esc(info.school_year || '____-____')}</td></tr>
  <tr><td style="border:none"><strong>Grade Level:</strong> ${sec ? esc(String(sec.grade_level)) : '____'}</td>
      <td style="border:none"><strong>Section:</strong> ${sec ? esc(sec.name) : '____'}</td></tr>
</table>
<table style="font-size:7pt;">
<thead><tr>
  <th style="width:25pt">LRN</th><th style="min-width:70pt">Name</th>
  <th style="min-width:70pt">Title of Textbook</th><th style="width:30pt">Date Issued</th>
  <th style="width:30pt">Date Returned</th><th style="width:25pt">Condition</th>
  <th style="width:20pt">Code</th><th style="width:25pt">Action</th>
  <th style="width:15pt">M</th><th style="width:15pt">F</th><th style="width:20pt">Total</th>
</tr></thead>
<tbody>
${students.length ? students.map(st => {
  const stBooks = books.filter(b => b.borrower_id === st.id);
  if (stBooks.length === 0) {
    return `<tr>
      <td>${esc(st.lrn || '')}</td>
      <td class="small">${esc(st.last_name)}, ${esc(st.first_name)}</td>
      <td></td><td></td><td></td><td></td><td></td><td></td>
      <td class="c"></td><td class="c"></td><td class="c"></td>
    </tr>`;
  }
  return stBooks.map(b => {
    const condition = b.status === 'returned' ? 'Good' : b.status === 'overdue' ? 'Overdue' : 'Issued';
    return `<tr>
      <td>${esc(st.lrn || '')}</td>
      <td class="small">${esc(st.last_name)}, ${esc(st.first_name)}</td>
      <td class="small">${esc(b.book_title || '')}</td>
      <td class="c">${esc(b.borrow_date || '')}</td>
      <td class="c">${esc(b.returned_date || '')}</td>
      <td class="c">${esc(condition)}</td>
      <td class="c">${esc(b.isbn || '')}</td>
      <td class="c">${b.status === 'returned' ? 'Returned' : 'Issued'}</td>
      <td class="c">${esc(st.sex === 'M' || st.sex === 'Male' ? '\u2713' : '')}</td>
      <td class="c">${esc(st.sex === 'F' || st.sex === 'Female' ? '\u2713' : '')}</td>
      <td class="c">1</td>
    </tr>`;
  }).join('');
}).join('') : blankRows(30, 11)}
</tbody></table>
<div class="small" style="margin:6pt 0;"><strong>Legend:</strong> FM=Force Majeure, TDO=Transferred/Dropped Out, NEG=Negligence &nbsp; | &nbsp; LLTR=Letter from Learner, TLTR=Teacher Letter, PTL=Paid by Learner</div>
${signatureBlockHtml('', 'Class Adviser / Teacher', '', 'School Head')}`;
}

function renderSF3Blank(info) { return renderSF3(null, info); }

/* ── SF4: Monthly Learner Movement ─────────────────────────── */

function renderSF4(data, info) {
  const sec = data?.section || null;
  const m = data?.month || new Date().getMonth() + 1;
  const y = data?.year || new Date().getFullYear();
  const monthName = new Date(y, m - 1).toLocaleString('en', { month: 'long' });
  const enrolledCount = data?.enrolledCount || 0;
  const maleCount = data?.maleCount || 0;
  const femaleCount = data?.femaleCount || 0;
  const totalDaysPresent = data?.totalDaysPresent || 0;
  const totalDaysAbsent = data?.totalDaysAbsent || 0;
  const movements = data?.movements || [];
  const transferredIn = movements.filter(mv => mv.status === 'enrolled' && mv.enrollment_type === 'new').length;
  const transferredOut = movements.filter(mv => mv.status === 'transferred_out').length;
  const droppedOut = movements.filter(mv => mv.status === 'dropped').length;
  const balikAral = movements.filter(mv => mv.status === 'balik_aral').length;
  return `
${formHeaderHtml(info, 'sf4', "School Form 4 (SF4) \u2014 Monthly Learner's Movement and Attendance")}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${esc(info?.school_name || 'Hinabangan National High School')}</td>
      <td style="border:none;width:50%"><strong>School Year:</strong> ${esc(info.school_year || '____-____')}</td></tr>
  <tr><td style="border:none"><strong>Grade Level:</strong> ${sec ? esc(String(sec.grade_level)) : '____'}</td>
      <td style="border:none"><strong>Section:</strong> ${sec ? esc(sec.name) : '____'}</td></tr>
  <tr><td style="border:none"><strong>Curriculum:</strong> K to 12 BEC / MATATAG</td><td style="border:none"><strong>Month:</strong> ${monthName} ${y}</td></tr>
</table>
<table style="font-size:8pt;">
<thead><tr>
  <th style="min-width:50pt">Indicator</th><th style="width:20pt">Code</th>
  <th style="min-width:40pt">Male</th><th style="min-width:40pt">Female</th><th style="min-width:40pt">Total</th>
</tr></thead>
<tbody>
  <tr><td>Enrolment as of 1st Friday of June</td><td class="c"></td><td class="c"></td><td class="c"></td><td class="c">${enrolledCount || ''}</td></tr>
  <tr><td>Late Enrollees (within the month)</td><td class="c">LE</td><td class="c"></td><td class="c"></td><td class="c"></td></tr>
  <tr><td>Registered Learners as of end of month</td><td class="c"></td><td class="c">${maleCount}</td><td class="c">${femaleCount}</td><td class="c">${enrolledCount}</td></tr>
  <tr><td>Transferred In</td><td class="c">T/I</td><td class="c"></td><td class="c"></td><td class="c">${transferredIn || ''}</td></tr>
  <tr><td>Transferred Out</td><td class="c">T/O</td><td class="c"></td><td class="c"></td><td class="c">${transferredOut || ''}</td></tr>
  <tr><td>Dropped Out</td><td class="c">DRP</td><td class="c"></td><td class="c"></td><td class="c">${droppedOut || ''}</td></tr>
  <tr><td>Balik-Aral</td><td class="c">B/A</td><td class="c"></td><td class="c"></td><td class="c">${balikAral || ''}</td></tr>
  <tr><td>Archived</td><td class="c">ARC</td><td class="c"></td><td class="c"></td><td class="c"></td></tr>
  <tr><td>Accelerated</td><td class="c">ACL</td><td class="c"></td><td class="c"></td><td class="c"></td></tr>
  <tr><td>Learners with Disability</td><td class="c">LWD</td><td class="c"></td><td class="c"></td><td class="c"></td></tr>
  <tr><td><strong>TOTAL</strong></td><td class="c"></td><td class="c"><strong>${maleCount}</strong></td><td class="c"><strong>${femaleCount}</strong></td><td class="c"><strong>${enrolledCount}</strong></td></tr>
</tbody></table>
<div class="small" style="margin:8pt 0;">
  <strong>Monthly Attendance:</strong> Total School Days: ${totalDaysPresent + totalDaysAbsent} &nbsp;|&nbsp; Days Present: ${totalDaysPresent} &nbsp;|&nbsp; Days Absent: ${totalDaysAbsent}
</div>
<div class="small" style="margin:6pt 0;"><strong>Remarks:</strong> ________________________________________________</div>
${signatureBlockHtml(sec?.adviser_name || '', 'Class Adviser', '', 'School Head')}`;
}

function renderSF4Blank(info) { return renderSF4(null, info); }

/* ── SF5: Report on Promotion ─────────────────────────────── */

function renderSF5(data, info, ctx) {
  const students = data?.students || [];
  const subjects = data?.subjects || [];
  const grades = data?.grades || [];
  const gradeMap = {};
  for (const g of grades) { gradeMap[`${g.student_id}_${g.subject_id}`] = g; }
  const sec = data?.section || (ctx?.sections || []).find(s => String(s.id) === String(ctx?.sectionId));
  return `
${formHeaderHtml(info, 'sf5', 'School Form 5 (SF5) — Report on Promotion and Level of Proficiency')}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${esc(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School Year:</strong> ${esc(info.school_year || '____-____')}</td></tr>
  <tr><td style="border:none"><strong>Grade Level:</strong> ${sec ? esc(String(sec.grade_level)) : '____'}</td>
      <td style="border:none"><strong>Section:</strong> ${sec ? esc(sec.name) : '____'}</td></tr>
  <tr><td style="border:none"><strong>Curriculum:</strong> K to 12 BEC / MATATAG</td><td style="border:none"></td></tr>
</table>
<table style="font-size:7pt;">
<thead><tr>
  <th style="width:25pt">LRN</th><th style="min-width:80pt">Name (LN, FN, MN)</th><th style="width:18pt">Sex</th>
  ${subjects.map(sub => `<th style="min-width:50pt">${esc(sub.title || sub.name)}</th>`).join('')}
  <th style="min-width:30pt">Gen. Avg.</th><th style="min-width:35pt">Remarks</th>
</tr></thead>
<tbody>
${students.length ? students.map(st => {
  const rowGrades = subjects.map(sub => gradeMap[`${st.id}_${sub.id}`] || {});
  const avg = rowGrades.reduce((sum, g) => sum + (Number(g.computed_grade) || 0), 0) / (subjects.length || 1);
  const avgVal = avg || avg === 0 ? avg.toFixed(1) : '';
  const remark = avg >= 75 ? 'Promoted' : avg >= 60 ? 'Cond. Promoted' : avg > 0 ? 'Retained' : '';
  return `<tr>
    <td class="c">${esc(st.lrn || '')}</td>
    <td>${esc(st.last_name)}, ${esc(st.first_name)}${st.extension_name ? ', ' + esc(st.extension_name) : ''}, ${esc(st.middle_name || '')}</td>
    <td class="c">${esc(st.sex || '')}</td>
    ${rowGrades.map(g => `<td class="c">${g.computed_grade != null ? Number(g.computed_grade).toFixed(1) : ''}</td>`).join('')}
    <td class="c"><strong>${avgVal}</strong></td>
    <td class="c small">${remark}</td>
  </tr>`;
}).join('') : blankRows(30, subjects.length + 5)}
</tbody></table>
<div class="small" style="margin:6pt 0;">
  <strong>Remarks:</strong> Promoted (&#8805;75) | Conditionally Promoted (60-74) | Retained (&lt;60)
</div>
${signatureBlockHtml('', 'Class Adviser', '', 'School Head')}`;
}

function renderSF5Blank(info) { return renderSF5(null, info); }

/* ── SF6: Summarized Promotion ─────────────────────────────── */

function renderSF6(data, info) {
  const rows = Array.isArray(data) ? data : [];
  return `
${formHeaderHtml(info, 'sf6', 'School Form 6 (SF6) — Summarized Report on Promotion and Level of Proficiency')}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${esc(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School Year:</strong> ${esc(info.school_year || '____-____')}</td></tr>
  <tr><td style="border:none"><strong>Curriculum:</strong> K to 12 BEC / MATATAG</td><td style="border:none"></td></tr>
</table>
<table>
<thead><tr>
  <th style="min-width:60pt">Grade Level / Section</th>
  <th style="width:30pt">Enrolled</th><th style="width:30pt">Promoted</th>
  <th style="width:30pt">Conditional</th><th style="width:30pt">Retained</th>
  <th style="width:30pt">T/O</th><th style="width:30pt">DRP</th>
  <th style="width:30pt">LWD</th><th style="width:30pt">ACL</th>
  <th style="width:30pt">Total</th>
</tr></thead>
<tbody>
${rows.length ? rows.map(r => {
  const total = Number(r.promotion?.promoted || 0) + Number(r.promotion?.conditional || 0) + Number(r.promotion?.retained || 0);
  return `<tr>
    <td>${esc(r.section?.grade_level)} — ${esc(r.section?.name)}</td>
    <td class="c">${r.enrolled || 0}</td>
    <td class="c">${r.promotion?.promoted || 0}</td>
    <td class="c">${r.promotion?.conditional || 0}</td>
    <td class="c">${r.promotion?.retained || 0}</td>
    <td class="c">${r.transferred_out || 0}</td>
    <td class="c">${r.dropped || 0}</td>
    <td class="c">${r.lwd_count || 0}</td>
    <td class="c"></td>
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
${formHeaderHtml(info, 'sf7', 'School Form 7 (SF7) — School Personnel Assignment List and Basic Profile')}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${esc(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School Year:</strong> ${esc(info.school_year || '____-____')}</td></tr>
</table>
<table style="font-size:7pt;">
<thead><tr>
  <th style="width:20pt">Emp.<br/>No.</th>
  <th style="width:25pt">#</th><th style="min-width:80pt">Name</th>
  <th style="min-width:50pt">Position</th><th style="width:35pt">Employment<br/>Status</th>
  <th style="min-width:50pt">Area of<br/>Specialization</th><th style="min-width:80pt">Subjects Taught</th>
  <th style="min-width:50pt">Advisory Class</th><th style="min-width:50pt">Daily Program</th>
  <th style="width:30pt">Avg. Min/Day</th><th style="min-width:40pt">Remarks</th>
</tr></thead>
<tbody>
${teachers.length ? teachers.map((t, idx) => {
  const asgn = assignments[t.id] || [];
  return `<tr>
    <td class="c">${esc(t.employee_no || '')}</td>
    <td class="c">${idx + 1}</td>
    <td>${esc(t.user_name || [t.last_name, t.first_name, t.middle_name].filter(Boolean).join(', ') || '')}</td>
    <td>${esc(t.position || '')}</td>
    <td>${esc(t.status || '')}</td>
    <td>${esc(t.specialization || '')}</td>
    <td class="small">${asgn.map(a => esc(a.subject_name)).join(', ')}</td>
    <td>${esc(t.advisory_class || '')}</td>
    <td class="small">${asgn.map(a => `${esc(a.room || '')}${a.meetings_per_week ? ' (' + a.meetings_per_week + 'x/wk)' : ''}`).join('<br/>')}</td>
    <td class="c">${asgn.reduce((sum, a) => sum + Number(a.minutes_per_day || 0), 0) || ''}</td>
    <td></td>
  </tr>`;
}).join('') : blankRows(20, 11)}
</tbody></table>
${signatureBlockHtml('', 'School Head', '', 'HR Officer')}`;
}

function renderSF7Blank(info) { return renderSF7(null, info); }

/* ── SF8: Health & Nutrition ─────────────────────────────── */

function renderSF8(data, info) {
  const students = data?.students || [];
  const section = data?.section;
  const sy = info.school_year || '____-____';
  function whoBmiStatus(bmi, age) {
    if (!bmi) return '';
    const b = Number(bmi);
    if (b < 18.5) return 'UW';
    if (b < 25) return 'N';
    if (b < 30) return 'OW';
    return 'OB';
  }
  return `
${formHeaderHtml(info, 'sf8', "School Form 8 (SF8) — Learner's Basic Health and Nutrition Report")}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${esc(info?.school_name || 'Hinabangan National High School')}</td>
      <td style="border:none;width:50%"><strong>School Year:</strong> ${esc(sy)}</td></tr>
  <tr><td style="border:none"><strong>Grade Level:</strong> ${section ? esc(section.grade_level) : '____'}</td>
      <td style="border:none"><strong>Section:</strong> ${section ? esc(section.name) : '____'}</td></tr>
</table>
<table style="font-size:7pt;">
<thead><tr>
  <th style="width:25pt">LRN</th><th style="min-width:70pt">Name (LN, FN, MN)</th><th style="width:14pt">Sex</th>
  <th style="width:18pt">Age</th>
  <th style="width:30pt">Height<br/>(cm)</th><th style="width:30pt">Weight<br/>(kg)</th>
  <th style="width:25pt">BMI</th><th style="width:30pt">Nutritional<br/>Status</th>
  <th style="width:40pt">Home Address</th>
  <th style="width:25pt">CCT</th>
</tr></thead>
<tbody>
${students.length ? students.map(s => {
  const bmi = s.bmi != null ? Number(s.bmi).toFixed(1) : (s.height_cm && s.weight_kg ? (s.weight_kg / ((s.height_cm / 100) ** 2)).toFixed(1) : '');
  let status = s.nutritional_status || '';
  if (!status && bmi) status = whoBmiStatus(bmi, s.age);
  const statusLabel = { UW: 'Underweight', N: 'Normal', OW: 'Overweight', OB: 'Obese' }[status] || status;
  return `<tr>
    <td>${esc(s.lrn || '')}</td>
    <td class="small">${esc(s.last_name)}, ${esc(s.first_name)}${s.middle_name ? ', ' + esc(s.middle_name) : ''}</td>
    <td class="c">${esc(s.sex || '')}</td>
    <td class="c">${esc(String(s.age || ''))}</td>
    <td class="c">${s.height_cm != null ? Number(s.height_cm).toFixed(1) : ''}</td>
    <td class="c">${s.weight_kg != null ? Number(s.weight_kg).toFixed(1) : ''}</td>
    <td class="c"><strong>${bmi}</strong></td>
    <td class="c">${esc(statusLabel)}</td>
    <td class="small">${esc(s.address || '')}</td>
    <td class="c">${s.cct ? '\u2713' : ''}</td>
  </tr>`;
}).join('') : blankRows(30, 10)}
</tbody></table>
<div class="small" style="margin:6pt 0;">
  <strong>Nutritional Status (WHO BMI-for-age 10-19):</strong> UW=Underweight | N=Normal Weight | OW=Overweight | OB=Obese<br/>
  <strong>BMI Categories:</strong> Underweight (&lt;18.5) | Normal (18.5-24.9) | Overweight (25-29.9) | Obese (&#8805;30)
</div>
${signatureBlockHtml('', 'Class Adviser / School Nurse', '', 'School Head')}`;
}

function renderSF8Blank(info) { return renderSF8(null, info); }

/* ── SF9: Report Card ─────────────────────────────────────── */

const MONTH_NAMES = ['JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER','JANUARY','FEBRUARY','MARCH','APRIL'];
const MONTH_NUMS = [6,7,8,9,10,11,12,1,2,3,4];
const TERM_MAP = {1:'First Term',2:'Second Term',3:'Third Term'};
const CORE_VALUES = [
  { key:'makadiyos', label:'Maka-Diyos', behaviors:['Expresses one\'s spiritual beliefs that inspire action for the common good.','Shows adherence to ethical principles and moral courage in daily life.'] },
  { key:'makatao', label:'Makatao', behaviors:['Is sensitive to individual, social, and cultural differences and respects the dignity of each person.','Demonstrates contributions toward solidarity and unity among people.'] },
  { key:'makakalikasan', label:'Makakalikasan', behaviors:['Cares for the environment and utilizes resources wisely and sustainably.'] },
  { key:'makabansa', label:'Makabansa', behaviors:['Demonstrates pride in being a Filipino and promotes national identity.','Demonstrates appropriate behavior in carrying out civic duties and responsibilities.'] }
];

function renderSF9(data, info) {
  if (data?.learner) {
    const learner = data.learner;
    return renderSF9Card(learner.student, learner.enrollment, learner.grades || [], learner.monthlyAttendance || [], info.school_year || '____-____', info, learner.conduct || []);
  }
  if (data?.learners) {
    return data.learners.map((lr, idx) => {
      return `<div style="margin-bottom:12pt;"><em style="font-size:9pt;color:#666;">Learner ${idx + 1}: ${esc(lr.last_name)}, ${esc(lr.first_name)} — select individual student to view full report card.</em></div>`;
    }).join('') || '<p>Select a student or section to populate the report card.</p>';
  }
  return '<p>Select a student or section to populate the report card.</p>';
}


function renderSF9Card(stud, enrollment, grades, monthlyAttendance, sy, info, conduct) {
  const gradeLevel = enrollment ? esc(String(enrollment.grade_level)) : '____';
  const sectionName = enrollment ? esc(enrollment.section_name) : '____';
  const trackCluster = enrollment ? esc(enrollment.track || enrollment.strand || '') : '';
  const principalName = esc(info.school_head_name || '');

  const gradesByQuarter = {};
  for (const g of grades) {
    const q = g.quarter || 0;
    if (!gradesByQuarter[q]) gradesByQuarter[q] = [];
    gradesByQuarter[q].push(g);
  }
  const availableTerms = Object.keys(gradesByQuarter).filter(q => q > 0).sort((a,b) => a - b);

  const attByMonth = {};
  for (const a of (monthlyAttendance || [])) {
    const m = Number(a.month);
    attByMonth[m] = { total_days: Number(a.total_days) || 0, days_present: Number(a.days_present) || 0, days_absent: Number(a.days_absent) || 0 };
  }
  const totalDays = Object.values(attByMonth).reduce((s, a) => s + a.total_days, 0);
  const totalPresent = Object.values(attByMonth).reduce((s, a) => s + a.days_present, 0);
  const totalAbsent = Object.values(attByMonth).reduce((s, a) => s + a.days_absent, 0);

  const conductByTerm = {};
  const conductArr = Array.isArray(conduct) ? conduct : conduct ? [conduct] : [];
  for (const c of conductArr) {
    const t = c.term ? c.term.replace(/[^0-9]/g, '') : '';
    if (t) conductByTerm[t] = c;
  }

  function gradesTableHtml(termNum, termGrades) {
    const regular = termGrades.filter(g => !/araling panlipunan/i.test(g.subject_name || ''));
    const special = termGrades.filter(g => /araling panlipunan/i.test(g.subject_name || ''));
    const allSubjects = [];
    for (const g of regular) allSubjects.push(g);
    let hasSpecial = false;
    for (const g of special) {
      if (!hasSpecial) { allSubjects.push({ _subheader: 'Applied and Specialized Subjects' }); hasSpecial = true; }
      allSubjects.push(g);
    }
    const genAvg = termGrades.length ? (termGrades.reduce((s, g) => s + (Number(g.computed_grade) || 0), 0) / termGrades.length).toFixed(1) : '';
    return `
    <div style="font-size:8pt;font-weight:bold;margin:3pt 0 2pt;">${TERM_MAP[termNum] || 'Term ' + termNum}</div>
    <table style="font-size:7.5pt;width:100%;">
    <thead><tr>
      <th style="text-align:left;min-width:120pt;padding:2pt 3pt;font-size:7.5pt;">Subject</th>
      <th style="width:35pt;padding:2pt 3pt;font-size:7.5pt;">Grade</th>
      <th style="width:40pt;padding:2pt 3pt;font-size:7.5pt;">Remarks</th>
    </tr></thead>
    <tbody>
    ${allSubjects.length ? allSubjects.map(g => {
      if (g._subheader) return `<tr><td colspan="3" style="font-weight:bold;padding:2pt 3pt;border-top:1px solid #000;border-bottom:1px solid #000;font-size:7.5pt;">${esc(g._subheader)}</td></tr>`;
      const finalGrade = Number(g.computed_grade) || 0;
      const remark = finalGrade >= 75 ? 'Passed' : finalGrade > 0 ? 'Failed' : '';
      return `<tr>
        <td style="padding:1.5pt 3pt;">${esc(g.subject_name)}</td>
        <td class="c" style="padding:1.5pt 3pt;"><strong>${finalGrade ? finalGrade.toFixed(1) : ''}</strong></td>
        <td class="c" style="padding:1.5pt 3pt;">${remark}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="3" class="c" style="padding:4pt;">&nbsp;</td></tr>'}
    <tr style="font-style:italic;">
      <td style="padding:2pt 3pt;border-top:1.5px solid #000;">General Average for the Term</td>
      <td class="c" style="padding:2pt 3pt;border-top:1.5px solid #000;"><strong>${genAvg}</strong></td>
      <td class="c" style="padding:2pt 3pt;border-top:1.5px solid #000;">${genAvg && Number(genAvg) >= 75 ? 'Passed' : genAvg ? 'Failed' : ''}</td>
    </tr>
    </tbody></table>`;
  }

  const front = `
<div class="sf9-page" style="display:flex;gap:0;height:100%;">

  <!-- PAGE 1 LEFT: ATTENDANCE RECORD -->
  <div style="flex:0 0 48%;border-right:1px solid #999;padding:0 8pt 0 0;">
    <div style="text-align:center;font-weight:bold;font-size:9pt;margin-bottom:4pt;text-decoration:underline;">ATTENDANCE RECORD</div>
    <table style="font-size:7.5pt;width:100%;">
    <thead><tr>
      <th style="width:30pt;padding:2pt;font-size:7pt;writing-mode:vertical-lr;text-orientation:mixed;">&nbsp;</th>
      ${MONTH_NAMES.map(m => `<th style="width:18pt;padding:1.5pt;font-size:6.5pt;writing-mode:vertical-lr;text-orientation:mixed;">${m}</th>`).join('')}
      <th style="width:20pt;padding:1.5pt;font-size:7pt;font-weight:bold;">TOTAL</th>
    </tr></thead>
    <tbody>
      <tr><td style="padding:2pt;font-size:7pt;font-weight:bold;">No. of School Days</td>${MONTH_NUMS.map(m => `<td class="c" style="padding:1.5pt;">${attByMonth[m]?.total_days || ''}</td>`).join('')}<td class="c" style="padding:1.5pt;font-weight:bold;">${totalDays || ''}</td></tr>
      <tr><td style="padding:2pt;font-size:7pt;font-weight:bold;">No. of Days Present</td>${MONTH_NUMS.map(m => `<td class="c" style="padding:1.5pt;">${attByMonth[m]?.days_present || ''}</td>`).join('')}<td class="c" style="padding:1.5pt;font-weight:bold;">${totalPresent || ''}</td></tr>
      <tr><td style="padding:2pt;font-size:7pt;font-weight:bold;">No. of Days Absent</td>${MONTH_NUMS.map(m => `<td class="c" style="padding:1.5pt;">${attByMonth[m]?.days_absent || ''}</td>`).join('')}<td class="c" style="padding:1.5pt;font-weight:bold;">${totalAbsent || ''}</td></tr>
    </tbody></table>

    <div style="margin-top:10pt;font-size:8pt;font-weight:bold;">PARENT / GUARDIAN'S SIGNATURE OVER LEARNER'S PROGRESS REPORT CARD</div>
    <div style="margin-top:6pt;font-size:7.5pt;">1st Term ___________________________________</div>
    <div style="margin-top:4pt;font-size:7.5pt;">2nd Term ___________________________________</div>
    <div style="margin-top:4pt;font-size:7.5pt;">3rd Term ___________________________________</div>

    <div style="margin-top:14pt;font-size:8pt;font-weight:bold;text-decoration:underline;">Certificate of Transfer</div>
    <div style="margin-top:4pt;font-size:7.5pt;line-height:1.6;">
      Admitted to Grade: ____ Section: ____________<br/>
      Eligibility for Admission to Grade: ____________
    </div>
    <div style="margin-top:4pt;font-size:7.5pt;">Approved:</div>
    <div style="display:flex;gap:20pt;margin-top:10pt;font-size:7.5pt;">
      <div style="text-align:center;flex:1;">________________________________<br/>Principal</div>
      <div style="text-align:center;flex:1;">________________________________<br/>Teacher</div>
    </div>

    <div style="margin-top:14pt;font-size:8pt;font-weight:bold;text-decoration:underline;">Cancellation of Eligibility to Transfer</div>
    <div style="margin-top:4pt;font-size:7.5pt;">
      Admitted in: ________________________________<br/>
      Date: ____________________
    </div>
    <div style="margin-top:10pt;font-size:7.5pt;text-align:center;">________________________________<br/>Principal</div>
  </div>

  <!-- PAGE 1 RIGHT: LEARNER'S PROGRESS REPORT CARD -->
  <div style="flex:1;padding:0 0 0 8pt;">
    <div style="text-align:center;margin-bottom:5pt;">
      <div style="font-size:8.5pt;font-weight:bold;">Republic of the Philippines</div>
      <div style="font-size:8pt;">DEPARTMENT OF EDUCATION</div>
      <div style="font-size:7.5pt;">${esc(info.region || 'Region ____')}</div>
      <div style="font-size:7.5pt;">${esc(info.division || 'Division ____')}</div>
      <div style="font-size:7.5pt;">${esc(info.district || 'District ____')}</div>
      <div style="font-size:8.5pt;font-weight:bold;margin-top:4pt;">${esc(info.school_name || 'School ____')}</div>
      <div style="font-size:7.5pt;">School ID: ${esc(info.school_id || '______')}</div>
    </div>
    <div style="text-align:right;font-size:8pt;margin-bottom:3pt;"><strong>LRN:</strong> ${esc(stud.lrn || '______________')}</div>
    <div style="text-align:center;font-size:11pt;font-weight:bold;margin:8pt 0;border:2px solid #000;padding:4pt;">LEARNER'S PROGRESS REPORT CARD</div>
    <table style="font-size:8.5pt;width:100%;margin:6pt 0;">
      <tr><td style="border:none;width:22%;padding:3pt;"><strong>Name:</strong></td><td style="border:none;padding:3pt;border-bottom:1px solid #000;">${esc(stud.last_name)}, ${esc(stud.first_name)}${stud.extension_name ? ', ' + esc(stud.extension_name) : ''}${stud.middle_name ? ', ' + esc(stud.middle_name) : ''}</td></tr>
      <tr><td style="border:none;padding:3pt;"><strong>Age:</strong></td><td style="border:none;padding:3pt;border-bottom:1px solid #000;">${esc(String(stud.age || '____'))} &nbsp;&nbsp;&nbsp; <strong>Sex:</strong> ${esc(stud.sex || '____')}</td></tr>
      <tr><td style="border:none;padding:3pt;"><strong>Grade:</strong></td><td style="border:none;padding:3pt;border-bottom:1px solid #000;">${gradeLevel} &nbsp;&nbsp;&nbsp; <strong>Section:</strong> ${sectionName}</td></tr>
      <tr><td style="border:none;padding:3pt;"><strong>Curriculum:</strong></td><td style="border:none;padding:3pt;border-bottom:1px solid #000;">K to 12 / MATATAG</td></tr>
      <tr><td style="border:none;padding:3pt;"><strong>School Year:</strong></td><td style="border:none;padding:3pt;border-bottom:1px solid #000;">${esc(sy)}</td></tr>
      ${trackCluster ? `<tr><td style="border:none;padding:3pt;"><strong>Track/Cluster:</strong></td><td style="border:none;padding:3pt;border-bottom:1px solid #000;">${trackCluster}</td></tr>` : ''}
    </table>
    <div style="font-size:8pt;margin:10pt 0;line-height:1.5;">
      Dear Parent,<br/>
      With the K to 12 Curriculum, the Learner Progress Report Card shows how your child is performing in school.
      The enclosed report card provides information on your child's grades in the different learning areas,
      conduct/behavior and attendance. In case you need further explanation or clarification on your child's grades,
      please do not hesitate to get in touch with the class adviser/principal.
    </div>
    <div style="margin-top:16pt;text-align:right;font-size:8.5pt;">
      <div>________________________________</div>
      <div><strong>${principalName || '______________________'}</strong></div>
      <div>Principal / Teacher</div>
    </div>
  </div>

</div>`; // end front

  const back = `
<div class="sf9-page" style="display:flex;gap:0;height:100%;">

  <!-- PAGE 2 LEFT: GRADES -->
  <div style="flex:0 0 52%;border-right:1px solid #999;padding:0 8pt 0 0;">
    <div style="text-align:center;font-weight:bold;font-size:9pt;margin-bottom:4pt;text-decoration:underline;">LEARNER'S GRADES</div>
    ${availableTerms.length ? availableTerms.map(q => gradesTableHtml(q, gradesByQuarter[q])).join('<div style="border-bottom:1px solid #aaa;margin:3pt 0;"></div>') : '<div style="margin:8pt;text-align:center;">No grade data available.</div>'}
  </div>

  <!-- PAGE 2 RIGHT: OBSERVED VALUES -->
  <div style="flex:1;padding:0 0 0 8pt;">
    <div style="text-align:center;font-weight:bold;font-size:9pt;margin-bottom:4pt;text-decoration:underline;">REPORT ON LEARNER'S OBSERVED VALUES</div>
    <table style="font-size:7pt;width:100%;">
    <thead><tr>
      <th style="width:60pt;padding:2pt;font-size:7pt;text-align:left;">Core Values</th>
      <th style="padding:2pt;font-size:7pt;text-align:left;">Behavior Statements</th>
      <th colspan="3" style="padding:2pt;font-size:7pt;text-align:center;">Term</th>
    </tr><tr>
      <th style="padding:1pt;"></th><th style="padding:1pt;"></th>
      <th style="width:20pt;padding:1pt;font-size:6.5pt;text-align:center;">1</th>
      <th style="width:20pt;padding:1pt;font-size:6.5pt;text-align:center;">2</th>
      <th style="width:20pt;padding:1pt;font-size:6.5pt;text-align:center;">3</th>
    </tr></thead>
    <tbody>
    ${CORE_VALUES.map(cv => {
      const rows = [];
      cv.behaviors.forEach((bh, bi) => {
        const term1 = bi === 0 ? (conductByTerm['1']?.[cv.key] || '') : '';
        const term2 = bi === 0 ? (conductByTerm['2']?.[cv.key] || '') : '';
        const term3 = bi === 0 ? (conductByTerm['3']?.[cv.key] || '') : '';
        rows.push(`<tr>
          ${bi === 0 ? `<td rowspan="${cv.behaviors.length}" style="padding:2pt;font-weight:bold;vertical-align:top;border-bottom:1px solid #aaa;">${esc(cv.label)}</td>` : ''}
          <td style="padding:1.5pt 2pt;font-size:7pt;border-bottom:1px solid #eee;">${esc(bh)}</td>
          <td class="c" style="padding:1.5pt;border-bottom:1px solid #eee;font-size:7.5pt;">${esc(term1)}</td>
          <td class="c" style="padding:1.5pt;border-bottom:1px solid #eee;font-size:7.5pt;">${esc(term2)}</td>
          <td class="c" style="padding:1.5pt;border-bottom:1px solid #eee;font-size:7.5pt;">${esc(term3)}</td>
        </tr>`);
      });
      return rows.join('');
    }).join('')}
    </tbody></table>

    <div style="margin-top:8pt;font-weight:bold;font-size:8pt;">Observed Values</div>
    <table style="font-size:7pt;width:50%;margin-top:3pt;">
    <tbody>
      <tr><td style="padding:1.5pt 4pt;font-weight:bold;border:1px solid #000;">AO</td><td style="padding:1.5pt 4pt;border:1px solid #000;">Always Observed</td></tr>
      <tr><td style="padding:1.5pt 4pt;font-weight:bold;border:1px solid #000;">SO</td><td style="padding:1.5pt 4pt;border:1px solid #000;">Sometimes Observed</td></tr>
      <tr><td style="padding:1.5pt 4pt;font-weight:bold;border:1px solid #000;">RO</td><td style="padding:1.5pt 4pt;border:1px solid #000;">Rarely Observed</td></tr>
      <tr><td style="padding:1.5pt 4pt;font-weight:bold;border:1px solid #000;">NO</td><td style="padding:1.5pt 4pt;border:1px solid #000;">Not Observed</td></tr>
    </tbody></table>

    <div style="margin-top:8pt;font-weight:bold;font-size:8pt;">Learner Progress and Achievement</div>
    <table style="font-size:7pt;width:100%;margin-top:3pt;">
    <thead><tr>
      <th style="padding:2pt;font-size:7pt;text-align:left;border:1px solid #000;">Descriptors</th>
      <th style="padding:2pt;font-size:7pt;text-align:center;border:1px solid #000;">Grading Scale</th>
      <th style="padding:2pt;font-size:7pt;text-align:center;border:1px solid #000;">Remarks</th>
    </tr></thead>
    <tbody>
      <tr><td style="padding:1.5pt 4pt;border:1px solid #000;">Outstanding</td><td class="c" style="padding:1.5pt 4pt;border:1px solid #000;">90-100</td><td class="c" style="padding:1.5pt 4pt;border:1px solid #000;">Passed</td></tr>
      <tr><td style="padding:1.5pt 4pt;border:1px solid #000;">Very Satisfactory</td><td class="c" style="padding:1.5pt 4pt;border:1px solid #000;">85-89</td><td class="c" style="padding:1.5pt 4pt;border:1px solid #000;">Passed</td></tr>
      <tr><td style="padding:1.5pt 4pt;border:1px solid #000;">Satisfactory</td><td class="c" style="padding:1.5pt 4pt;border:1px solid #000;">80-84</td><td class="c" style="padding:1.5pt 4pt;border:1px solid #000;">Passed</td></tr>
      <tr><td style="padding:1.5pt 4pt;border:1px solid #000;">Fairly Satisfactory</td><td class="c" style="padding:1.5pt 4pt;border:1px solid #000;">75-79</td><td class="c" style="padding:1.5pt 4pt;border:1px solid #000;">Passed</td></tr>
      <tr><td style="padding:1.5pt 4pt;border:1px solid #000;">Did Not Meet Expectation</td><td class="c" style="padding:1.5pt 4pt;border:1px solid #000;">Below 75</td><td class="c" style="padding:1.5pt 4pt;border:1px solid #000;">Failed</td></tr>
    </tbody></table>
  </div>

</div>`; // end back

  return front + '\n<div style="page-break-after:always;"></div>\n' + back;
}


function renderSF9Blank(info) {
  const emptyMonthCells = MONTH_NUMS.map(() => '<td class="c" style="padding:1.5pt;">&nbsp;</td>').join('');
  function blankGradesTable(termLabel) {
    const subjects = ['Filipino','English','Mathematics','Science','Araling Panlipunan'];
    return `
    <div style="font-size:8pt;font-weight:bold;margin:3pt 0 2pt;">${termLabel}</div>
    <table style="font-size:7.5pt;width:100%;">
    <thead><tr>
      <th style="text-align:left;min-width:120pt;padding:2pt 3pt;font-size:7.5pt;">Subject</th>
      <th style="width:35pt;padding:2pt 3pt;font-size:7.5pt;">Grade</th>
      <th style="width:40pt;padding:2pt 3pt;font-size:7.5pt;">Remarks</th>
    </tr></thead>
    <tbody>
    ${subjects.map(s => `<tr><td style="padding:1.5pt 3pt;">${s}</td><td class="c" style="padding:1.5pt 3pt;"></td><td class="c" style="padding:1.5pt 3pt;"></td></tr>`).join('')}
    <tr><td colspan="2" style="font-weight:bold;padding:2pt 3pt;border-top:1px solid #000;">Applied and Specialized Subjects</td><td style="border-top:1px solid #000;"></td></tr>
    <tr><td style="padding:1.5pt 3pt;">Araling Panlipunan (AP)</td><td class="c" style="padding:1.5pt 3pt;"></td><td class="c" style="padding:1.5pt 3pt;"></td></tr>
    <tr style="font-style:italic;">
      <td style="padding:2pt 3pt;border-top:1.5px solid #000;">General Average for the Term</td>
      <td class="c" style="padding:2pt 3pt;border-top:1.5px solid #000;"><strong></strong></td>
      <td class="c" style="padding:2pt 3pt;border-top:1.5px solid #000;"></td>
    </tr>
    </tbody></table>`;
  }

  const front = `
<div class="sf9-page" style="display:flex;gap:0;height:100%;">

  <!-- PAGE 1 LEFT: ATTENDANCE RECORD -->
  <div style="flex:0 0 48%;border-right:1px solid #999;padding:0 8pt 0 0;">
    <div style="text-align:center;font-weight:bold;font-size:9pt;margin-bottom:4pt;text-decoration:underline;">ATTENDANCE RECORD</div>
    <table style="font-size:7.5pt;width:100%;">
    <thead><tr>
      <th style="width:30pt;padding:2pt;font-size:7pt;writing-mode:vertical-lr;text-orientation:mixed;">&nbsp;</th>
      ${MONTH_NAMES.map(m => `<th style="width:18pt;padding:1.5pt;font-size:6.5pt;writing-mode:vertical-lr;text-orientation:mixed;">${m}</th>`).join('')}
      <th style="width:20pt;padding:1.5pt;font-size:7pt;font-weight:bold;">TOTAL</th>
    </tr></thead>
    <tbody>
      <tr><td style="padding:2pt;font-size:7pt;font-weight:bold;">No. of School Days</td>${emptyMonthCells}<td class="c" style="padding:1.5pt;"></td></tr>
      <tr><td style="padding:2pt;font-size:7pt;font-weight:bold;">No. of Days Present</td>${emptyMonthCells}<td class="c" style="padding:1.5pt;"></td></tr>
      <tr><td style="padding:2pt;font-size:7pt;font-weight:bold;">No. of Days Absent</td>${emptyMonthCells}<td class="c" style="padding:1.5pt;"></td></tr>
    </tbody></table>

    <div style="margin-top:10pt;font-size:8pt;font-weight:bold;">PARENT / GUARDIAN'S SIGNATURE OVER LEARNER'S PROGRESS REPORT CARD</div>
    <div style="margin-top:6pt;font-size:7.5pt;">1st Term ___________________________________</div>
    <div style="margin-top:4pt;font-size:7.5pt;">2nd Term ___________________________________</div>
    <div style="margin-top:4pt;font-size:7.5pt;">3rd Term ___________________________________</div>

    <div style="margin-top:14pt;font-size:8pt;font-weight:bold;text-decoration:underline;">Certificate of Transfer</div>
    <div style="margin-top:4pt;font-size:7.5pt;line-height:1.6;">
      Admitted to Grade: ____ Section: ____________<br/>
      Eligibility for Admission to Grade: ____________
    </div>
    <div style="margin-top:4pt;font-size:7.5pt;">Approved:</div>
    <div style="display:flex;gap:20pt;margin-top:10pt;font-size:7.5pt;">
      <div style="text-align:center;flex:1;">________________________________<br/>Principal</div>
      <div style="text-align:center;flex:1;">________________________________<br/>Teacher</div>
    </div>

    <div style="margin-top:14pt;font-size:8pt;font-weight:bold;text-decoration:underline;">Cancellation of Eligibility to Transfer</div>
    <div style="margin-top:4pt;font-size:7.5pt;">
      Admitted in: ________________________________<br/>
      Date: ____________________
    </div>
    <div style="margin-top:10pt;font-size:7.5pt;text-align:center;">________________________________<br/>Principal</div>
  </div>

  <!-- PAGE 1 RIGHT: LEARNER'S PROGRESS REPORT CARD -->
  <div style="flex:1;padding:0 0 0 8pt;">
    <div style="text-align:center;margin-bottom:5pt;">
      <div style="font-size:8.5pt;font-weight:bold;">Republic of the Philippines</div>
      <div style="font-size:8pt;">DEPARTMENT OF EDUCATION</div>
      <div style="font-size:7.5pt;">${esc(info.region || 'Region ____')}</div>
      <div style="font-size:7.5pt;">${esc(info.division || 'Division ____')}</div>
      <div style="font-size:7.5pt;">${esc(info.district || 'District ____')}</div>
      <div style="font-size:8.5pt;font-weight:bold;margin-top:4pt;">${esc(info.school_name || 'School ____')}</div>
      <div style="font-size:7.5pt;">School ID: ${esc(info.school_id || '______')}</div>
    </div>
    <div style="text-align:right;font-size:8pt;margin-bottom:3pt;"><strong>LRN:</strong> ______________</div>
    <div style="text-align:center;font-size:11pt;font-weight:bold;margin:8pt 0;border:2px solid #000;padding:4pt;">LEARNER'S PROGRESS REPORT CARD</div>
    <table style="font-size:8.5pt;width:100%;margin:6pt 0;">
      <tr><td style="border:none;width:22%;padding:3pt;"><strong>Name:</strong></td><td style="border:none;padding:3pt;border-bottom:1px solid #000;">____________________________</td></tr>
      <tr><td style="border:none;padding:3pt;"><strong>Age:</strong></td><td style="border:none;padding:3pt;border-bottom:1px solid #000;">____ &nbsp;&nbsp;&nbsp; <strong>Sex:</strong> ____</td></tr>
      <tr><td style="border:none;padding:3pt;"><strong>Grade:</strong></td><td style="border:none;padding:3pt;border-bottom:1px solid #000;">____ &nbsp;&nbsp;&nbsp; <strong>Section:</strong> ____________</td></tr>
      <tr><td style="border:none;padding:3pt;"><strong>Curriculum:</strong></td><td style="border:none;padding:3pt;border-bottom:1px solid #000;">K to 12 / MATATAG</td></tr>
      <tr><td style="border:none;padding:3pt;"><strong>School Year:</strong></td><td style="border:none;padding:3pt;border-bottom:1px solid #000;">____-____</td></tr>
      <tr><td style="border:none;padding:3pt;"><strong>Track/Cluster:</strong></td><td style="border:none;padding:3pt;border-bottom:1px solid #000;"></td></tr>
    </table>
    <div style="font-size:8pt;margin:10pt 0;line-height:1.5;">
      Dear Parent,<br/>
      With the K to 12 Curriculum, the Learner Progress Report Card shows how your child is performing in school.
      The enclosed report card provides information on your child's grades in the different learning areas,
      conduct/behavior and attendance. In case you need further explanation or clarification on your child's grades,
      please do not hesitate to get in touch with the class adviser/principal.
    </div>
    <div style="margin-top:16pt;text-align:right;font-size:8.5pt;">
      <div>________________________________</div>
      <div><strong>______________________</strong></div>
      <div>Principal / Teacher</div>
    </div>
  </div>

</div>`;

  const back = `
<div class="sf9-page" style="display:flex;gap:0;height:100%;">

  <!-- PAGE 2 LEFT: GRADES -->
  <div style="flex:0 0 52%;border-right:1px solid #999;padding:0 8pt 0 0;">
    <div style="text-align:center;font-weight:bold;font-size:9pt;margin-bottom:4pt;text-decoration:underline;">LEARNER'S GRADES</div>
    ${blankGradesTable('First Term')}
    <div style="border-bottom:1px solid #aaa;margin:3pt 0;"></div>
    ${blankGradesTable('Second Term')}
    <div style="border-bottom:1px solid #aaa;margin:3pt 0;"></div>
    ${blankGradesTable('Third Term')}
  </div>

  <!-- PAGE 2 RIGHT: OBSERVED VALUES -->
  <div style="flex:1;padding:0 0 0 8pt;">
    <div style="text-align:center;font-weight:bold;font-size:9pt;margin-bottom:4pt;text-decoration:underline;">REPORT ON LEARNER'S OBSERVED VALUES</div>
    <table style="font-size:7pt;width:100%;">
    <thead><tr>
      <th style="width:60pt;padding:2pt;font-size:7pt;text-align:left;">Core Values</th>
      <th style="padding:2pt;font-size:7pt;text-align:left;">Behavior Statements</th>
      <th colspan="3" style="padding:2pt;font-size:7pt;text-align:center;">Term</th>
    </tr><tr>
      <th style="padding:1pt;"></th><th style="padding:1pt;"></th>
      <th style="width:20pt;padding:1pt;font-size:6.5pt;text-align:center;">1</th>
      <th style="width:20pt;padding:1pt;font-size:6.5pt;text-align:center;">2</th>
      <th style="width:20pt;padding:1pt;font-size:6.5pt;text-align:center;">3</th>
    </tr></thead>
    <tbody>
    ${CORE_VALUES.map(cv => {
      const rows = [];
      cv.behaviors.forEach((bh, bi) => {
        rows.push(`<tr>
          ${bi === 0 ? `<td rowspan="${cv.behaviors.length}" style="padding:2pt;font-weight:bold;vertical-align:top;border-bottom:1px solid #aaa;">${esc(cv.label)}</td>` : ''}
          <td style="padding:1.5pt 2pt;font-size:7pt;border-bottom:1px solid #eee;">${esc(bh)}</td>
          <td class="c" style="padding:1.5pt;border-bottom:1px solid #eee;font-size:7.5pt;">&nbsp;</td>
          <td class="c" style="padding:1.5pt;border-bottom:1px solid #eee;font-size:7.5pt;">&nbsp;</td>
          <td class="c" style="padding:1.5pt;border-bottom:1px solid #eee;font-size:7.5pt;">&nbsp;</td>
        </tr>`);
      });
      return rows.join('');
    }).join('')}
    </tbody></table>

    <div style="margin-top:8pt;font-weight:bold;font-size:8pt;">Observed Values</div>
    <table style="font-size:7pt;width:50%;margin-top:3pt;">
    <tbody>
      <tr><td style="padding:1.5pt 4pt;font-weight:bold;border:1px solid #000;">AO</td><td style="padding:1.5pt 4pt;border:1px solid #000;">Always Observed</td></tr>
      <tr><td style="padding:1.5pt 4pt;font-weight:bold;border:1px solid #000;">SO</td><td style="padding:1.5pt 4pt;border:1px solid #000;">Sometimes Observed</td></tr>
      <tr><td style="padding:1.5pt 4pt;font-weight:bold;border:1px solid #000;">RO</td><td style="padding:1.5pt 4pt;border:1px solid #000;">Rarely Observed</td></tr>
      <tr><td style="padding:1.5pt 4pt;font-weight:bold;border:1px solid #000;">NO</td><td style="padding:1.5pt 4pt;border:1px solid #000;">Not Observed</td></tr>
    </tbody></table>

    <div style="margin-top:8pt;font-weight:bold;font-size:8pt;">Learner Progress and Achievement</div>
    <table style="font-size:7pt;width:100%;margin-top:3pt;">
    <thead><tr>
      <th style="padding:2pt;font-size:7pt;text-align:left;border:1px solid #000;">Descriptors</th>
      <th style="padding:2pt;font-size:7pt;text-align:center;border:1px solid #000;">Grading Scale</th>
      <th style="padding:2pt;font-size:7pt;text-align:center;border:1px solid #000;">Remarks</th>
    </tr></thead>
    <tbody>
      <tr><td style="padding:1.5pt 4pt;border:1px solid #000;">Outstanding</td><td class="c" style="padding:1.5pt 4pt;border:1px solid #000;">90-100</td><td class="c" style="padding:1.5pt 4pt;border:1px solid #000;">Passed</td></tr>
      <tr><td style="padding:1.5pt 4pt;border:1px solid #000;">Very Satisfactory</td><td class="c" style="padding:1.5pt 4pt;border:1px solid #000;">85-89</td><td class="c" style="padding:1.5pt 4pt;border:1px solid #000;">Passed</td></tr>
      <tr><td style="padding:1.5pt 4pt;border:1px solid #000;">Satisfactory</td><td class="c" style="padding:1.5pt 4pt;border:1px solid #000;">80-84</td><td class="c" style="padding:1.5pt 4pt;border:1px solid #000;">Passed</td></tr>
      <tr><td style="padding:1.5pt 4pt;border:1px solid #000;">Fairly Satisfactory</td><td class="c" style="padding:1.5pt 4pt;border:1px solid #000;">75-79</td><td class="c" style="padding:1.5pt 4pt;border:1px solid #000;">Passed</td></tr>
      <tr><td style="padding:1.5pt 4pt;border:1px solid #000;">Did Not Meet Expectation</td><td class="c" style="padding:1.5pt 4pt;border:1px solid #000;">Below 75</td><td class="c" style="padding:1.5pt 4pt;border:1px solid #000;">Failed</td></tr>
    </tbody></table>
  </div>

</div>`;

  return front + '\n<div style="page-break-after:always;"></div>\n' + back;
}


/* ── SF10: Permanent Record (Form 137) ─────────────────────── */

function renderSF10(data, info) {
  if (!data?.learner) return '<p>Select a student to view their Permanent Academic Record (Form 137).</p>';
  const lr = data.learner;
  const stud = lr.student;
  const enrollments = lr.enrollments || [];
  const allGrades = lr.grades || [];
  const allAttendance = lr.attendance || [];

  function numberToWords(n) {
    if (!n || isNaN(n)) return '';
    const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    const num = Math.round(Number(n));
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? '-' + ones[num%10] : '');
    return num.toString();
  }

  const byYear = {};
  for (const en of enrollments) {
    const sy = en.school_year || 'N/A';
    if (!byYear[sy]) byYear[sy] = { enrollment: en, grades: [], attendance: null };
    byYear[sy].grades = allGrades.filter(g => g.section_name === en.section_name);
    byYear[sy].attendance = allAttendance.find(a => a.section_name === en.section_name);
  }

  return `
${formHeaderHtml(info, 'sf10', "School Form 10 (SF10) — Learner's Permanent Academic Record (Form 137)")}
<table style="font-size:8pt;margin-bottom:8pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${esc(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School ID:</strong> ${esc(info.school_id || '')}</td></tr>
</table>
<strong style="font-size:9pt;">I. Learner Information</strong>
<table style="font-size:8pt;">
  <tr><td style="width:25%"><strong>Name:</strong></td><td>${esc(stud.last_name)}, ${esc(stud.first_name)}${stud.extension_name ? ', ' + esc(stud.extension_name) : ''}, ${esc(stud.middle_name || '')}</td></tr>
  <tr><td><strong>LRN:</strong></td><td>${esc(stud.lrn || '')}</td></tr>
  <tr><td><strong>Birthdate:</strong></td><td>${esc(stud.birthdate || '')}</td>
      <td style="width:15%"><strong>Sex:</strong></td><td>${esc(stud.sex || '')}</td></tr>
  <tr><td><strong>Address:</strong></td><td colspan="3">${esc(stud.address || '')}</td></tr>
  <tr><td><strong>Father:</strong></td><td>${esc(stud.father_name || '')}</td>
      <td><strong>Mother:</strong></td><td>${esc(stud.mother_name || '')}</td></tr>
  <tr><td><strong>Guardian:</strong></td><td>${esc(stud.guardian_name || '')}</td>
      <td><strong>Contact:</strong></td><td>${esc(stud.contact_number || stud.parent_contact || '')}</td></tr>
</table>
<strong style="font-size:9pt;margin-top:8pt;display:block;">II. Education Record</strong>
<table style="font-size:7pt;">
<thead><tr>
  <th style="min-width:40pt">School Year</th><th style="min-width:40pt">Grade Level</th>
  <th style="min-width:40pt">Section</th><th style="min-width:40pt">Subjects / Grades</th>
  <th style="width:30pt">Gen. Avg.</th><th style="width:35pt">GWA<br/>(words)</th>
  <th style="width:40pt">Attendance<br/>Present / Absent</th>
  <th style="width:35pt">Remarks</th><th style="min-width:40pt">School Last Attended</th>
</tr></thead>
<tbody>
${Object.keys(byYear).length ? Object.entries(byYear).map(([sy, yr]) => {
  const avg = yr.grades.length ? (yr.grades.reduce((sum, g) => sum + (Number(g.computed_grade) || 0), 0) / yr.grades.length).toFixed(1) : '';
  const promoted = avg && Number(avg) >= 75 ? 'Promoted' : avg ? 'Retained' : '';
  const gwaWords = numberToWords(avg);
  return `<tr>
    <td>${esc(sy)}</td>
    <td class="c">${yr.enrollment?.grade_level || ''}</td>
    <td>${yr.enrollment?.section_name || ''}</td>
    <td class="small">${yr.grades.map(g => `${esc(g.subject_name)}: ${Number(g.computed_grade).toFixed(1)}`).join('<br/>')}</td>
    <td class="c"><strong>${avg}</strong></td>
    <td class="c small">${esc(gwaWords)}</td>
    <td class="c">${yr.attendance ? `${yr.attendance.days_present || 0} / ${yr.attendance.days_absent || 0}` : ''}</td>
    <td class="c">${promoted}</td>
    <td>${esc(info.school_name)}</td>
  </tr>`;
}).join('') : blankRows(6, 9)}
</tbody></table>
<strong style="font-size:9pt;margin-top:8pt;display:block;">III. Behavior / Conduct</strong>
<table style="font-size:8pt;">
<thead><tr><th>School Year</th><th>Conduct Rating</th><th>Values Education</th></tr></thead>
<tbody>${blankRows(4, 3)}</tbody></table>
<strong style="font-size:9pt;margin-top:8pt;display:block;">IV. Character Reference</strong>
<table style="font-size:8pt;">
<tbody>
  <tr><td style="border:none;width:50%"><strong>Noted by:</strong> ____________________________________<br/><em>Class Adviser</em></td>
      <td style="border:none"><strong>Approved by:</strong> ____________________________________<br/><em>School Head / Registrar</em></td></tr>
</tbody></table>
<div class="small" style="margin:8pt 0;"><em>Note: SF10 is for Grades 1 &amp; 7 only (K to 12). SHS incoming Grade 11 uses SF10-SHS format per DO 69, s. 2016.</em></div>
${signatureBlockHtml('', 'Class Adviser', '', 'School Head / Registrar')}`;
}

function renderSF10Blank(info) {
  return `
${formHeaderHtml(info, 'sf10', "School Form 10 (SF10) — Learner's Permanent Academic Record (Form 137)")}
<table style="font-size:8pt;margin-bottom:8pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${esc(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School ID:</strong> ${esc(info.school_id || '')}</td></tr>
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
  <th style="width:30pt">Gen. Avg.</th><th style="width:35pt">GWA<br/>(words)</th>
  <th style="width:40pt">Attendance</th>
  <th style="width:35pt">Remarks</th><th style="min-width:40pt">School Last Attended</th>
</tr></thead>
<tbody>${blankRows(8, 9)}</tbody></table>
<strong style="font-size:9pt;margin-top:8pt;display:block;">III. Behavior / Conduct</strong>
<table style="font-size:8pt;">
<thead><tr><th>School Year</th><th>Conduct Rating</th><th>Values Education</th></tr></thead>
<tbody>${blankRows(4, 3)}</tbody></table>
<strong style="font-size:9pt;margin-top:8pt;display:block;">IV. Character Reference</strong>
<table style="font-size:8pt;">
<tbody>
  <tr><td style="border:none;width:50%"><strong>Noted by:</strong> ____________________________________<br/><em>Class Adviser</em></td>
      <td style="border:none"><strong>Approved by:</strong> ____________________________________<br/><em>School Head / Registrar</em></td></tr>
</tbody></table>
${signatureBlockHtml('', 'Class Adviser', '', 'School Head / Registrar')}`;
}

/* ── Summary of Grades ─────────────────────────────────────── */

function renderSOG(data, info) {
  const learners = data?.learners || [];
  const subjects = data?.subjects || [];
  const grades = data?.grades || [];
  const section = data?.section;

  const gradeMap = {};
  for (const g of grades) {
    const key = `${g.student_id}_${g.subject_id}_${g.quarter}`;
    gradeMap[key] = g;
  }

  return `
${formHeaderHtml(info, 'sog', 'Summary of Grades')}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${esc(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School Year:</strong> ${esc(info.school_year || '____-____')}</td></tr>
  <tr><td style="border:none"><strong>Grade Level:</strong> ${section ? esc(String(section.grade_level)) : '____'}</td>
      <td style="border:none"><strong>Section:</strong> ${section ? esc(section.name) : '____'}</td></tr>
  <tr><td style="border:none"><strong>Adviser:</strong> ${esc(section?.adviser_name || '______________________')}</td><td style="border:none"></td></tr>
</table>
<div class="small" style="margin-bottom:4pt;"><em>Consolidated final grades across all terms — for checking and submission to the School Head.</em></div>
<div style="overflow-x:auto;">
<table style="font-size:7pt;">
<thead><tr>
  <th style="width:20pt">#</th>
  <th style="min-width:90pt">Name of Learner</th>
  ${subjects.map(sub => `<th style="min-width:45pt" class="c">${esc(sub.name)}</th>`).join('')}
  <th style="min-width:30pt" class="c"><strong>General<br/>Average</strong></th>
  <th style="width:25pt" class="c"><strong>Rank</strong></th>
  <th style="width:30pt" class="c"><strong>Remarks</strong></th>
  <th style="width:25pt" class="c"><strong>With<br/>Honors</strong></th>
</tr></thead>
<tbody>
${learners.length ? learners.map((lr, idx) => {
  const learnerGrades = subjects.map(sub => {
    const q1 = gradeMap[`${lr.id}_${sub.id}_Q1`]?.computed_grade || 0;
    const q2 = gradeMap[`${lr.id}_${sub.id}_Q2`]?.computed_grade || 0;
    const q3 = gradeMap[`${lr.id}_${sub.id}_Q3`]?.computed_grade || 0;
    const q4 = gradeMap[`${lr.id}_${sub.id}_Q4`]?.computed_grade || 0;
    const finalGrade = gradeMap[`${lr.id}_${sub.id}_Final`]?.computed_grade ||
      ((q1 + q2 + q3 + q4) / 4 || 0);
    return Number(finalGrade) || 0;
  });
  const genAvg = learnerGrades.filter(x => x > 0).length
    ? (learnerGrades.reduce((a, b) => a + b, 0) / learnerGrades.filter(x => x > 0).length).toFixed(0)
    : '';
  const withHonors = genAvg && Number(genAvg) >= 95 ? '&#10003;' : '';
  const remarks = genAvg ? (Number(genAvg) >= 75 ? 'Passed' : 'Failed') : '';
  return `<tr>
    <td class="c">${idx + 1}</td>
    <td>${esc(lr.last_name)}, ${esc(lr.first_name)}${lr.extension_name ? ', ' + esc(lr.extension_name) : ''}, ${esc(lr.middle_name || '')}</td>
    ${learnerGrades.map(g => `<td class="c">${g ? g.toFixed(0) : ''}</td>`).join('')}
    <td class="c"><strong>${genAvg}</strong></td>
    <td class="c"></td>
    <td class="c small">${remarks}</td>
    <td class="c">${withHonors}</td>
  </tr>`;
}).join('') : blankRows(30, subjects.length + 5)}
</tbody></table>
</div>
<div class="small" style="margin:6pt 0;">
  <strong>Ranking:</strong> Based on General Average. &nbsp;|&nbsp;
  <strong>With Honors:</strong> GWA &#8805; 95 and lowest grade &#8805; 85 (Academic Excellence Awardee candidate indicator).
</div>
<div class="small" style="margin:4pt 0;">
  <strong>Grade Scale:</strong> 90-100 = Excellent | 85-89 = Very Satisfactory | 80-84 = Satisfactory |
  75-79 = Fair | Below 75 = Did Not Meet Expectations
</div>
${signatureBlockHtml('', 'Class Adviser', '', 'School Head')}`;
}

function renderSOGBlank(info, ctx) {
  const sec = (ctx.sections || []).find(s => String(s.id) === String(ctx.sectionId));
  return `
${formHeaderHtml(info, 'sog', 'Summary of Grades')}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${esc(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School Year:</strong> ${esc(info.school_year || '____-____')}</td></tr>
  <tr><td style="border:none"><strong>Grade Level:</strong> ${sec ? esc(String(sec.grade_level)) : '____'}</td>
      <td style="border:none"><strong>Section:</strong> ${sec ? esc(sec.name) : '____'}</td></tr>
  <tr><td style="border:none"><strong>Adviser:</strong> ______________________</td><td style="border:none"></td></tr>
</table>
<div class="small" style="margin-bottom:4pt;"><em>Consolidated final grades across all terms — for checking and submission to the School Head.</em></div>
<div style="overflow-x:auto;">
<table style="font-size:7pt;">
<thead><tr>
  <th style="width:20pt">#</th>
  <th style="min-width:90pt">Name of Learner</th>
  <th style="min-width:45pt" class="c">Subject 1</th>
  <th style="min-width:45pt" class="c">Subject 2</th>
  <th style="min-width:45pt" class="c">Subject 3</th>
  <th style="min-width:45pt" class="c">Subject 4</th>
  <th style="min-width:45pt" class="c">Subject 5</th>
  <th style="min-width:45pt" class="c">Subject 6</th>
  <th style="min-width:45pt" class="c">Subject 7</th>
  <th style="min-width:45pt" class="c">Subject 8</th>
  <th style="min-width:45pt" class="c">Subject 9</th>
  <th style="min-width:30pt" class="c"><strong>Gen. Avg.</strong></th>
  <th style="width:25pt" class="c"><strong>Rank</strong></th>
  <th style="width:30pt" class="c"><strong>Remarks</strong></th>
  <th style="width:25pt" class="c"><strong>Honors</strong></th>
</tr></thead>
<tbody>${blankRows(30, 15)}</tbody></table>
</div>
<div class="small" style="margin:6pt 0;">
  <strong>Ranking:</strong> Based on General Average. &nbsp;|&nbsp;
  <strong>With Honors:</strong> GWA &#8805; 95 and lowest grade &#8805; 85.
</div>
<div class="small" style="margin:4pt 0;">
  <strong>Grade Scale:</strong> 90-100 = Excellent | 85-89 = Very Satisfactory | 80-84 = Satisfactory |
  75-79 = Fair | Below 75 = Did Not Meet Expectations
</div>
${signatureBlockHtml('', 'Class Adviser', '', 'School Head')}`;
}

/* ── SAS: Attendance Summary Report ─────────────────────── */

function renderSAS(data, info) {
  const students = data?.students || [];
  const att = data?.attendance || [];
  const attMap = {};
  for (const a of att) {
    if (!attMap[a.student_id]) attMap[a.student_id] = { present: 0, absent: 0, late: 0, total: 0 };
    attMap[a.student_id].total++;
    if (a.status === 'present') attMap[a.student_id].present++;
    else if (a.status === 'absent') attMap[a.student_id].absent++;
    else if (a.status === 'late') attMap[a.student_id].late++;
  }
  const months = {};
  for (const a of att) {
    const key = `${a.year}-${String(a.month).padStart(2, '0')}`;
    if (!months[key]) months[key] = { present: 0, absent: 0, late: 0 };
    months[key][a.status === 'present' ? 'present' : a.status === 'absent' ? 'absent' : 'late']++;
  }
  const monthKeys = Object.keys(months).sort();
  return `
${formHeaderHtml(info, 'sas', 'Section Attendance Summary Report')}
<table style="font-size:8pt;margin-bottom:6pt;">
  <tr><td style="border:none;width:50%"><strong>School Name:</strong> ${esc(info.school_name)}</td>
      <td style="border:none;width:50%"><strong>School Year:</strong> ${esc(info.school_year || '____-____')}</td></tr>
</table>
<div class="small" style="margin-bottom:6pt;"><em>Consolidated attendance per student across months — for filing and trend analysis.</em></div>
<div style="overflow-x:auto;">
<table style="font-size:7pt;">
<thead><tr>
  <th style="width:20pt">#</th>
  <th style="min-width:90pt">Name of Learner</th>
  <th style="width:25pt" class="c"><strong>Total<br/>Days</strong></th>
  <th style="width:25pt" class="c"><strong>Present</strong></th>
  <th style="width:25pt" class="c"><strong>Absent</strong></th>
  <th style="width:25pt" class="c"><strong>Late</strong></th>
  <th style="width:30pt" class="c"><strong>Attendance<br/>%</strong></th>
  ${monthKeys.map(m => `<th style="width:22pt" class="c" colspan="3"><strong>${m}</strong></th>`).join('')}
  <th style="width:30pt">Remarks</th>
</tr>
<tr>
  <th></th><th></th><th></th><th></th><th></th><th></th><th></th>
  ${monthKeys.map(() => '<th style="width:8pt;font-size:6pt" class="c">P</th><th style="width:8pt;font-size:6pt" class="c">A</th><th style="width:8pt;font-size:6pt" class="c">L</th>').join('')}
  <th></th>
</tr></thead>
<tbody>
${students.length ? students.map((st, idx) => {
  const m = attMap[st.id] || { present: 0, absent: 0, late: 0, total: 0 };
  const pct = m.total > 0 ? ((m.present / m.total) * 100).toFixed(1) : '';
  const remark = pct >= 95 ? 'Excellent' : pct >= 85 ? 'Good' : pct >= 75 ? 'Fair' : pct ? 'Poor' : '';
  return `<tr>
    <td class="c">${idx + 1}</td>
    <td>${esc(st.last_name)}, ${esc(st.first_name)}${st.extension_name ? ', ' + esc(st.extension_name) : ''}</td>
    <td class="c">${m.total || ''}</td>
    <td class="c">${m.present || ''}</td>
    <td class="c">${m.absent || ''}</td>
    <td class="c">${m.late || ''}</td>
    <td class="c"><strong>${pct}%</strong></td>
    ${monthKeys.map(key => {
      const mm = months[key];
      const sp = att.filter(a => a.student_id === st.id && `${a.year}-${String(a.month).padStart(2, '0')}` === key);
      return `<td class="c">${sp.filter(a => a.status === 'present').length || ''}</td>
             <td class="c">${sp.filter(a => a.status === 'absent').length || ''}</td>
             <td class="c">${sp.filter(a => a.status === 'late').length || ''}</td>`;
    }).join('')}
    <td class="c small">${remark}</td>
  </tr>`;
}).join('') : blankRows(30, monthKeys.length * 3 + 7)}
</tbody></table></div>
<div class="small" style="margin:6pt 0;">
  <strong>Legend:</strong> P=Present, A=Absent, L=Late &nbsp;|&nbsp;
  <strong>Attendance:</strong> Excellent (&#8805;95%) | Good (85-94%) | Fair (75-84%) | Poor (&lt;75%)
</div>
${signatureBlockHtml('', 'Class Adviser', '', 'School Head')}`;
}

/* ── SID: Student ID Card ─────────────────────────────── */

function renderSID(data, info) {
  const s = data?.student;
  if (!s) return '<p>Select a student to generate their ID card.</p>';
  return `
<div style="display:flex;gap:20pt;flex-wrap:wrap;justify-content:center;padding:16pt;">
  <div style="width:300pt;border:2pt solid #000;padding:12pt;text-align:center;font-family:'Times New Roman',serif;">
    <div style="font-size:8pt;font-weight:bold;color:#1a5276;">REPUBLIC OF THE PHILIPPINES</div>
    <div style="font-size:7pt;">Department of Education</div>
    <div style="font-size:8pt;font-weight:bold;margin-top:3pt;">${esc(info.school_name || 'Hinabangan National High School')}</div>
    <div style="font-size:7pt;">School ID: ${esc(info.school_id || '')}</div>
    <div style="font-size:7pt;">${esc(info.region || '')} · ${esc(info.division || '')}</div>
    <hr style="border:none;border-top:1.5pt solid #1a5276;margin:6pt 0;"/>
    <div style="font-size:9pt;font-weight:bold;margin:6pt 0;">STUDENT IDENTIFICATION CARD</div>
    <div style="width:80pt;height:80pt;border:1pt solid #ccc;margin:8pt auto;display:flex;align-items:center;justify-content:center;background:#f5f5f5;">
      ${s.photo_url ? `<img src="${esc(s.photo_url)}" style="width:80pt;height:80pt;object-fit:cover;" alt="Photo"/>` : '<span style="font-size:8pt;color:#999;">No Photo</span>'}
    </div>
    <div style="text-align:left;font-size:8pt;margin-top:8pt;">
      <div style="margin-bottom:3pt;"><strong>Name:</strong> ${esc(s.last_name)}, ${esc(s.first_name)}${s.extension_name ? ', ' + esc(s.extension_name) : ''}${s.middle_name ? ', ' + esc(s.middle_name) : ''}</div>
      <div style="margin-bottom:3pt;"><strong>LRN:</strong> ${esc(s.lrn || '____________________')}</div>
      <div style="margin-bottom:3pt;"><strong>Grade & Section:</strong> ${esc(s.grade_level || '____')} — ${esc(s.section_name || '____')}</div>
      <div style="margin-bottom:3pt;"><strong>Sex:</strong> ${esc(s.sex || '____')}</div>
      <div style="margin-bottom:3pt;"><strong>Birthdate:</strong> ${esc(s.birthdate || '____')}</div>
      <div style="margin-bottom:3pt;"><strong>Address:</strong> ${esc(s.address || '____________________________')}</div>
    </div>
    <hr style="border:none;border-top:1pt solid #ccc;margin:8pt 0;"/>
    <div style="font-size:7pt;color:#666;">
      <div>This card is for official use only.</div>
      <div>Valid SY: ${esc(info.school_year || '____-____')}</div>
    </div>
    <div style="margin-top:6pt;font-size:7pt;text-align:left;">
      <strong>School Head:</strong> ________________________
    </div>
  </div>
</div>`;
}

export { renderSF9Card, esc, MONTH_NAMES, MONTH_NUMS, TERM_MAP, CORE_VALUES };
