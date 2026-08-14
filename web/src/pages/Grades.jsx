import { useEffect, useState } from 'react';
import { Save, FileText } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Badge, Modal, Empty, ErrorBanner, Spinner } from '../components/ui';

const TERMS = [1, 2, 3];

export default function Grades() {
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [schoolYear, setSchoolYear] = useState('2026-2027');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [term, setTerm] = useState(1);
  const [rows, setRows] = useState(null);
  const [weights, setWeights] = useState(null);
  const [scale, setScale] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, sub] = await Promise.all([api('/sections?limit=200'), api('/subjects?limit=200')]);
        setSections(s.data);
        setSubjects(sub.data);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  async function loadClass() {
    if (!sectionId || !subjectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api(`/grades/class?section_id=${sectionId}&subject_id=${subjectId}&school_year=${encodeURIComponent(schoolYear)}&term=${term}`);
      setRows(res.data);
      setWeights(res.weights);
      setScale(res.scale);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function update(studentId, key, value) {
    setRows((rs) => rs.map((r) => (r.id === studentId ? { ...r, [key]: value === '' ? null : Number(value) } : r)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = rows
        .filter((r) => r.written_work != null || r.performance_task != null || r.quarterly_exam != null)
        .map((r) => ({ student_id: r.id, written_work: r.written_work, performance_task: r.performance_task, quarterly_exam: r.quarterly_exam }));
      const res = await api('/grades/class', {
        method: 'POST',
        body: { section_id: Number(sectionId), subject_id: Number(subjectId), school_year: schoolYear, term, rows: payload },
      });
      alert(`Saved grades for ${res.saved} student(s).`);
      loadClass();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function viewReportCard(studentId) {
    const res = await api(`/grades/report-card/${studentId}?school_year=${encodeURIComponent(schoolYear)}&term=${term}`);
    setReport(res);
  }

  const section = sections.find((s) => s.id === Number(sectionId));
  const subject = subjects.find((s) => s.id === Number(subjectId));

  return (
    <>
      <PageHead
        title="Class Records"
        sub="Enter written work, performance tasks, and term assessments — grades are computed automatically (DepEd weights, 3-term calendar)"
      />
      <ErrorBanner error={error} />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ alignItems: 'end' }}>
          <div>
            <label>Section</label>
            <select value={sectionId} onChange={(e) => { setSectionId(e.target.value); setRows(null); }}>
              <option value="">— select —</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label>Subject</label>
            <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setRows(null); }}>
              <option value="">— select —</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.title}</option>)}
            </select>
          </div>
          <div>
            <label>School year</label>
            <input value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} />
          </div>
          <div>
            <label>Term</label>
            <div className="seg">
              {TERMS.map((t) => (
                <button key={t} className={term === t ? 'on' : ''} onClick={() => { setTerm(t); setRows(null); }} type="button">{t}</button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" onClick={loadClass} disabled={!sectionId || !subjectId}>Load class</button>
        </div>
      </div>

      {loading && <Spinner />}

      {rows && weights && (
        <div className="card table-wrap">
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
            <strong>{section?.name} · {subject?.title}</strong>
            <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              Weights: Written Work {weights.written_work}% · Performance Tasks {weights.performance_task}% · Term {weights.quarterly_exam}%
              {scale && <> · Scale: <strong>{scale.name}</strong></>}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={save} disabled={saving}><Save size={14} /> {saving ? 'Saving…' : 'Save grades'}</button>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>LRN</th><th>Learner</th>
                <th style={{ textAlign: 'center' }}>Written Work ({weights.written_work}%)</th>
                <th style={{ textAlign: 'center' }}>Performance Task ({weights.performance_task}%)</th>
                <th style={{ textAlign: 'center' }}>Term Exam ({weights.quarterly_exam}%)</th>
                <th style={{ textAlign: 'center' }}>Final Grade</th>
                <th>Remarks</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12.5 }}>{r.lrn}</td>
                  <td>{r.last_name}, {r.first_name}</td>
                  <td style={{ textAlign: 'center' }}>
                    <input className="grade-input" type="number" min="0" max="100" value={r.written_work ?? ''} onChange={(e) => update(r.id, 'written_work', e.target.value)} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input className="grade-input" type="number" min="0" max="100" value={r.performance_task ?? ''} onChange={(e) => update(r.id, 'performance_task', e.target.value)} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input className="grade-input" type="number" min="0" max="100" value={r.quarterly_exam ?? ''} onChange={(e) => update(r.id, 'quarterly_exam', e.target.value)} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {r.computed_grade != null
                      ? <><strong>{r.computed_grade}</strong>{r.letter && <span style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 4 }}>{r.letter}</span>}</>
                      : '—'}
                  </td>
                  <td>{r.remarks ? <Badge status={r.remarks} /> : '—'}</td>
                  <td>
                    <button className="btn btn-sm" title="Report card" onClick={() => viewReportCard(r.id)}><FileText size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows && rows.length === 0 && <Empty text="No enrolled students in this section." />}

      {report && (
        <Modal
          title={`Report Card — ${report.student.last_name}, ${report.student.first_name}`}
          sub={`LRN ${report.student.lrn} · ${report.school_year} · Term ${report.term || report.quarter}`}
          onClose={() => setReport(null)}
          wide
        >
          <table>
            <thead>
              <tr><th>Subject</th><th style={{ textAlign: 'center' }}>WW</th><th style={{ textAlign: 'center' }}>PT</th><th style={{ textAlign: 'center' }}>QA</th><th style={{ textAlign: 'center' }}>Grade</th><th style={{ textAlign: 'center' }}>Letter</th><th>Remarks</th></tr>
            </thead>
            <tbody>
              {report.subjects.map((s, i) => (
                <tr key={i}>
                  <td>{s.code} — {s.title}</td>
                  <td style={{ textAlign: 'center' }}>{s.written_work ?? '—'}</td>
                  <td style={{ textAlign: 'center' }}>{s.performance_task ?? '—'}</td>
                  <td style={{ textAlign: 'center' }}>{s.quarterly_exam ?? '—'}</td>
                  <td style={{ textAlign: 'center' }}>{s.computed_grade ?? '—'}</td>
                  <td style={{ textAlign: 'center' }}>{s.letter || '—'}</td>
                  <td>{s.remarks ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 14, fontSize: 15, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {report.general_average != null && <span>General Average: <strong>{report.general_average}</strong></span>}
            {report.gpa != null && <span>GPA: <strong>{report.gpa}</strong></span>}
            {report.scale && <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>Scale: {report.scale.name}</span>}
          </div>
        </Modal>
      )}
    </>
  );
}
