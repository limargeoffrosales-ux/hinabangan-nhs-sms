import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, FileText, BookOpen, ClipboardCheck, BarChart3, GraduationCap, Sparkles, Loader2, AlertCircle, Bot, Printer } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Spinner } from '../components/ui';
import { renderSF9Card, esc, MONTH_NAMES, MONTH_NUMS, TERM_MAP, CORE_VALUES } from './DepedForms';
import { printElementHtml } from '../lib/export';

const TABS = [
  { id: 'report', label: 'Report Card', icon: FileText },
  { id: 'form137', label: 'Form 137', icon: ClipboardCheck },
  { id: 'lesson', label: 'Lesson Plan', icon: BookOpen },
  { id: 'exam', label: 'Exam Builder', icon: ClipboardCheck },
  { id: 'analytics', label: 'Student Analytics', icon: BarChart3 },
  { id: 'enroll', label: 'Enrollment Tips', icon: GraduationCap },
];

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ margin: '0 0 8px', color: 'var(--accent, #1e3a5f)', fontSize: 14 }}>{title}</h4>
      <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text, #1a1a1a)' }}>{children}</div>
    </div>
  );
}

function mergeConductData(sf9Data, aiResult) {
  if (!aiResult || !aiResult.conduct) return sf9Data;
  const merged = { ...sf9Data, conduct: { ...sf9Data.conduct } };
  for (const cv of CORE_VALUES) {
    const ai = aiResult.conduct[cv.key] || {};
    for (let q = 1; q <= 3; q++) {
      const val = ai[String(q)];
      if (val && ['ao','so','ro','no'].includes(val.toLowerCase())) {
        if (!merged.conduct[q]) merged.conduct[q] = { ...merged.conduct[q] };
        merged.conduct[q][cv.key] = val.toLowerCase();
      }
    }
  }
  return merged;
}

function ReportCard() {
  const [studentId, setStudentId] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [sf9Data, setSf9Data] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/students').then(r => setStudents(r.data || r.rows || r || [])).catch(() => {});
  }, []);

  async function generate() {
    if (!studentId) return;
    setLoading(true); setError(null); setResult(null); setSf9Data(null);
    try {
      const [aiRes, sf9Res] = await Promise.all([
        api('/ai/report', { method: 'POST', body: { student_id: Number(studentId) } }),
        api(`/deped-forms/sf9/full?student_id=${studentId}`),
      ]);
      setResult(aiRes);
      setSf9Data(sf9Res);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  function print() {
    if (!sf9Data?.learner) return;
    const lr = mergeConductData(sf9Data.learner, result);
    printElementHtml(`SF9 - ${lr.student.last_name}`, renderSF9Card(lr.student, lr.enrollment, lr.grades || [], lr.monthlyAttendance || [], sf9Data.learner.enrollment?.school_year || '____-____', {}, lr.conduct || []));
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}><FileText size={16} /> AI Report Card Generator</h3>
      <p style={{ fontSize: 13, color: 'var(--text-dim, #6b7280)' }}>Generate SF9 Learner Progress Report Card with AI-powered conduct ratings and analysis.</p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
        <label style={{ flex: 1 }}>Student
          <select className="input" style={{ marginLeft: 6, minWidth: 250 }} value={studentId} onChange={e => setStudentId(e.target.value)}>
            <option value="">Select a student...</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} (ID: {s.id})</option>)}
          </select>
        </label>
        <button className="btn btn-primary" onClick={generate} disabled={loading || !studentId}>{loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Generate</button>
      </div>
      {error && <div className="err-banner"><AlertCircle size={14} /> {error}</div>}
      {result && (
        <div style={{ background: 'var(--bg, #f8fafc)', borderRadius: 12, padding: 18, border: '1px solid var(--border, #e2e8f0)' }}>
          {result.risk_level && (
            <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Risk Level:</span>
              <span className={`badge badge-${result.risk_level === 'high' ? 'red' : result.risk_level === 'moderate' ? 'yellow' : 'green'}`}>{result.risk_level}</span>
            </div>
          )}
          {result.conduct && (
            <Section title="AI-Generated Conduct Ratings">
              {CORE_VALUES.map(cv => (
                <div key={cv.key} style={{ marginBottom: 6 }}>
                  <strong>{cv.label}:</strong>{' '}
                  {[1,2,3].map(q => `Q${q}`).map((t,i) => (
                    <span key={t} style={{ marginRight: 8 }}><em>{t}</em>: {(result.conduct[cv.key] || {})[String(i+1)] || '—'}</span>
                  ))}
                </div>
              ))}
            </Section>
          )}
          {result.remarks && <Section title="Remarks">{typeof result.remarks === 'string' ? result.remarks : result.remarks.overall || JSON.stringify(result.remarks)}</Section>}
          {result.raw && <Section title="AI Output"><pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{result.raw}</pre></Section>}
          {sf9Data?.learner && (
            <div style={{ marginTop: 12 }}>
              {(() => { const lr = mergeConductData(sf9Data.learner, result); return <div id="sf9-preview" dangerouslySetInnerHTML={{ __html: renderSF9Card(lr.student, lr.enrollment, lr.grades || [], lr.monthlyAttendance || [], lr.enrollment?.school_year || '____-____', {}, lr.conduct || []) }} />; })()}
              <button className="btn btn-primary" onClick={print} style={{ marginTop: 10 }}><Printer size={14} /> Print SF9 Card</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Form137() {
  const [studentId, setStudentId] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/students').then(r => setStudents(r.data || r.rows || r || [])).catch(() => {});
  }, []);

  async function generate() {
    if (!studentId) return;
    setLoading(true); setError(null); setResult(null);
    try {
      setResult(await api('/ai/form-137', { method: 'POST', body: { student_id: Number(studentId) } }));
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}><ClipboardCheck size={16} /> AI Form 137 — Individual Permanent Academic Record</h3>
      <p style={{ fontSize: 13, color: 'var(--text-dim, #6b7280)' }}>Generate a comprehensive permanent academic record narrative with AI analysis of all grades, attendance, and conduct across all school years.</p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
        <label style={{ flex: 1 }}>Student
          <select className="input" style={{ marginLeft: 6, minWidth: 250 }} value={studentId} onChange={e => setStudentId(e.target.value)}>
            <option value="">Select a student...</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} (ID: {s.id})</option>)}
          </select>
        </label>
        <button className="btn btn-primary" onClick={generate} disabled={loading || !studentId}>{loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Generate Form 137</button>
      </div>
      {error && <div className="err-banner"><AlertCircle size={14} /> {error}</div>}
      {result && (
        <div style={{ background: 'var(--bg, #f8fafc)', borderRadius: 12, padding: 18, border: '1px solid var(--border, #e2e8f0)' }}>
          {result.overall_remark && (
            <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Overall Remark:</span>
              <span className={`badge badge-${result.overall_remark === 'Outstanding' ? 'green' : result.overall_remark === 'Needs Improvement' ? 'red' : 'yellow'}`}>{result.overall_remark}</span>
            </div>
          )}
          {result.personal_info && <Section title="Personal Information">{result.personal_info}</Section>}
          {result.academic_narrative && <Section title="Academic Performance">{result.academic_narrative}</Section>}
          {result.attendance_summary && <Section title="Attendance Summary">{result.attendance_summary}</Section>}
          {result.conduct_evaluation && <Section title="Character & Conduct">{result.conduct_evaluation}</Section>}
          {result.talents_achievements && <Section title="Special Talents & Achievements">{result.talents_achievements}</Section>}
          {result.recommendations && <Section title="Recommendations">{result.recommendations}</Section>}
          {result.raw && <Section title="AI Output"><pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{result.raw}</pre></Section>}
        </div>
      )}
    </div>
  );
}

function LessonPlan() {
  const [form, setForm] = useState({ subject_id: '', topic: '', grade_level: 'Grade 11', strand: '', duration_minutes: 60, week: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function generate() {
    setLoading(true); setError(null); setResult(null);
    try {
      const body = { ...form };
      if (body.subject_id) body.subject_id = Number(body.subject_id);
      if (body.duration_minutes) body.duration_minutes = Number(body.duration_minutes);
      setResult(await api('/ai/lesson-plan', { method: 'POST', body }));
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}><BookOpen size={16} /> AI Lesson Plan Generator</h3>
      <p style={{ fontSize: 13, color: 'var(--text-dim, #6b7280)' }}>Auto-generate Detailed Lesson Plans (DLL) aligned to DepEd format and competencies.</p>
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <label>Subject ID <input className="input" type="number" value={form.subject_id} onChange={(e) => setForm(f => ({ ...f, subject_id: e.target.value }))} placeholder="Optional" /></label>
        <label>Grade Level <select className="input" value={form.grade_level} onChange={(e) => setForm(f => ({ ...f, grade_level: e.target.value }))}>
          <option>Grade 11</option><option>Grade 12</option>
        </select></label>
        <label>Topic <input className="input" value={form.topic} onChange={(e) => setForm(f => ({ ...f, topic: e.target.value }))} placeholder="e.g. Photosynthesis" /></label>
        <label>Strand <input className="input" value={form.strand} onChange={(e) => setForm(f => ({ ...f, strand: e.target.value }))} placeholder="e.g. STEM" /></label>
        <label>Duration (min) <input className="input" type="number" value={form.duration_minutes} onChange={(e) => setForm(f => ({ ...f, duration_minutes: e.target.value }))} /></label>
        <label>Week <input className="input" value={form.week} onChange={(e) => setForm(f => ({ ...f, week: e.target.value }))} placeholder="e.g. Week 3" /></label>
      </div>
      <button className="btn btn-primary" onClick={generate} disabled={loading}>{loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Generate Lesson Plan</button>
      {error && <div className="err-banner" style={{ marginTop: 12 }}><AlertCircle size={14} /> {error}</div>}
      {result && (
        <div style={{ background: 'var(--bg, #f8fafc)', borderRadius: 12, padding: 18, marginTop: 16, border: '1px solid var(--border, #e2e8f0)' }}>
          {result.competencies && <Section title="Learning Competencies">{result.competencies}</Section>}
          {result.content && <Section title="Content">{result.content}</Section>}
          {result.learning_resources && <Section title="Learning Resources">{result.learning_resources}</Section>}
          {result.procedures && (
            <Section title="Procedures">
              {['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(k => result.procedures[k] && (
                <div key={k} style={{ marginBottom: 6 }}><strong style={{ fontSize: 12 }}>{k.toUpperCase()}.</strong> {result.procedures[k]}</div>
              ))}
            </Section>
          )}
          {result.reflection && <Section title="Reflection">{result.reflection}</Section>}
          {result.remarks && <Section title="Remarks">{result.remarks}</Section>}
          {result.raw && <Section title="AI Output"><pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{result.raw}</pre></Section>}
        </div>
      )}
    </div>
  );
}

function ExamBuilder() {
  const [form, setForm] = useState({ subject_id: '', topic: '', num_items: 20, grade_level: 'Grade 11', exam_type: 'prelim exam', difficulty_mix: '40 easy, 40 moderate, 20 difficult' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function generate() {
    setLoading(true); setError(null); setResult(null);
    try {
      const body = { ...form };
      if (body.subject_id) body.subject_id = Number(body.subject_id);
      if (body.num_items) body.num_items = Number(body.num_items);
      setResult(await api('/ai/exam', { method: 'POST', body }));
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}><ClipboardCheck size={16} /> AI Exam / TOS Builder</h3>
      <p style={{ fontSize: 13, color: 'var(--text-dim, #6b7280)' }}>Generate test items with Table of Specifications (TOS), answer keys, and difficulty tags.</p>
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <label>Subject ID <input className="input" type="number" value={form.subject_id} onChange={(e) => setForm(f => ({ ...f, subject_id: e.target.value }))} placeholder="Optional" /></label>
        <label>Grade Level <select className="input" value={form.grade_level} onChange={(e) => setForm(f => ({ ...f, grade_level: e.target.value }))}>
          <option>Grade 11</option><option>Grade 12</option>
        </select></label>
        <label>Topic <input className="input" value={form.topic} onChange={(e) => setForm(f => ({ ...f, topic: e.target.value }))} placeholder="e.g. Cell Division" /></label>
        <label>Exam Type <select className="input" value={form.exam_type} onChange={(e) => setForm(f => ({ ...f, exam_type: e.target.value }))}>
          <option>prelim exam</option><option>midterm exam</option><option>finals exam</option><option>quiz</option><option>activity</option>
        </select></label>
        <label>Number of Items <input className="input" type="number" value={form.num_items} onChange={(e) => setForm(f => ({ ...f, num_items: e.target.value }))} /></label>
        <label>Difficulty Mix <input className="input" value={form.difficulty_mix} onChange={(e) => setForm(f => ({ ...f, difficulty_mix: e.target.value }))} /></label>
      </div>
      <button className="btn btn-primary" onClick={generate} disabled={loading}>{loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Generate Exam</button>
      {error && <div className="err-banner" style={{ marginTop: 12 }}><AlertCircle size={14} /> {error}</div>}
      {result && (
        <div style={{ background: 'var(--bg, #f8fafc)', borderRadius: 12, padding: 18, marginTop: 16, border: '1px solid var(--border, #e2e8f0)' }}>
          {result.tos && result.tos.length > 0 && (
            <Section title="Table of Specifications">
              <table style={{ width: '100%', fontSize: 13 }}>
                <thead><tr><th style={{ textAlign: 'left' }}>Objective</th><th style={{ textAlign: 'center' }}>Difficulty</th><th style={{ textAlign: 'center' }}>Count</th><th style={{ textAlign: 'center' }}>%</th></tr></thead>
                <tbody>{result.tos.map((t, i) => <tr key={i}><td>{t.objective}</td><td style={{ textAlign: 'center' }}>{t.difficulty}</td><td style={{ textAlign: 'center' }}>{t.count}</td><td style={{ textAlign: 'center' }}>{t.percentage}</td></tr>)}</tbody>
              </table>
            </Section>
          )}
          {result.items && result.items.length > 0 && (
            <Section title={'Test Items (' + result.items.length + ')'}>
              {result.items.map((item, i) => (
                <div key={i} style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: 'var(--card, #fff)', border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{i + 1}. {item.question}</div>
                  {item.options && item.options.map((opt, j) => <div key={j} style={{ fontSize: 13, padding: '2px 0', color: String.fromCharCode(65 + j) === item.answer ? 'var(--success, #2FD6A0)' : 'var(--text-dim, #6b7280)' }}>{String.fromCharCode(65 + j)}. {opt}</div>)}
                  <div style={{ fontSize: 11, color: 'var(--text-dim, #6b7280)', marginTop: 4 }}>Answer: <strong>{item.answer}</strong> | Difficulty: {item.difficulty} | {item.objective}</div>
                </div>
              ))}
            </Section>
          )}
          {result.raw && <Section title="AI Output"><pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{result.raw}</pre></Section>}
        </div>
      )}
    </div>
  );
}

function StudentAnalytics() {
  const [studentId, setStudentId] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/students').then(r => setStudents(r.data || r.rows || r || [])).catch(() => {});
  }, []);

  async function analyze() {
    if (!studentId) return;
    setLoading(true); setError(null); setResult(null);
    try {
      setResult(await api('/ai/analyze', { method: 'POST', body: { student_id: Number(studentId) } }));
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}><BarChart3 size={16} /> AI Student Analytics & Interventions</h3>
      <p style={{ fontSize: 13, color: 'var(--text-dim, #6b7280)' }}>AI-powered risk assessment with specific intervention plans for at-risk students.</p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
        <label style={{ flex: 1 }}>Student
          <select className="input" style={{ marginLeft: 6, minWidth: 250 }} value={studentId} onChange={e => setStudentId(e.target.value)}>
            <option value="">Select a student...</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} (ID: {s.id})</option>)}
          </select>
        </label>
        <button className="btn btn-primary" onClick={analyze} disabled={loading || !studentId}>{loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Analyze</button>
      </div>
      {error && <div className="err-banner"><AlertCircle size={14} /> {error}</div>}
      {result && (
        <div style={{ background: 'var(--bg, #f8fafc)', borderRadius: 12, padding: 18, border: '1px solid var(--border, #e2e8f0)' }}>
          {result.risk_level && (
            <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Risk Level:</span>
              <span className={`badge badge-${result.risk_level === 'high' || result.risk_level === 'critical' ? 'red' : result.risk_level === 'moderate' ? 'yellow' : 'green'}`}>{result.risk_level}</span>
            </div>
          )}
          {result.reasoning && <Section title="Reasoning">{result.reasoning}</Section>}
          {result.factors && result.factors.length > 0 && (
            <Section title="Contributing Factors">
              <ul style={{ margin: 0, paddingLeft: 18 }}>{result.factors.map((f, i) => <li key={i} style={{ marginBottom: 4 }}>{f}</li>)}</ul>
            </Section>
          )}
          {result.interventions && result.interventions.length > 0 && (
            <Section title="Intervention Plan">
              <table style={{ width: '100%', fontSize: 13 }}>
                <thead><tr><th style={{ textAlign: 'left' }}>Action</th><th style={{ textAlign: 'left' }}>Timeline</th><th style={{ textAlign: 'left' }}>Responsible</th></tr></thead>
                <tbody>{result.interventions.map((iv, i) => <tr key={i}><td>{iv.action}</td><td>{iv.timeline}</td><td>{iv.responsible}</td></tr>)}</tbody>
              </table>
            </Section>
          )}
          {result.parent_recommendations && <Section title="Parent Recommendations">{result.parent_recommendations}</Section>}
          {result.raw && <Section title="AI Output"><pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{result.raw}</pre></Section>}
        </div>
      )}
    </div>
  );
}

function EnrollmentSuggestions() {
  const [studentId, setStudentId] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/students').then(r => setStudents(r.data || r.rows || r || [])).catch(() => {});
  }, []);

  async function suggest() {
    if (!studentId) return;
    setLoading(true); setError(null); setResult(null);
    try {
      setResult(await api('/ai/enrollment-suggest', { method: 'POST', body: { student_id: Number(studentId) } }));
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}><GraduationCap size={16} /> AI Enrollment Suggestions</h3>
      <p style={{ fontSize: 13, color: 'var(--text-dim, #6b7280)' }}>AI recommends the best strand, section, and academic support for each student.</p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
        <label style={{ flex: 1 }}>Student
          <select className="input" style={{ marginLeft: 6, minWidth: 250 }} value={studentId} onChange={e => setStudentId(e.target.value)}>
            <option value="">Select a student...</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} (ID: {s.id})</option>)}
          </select>
        </label>
        <button className="btn btn-primary" onClick={suggest} disabled={loading || !studentId}>{loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Get Suggestions</button>
      </div>
      {error && <div className="err-banner"><AlertCircle size={14} /> {error}</div>}
      {result && (
        <div style={{ background: 'var(--bg, #f8fafc)', borderRadius: 12, padding: 18, border: '1px solid var(--border, #e2e8f0)' }}>
          {result.recommended_strand && <Section title="Recommended Strand">{result.recommended_strand}</Section>}
          {result.reasoning && <Section title="Reasoning">{result.reasoning}</Section>}
          {result.focus_areas && result.focus_areas.length > 0 && (
            <Section title="Focus Areas"><ul style={{ margin: 0, paddingLeft: 18 }}>{result.focus_areas.map((f, i) => <li key={i}>{f}</li>)}</ul></Section>
          )}
          {result.support_needed && result.support_needed.length > 0 && (
            <Section title="Support Needed"><ul style={{ margin: 0, paddingLeft: 18 }}>{result.support_needed.map((s, i) => <li key={i}>{s}</li>)}</ul></Section>
          )}
          {result.aral_eligible !== undefined && (
            <Section title="Aral Program Eligibility">{result.aral_eligible ? 'This student is recommended for the Aral Program.' : 'Not eligible for Aral Program.'}</Section>
          )}
          {result.raw && <Section title="AI Output"><pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{result.raw}</pre></Section>}
        </div>
      )}
    </div>
  );
}

const TAB_COMPONENTS = { report: ReportCard, form137: Form137, lesson: LessonPlan, exam: ExamBuilder, analytics: StudentAnalytics, enroll: EnrollmentSuggestions };

export default function AIPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('report');
  const [info, setInfo] = useState(null);
  const TabContent = TAB_COMPONENTS[tab];

  useEffect(() => { api('/ai/status').then(setInfo).catch(() => {}); }, []);

  return (
    <>
      <PageHead title="AI Tools" sub={info ? `${info.provider.toUpperCase()} · ${info.model}` : 'AI-powered features for MeridianEd'} />
      {info && !info.enabled && (
        <div className="err-banner" style={{ marginBottom: 12 }}>
          <AlertCircle size={14} /> AI is not configured. Set <code>{info.provider === 'groq' ? 'GROQ_API_KEY' : info.provider === 'ollama' ? 'Start Ollama locally' : info.provider === 'hf' ? 'HF_API_KEY' : 'OPENAI_API_KEY'}</code> in your environment.
        </div>
      )}
      <div className="card-top" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map((tabItem) => (
            <button
              key={tabItem.id}
              className={`btn ${tab === tabItem.id ? 'btn-primary' : ''}`}
              onClick={() => setTab(tabItem.id)}
              style={{ fontSize: 13 }}
            >
              <tabItem.icon size={14} /> {tabItem.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ height: 12 }} />
      <TabContent />
    </>
  );
}
