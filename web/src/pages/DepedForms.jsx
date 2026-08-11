import { useEffect, useState } from 'react';
import { Printer, FileSpreadsheet, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Spinner, ErrorBanner } from '../components/ui';
import { printElementHtml } from '../lib/export';

const FORMS = ['SF1', 'SF2', 'SF3', 'SF4', 'SF5', 'SF6', 'SF7', 'SF8', 'SF9', 'SF10'];
const FORM_NAMES = {
  SF1: 'School Register', SF2: 'Daily Attendance', SF3: 'Books Issued & Returned',
  SF4: 'Monthly Learner Movement & Attendance', SF5: 'Report on Promotion',
  SF6: 'Summarized Report on Promotion', SF7: 'School Personnel Assignment',
  SF8: 'Learner Health & Nutrition', SF9: 'Learner Progress Report Card', SF10: 'Learner Permanent Record',
};
const SY = '2025-2026';

const blank = '<span style="border-bottom:1px solid #000;display:inline-block;min-width:120px">&nbsp;</span>';

function h(...lines) {
  return lines.filter(Boolean).join('\n');
}

export default function DepedForms() {
  const [form, setForm] = useState('SF1');
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [roster, setRoster] = useState([]);
  const [cards, setCards] = useState(null);
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

  async function loadCards(allQuarters) {
    if (!sectionId) return;
    setBusy(true);
    setError('');
    try {
      const data = {};
      const quarters = allQuarters ? [1, 2, 3, 4] : [1];
      for (const st of roster) {
        data[st.id] = {};
        for (const q of quarters) {
          const r = await api(`/grades/report-card/${st.id}?school_year=${SY}&quarter=${q}`);
          data[st.id][q] = r;
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
  const fullName = (st) => `${cap(st.first_name)} ${cap(st.middle_name || '')} ${cap(st.last_name)}`.replace(/\s+/g, ' ').trim();
  const age = (st) => {
    if (!st.birth_date) return '';
    const b = new Date(st.birth_date);
    const diff = Math.floor((Date.now() - b.getTime()) / (365.25 * 24 * 3600 * 1000));
    return diff > 0 && diff < 100 ? diff : '';
  };

  function build() {
    const sch = 'Hinabangan National High School — Hinabangan, Samar';
    const sec = sections.find((s) => String(s.id) === String(sectionId));
    const lbl = `${sch}<br/>SY ${SY} ${sec ? '· ' + sec.name + ' (' + sec.grade_level + ')' : ''}`;

    if (form === 'SF1') {
      const rows = roster.map((st, i) =>
        `<tr><td class="c">${i + 1}</td><td>${st.lrn}</td><td>${fullName(st)}</td><td class="c">${st.sex}</td><td class="c">${st.birth_date || ''}</td><td class="c">${age(st)}</td><td>${st.address || ''}</td><td>${st.guardian_name || ''}</td></tr>`).join('');
      return {
        title: 'SF1 – School Register',
        body: h(
          `<h3 class="center">${lbl}</h3><h4 class="center">SCHOOL REGISTER (SF1)</h4>`,
          `<table><thead><tr><th>No.</th><th>LRN</th><th>Name of Learner</th><th>Sex</th><th>Birthdate</th><th>Age</th><th>Address</th><th>Parent/Guardian</th></tr></thead><tbody>${rows}</tbody></table>`,
          `<p class="center">Prepared by: ${blank} &nbsp;&nbsp;&nbsp; Checked by: ${blank}</p>`),
      };
    }
    if (form === 'SF2') {
      const rows = roster.map((st, i) =>
        `<tr><td class="c">${i + 1}</td><td>${st.lrn}</td><td>${fullName(st)}</td>${'<td></td>'.repeat(7)}<td class="c">${i + 1}</td></tr>`).join('');
      return {
        title: 'SF2 – Daily Attendance',
        body: h(
          `<h3 class="center">${lbl}</h3><h4 class="center">DAILY ATTENDANCE SHEET (SF2)</h4>`,
          `<table><thead><tr><th>No.</th><th>LRN</th><th>Name of Learner</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Total Days Present</th><th>No. of Times Absent</th></tr></thead><tbody>${rows}</tbody></table>`,
          `<p><b>Marking legend:</b> marks denote attendance; letters denote absences (S=skipped, X=excused, U=unexcused). Prepared by: ${blank} &nbsp; Noted by: ${blank}</p>`),
      };
    }
    if (form === 'SF3') {
      const rows = roster.map((st, i) =>
        `<tr><td class="c">${i + 1}</td><td>${fullName(st)}</td><td>${blank}</td><td>${blank}</td><td>${blank}</td><td>${blank}</td><td class="c">${i + 1}</td></tr>`).join('');
      return {
        title: 'SF3 – Books Issued & Returned',
        body: h(
          `<h3 class="center">${lbl}</h3><h4 class="center">BOOKS ISSUED & RETURNED (SF3)</h4>`,
          `<table><thead><tr><th>No.</th><th>Name of Learner</th><th>Title of Book</th><th>Date Issued</th><th>Date Returned</th><th>Condition</th><th>No. of Books Issued</th></tr></thead><tbody>${rows}</tbody></table>`,
          `<p class="center">Prepared by: ${blank} &nbsp;&nbsp;&nbsp; Noted by: ${blank}</p>`),
      };
    }
    if (form === 'SF4') {
      const enrolled = roster.length;
      const rows = roster.map((st, i) =>
        `<tr><td class="c">${i + 1}</td><td>${st.lrn}</td><td>${fullName(st)}</td><td class="c">${st.sex}</td><td class="c">${st.status || 'Enrolled'}</td><td class="c">${i + 1}</td><td></td><td></td><td></td></tr>`).join('');
      return {
        title: 'SF4 – Monthly Learner Movement',
        body: h(
          `<h3 class="center">${lbl}</h3><h4 class="center">MONTHLY REPORT ON LEARNER MOVEMENT AND ATTENDANCE (SF4)</h4>`,
          `<p>Month: ${blank} &nbsp;&nbsp; Enrolled this month: <b>${enrolled}</b></p>`,
          `<table><thead><tr><th>No.</th><th>LRN</th><th>Name</th><th>Sex</th><th>Status</th><th>Enrolled</th><th>Transferred In</th><th>Transferred Out</th><th>Dropped</th></tr></thead><tbody>${rows}</tbody></table>`,
          `<p class="center">Prepared by: ${blank} &nbsp;&nbsp;&nbsp; Checked by: ${blank}</p>`),
      };
    }
    if (form === 'SF5') {
      const rows = (roster || []).map((st, i) => {
        const c = cards && cards[st.id];
        const avg = c && Object.keys(c).some((q) => c[q].general_average != null)
          ? Math.round(([1, 2, 3, 4].reduce((s, q) => s + (c[q].general_average || 0), 0) / 4) * 100) / 100
          : null;
        const res = avg == null ? '' : avg >= 75 ? 'Promoted' : 'Retained / Remediation';
        return `<tr><td class="c">${i + 1}</td><td>${st.lrn}</td><td>${fullName(st)}</td><td class="c">${st.sex}</td><td class="c">${avg ?? ''}</td><td class="c">${res}</td></tr>`;
      }).join('');
      return {
        title: 'SF5 – Report on Promotion',
        body: h(
          `<h3 class="center">${lbl}</h3><h4 class="center">REPORT ON PROMOTION AND LEVEL OF PROFICIENCY (SF5)</h4>`,
          cards ? `<table><thead><tr><th>No.</th><th>LRN</th><th>Name of Learner</th><th>Sex</th><th>General Average</th><th>Promotion Status</th></tr></thead><tbody>${rows}</tbody></table>`
            : `<p>Click "Generate from grades" first.</p>`),
      };
    }
    if (form === 'SF6') {
      let promoted = 0, retained = 0, noData = 0;
      for (const st of roster || []) {
        const c = cards && cards[st.id];
        const avg = c ? [1, 2, 3, 4].reduce((s, q) => s + (c[q].general_average || 0), 0) / 4 : null;
        if (avg == null) noData++;
        else if (avg >= 75) promoted++;
        else retained++;
      }
      return {
        title: 'SF6 – Summarized Report on Promotion',
        body: h(
          `<h3 class="center">${lbl}</h3><h4 class="center">SUMMARIZED REPORT ON PROMOTION (SF6)</h4>`,
          `<table><thead><tr><th>Grade Level</th><th>Total Enrolled</th><th>Promoted</th><th>Retained</th><th>Under Remediation</th></tr></thead><tbody><tr><td>${sec ? sec.grade_level : ''} ${sec ? sec.name : ''}</td><td class="c">${roster.length}</td><td class="c">${promoted || ''}</td><td class="c">${retained || ''}</td><td class="c">${noData ? noData : ''}</td></tr></tbody></table>`,
          `<p class="center">Prepared by: ${blank} &nbsp;&nbsp;&nbsp; Certified by: ${blank}</p>`),
      };
    }
    if (form === 'SF7') {
      const rows = teachers.map((t, i) =>
        `<tr><td class="c">${i + 1}</td><td>${t.employee_no || ''}</td><td>${fullName(t)}</td><td>${t.position || ''}</td><td>${t.sex || ''}</td><td></td></tr>`).join('');
      return {
        title: 'SF7 – School Personnel Assignment',
        body: h(
          `<h3 class="center">${sch}<br/>SY ${SY}</h3><h4 class="center">SCHOOL PERSONNEL ASSIGNMENT (SF7)</h4>`,
          `<table><thead><tr><th>No.</th><th>Employee No.</th><th>Name of Personnel</th><th>Position</th><th>Sex</th><th>Grade/Class Assigned</th></tr></thead><tbody>${rows}</tbody></table>`),
      };
    }
    if (form === 'SF8') {
      const rows = roster.map((st, i) =>
        `<tr><td class="c">${i + 1}</td><td>${st.lrn}</td><td>${fullName(st)}</td><td class="c">${st.sex}</td><td class="c">${st.birth_date || ''}</td><td class="c">${age(st)}</td><td>${blank}</td><td>${blank}</td><td>${st.guardian_name || ''}</td></tr>`).join('');
      return {
        title: 'SF8 – Learner Health & Nutrition',
        body: h(
          `<h3 class="center">${lbl}</h3><h4 class="center">LEARNER HEALTH AND NUTRITION REPORT (SF8)</h4>`,
          `<table><thead><tr><th>No.</th><th>LRN</th><th>Name</th><th>Sex</th><th>Birthdate</th><th>Age</th><th>Height (cm)</th><th>Weight (kg)</th><th>Parent/Guardian</th></tr></thead><tbody>${rows}</tbody></table>`),
      };
    }
    if (form === 'SF9' || form === 'SF10') {
      const gradeRowsFor = (c, q) =>
        (c[q] ? c[q].subjects.filter((x) => x.computed_grade != null) : [])
          .map((x) => `<tr><td>${x.title}</td><td class="c">${x.written_work ?? ''}</td><td class="c">${x.performance_task ?? ''}</td><td class="c">${x.quarterly_exam ?? ''}</td><td class="c">${x.computed_grade}</td><td class="c">${x.remarks}</td></tr>`).join('');
      const rows = (roster || []).map((st, i) => {
        const c = cards && cards[st.id];
        const header = `<tr><th>Subject</th><th>WW</th><th>PT</th><th>QA</th><th>Final Grade</th><th>Remarks</th></tr>`;
        const quarters = form === 'SF9' ? [1] : [1, 2, 3, 4];
        const qBlocks = quarters
          .map((q) => (c && c[q] && gradeRowsFor(c, q)
            ? `<div style="margin:4px 0"><b>Quarter ${q}</b>${c[q].general_average != null ? ` — General Average: ${c[q].general_average}` : ''}</div><table style="font-size:9pt"><thead>${header}</thead><tbody>${gradeRowsFor(c, q)}</tbody></table>`
            : ''))
          .filter(Boolean).join('');
        return `<div style="border:1px solid #000;padding:8px;margin:6px 0">
          <b>${i + 1}. ${fullName(st)}</b> &nbsp; LRN: ${st.lrn} &nbsp; ${st.sex} &nbsp; Birthdate: ${st.birth_date || ''}
          ${c ? qBlocks : ''}
        </div>`;
      }).join('');
      return {
        title: form === 'SF9' ? 'SF9 – Learner Progress Report Card' : 'SF10 – Learner Permanent Record',
        body: h(
          `<h3 class="center">${sch}</h3><h4 class="center">${form === 'SF9' ? 'LEARNER PROGRESS REPORT CARD (SF9)' : 'LEARNER PERMANENT RECORD (SF10)'}</h4>`,
          cards ? rows : `<p>Click "Generate from grades" first.</p>`),
      };
    }
    return { title: form, body: '' };
  }

  const doc = build();

  return (
    <div>
      <PageHead title="DepEd School Forms" sub="Live-populated SF1–SF10 forms with print/PDF export — no paper, no retyping.">
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
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.grade_level})</option>)}
            </select>
          </label>
          {(form === 'SF5' || form === 'SF6' || form === 'SF9' || form === 'SF10') && (
            <label className="form-inline">
              <button className="btn" onClick={() => loadCards(form === 'SF10' || form === 'SF5' || form === 'SF6')} disabled={busy || !sectionId}>
                {busy ? <Loader2 size={14} className="spin" /> : <FileSpreadsheet size={14} />} {cards ? 'Refresh from grades' : 'Generate from grades'}
              </button>
            </label>
          )}
        </div>
        {!preview && (form === 'SF5' || form === 'SF6' || form === 'SF9' || form === 'SF10') && (
          <div className="notice warn">This form is populated from encoded class records. Click <b>Generate from grades</b> to pull live data.</div>
        )}
        <div className="sub" style={{ margin: '8px 0' }}>Tip: use Print / Save as PDF for your SF submission copies. SF2/SF3 stay blank for day-to-day encoding.</div>
      </div>

      <div className="card form-preview linux">
        <div className="preview-label">Live preview — {doc.title}</div>
        <div className="preview-body" dangerouslySetInnerHTML={{ __html: doc.body }} />
      </div>
    </div>
  );
}