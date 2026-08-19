import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, FileText, Target, Printer } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Badge, Modal, Empty, ErrorBanner, Spinner } from '../components/ui';
import { printElementHtml } from '../lib/export';

const TERMS = [1, 2, 3];
const LEVEL_COLORS = { Advanced: '#2FD6A0', Proficient: '#4D96FF', 'Approaching Proficiency': '#F5B942', Developing: '#FB7185', Beginning: '#F2555A' };

export default function Grades() {
  const { t } = useTranslation();
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
  const [compMode, setCompMode] = useState(false);
  const [competencies, setCompetencies] = useState([]);
  const [compScores, setCompScores] = useState({});
  const [compSaving, setCompSaving] = useState(false);

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
      if (compMode) loadCompetencies();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCompetencies() {
    if (!subjectId) return;
    try {
      const r = await api(`/competency-tracker/competencies?subject_id=${subjectId}&quarter=${term}`);
      setCompetencies(r.data || []);
      const sc = await api(`/competency-tracker/scores?section_id=${sectionId}&subject_id=${subjectId}&school_year=${encodeURIComponent(schoolYear)}&quarter=${term}`);
      const map = {};
      for (const s of (sc.data || [])) map[`${s.student_id}-${s.competency_id}`] = s;
      setCompScores(map);
    } catch { setCompetencies([]); setCompScores({}); }
  }

  async function saveCompScores() {
    setCompSaving(true);
    try {
      const scoreArr = [];
      for (const st of (rows || [])) {
        for (const c of competencies) {
          const key = `${st.id}-${c.id}`;
          const val = compScores[key]?.score;
          if (val != null && val !== '') scoreArr.push({ student_id: st.id, competency_id: c.id, score: Number(val) });
        }
      }
      await api('/competency-tracker/scores/batch', {
        method: 'POST', body: { scores: scoreArr, school_year: schoolYear, quarter: term, subject_id: subjectId, section_id: sectionId },
      });
      alert(`Saved ${scoreArr.length} competency scores.`);
      loadCompetencies();
    } catch (e) { setError(e.message); } finally { setCompSaving(false); }
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

  function printClassRecord() {
    if (!rows || !rows.length || !section || !subject) return;
    const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const headers = `<tr><th style="border:1px solid #000;padding:3pt;font-size:8pt;width:20pt">#</th><th style="border:1px solid #000;padding:3pt;font-size:8pt;min-width:100pt">Name</th><th style="border:1px solid #000;padding:3pt;font-size:8pt;text-align:center;width:25pt">WW</th><th style="border:1px solid #000;padding:3pt;font-size:8pt;text-align:center;width:25pt">PT</th><th style="border:1px solid #000;padding:3pt;font-size:8pt;text-align:center;width:25pt">QA</th><th style="border:1px solid #000;padding:3pt;font-size:8pt;text-align:center;width:25pt">Final</th><th style="border:1px solid #000;padding:3pt;font-size:8pt;text-align:center;width:25pt">Remarks</th></tr>`;
    const bodyRows = rows.map((r, i) => {
      const avg = r.written_work != null || r.performance_task != null || r.quarterly_exam != null
        ? ((Number(r.written_work || 0) * (weights?.written_work || 30) + Number(r.performance_task || 0) * (weights?.performance_task || 50) + Number(r.quarterly_exam || 0) * (weights?.quarterly_exam || 20)) / 100).toFixed(1)
        : '';
      const remark = avg && Number(avg) >= 75 ? 'Passed' : avg ? 'Did Not Pass' : '';
      return `<tr><td style="border:1px solid #000;padding:3pt;font-size:8pt;text-align:center">${i + 1}</td><td style="border:1px solid #000;padding:3pt;font-size:8pt">${escHtml(r.last_name)}, ${escHtml(r.first_name)}</td><td style="border:1px solid #000;padding:3pt;font-size:8pt;text-align:center">${r.written_work ?? ''}</td><td style="border:1px solid #000;padding:3pt;font-size:8pt;text-align:center">${r.performance_task ?? ''}</td><td style="border:1px solid #000;padding:3pt;font-size:8pt;text-align:center">${r.quarterly_exam ?? ''}</td><td style="border:1px solid #000;padding:3pt;font-size:8pt;text-align:center;font-weight:bold">${avg}</td><td style="border:1px solid #000;padding:3pt;font-size:8pt;text-align:center">${remark}</td></tr>`;
    }).join('');
    const html = `
<div style="text-align:center;margin-bottom:6pt;">
  <div style="font-size:10pt;font-weight:bold;">REPUBLIC OF THE PHILIPPINES</div>
  <div style="font-size:8pt;">Department of Education</div>
  <div style="font-size:9pt;font-weight:bold;margin-top:4pt;">Class Record</div>
</div>
<table style="font-size:8pt;margin-bottom:4pt;border:none;">
  <tr><td style="border:none;width:50%"><strong>Section:</strong> ${escHtml(section.name)}</td><td style="border:none"><strong>School Year:</strong> ${escHtml(schoolYear)}</td></tr>
  <tr><td style="border:none"><strong>Subject:</strong> ${escHtml(subject.title)}</td><td style="border:none"><strong>Term:</strong> ${term}</td></tr>
</table>
<table style="font-size:8pt;border-collapse:collapse;">${headers}<tbody>${bodyRows}</tbody></table>
<div style="margin-top:12pt;font-size:8pt;">
  <strong>Grading Weights:</strong> Written Work ${weights?.written_work || 30}% · Performance Task ${weights?.performance_task || 50}% · Term Exam ${weights?.quarterly_exam || 20}%<br/>
  <strong>Remarks:</strong> Passed (&#8805;75) | Did Not Pass (&lt;75)
</div>
<div style="margin-top:12pt;font-size:8pt;display:flex;gap:24pt;">
  <div style="text-align:center;">________________________________<br/><strong>${escHtml(section.name)}</strong><br/>Class Adviser</div>
  <div style="text-align:center;">________________________________<br/><strong>School Head</strong></div>
</div>`;
    const css = `@page{size:legal landscape;margin:0.5in}body{font-family:'Times New Roman',serif;font-size:11pt;color:#000}table{border-collapse:collapse}td,th{border:1px solid #000;padding:3pt}`;
    const full = `<!doctype html><html><head><meta charset="utf-8"><title>Class Record</title><style>${css}</style></head><body>${html}</body></html>`;
    printElementHtml('Class Record', full, { orientation: 'landscape', paper: 'legal' });
  }

  return (
    <>
      <PageHead
        title={t('grades.title')}
        sub={t('grades.subtitle')}
      />
      <ErrorBanner error={error} />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ alignItems: 'end' }}>
          <div>
            <label>{t('grades.section')}</label>
            <select value={sectionId} onChange={(e) => { setSectionId(e.target.value); setRows(null); }}>
              <option value="">{t('common.select')}</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label>{t('grades.subject')}</label>
            <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setRows(null); }}>
              <option value="">{t('common.select')}</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.title}</option>)}
            </select>
          </div>
          <div>
            <label>{t('grades.schoolYear')}</label>
            <input value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} />
          </div>
          <div>
            <label>{t('grades.term')}</label>
            <div className="seg">
              {TERMS.map((termVal) => (
                <button key={termVal} className={term === termVal ? 'on' : ''} onClick={() => { setTerm(termVal); setRows(null); }} type="button">{termVal}</button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" onClick={loadClass} disabled={!sectionId || !subjectId}>{t('grades.loadClass')}</button>
        </div>
      </div>

      {loading && <Spinner />}

      {rows && weights && (
        <div className="card table-wrap">
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
            <strong>{section?.name} · {subject?.title}</strong>
            <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              {t('grades.weights')} Written Work {weights.written_work}% · Performance Tasks {weights.performance_task}% · Term {weights.quarterly_exam}%
              {scale && <> · {t('grades.scaleLabel')} <strong>{scale.name}</strong></>}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className={`btn ${compMode ? 'btn-primary' : ''}`} onClick={() => { setCompMode(!compMode); if (!compMode) loadCompetencies(); }} type="button">
                <Target size={14} /> {compMode ? 'Grade Mode' : 'Competency Mode'}
              </button>
              <button className="btn" onClick={printClassRecord} disabled={!rows || !rows.length} type="button">
                <Printer size={14} /> Print Class Record
              </button>
              <button className="btn btn-primary" onClick={compMode ? saveCompScores : save} disabled={saving || compSaving}>
                <Save size={14} /> {compSaving ? 'Saving…' : saving ? t('common.saving') : t('grades.saveGrades')}
              </button>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>{t('grades.lrn')}</th><th>{t('grades.learner')}</th>
                <th style={{ textAlign: 'center' }}>{t('grades.writtenWork')} ({weights.written_work}%)</th>
                <th style={{ textAlign: 'center' }}>{t('grades.performanceTask')} ({weights.performance_task}%)</th>
                <th style={{ textAlign: 'center' }}>{t('grades.termExam')} ({weights.quarterly_exam}%)</th>
                <th style={{ textAlign: 'center' }}>{t('grades.finalGrade')}</th>
                <th>{t('grades.remarks')}</th><th></th>
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
                    <button className="btn btn-sm" title={t('grades.reportCard')} onClick={() => viewReportCard(r.id)}><FileText size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {compMode && competencies.length > 0 && (
            <div style={{ marginTop: 20, borderTop: '2px solid var(--border)', paddingTop: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14 }}><Target size={14} /> Competency Scores</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Learner</th>
                      {competencies.map((c) => <th key={c.id} style={{ textAlign: 'center', minWidth: 70 }}>{c.code}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{r.last_name}, {r.first_name}</td>
                        {competencies.map((c) => {
                          const key = `${r.id}-${c.id}`;
                          const val = compScores[key]?.score ?? '';
                          return (
                            <td key={c.id} style={{ textAlign: 'center' }}>
                              <input className="grade-input" type="number" min="0" max="100" value={val}
                                onChange={(e) => setCompScores((prev) => ({ ...prev, [key]: { ...prev[key], score: e.target.value ? Number(e.target.value) : null, student_id: r.id, competency_id: c.id } }))}
                                style={{ width: 60 }} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="sub" style={{ marginTop: 6 }}>Enter 0-100 scores per competency. Levels are auto-assigned: Beginning (&lt;75), Developing (75-79), Approaching (80-84), Proficient (85-89), Advanced (90+).</div>
            </div>
          )}
        </div>
      )}

      {rows && rows.length === 0 && <Empty text={t('grades.noEnrolled')} />}

      {report && (
        <Modal
          title={`${t('grades.reportCard')} — ${report.student.last_name}, ${report.student.first_name}`}
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
            {report.general_average != null && <span>{t('grades.generalAverage')} <strong>{report.general_average}</strong></span>}
            {report.gpa != null && <span>{t('grades.gpa')} <strong>{report.gpa}</strong></span>}
            {report.scale && <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>{t('grades.scaleLabel')} {report.scale.name}</span>}
          </div>
        </Modal>
      )}
    </>
  );
}
