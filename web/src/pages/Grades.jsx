import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, FileText, Target, Printer, Copy, Download } from 'lucide-react';
import { api } from '../lib/api';
import { printElementHtml, downloadFromApi } from '../lib/export';
import { useToast } from '../components/Toast';
import { PageHead, ErrorBanner, Badge, Empty, Modal, Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';

const TERMS = [1, 2, 3];

function getGradeBandStyle(grade) {
  if (grade == null || grade === '') return {};
  const g = Number(grade);
  if (g < 75) {
    return { background: 'rgba(214, 69, 69, 0.15)', color: 'var(--danger)', padding: '4px 10px', borderRadius: 8, fontWeight: 800, display: 'inline-block' };
  }
  if (g >= 90) {
    return { background: 'rgba(46, 158, 91, 0.15)', color: 'var(--success)', padding: '4px 10px', borderRadius: 8, fontWeight: 800, display: 'inline-block' };
  }
  return { background: 'rgba(232, 163, 23, 0.15)', color: 'var(--warn)', padding: '4px 10px', borderRadius: 8, fontWeight: 700, display: 'inline-block' };
}

export default function Grades() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);
  const [myTeacher, setMyTeacher] = useState(null);
  const [teacherAssignments, setTeacherAssignments] = useState([]);
  const [isAdvisoryMode, setIsAdvisoryMode] = useState(false);
  const [advisorySummary, setAdvisorySummary] = useState(null);
  const [advisoryLoading, setAdvisoryLoading] = useState(false);
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
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [secRes, subRes, teaRes, asgRes] = await Promise.all([
          api('/sections?limit=200'),
          api('/subjects?limit=200'),
          isTeacher ? api('/teachers?limit=200').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          isTeacher ? api('/schedule/assignments?school_year=' + encodeURIComponent(schoolYear)).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        ]);
        setAllSections(secRes.data || []);
        setAllSubjects(subRes.data || []);

        if (isTeacher) {
          const tea = (teaRes.data || []).find((t) => t.user_id === user?.id);
          setMyTeacher(tea || null);
          const asg = (asgRes.data || []).filter((a) => a.teacher_id === tea?.id);
          setTeacherAssignments(asg);

          const assignedSecIds = new Set(asg.map((a) => Number(a.section_id)));
          const filteredSec = (secRes.data || []).filter(
            (s) => Number(s.adviser_id) === Number(tea?.id) || Number(s.adviser_teacher_id) === Number(tea?.id) || assignedSecIds.has(Number(s.id))
          );
          setSections(filteredSec);
        } else {
          setSections(secRes.data || []);
          setSubjects(subRes.data || []);
        }
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [isTeacher, user?.id, schoolYear]);

  useEffect(() => {
    if (!sectionId) {
      if (isTeacher) setSubjects([]);
      return;
    }
    if (isTeacher && myTeacher) {
      const allowedSubIds = new Set(
        teacherAssignments
          .filter((a) => String(a.section_id) === String(sectionId))
          .map((a) => Number(a.subject_id))
      );
      setSubjects(allSubjects.filter((s) => allowedSubIds.has(Number(s.id))));
    } else {
      setSubjects(allSubjects);
    }
  }, [sectionId, isTeacher, myTeacher, teacherAssignments, allSubjects]);

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

  useEffect(() => {
    loadClass();
  }, [sectionId, subjectId, schoolYear, term]);

  useEffect(() => {
    if (!sectionId || !subjectId) return;
    const interval = setInterval(() => {
      // Never clobber in-progress edits: skip the tick while the user has
      // unsaved changes, a save is running, or the tab isn't focused.
      if (dirtyRef.current || savingRef.current || !document.hasFocus()) return;
      api(`/grades/class?section_id=${sectionId}&subject_id=${subjectId}&school_year=${encodeURIComponent(schoolYear)}&term=${term}`)
        .then((res) => {
          setRows(res.data);
          setWeights(res.weights);
          setScale(res.scale);
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [sectionId, subjectId, schoolYear, term]);

  async function loadCompetencies() {
    if (!subjectId) return;
    try {
      const r = await api(`/competency-tracker/competencies?subject_id=${subjectId}&quarter=${term}`);
      setCompetencies(r.data || []);
      const sc = await api(`/competency-tracker/scores?section_id=${sectionId}&subject_id=${subjectId}&school_year=${encodeURIComponent(schoolYear)}&quarter=${term}`);
      const map = {};
      for (const s of (sc.data || [])) map[`${s.student_id}-${s.competency_id}`] = s;
      setCompScores(map);
      setError(null);
    } catch (e) { setError(e.message); }
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
      toast.success(`Saved ${scoreArr.length} competency scores.`);
      loadCompetencies();
    } catch (e) { setError(e.message); } finally { setCompSaving(false); }
  }

  function update(studentId, key, value) {
    dirtyRef.current = true;
    setRows((rs) => rs ? rs.map((r) => (r.id === studentId ? { ...r, [key]: value === '' ? null : Number(value) } : r)) : []);
  }

  function quickFill(key, value) {
    dirtyRef.current = true;
    const n = value === '' ? null : Number(value);
    setRows((rs) => rs ? rs.map((r) => ({ ...r, [key]: n != null && (n < 0 || n > 100) ? r[key] : n })) : []);
  }

  const GRADE_COLS = ['written_work', 'performance_task', 'quarterly_exam'];

  function gradeNav(e) {
    const el = e.target;
    const row = Number(el.dataset.row);
    const col = Number(el.dataset.col);
    let targetRow = row;
    let targetCol = col;

    if (e.key === 'ArrowUp') { targetRow = Math.max(0, row - 1); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { targetRow = Math.min(rows.length - 1, row + 1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' && el.selectionStart === 0) { targetCol = Math.max(0, col - 1); e.preventDefault(); }
    else if (e.key === 'ArrowRight' && el.selectionStart === el.value.length) { targetCol = Math.min(GRADE_COLS.length - 1, col + 1); e.preventDefault(); }
    else if (e.key === 'Tab' && !e.shiftKey) {
      targetCol = col + 1;
      if (targetCol >= GRADE_COLS.length) { targetCol = 0; targetRow = Math.min(rows.length - 1, row + 1); }
      e.preventDefault();
    }
    else if (e.key === 'Tab' && e.shiftKey) {
      targetCol = col - 1;
      if (targetCol < 0) { targetCol = GRADE_COLS.length - 1; targetRow = Math.max(0, row - 1); }
      e.preventDefault();
    }
    else if (e.key === 'Enter') { targetRow = Math.min(rows.length - 1, row + 1); e.preventDefault(); }
    else if (e.key === 'Escape') { el.blur(); return; }
    else if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
      const val = el.value;
      if (val) { navigator.clipboard?.writeText(val); e.preventDefault(); }
      return;
    }
    else if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
      navigator.clipboard?.readText().then((text) => {
        const num = Number(text.trim());
        if (!isNaN(num) && num >= 0 && num <= 100) {
          update(rows[row].id, GRADE_COLS[col], num);
        }
      }).catch(() => {});
      e.preventDefault();
      return;
    }
    else return;

    const target = el.closest('table')?.querySelector(`[data-row="${targetRow}"][data-col="${targetCol}"]`);
    if (target) { target.focus(); target.select(); }
  }

  async function save() {
    setSaving(true);
    savingRef.current = true;
    setError(null);
    try {
      const payload = rows
        .filter((r) => r.written_work != null || r.performance_task != null || r.quarterly_exam != null)
        .map((r) => ({ student_id: r.id, written_work: r.written_work, performance_task: r.performance_task, quarterly_exam: r.quarterly_exam }));
      const res = await api('/grades/class', {
        method: 'POST',
        body: { section_id: Number(sectionId), subject_id: Number(subjectId), school_year: schoolYear, term, rows: payload },
      });
      dirtyRef.current = false;
      toast.success(`Saved grades for ${res.saved} student(s).`);
      loadClass();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }

  async function viewReportCard(studentId) {
    try {
      const res = await api(`/grades/report-card/${studentId}?school_year=${encodeURIComponent(schoolYear)}&term=${term}`);
      setReport(res);
    } catch (e) {
      setError(e.message);
    }
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

  const exportClassRecord = async () => {
    if (!sectionId || !subjectId) return;
    try {
      const params = new URLSearchParams({ format: 'xlsx', section_id: sectionId, subject_id: subjectId, school_year: schoolYear, term });
      await downloadFromApi(`/grades/export?${params.toString()}`, 'class-record.xlsx');
    } catch (e) {
      setError(e.message);
    }
  };

  async function loadAdvisorySummary() {
    if (!sectionId) return;
    setAdvisoryLoading(true);
    setError(null);
    try {
      const asgRes = await api(`/schedule/assignments?school_year=${encodeURIComponent(schoolYear)}`);
      const sectionAssignments = (asgRes.data || []).filter((a) => String(a.section_id) === String(sectionId));

      const subjectGrades = await Promise.all(
        sectionAssignments.map((a) =>
          api(`/grades/class?section_id=${sectionId}&subject_id=${a.subject_id}&school_year=${encodeURIComponent(schoolYear)}&term=${term}`)
            .then((r) => ({ subject: a, data: r.data || [] }))
            .catch(() => ({ subject: a, data: [] }))
        )
      );

      const studentMap = new Map();
      for (const sg of subjectGrades) {
        for (const st of sg.data) {
          if (!studentMap.has(st.id)) {
            studentMap.set(st.id, {
              id: st.id,
              lrn: st.lrn,
              name: `${st.last_name}, ${st.first_name}`,
              grades: {},
            });
          }
          studentMap.get(st.id).grades[sg.subject.subject_code] = st.computed_grade;
        }
      }

      setAdvisorySummary({
        section: sections.find((s) => String(s.id) === String(sectionId)),
        subjects: sectionAssignments,
        students: Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      });
      setIsAdvisoryMode(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setAdvisoryLoading(false);
    }
  }

  const selectedSecObj = sections.find((s) => String(s.id) === String(sectionId));
  const isSelectedAdvisory = myTeacher && selectedSecObj && (
    Number(selectedSecObj.adviser_id) === Number(myTeacher.id) ||
    Number(selectedSecObj.adviser_teacher_id) === Number(myTeacher.id)
  );

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
            <select value={sectionId} onChange={(e) => { setSectionId(e.target.value); setRows(null); setIsAdvisoryMode(false); }}>
              <option value="">{t('common.select')}</option>
              {sections.map((s) => {
                const isAdv = isTeacher && myTeacher && (Number(s.adviser_id) === Number(myTeacher.id) || Number(s.adviser_teacher_id) === Number(myTeacher.id));
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} {isAdv ? '★ (My Advisory Class)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label>{t('grades.subject')}</label>
            <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setRows(null); setIsAdvisoryMode(false); }}>
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
          <button className="btn btn-primary" onClick={() => { setIsAdvisoryMode(false); loadClass(); }} disabled={!sectionId || !subjectId}>{t('grades.loadClass')}</button>
          {isSelectedAdvisory && (
            <button className="btn" onClick={loadAdvisorySummary} disabled={advisoryLoading} style={{ background: 'var(--accent-2)', color: '#fff' }}>
              {advisoryLoading ? 'Loading…' : '📊 Advisory Grade Summary'}
            </button>
          )}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--primary-tint)', borderRadius: 99, fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: saving ? 'var(--warn)' : 'var(--success)' }} />
              <span>{saving ? 'Saving changes...' : 'Saved just now'}</span>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className={`btn ${compMode ? 'btn-primary' : ''}`} onClick={() => { setCompMode(!compMode); if (!compMode) loadCompetencies(); }} type="button">
                <Target size={14} /> {compMode ? 'Grade Mode' : 'Competency Mode'}
              </button>
              <button className="btn" onClick={printClassRecord} disabled={!rows || !rows.length} type="button">
                <Printer size={14} /> Print Class Record
              </button>
              <span className="no-print" style={{ fontSize: 11, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <kbd style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, background: 'var(--bg-soft)', border: '1px solid var(--border)' }}>↑↓←→</kbd> navigate
                <kbd style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, background: 'var(--bg-soft)', border: '1px solid var(--border)' }}>Tab</kbd> next cell
                <kbd style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, background: 'var(--bg-soft)', border: '1px solid var(--border)' }}>Esc</kbd> deselect
              </span>
              <button className="btn" onClick={exportClassRecord} disabled={!rows || !rows.length} type="button">
                <Download size={14} /> {t('grades.export')}
              </button>
              <button className="btn btn-primary" onClick={compMode ? saveCompScores : save} disabled={saving || compSaving}>
                <Save size={14} /> {compSaving ? 'Saving…' : saving ? t('common.saving') : t('grades.saveGrades')}
              </button>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: 'var(--card)', zIndex: 3 }}>{t('grades.lrn')}</th>
                <th style={{ position: 'sticky', left: 110, background: 'var(--card)', zIndex: 3 }}>{t('grades.learner')}</th>
                <th style={{ textAlign: 'center' }}>{t('grades.writtenWork')} ({weights.written_work}%)</th>
                <th style={{ textAlign: 'center' }}>{t('grades.performanceTask')} ({weights.performance_task}%)</th>
                <th style={{ textAlign: 'center' }}>{t('grades.termExam')} ({weights.quarterly_exam}%)</th>
                <th style={{ textAlign: 'center' }}>{t('grades.finalGrade')}</th>
                <th>{t('grades.remarks')}</th><th></th>
              </tr>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <td colSpan={2} style={{ position: 'sticky', left: 0, background: 'var(--bg-secondary)', zIndex: 3, fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>{t('grades.quickFill')}</td>
                <td style={{ textAlign: 'center' }}>
                  <input className="grade-input" type="number" min="0" max="100" placeholder="—" style={{ width: 60, fontSize: 11 }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { quickFill('written_work', e.target.value); e.target.value = ''; } }} />
                  <button className="btn btn-sm" type="button" title="Apply to all" onClick={(e) => { const inp = e.target.closest('td').querySelector('input'); quickFill('written_work', inp.value); inp.value = ''; }}><Copy size={11} /></button>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input className="grade-input" type="number" min="0" max="100" placeholder="—" style={{ width: 60, fontSize: 11 }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { quickFill('performance_task', e.target.value); e.target.value = ''; } }} />
                  <button className="btn btn-sm" type="button" title="Apply to all" onClick={(e) => { const inp = e.target.closest('td').querySelector('input'); quickFill('performance_task', inp.value); inp.value = ''; }}><Copy size={11} /></button>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input className="grade-input" type="number" min="0" max="100" placeholder="—" style={{ width: 60, fontSize: 11 }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { quickFill('quarterly_exam', e.target.value); e.target.value = ''; } }} />
                  <button className="btn btn-sm" type="button" title="Apply to all" onClick={(e) => { const inp = e.target.closest('td').querySelector('input'); quickFill('quarterly_exam', inp.value); inp.value = ''; }}><Copy size={11} /></button>
                </td>
                <td colSpan={3}></td>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={r.id}>
                  <td style={{ position: 'sticky', left: 0, background: 'var(--card)', zIndex: 2, fontVariantNumeric: 'tabular-nums', fontSize: 12.5 }}>{r.lrn}</td>
                  <td style={{ position: 'sticky', left: 110, background: 'var(--card)', zIndex: 2, fontWeight: 600 }}>{r.last_name}, {r.first_name}</td>
                  <td style={{ textAlign: 'center' }}>
                    <input className="grade-input" type="number" min="0" max="100" value={r.written_work ?? ''} data-row={ri} data-col={0} onKeyDown={gradeNav} onChange={(e) => update(r.id, 'written_work', e.target.value)} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input className="grade-input" type="number" min="0" max="100" value={r.performance_task ?? ''} data-row={ri} data-col={1} onKeyDown={gradeNav} onChange={(e) => update(r.id, 'performance_task', e.target.value)} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input className="grade-input" type="number" min="0" max="100" value={r.quarterly_exam ?? ''} data-row={ri} data-col={2} onKeyDown={gradeNav} onChange={(e) => update(r.id, 'quarterly_exam', e.target.value)} />
                  </td>
                  <td style={{ textAlign: 'center', minWidth: 120 }}>
                    {r.computed_grade != null ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <span style={getGradeBandStyle(r.computed_grade)}>
                          {r.computed_grade} {r.letter && <span style={{ fontSize: 11, marginLeft: 2 }}>({r.letter})</span>}
                        </span>
                        <div style={{ width: '80%', height: 4, background: 'var(--bg-soft)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.min(100, Math.max(0, Number(r.computed_grade)))}%`,
                            height: '100%',
                            background: Number(r.computed_grade) >= 90 ? 'var(--success)' : Number(r.computed_grade) >= 75 ? 'var(--warn)' : 'var(--danger)',
                          }} />
                        </div>
                      </div>
                    ) : '—'}
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

      {isAdvisoryMode && advisorySummary && (
        <div className="card table-wrap" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0 }}>Advisory Class Summary of Grades — {advisorySummary.section?.name}</h3>
              <p className="sub" style={{ margin: '2px 0 0 0' }}>School Year {schoolYear} · Quarter {term}</p>
            </div>
            <button className="btn" onClick={() => window.print()}>
              <Printer size={15} /> Print Summary Sheet
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>LRN</th>
                <th>Learner Name</th>
                {advisorySummary.subjects.map((s) => (
                  <th key={s.id} style={{ textAlign: 'center' }}>{s.subject_code}</th>
                ))}
                <th style={{ textAlign: 'center' }}>General Average</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {advisorySummary.students.map((st) => {
                const vals = Object.values(st.grades).filter((v) => v != null);
                const avg = vals.length ? (vals.reduce((a, b) => a + Number(b), 0) / vals.length).toFixed(1) : null;
                const status = avg ? (Number(avg) >= 75 ? 'Promoted' : 'Needs Improvement') : '—';
                return (
                  <tr key={st.id}>
                    <td>{st.lrn}</td>
                    <td><strong>{st.name}</strong></td>
                    {advisorySummary.subjects.map((s) => (
                      <td key={s.id} style={{ textAlign: 'center' }}>
                        {st.grades[s.subject_code] != null ? (
                          <strong>{st.grades[s.subject_code]}</strong>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    ))}
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{avg || '—'}</td>
                    <td>{avg ? <Badge status={Number(avg) >= 75 ? 'present' : 'absent'}>{status}</Badge> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!advisorySummary.students.length && (
            <Empty text="No enrolled learners found for this advisory section." />
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
