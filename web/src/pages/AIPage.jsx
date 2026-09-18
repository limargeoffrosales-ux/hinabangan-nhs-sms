import { useState, useEffect } from 'react';
import { Brain, FileText, BookOpen, ClipboardCheck, BarChart3, GraduationCap, Sparkles, Loader2, AlertCircle, Printer, ChevronDown, ChevronRight, MessageSquare, RefreshCw, FolderOpen, Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { PageHead } from '../components/ui';
import { renderSF9Card, esc, CORE_VALUES } from './DepedForms';
import { printElementHtml } from '../lib/export';
import DOMPurify from 'dompurify';
import AIText from '../components/AIText';

const TABS = [
  { id: 'report', label: 'Report Card', icon: FileText },
  { id: 'form137', label: 'Form 137', icon: ClipboardCheck },
  { id: 'lesson', label: 'Lesson Plan', icon: BookOpen },
  { id: 'exam', label: 'Exam Builder', icon: ClipboardCheck },
  { id: 'analytics', label: 'Student Analytics', icon: BarChart3 },
  { id: 'enroll', label: 'Enrollment Tips', icon: GraduationCap },
  { id: 'chatlogs', label: 'Chat Logs', icon: MessageSquare },
  { id: 'library', label: 'Document Library', icon: FolderOpen },
];

const AI_ADMIN = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
const AI_STAFF = [...AI_ADMIN, 'teacher', 'guidance'];

// Mirrors the server-side requireRole allow-list on /api/v1/ai/*. A tab is
// only shown when the signed-in role can actually call its endpoint.
const TAB_ROLES = {
  report: [...AI_ADMIN, 'teacher'],
  form137: [...AI_ADMIN, 'teacher'],
  lesson: AI_STAFF,
  exam: AI_STAFF,
  analytics: [...AI_ADMIN, 'teacher', 'guidance'],
  enroll: [...AI_ADMIN, 'teacher'],
  chatlogs: AI_ADMIN,
  library: [...AI_ADMIN, 'teacher'],
};

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
  const [showAnalysis, setShowAnalysis] = useState(false);

  useEffect(() => {
    api('/students').then(r => setStudents(r.data || r.rows || r || [])).catch(() => {});
  }, []);

  async function generate() {
    if (!studentId) return;
    setLoading(true); setError(null); setResult(null); setSf9Data(null); setShowAnalysis(false);
    try {
      const [aiRes, sf9Res] = await Promise.all([
        api('/ai/report', { method: 'POST', body: { student_id: Number(studentId) } }),
        api(`/deped-forms/sf9/full?student_id=${studentId}`),
      ]);
      setResult(aiRes);
      setSf9Data(sf9Res);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  const learner = sf9Data?.learner;
  const merged = learner ? mergeConductData(learner, result) : null;
  const sf9Html = merged ? renderSF9Card(merged.student, merged.enrollment, merged.grades || [], merged.monthlyAttendance || [], merged.enrollment?.school_year || '____-____', {}, merged.conduct || []) : '';

  function print() {
    if (!sf9Html) return;
    printElementHtml(`SF9 - ${merged.student.last_name}, ${merged.student.first_name}`, sf9Html, { paper: 'legal', orientation: 'landscape' });
  }

  return (
    <div>
      {/* Student selector */}
      <div className="card">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ flex: 1, minWidth: 250 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim, #6b7280)' }}>Select Student</span>
            <select className="input" value={studentId} onChange={e => setStudentId(e.target.value)}>
              <option value="">Choose a student...</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} ({s.grade_level || '—'})</option>)}
            </select>
          </label>
          <button className="btn btn-primary" onClick={generate} disabled={loading || !studentId} style={{ height: 38 }}>
            {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Generate Report Card
          </button>
        </div>
      </div>

      {error && <div className="err-banner" style={{ marginTop: 12 }}><AlertCircle size={14} /> {error}</div>}

      {/* SF9 Card Preview — the main output */}
      {merged && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>
                <FileText size={16} /> SF9 — Learner's Progress Report Card
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-dim, #6b7280)' }}>
                {merged.student.first_name} {merged.student.last_name} · LRN {merged.student.lrn || '—'} · {merged.enrollment?.grade_level || '—'} {merged.enrollment?.section_name ? `— ${merged.enrollment.section_name}` : ''}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {result && (
                <button className="btn btn-sm" onClick={() => setShowAnalysis(!showAnalysis)}>
                  {showAnalysis ? <ChevronDown size={14} /> : <ChevronRight size={14} />} AI Analysis
                </button>
              )}
              <button className="btn btn-primary btn-sm" onClick={print}>
                <Printer size={14} /> Print SF9
              </button>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid var(--border, #e2e8f0)', borderRadius: 10, overflow: 'hidden' }}>
            <div id="sf9-preview" style={{ padding: 8, overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(sf9Html, { USE_PROFILES: { html: true } }) }} />
          </div>
        </div>
      )}

      {/* AI Analysis — collapsible */}
      {result && showAnalysis && (
        <div style={{ marginTop: 12 }}>
          <div className="card" style={{ borderLeft: '3px solid var(--accent, #1e3a5f)' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Brain size={14} /> AI-Generated Analysis
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              {result.risk_level && (
                <div style={{ padding: 10, borderRadius: 8, background: result.risk_level === 'high' ? '#fef2f2' : result.risk_level === 'moderate' ? '#fffbeb' : '#f0fdf4', border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim, #6b7280)', marginBottom: 4 }}>Risk Level</div>
                  <span className={`badge badge-${result.risk_level === 'high' ? 'red' : result.risk_level === 'moderate' ? 'yellow' : 'green'}`}>{result.risk_level}</span>
                </div>
              )}
              {result.conduct && (
                <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim, #6b7280)', marginBottom: 4 }}>Conduct Summary</div>
                  <div style={{ fontSize: 12 }}>
                    {CORE_VALUES.map(cv => {
                      const ratings = result.conduct[cv.key] || {};
                      const vals = [1,2,3].map(q => ratings[String(q)]?.toUpperCase()).filter(Boolean);
                      return vals.length ? <span key={cv.key} style={{ marginRight: 6 }}>{cv.label.split('-')[1]?.trim() || cv.label}: {vals.join(', ')}</span> : null;
                    })}
                  </div>
                </div>
              )}
              {result.remarks && (
                <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim, #6b7280)', marginBottom: 4 }}>Overall Remarks</div>
                  <div style={{ fontSize: 12 }}>{typeof result.remarks === 'string' ? <AIText text={result.remarks} /> : result.remarks.overall || '—'}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !merged && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-dim, #6b7280)' }}>
          <FileText size={40} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div style={{ fontSize: 14 }}>Select a student and click Generate to create an SF9 Report Card with AI-powered conduct ratings.</div>
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

  function printForm137() {
    if (!result) return;
    const student = students.find(s => String(s.id) === String(studentId));
    const name = student ? `${student.last_name}, ${student.first_name}` : '';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Form 137 - ${esc(name)}</title>
      <style>
        @page { size: legal portrait; margin: 0.5in 0.6in; }
        body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.5; color: #000; margin: 0; }
        h1 { font-size: 13pt; text-align: center; margin: 0 0 4pt; text-transform: uppercase; letter-spacing: 1pt; }
        h2 { font-size: 11pt; margin: 14pt 0 6pt; padding-bottom: 3pt; border-bottom: 2px solid #000; text-transform: uppercase; }
        h3 { font-size: 10.5pt; margin: 10pt 0 4pt; color: #333; }
        p { margin: 4pt 0; text-align: justify; }
        .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 8pt; margin-bottom: 12pt; }
        .header .dep-ed { font-size: 10pt; letter-spacing: 2pt; }
        .header .school { font-size: 12pt; font-weight: bold; margin: 4pt 0; }
        .header .form-title { font-size: 14pt; font-weight: bold; margin: 6pt 0 2pt; text-transform: uppercase; }
        .header .form-sub { font-size: 10pt; }
        .section { margin-bottom: 10pt; }
        .footer { margin-top: 24pt; border-top: 1px solid #999; padding-top: 6pt; font-size: 9pt; color: #666; text-align: center; }
        ul { margin: 4pt 0; padding-left: 18pt; }
        li { margin-bottom: 3pt; }
      </style></head><body>
      <div class="header">
        <div class="dep-ed">DEPARTMENT OF EDUCATION</div>
        <div class="school">Hinabangan National High School</div>
        <div class="form-title">Form 137</div>
        <div class="form-sub">Individual Permanent Academic Record</div>
      </div>
      ${result.personal_info ? `<div class="section"><h2>Personal Information</h2><p>${esc(result.personal_info)}</p></div>` : ''}
      ${result.academic_narrative ? `<div class="section"><h2>Academic Performance</h2><p>${esc(result.academic_narrative)}</p></div>` : ''}
      ${result.attendance_summary ? `<div class="section"><h2>Attendance Summary</h2><p>${esc(result.attendance_summary)}</p></div>` : ''}
      ${result.conduct_evaluation ? `<div class="section"><h2>Character &amp; Conduct</h2><p>${esc(result.conduct_evaluation)}</p></div>` : ''}
      ${result.talents_achievements ? `<div class="section"><h2>Special Talents &amp; Achievements</h2><p>${esc(result.talents_achievements)}</p></div>` : ''}
      ${result.recommendations ? `<div class="section"><h2>Recommendations</h2><p>${esc(result.recommendations)}</p></div>` : ''}
      <div class="footer">Generated by MeridianEd AI · ${new Date().toLocaleDateString()}</div>
      </body></html>`;
    printElementHtml(`Form 137 - ${name}`, html, { paper: 'legal' });
  }

  return (
    <div>
      {/* Student selector */}
      <div className="card">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ flex: 1, minWidth: 250 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim, #6b7280)' }}>Select Student</span>
            <select className="input" value={studentId} onChange={e => setStudentId(e.target.value)}>
              <option value="">Choose a student...</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} ({s.grade_level || '—'})</option>)}
            </select>
          </label>
          <button className="btn btn-primary" onClick={generate} disabled={loading || !studentId} style={{ height: 38 }}>
            {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Generate Form 137
          </button>
        </div>
      </div>

      {error && <div className="err-banner" style={{ marginTop: 12 }}><AlertCircle size={14} /> {error}</div>}

      {/* Form 137 Preview */}
      {result && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>
                <ClipboardCheck size={16} /> Form 137 — Individual Permanent Academic Record
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-dim, #6b7280)' }}>
                AI-generated narrative based on complete academic history
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={printForm137}>
              <Printer size={14} /> Print Form 137
            </button>
          </div>

          {/* Document preview */}
          <div style={{ background: '#fff', border: '1px solid var(--border, #e2e8f0)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '20px 28px', maxWidth: 800, margin: '0 auto' }}>
              {/* Document header */}
              <div style={{ textAlign: 'center', borderBottom: '3px double #000', paddingBottom: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: 3, color: '#666' }}>DEPARTMENT OF EDUCATION</div>
                <div style={{ fontSize: 13, fontWeight: 700, margin: '4px 0' }}>Hinabangan National High School</div>
                <div style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, margin: '8px 0 2px' }}>Form 137</div>
                <div style={{ fontSize: 10.5, color: '#444' }}>Individual Permanent Academic Record</div>
              </div>

              {result.overall_remark && (
                <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 6, background: result.overall_remark === 'Outstanding' ? '#f0fdf4' : result.overall_remark === 'Needs Improvement' ? '#fef2f2' : '#fffbeb', border: '1px solid var(--border, #e2e8f0)' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)' }}>Overall Assessment: </span>
                  <span className={`badge badge-${result.overall_remark === 'Outstanding' ? 'green' : result.overall_remark === 'Needs Improvement' ? 'red' : 'yellow'}`}>{result.overall_remark}</span>
                </div>
              )}

              {[
                { title: 'Personal Information', content: result.personal_info },
                { title: 'Academic Performance', content: result.academic_narrative },
                { title: 'Attendance Summary', content: result.attendance_summary },
                { title: 'Character & Conduct', content: result.conduct_evaluation },
                { title: 'Special Talents & Achievements', content: result.talents_achievements },
                { title: 'Recommendations', content: result.recommendations },
              ].filter(s => s.content).map((section, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  <h4 style={{ margin: '0 0 4px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, paddingBottom: 3, borderBottom: '1px solid #ccc', color: 'var(--accent, #1e3a5f)' }}>{section.title}</h4>
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: 'var(--text, #1a1a1a)', textAlign: 'justify' }}>{section.content}</p>
                </div>
              ))}

              <div style={{ marginTop: 20, paddingTop: 10, borderTop: '1px solid #ddd', fontSize: 9, color: '#999', textAlign: 'center' }}>
                Generated by MeridianEd AI · {new Date().toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !result && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-dim, #6b7280)' }}>
          <ClipboardCheck size={40} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div style={{ fontSize: 14 }}>Select a student and click Generate to create a Form 137 with AI-powered academic analysis.</div>
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
          {result.competencies && <Section title="Learning Competencies"><AIText text={result.competencies} /></Section>}
          {result.content && <Section title="Content"><AIText text={result.content} /></Section>}
          {result.learning_resources && <Section title="Learning Resources"><AIText text={result.learning_resources} /></Section>}
          {result.procedures && (
            <Section title="Procedures">
              {['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(k => result.procedures[k] && (
                <div key={k} style={{ marginBottom: 6 }}><strong style={{ fontSize: 12 }}>{k.toUpperCase()}.</strong> {result.procedures[k]}</div>
              ))}
            </Section>
          )}
          {result.reflection && <Section title="Reflection"><AIText text={result.reflection} /></Section>}
          {result.remarks && <Section title="Remarks"><AIText text={result.remarks} /></Section>}
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
          {result.reasoning && <Section title="Reasoning"><AIText text={result.reasoning} /></Section>}
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
          {result.parent_recommendations && <Section title="Parent Recommendations"><AIText text={result.parent_recommendations} /></Section>}
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
          {result.recommended_strand && <Section title="Recommended Strand"><AIText text={result.recommended_strand} /></Section>}
          {result.reasoning && <Section title="Reasoning"><AIText text={result.reasoning} /></Section>}
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

function ChatLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const limit = 20;

  async function load(o = offset) {
    setLoading(true); setError(null);
    try {
      const [logRes, statRes] = await Promise.all([
        api(`/ai/chat-logs?limit=${limit}&offset=${o}`),
        api('/ai/chat-logs/stats'),
      ]);
      setLogs(logRes.data || []);
      setTotal(logRes.total || 0);
      setStats(statRes);
      setOffset(o);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  useEffect(() => { load(0); }, []);

  return (
    <div>
      {stats && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: 'var(--text-dim, #6b7280)' }}>Total messages: <strong>{stats.total_messages}</strong></div>
          <div style={{ fontSize: 13, color: 'var(--text-dim, #6b7280)' }}>Distinct users: <strong>{stats.distinct_users}</strong></div>
          <div style={{ fontSize: 13, color: 'var(--text-dim, #6b7280)' }}>Last 24h: <strong>{stats.last_24h}</strong></div>
        </div>
      )}
      {error && <div className="err-banner" style={{ marginBottom: 12 }}><AlertCircle size={14} /> {error}</div>}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14 }}><MessageSquare size={14} /> AI Chat Logs</h3>
          <button className="btn btn-sm" onClick={() => load(offset)} disabled={loading}><RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh</button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32 }}><Loader2 size={20} className="spin" /></div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, fontSize: 13, color: 'var(--text-dim, #6b7280)' }}>No chat logs recorded yet.</div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Timestamp</th>
                  <th style={{ textAlign: 'left' }}>User</th>
                  <th style={{ textAlign: 'left' }}>Role</th>
                  <th style={{ textAlign: 'left' }}>Message</th>
                  <th style={{ textAlign: 'left' }}>Intent</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((row) => (
                  <tr key={row.id}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-dim, #6b7280)' }}>{new Date(row.created_at).toLocaleString()}</td>
                    <td>{row.user_name || row.username || '—'}</td>
                    <td><span className={`badge badge-${row.role === 'assistant' ? 'blue' : 'green'}`}>{row.role}</span></td>
                    <td style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(row.message || '').slice(0, 80)}</td>
                    <td style={{ color: 'var(--text-dim, #6b7280)' }}>{row.intent || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > limit && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
            <button className="btn btn-sm" disabled={offset === 0} onClick={() => load(offset - limit)}>Prev</button>
            <span style={{ fontSize: 12, alignSelf: 'center', color: 'var(--text-dim)' }}>{offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
            <button className="btn btn-sm" disabled={offset + limit >= total} onClick={() => load(offset + limit)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentLibrary() {
  const [formats, setFormats] = useState([]);
  const [generations, setGenerations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [editFormat, setEditFormat] = useState(null);
  const [formatForm, setFormatForm] = useState({ name: '', body: '', fields: '' });
  const [showGenModal, setShowGenModal] = useState(false);
  const [genForm, setGenForm] = useState({ name: '', kind: 'template', source_id: '', body: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [fRes, gRes, sRes] = await Promise.all([
        api('/documents/formats'),
        api('/documents/generations'),
        api('/documents/generations/stats'),
      ]);
      setFormats(fRes.data || []);
      setGenerations(gRes.data || []);
      setStats(sRes.data || []);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function saveFormat() {
    setSaving(true);
    try {
      const fieldsArr = formatForm.fields.split(',').map(s => s.trim()).filter(Boolean);
      const payload = { name: formatForm.name, body: formatForm.body, fields: fieldsArr };
      if (editFormat) {
        await api(`/documents/formats/${editFormat.id}`, { method: 'PATCH', body: payload });
      } else {
        await api('/documents/formats', { method: 'POST', body: payload });
      }
      setShowFormatModal(false); setEditFormat(null); setFormatForm({ name: '', body: '', fields: '' });
      await load();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  }

  async function deleteFormat(id) {
    if (!window.confirm('Delete this format?')) return;
    try {
      await api(`/documents/formats/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) { alert(e.message); }
  }

  async function saveGen() {
    setSaving(true);
    try {
      await api('/documents/generations', { method: 'POST', body: genForm });
      setShowGenModal(false); setGenForm({ name: '', kind: 'template', source_id: '', body: '' });
      await load();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  }

  function openEditFormat(f) {
    setEditFormat(f);
    setFormatForm({ name: f.name, body: f.body, fields: (f.fields || []).join(', ') });
    setShowFormatModal(true);
  }

  function openNewFormat() {
    setEditFormat(null); setFormatForm({ name: '', body: '', fields: '' }); setShowFormatModal(true);
  }

  const totalDocs = (stats || []).reduce((sum, s) => sum + Number(s.n), 0);

  return (
    <div>
      {error && <div className="err-banner" style={{ marginBottom: 12 }}><AlertCircle size={14} /> {error}</div>}

      {/* Stats line */}
      {stats && stats.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: 'var(--text-dim, #6b7280)' }}>Total generations: <strong>{totalDocs}</strong></div>
          {stats.map(s => (
            <div key={s.kind} style={{ fontSize: 13, color: 'var(--text-dim, #6b7280)' }}>
              {s.kind}: <strong>{s.n}</strong>
            </div>
          ))}
        </div>
      )}

      {/* Formats table */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14 }}><FileText size={14} /> Format Templates</h3>
          <button className="btn btn-primary btn-sm" onClick={openNewFormat}><Plus size={14} /> New Format</button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32 }}><Loader2 size={20} className="spin" /></div>
        ) : formats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, fontSize: 13, color: 'var(--text-dim, #6b7280)' }}>No formats created yet.</div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Name</th>
                  <th style={{ textAlign: 'center' }}>Fields</th>
                  <th style={{ textAlign: 'left' }}>Created At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {formats.map(f => (
                  <tr key={f.id}>
                    <td>{f.name}</td>
                    <td style={{ textAlign: 'center' }}>{Array.isArray(f.fields) ? f.fields.length : 0}</td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-dim, #6b7280)' }}>{new Date(f.created_at).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-sm" onClick={() => openEditFormat(f)} style={{ marginRight: 6 }}><Pencil size={13} /> Edit</button>
                      <button className="btn btn-sm" onClick={() => deleteFormat(f.id)} style={{ color: 'var(--danger, #ef4444)' }}><Trash2 size={13} /> Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Generations table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14 }}><FileText size={14} /> Generated Documents</h3>
          <button className="btn btn-primary btn-sm" onClick={() => { setGenForm({ name: '', kind: 'template', source_id: '', body: '' }); setShowGenModal(true); }}><Plus size={14} /> Generate</button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32 }}><Loader2 size={20} className="spin" /></div>
        ) : generations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, fontSize: 13, color: 'var(--text-dim, #6b7280)' }}>No documents generated yet.</div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Name</th>
                  <th style={{ textAlign: 'center' }}>Kind</th>
                  <th style={{ textAlign: 'left' }}>Source ID</th>
                  <th style={{ textAlign: 'left' }}>Created By</th>
                  <th style={{ textAlign: 'left' }}>Created At</th>
                </tr>
              </thead>
              <tbody>
                {generations.map(g => (
                  <tr key={g.id}>
                    <td>{g.name}</td>
                    <td style={{ textAlign: 'center' }}><span className="badge badge-blue">{g.kind}</span></td>
                    <td style={{ color: 'var(--text-dim, #6b7280)' }}>{g.source_id || '—'}</td>
                    <td>{g.created_by_name || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-dim, #6b7280)' }}>{new Date(g.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Format modal */}
      {showFormatModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowFormatModal(false)}>
          <div className="card" style={{ width: 480, maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{editFormat ? 'Edit Format' : 'New Format'}</h3>
            <label>Name <input className="input" value={formatForm.name} onChange={e => setFormatForm(f => ({ ...f, name: e.target.value }))} placeholder="Format name" /></label>
            <label style={{ marginTop: 10 }}>Body (template text) <textarea className="input" rows={6} value={formatForm.body} onChange={e => setFormatForm(f => ({ ...f, body: e.target.value }))} placeholder="Template body with placeholders" /></label>
            <label style={{ marginTop: 10 }}>Fields (comma-separated) <input className="input" value={formatForm.fields} onChange={e => setFormatForm(f => ({ ...f, fields: e.target.value }))} placeholder="field1, field2, field3" /></label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn" onClick={() => setShowFormatModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveFormat} disabled={saving || !formatForm.name.trim() || !formatForm.body.trim()}>{saving ? <Loader2 size={14} className="spin" /> : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Generation modal */}
      {showGenModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowGenModal(false)}>
          <div className="card" style={{ width: 480, maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Generate Document</h3>
            <label>Name <input className="input" value={genForm.name} onChange={e => setGenForm(f => ({ ...f, name: e.target.value }))} placeholder="Document name" /></label>
            <label style={{ marginTop: 10 }}>Kind <select className="input" value={genForm.kind} onChange={e => setGenForm(f => ({ ...f, kind: e.target.value }))}>
              <option value="template">template</option><option value="report">report</option><option value="letter">letter</option><option value="memo">memo</option>
            </select></label>
            <label style={{ marginTop: 10 }}>Source ID <input className="input" value={genForm.source_id} onChange={e => setGenForm(f => ({ ...f, source_id: e.target.value }))} placeholder="Optional source ID" /></label>
            <label style={{ marginTop: 10 }}>Body <textarea className="input" rows={6} value={genForm.body} onChange={e => setGenForm(f => ({ ...f, body: e.target.value }))} placeholder="Document body" /></label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn" onClick={() => setShowGenModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveGen} disabled={saving || !genForm.name.trim() || !genForm.body.trim()}>{saving ? <Loader2 size={14} className="spin" /> : 'Generate'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TAB_COMPONENTS = { report: ReportCard, form137: Form137, lesson: LessonPlan, exam: ExamBuilder, analytics: StudentAnalytics, enroll: EnrollmentSuggestions, chatlogs: ChatLogs, library: DocumentLibrary };

export default function AIPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('report');
  const [info, setInfo] = useState(null);
  const visibleTabs = TABS.filter((t) => can(user?.role, ...TAB_ROLES[t.id]));
  const activeTab = visibleTabs.some((t) => t.id === tab) ? tab : (visibleTabs[0]?.id || null);
  const TabContent = TAB_COMPONENTS[activeTab];

  useEffect(() => { api('/ai/status').then(setInfo).catch(() => {}); }, []);

  return (
    <>
      <PageHead title="AI Tools" sub={info ? `${info.provider.toUpperCase()} · ${info.model}` : 'AI-powered features for MeridianEd'} />
      {info && !info.enabled && (
        <div className="err-banner" style={{ marginBottom: 12 }}>
          <AlertCircle size={14} /> AI is not configured. Set <code>{info.provider === 'groq' ? 'GROQ_API_KEY' : info.provider === 'ollama' ? 'Start Ollama locally' : info.provider === 'hf' ? 'HF_API_KEY' : 'OPENAI_API_KEY'}</code> in your environment.
        </div>
      )}
      {activeTab ? (
        <>
          <div className="card-top" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {visibleTabs.map((tabItem) => (
                <button
                  key={tabItem.id}
                  className={`btn ${activeTab === tabItem.id ? 'btn-primary' : ''}`}
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
      ) : (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim, #6b7280)' }}>No AI tools available for your role.</div>
      )}
    </>
  );
}
