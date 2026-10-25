import { useState, useEffect } from 'react';
import { Brain, FileText, BookOpen, ClipboardCheck, BarChart3, GraduationCap, Sparkles, Loader2, AlertCircle, Printer, ChevronDown, ChevronRight, ChevronUp, MessageSquare, RefreshCw, Copy, Check, Cpu, AlertTriangle, Download, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { PageHead, SectionCard, EmptyState, Badge } from '../components/ui';
import { renderSF9Card, esc, CORE_VALUES } from './DepedForms';
import { printElementHtml, downloadBlob } from '../lib/export';
import DOMPurify from 'dompurify';
import AIText from '../components/AIText';

const TABS = [
  { id: 'report', label: 'Report Card', icon: FileText, desc: 'Generate SF9 report cards with AI conduct ratings' },
  { id: 'form137', label: 'Form 137', icon: ClipboardCheck, desc: 'Individual Permanent Academic Record' },
  { id: 'lesson', label: 'Lesson Plan', icon: BookOpen, desc: 'DepEd DLL lesson plan generator' },
  { id: 'exam', label: 'Exam Builder', icon: ClipboardCheck, desc: 'Exams with TOS and answer keys' },
  { id: 'analytics', label: 'Student Analytics', icon: BarChart3, desc: 'AI risk assessment and interventions' },
  { id: 'enroll', label: 'Enrollment Tips', icon: GraduationCap, desc: 'Strand and section recommendations' },
  { id: 'chatlogs', label: 'Chat Logs', icon: MessageSquare, desc: 'View all AI chat history' },
];

const AI_ADMIN = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
const AI_STAFF = [...AI_ADMIN, 'teacher', 'guidance'];

const TAB_ROLES = {
  report: [...AI_ADMIN, 'teacher'],
  form137: [...AI_ADMIN, 'teacher'],
  lesson: AI_STAFF,
  exam: AI_STAFF,
  analytics: [...AI_ADMIN, 'teacher', 'guidance'],
  enroll: [...AI_ADMIN, 'teacher'],
  chatlogs: AI_ADMIN,
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { }
  }
  return (
    <button className="btn btn-sm" onClick={handleCopy} title="Copy to clipboard">
      {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
    </button>
  );
}

function mergeConductData(sf9Data, aiResult) {
  if (!aiResult || !aiResult.conduct) return sf9Data;
  const merged = { ...sf9Data, conduct: { ...sf9Data.conduct } };
  for (const cv of CORE_VALUES) {
    const ai = aiResult.conduct[cv.key] || {};
    for (let q = 1; q <= 3; q++) {
      const val = ai[String(q)];
      if (val && ['ao', 'so', 'ro', 'no'].includes(val.toLowerCase())) {
        if (!merged.conduct[q]) merged.conduct[q] = { ...merged.conduct[q] };
        merged.conduct[q][cv.key] = val.toLowerCase();
      }
    }
  }
  return merged;
}

function LoadingOverlay({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <Loader2 size={28} className="spin" style={{ color: 'var(--accent)' }} />
      <div style={{ marginTop: 14, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{text}</div>
      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-dim)' }}>This may take a few moments...</div>
    </div>
  );
}

function FormSection({ title, icon: Icon, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h4 style={{ margin: '0 0 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, paddingBottom: 4, borderBottom: '1px solid var(--border)', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
        {Icon && <Icon size={13} />} {title}
      </h4>
      <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text)' }}>{children}</div>
    </div>
  );
}

function StudentSelector({ studentId, setStudentId, students, loading, onClick, label }) {
  return (
    <div className="form-row" style={{ alignItems: 'flex-end' }}>
      <label style={{ flex: 1, minWidth: 250 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>Select Student</span>
        <select className="input" value={studentId} onChange={e => setStudentId(e.target.value)}>
          <option value="">Choose a student...</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} ({s.grade_level || ' - '})</option>)}
        </select>
      </label>
      <button className="btn btn-primary" onClick={onClick} disabled={loading || !studentId} style={{ height: 38 }}>
        {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} {label}
      </button>
    </div>
  );
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
      <SectionCard title="Generate Report Card" icon={FileText}>
        <StudentSelector studentId={studentId} setStudentId={setStudentId} students={students} loading={loading} onClick={generate} label="Generate Report Card" />
      </SectionCard>

      {error && <div className="err-banner" style={{ marginTop: 12 }}><AlertCircle size={14} /> {error}</div>}

      {loading && <LoadingOverlay text="Generating report card with AI conduct ratings..." />}

      {merged && !loading && (
        <div style={{ marginTop: 16 }}>
          <SectionCard
            title="SF9 - Learner's Progress Report Card"
            icon={FileText}
            action={
              <div className="row-actions">
                {result && (
                  <button className="btn btn-sm" onClick={() => setShowAnalysis(!showAnalysis)}>
                    {showAnalysis ? <ChevronDown size={14} /> : <ChevronRight size={14} />} AI Analysis
                  </button>
                )}
                <button className="btn btn-primary btn-sm" onClick={print}>
                  <Printer size={14} /> Print SF9
                </button>
              </div>
            }
          >
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
              {merged.student.first_name} {merged.student.last_name} &middot; LRN {merged.student.lrn || 'N/A'} &middot; {merged.enrollment?.grade_level || ''}{merged.enrollment?.section_name ? ` - ${merged.enrollment.section_name}` : ''}
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div id="sf9-preview" style={{ padding: 8, overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(sf9Html, { USE_PROFILES: { html: true } }) }} />
            </div>
          </SectionCard>

          {result && showAnalysis && (
            <div style={{ marginTop: 12 }}>
              <SectionCard title="AI-Generated Analysis" icon={Brain}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  {result.risk_level && (
                    <div style={{ padding: 12, borderRadius: 8, background: result.risk_level === 'high' ? '#fef2f2' : result.risk_level === 'moderate' ? '#fffbeb' : '#f0fdf4', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>Risk Level</div>
                      <Badge status={result.risk_level}>{result.risk_level}</Badge>
                    </div>
                  )}
                  {result.conduct && (
                    <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>Conduct Summary</div>
                      <div style={{ fontSize: 12 }}>
                        {CORE_VALUES.map(cv => {
                          const ratings = result.conduct[cv.key] || {};
                          const vals = [1, 2, 3].map(q => ratings[String(q)]?.toUpperCase()).filter(Boolean);
                          return vals.length ? <span key={cv.key} style={{ marginRight: 6 }}>{cv.label.split('-')[1]?.trim() || cv.label}: {vals.join(', ')}</span> : null;
                        })}
                      </div>
                    </div>
                  )}
                  {result.remarks && (
                    <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>Overall Remarks</div>
                      <div style={{ fontSize: 12 }}>{typeof result.remarks === 'string' ? <AIText text={result.remarks} /> : result.remarks.overall || 'N/A'}</div>
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>
          )}
        </div>
      )}

      {!loading && !merged && (
        <EmptyState icon={FileText} text="Select a student and click Generate to create an SF9 Report Card with AI-powered conduct ratings." />
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
      <div class="footer">Generated by UGOP AI - ${new Date().toLocaleDateString()}</div>
      </body></html>`;
    printElementHtml(`Form 137 - ${name}`, html, { paper: 'legal' });
  }

  const resultSections = [
    { title: 'Personal Information', content: result?.personal_info, icon: FileText },
    { title: 'Academic Performance', content: result?.academic_narrative, icon: BarChart3 },
    { title: 'Attendance Summary', content: result?.attendance_summary, icon: ClipboardCheck },
    { title: 'Character & Conduct', content: result?.conduct_evaluation, icon: Brain },
    { title: 'Special Talents & Achievements', content: result?.talents_achievements, icon: Sparkles },
    { title: 'Recommendations', content: result?.recommendations, icon: BookOpen },
  ].filter(s => s.content);

  return (
    <div>
      <SectionCard title="Generate Form 137" icon={ClipboardCheck}>
        <StudentSelector studentId={studentId} setStudentId={setStudentId} students={students} loading={loading} onClick={generate} label="Generate Form 137" />
      </SectionCard>

      {error && <div className="err-banner" style={{ marginTop: 12 }}><AlertCircle size={14} /> {error}</div>}

      {loading && <LoadingOverlay text="Generating Form 137 with AI-powered academic analysis..." />}

      {result && !loading && (
        <div style={{ marginTop: 16 }}>
          <SectionCard
            title="Form 137 - Individual Permanent Academic Record"
            icon={ClipboardCheck}
            action={
              <div className="row-actions">
                <CopyButton text={resultSections.map(s => `${s.title}\n${s.content}`).join('\n\n')} />
                <button className="btn btn-primary btn-sm" onClick={printForm137}>
                  <Printer size={14} /> Print Form 137
                </button>
              </div>
            }
          >
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
              AI-generated narrative based on complete academic history
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '20px 28px', maxWidth: 800, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', borderBottom: '3px double #000', paddingBottom: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: 10, letterSpacing: 3, color: '#666' }}>DEPARTMENT OF EDUCATION</div>
                  <div style={{ fontSize: 13, fontWeight: 700, margin: '4px 0' }}>Hinabangan National High School</div>
                  <div style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, margin: '8px 0 2px' }}>Form 137</div>
                  <div style={{ fontSize: 10.5, color: '#444' }}>Individual Permanent Academic Record</div>
                </div>

                {result.overall_remark && (
                  <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 6, background: result.overall_remark === 'Outstanding' ? '#f0fdf4' : result.overall_remark === 'Needs Improvement' ? '#fef2f2' : '#fffbeb', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)' }}>Overall Assessment: </span>
                    <Badge status={result.overall_remark === 'Outstanding' ? 'green' : result.overall_remark === 'Needs Improvement' ? 'red' : 'yellow'}>{result.overall_remark}</Badge>
                  </div>
                )}

                {resultSections.map((section, i) => (
                  <FormSection key={i} title={section.title} icon={section.icon}>
                    {section.content}
                  </FormSection>
                ))}

                <div style={{ marginTop: 20, paddingTop: 10, borderTop: '1px solid #ddd', fontSize: 9, color: '#999', textAlign: 'center' }}>
                  Generated by UGOP AI - {new Date().toLocaleDateString()}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {!loading && !result && (
        <EmptyState icon={ClipboardCheck} text="Select a student and click Generate to create a Form 137 with AI-powered academic analysis." />
      )}
    </div>
  );
}

const DLL_PROC_LABELS = { a: 'Review of Previous Lesson', b: 'Establishing Purpose', c: 'Presenting new Examples', d: 'Discussing new Concepts', e: 'Developing Mastery', f: 'Evaluating Learning', g: 'Additional Activities / Remediation' };

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

  function printDll() {
    if (!result) return;
    const x = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const procHtml = ['a','b','c','d','e','f','g'].filter(k => result.procedures?.[k]).map(k =>
      `<tr><td class="b" style="width:30%">(${k}) ${DLL_PROC_LABELS[k] || ''}</td><td>${x(result.procedures[k])}</td></tr>`).join('');
    const html = `<div class="h1 center">Detailed Lesson Log (DLL)</div>
      <table><tr><td class="b" style="width:30%">Subject</td><td>${x(form.subject_id)}</td><td class="b" style="width:20%">Grade</td><td>${x(form.grade_level)}</td></tr>
      <tr><td class="b">Topic</td><td colspan="3">${x(form.topic || result.competencies || '')}</td></tr>
      <tr><td class="b">Duration</td><td>${x(String(form.duration_minutes))} min</td><td class="b">Week</td><td>${x(form.week)}</td></tr></table>
      ${result.competencies ? `<h2>Learning Competencies</h2><p>${x(result.competencies)}</p>` : ''}
      ${result.content ? `<h2>Content</h2><p>${x(result.content)}</p>` : ''}
      ${result.learning_resources ? `<h2>Learning Resources</h2><p>${x(result.learning_resources)}</p>` : ''}
      ${procHtml ? `<h2>Procedures</h2><table>${procHtml}</table>` : ''}
      ${result.reflection ? `<h2>Reflection</h2><p>${x(result.reflection)}</p>` : ''}
      ${result.remarks ? `<h2>Remarks</h2><p>${x(result.remarks)}</p>` : ''}
      <div class="center small" style="margin-top:18pt;border-top:1px solid #999;padding-top:6pt;">Generated by MeridianEd AI - ${new Date().toLocaleDateString()}</div>`;
    printElementHtml('Detailed Lesson Plan', html, { paper: 'letter' });
  }

  const outputText = result ? JSON.stringify(result, null, 2) : '';
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <SectionCard title="AI Lesson Plan Generator" icon={BookOpen} action={result ? (
        <div className="row-actions">
          <CopyButton text={outputText} />
          <button className="btn btn-primary btn-sm" onClick={printDll}><Printer size={14} /> Print DLL</button>
        </div>
      ) : null}>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 14px' }}>Auto-generate Detailed Lesson Plans (DLL) aligned to DepEd format and competencies.</p>
        <div className="form-row-2" style={{ marginBottom: 16 }}>
          <label className="form-group"><span>Subject ID</span>
            <input className="input" type="number" value={form.subject_id} onChange={e => set('subject_id', e.target.value)} placeholder="Optional" /></label>
          <label className="form-group"><span>Grade Level</span>
            <select className="input" value={form.grade_level} onChange={e => set('grade_level', e.target.value)}><option>Grade 11</option><option>Grade 12</option></select></label>
          <label className="form-group"><span>Topic</span>
            <input className="input" value={form.topic} onChange={e => set('topic', e.target.value)} placeholder="e.g. Photosynthesis" /></label>
          <label className="form-group"><span>Strand</span>
            <input className="input" value={form.strand} onChange={e => set('strand', e.target.value)} placeholder="e.g. STEM" /></label>
          <label className="form-group"><span>Duration (min)</span>
            <input className="input" type="number" value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)} /></label>
          <label className="form-group"><span>Week</span>
            <input className="input" value={form.week} onChange={e => set('week', e.target.value)} placeholder="e.g. Week 3" /></label>
        </div>
        <button className="btn btn-primary" onClick={generate} disabled={loading}>
          {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Generate Lesson Plan</button>
      </SectionCard>
      {error && <div className="err-banner" style={{ marginTop: 12 }}><AlertCircle size={14} /> {error}</div>}
      {loading && <LoadingOverlay text="Generating Detailed Lesson Plan (DLL)..." />}
      {result && !loading && (
        <div style={{ marginTop: 16 }}>
          <SectionCard title="Generated Lesson Plan" icon={BookOpen}>
            {result.competencies && <FormSection title="Learning Competencies" icon={Brain}><AIText text={result.competencies} /></FormSection>}
            {result.content && <FormSection title="Content" icon={FileText}><AIText text={result.content} /></FormSection>}
            {result.learning_resources && (
              <FormSection title="Learning Resources" icon={BookOpen}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {result.learning_resources.split(/\n|,|;/).filter(Boolean).map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <BookOpen size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} /><span>{r.trim()}</span></div>
                  ))}
                </div>
              </FormSection>
            )}
            {result.procedures && (
              <FormSection title="Procedures" icon={ClipboardCheck}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(k => result.procedures[k] && (
                    <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)' }}>
                      <span className="badge badge-blue" style={{ flexShrink: 0, marginTop: 1 }}>{k.toUpperCase()}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--accent)', marginBottom: 2 }}>{DLL_PROC_LABELS[k] || k}</div>
                        <div style={{ fontSize: 13, lineHeight: 1.5 }}>{result.procedures[k]}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </FormSection>
            )}
            {result.reflection && <FormSection title="Reflection" icon={Sparkles}><AIText text={result.reflection} /></FormSection>}
            {result.remarks && <FormSection title="Remarks" icon={MessageSquare}><AIText text={result.remarks} /></FormSection>}
            {result.raw && <FormSection title="AI Output" icon={Cpu}><pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{result.raw}</pre></FormSection>}
          </SectionCard>
        </div>
      )}
      {!loading && !result && <EmptyState icon={BookOpen} text="Configure the lesson plan parameters above and click Generate to create a DepEd-aligned DLL." />}
    </div>
  );
}

function ExamBuilder() {
  const [form, setForm] = useState({ subject_id: '', topic: '', num_items: 20, grade_level: 'Grade 11', exam_type: 'prelim exam', difficulty_mix: '40 easy, 40 moderate, 20 difficult' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showAnswerKey, setShowAnswerKey] = useState(false);

  async function generate() {
    setLoading(true); setError(null); setResult(null); setShowAnswerKey(false);
    try {
      const body = { ...form };
      if (body.subject_id) body.subject_id = Number(body.subject_id);
      if (body.num_items) body.num_items = Number(body.num_items);
      setResult(await api('/ai/exam', { method: 'POST', body }));
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  function diffBadge(d) {
    const l = String(d).toLowerCase();
    const cls = l.includes('easy') ? 'badge-green' : (l.includes('moderate') || l.includes('medium')) ? 'badge-yellow' : (l.includes('difficult') || l.includes('hard')) ? 'badge-red' : 'badge-blue';
    return <span className={`badge ${cls}`} style={{ fontSize: 11 }}>{d}</span>;
  }

  function printExam() {
    if (!result?.items) return;
    const x = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const itemsHtml = result.items.map((item, i) => {
      const opts = (item.options || []).map((o, j) => `<div style="margin-left:24pt;margin-bottom:2pt;">${String.fromCharCode(65+j)}. ${x(o)}</div>`).join('');
      return `<div style="margin-bottom:10pt;page-break-inside:avoid;"><strong>${i+1}.</strong> ${x(item.question)}${opts}</div>`;
    }).join('');
    const answerHtml = result.items.map((item, i) =>
      `<tr><td style="text-align:center;">${i+1}</td><td style="text-align:center;font-weight:bold;">${x(item.answer)}</td><td>${x(item.difficulty||'')}</td></tr>`).join('');
    const body = `<div class="h1 center">Examination</div>
      <p><strong>Topic:</strong> ${x(form.topic||'')} &nbsp;|&nbsp; <strong>Grade:</strong> ${x(form.grade_level)} &nbsp;|&nbsp; <strong>Type:</strong> ${x(form.exam_type)}</p>
      <div class="pagebreak"></div>${itemsHtml}
      <div class="pagebreak"></div><div class="h1 center">Answer Key</div>
      <table><thead><tr><th style="width:20%">Item</th><th style="width:30%">Answer</th><th>Difficulty</th></tr></thead><tbody>${answerHtml}</tbody></table>`;
    printElementHtml('Examination', body, { paper: 'letter' });
  }

  const outputText = result ? JSON.stringify(result, null, 2) : '';
  const diffCounts = { easy: 0, moderate: 0, difficult: 0 };
  if (result?.items) result.items.forEach(item => {
    const d = String(item.difficulty || '').toLowerCase();
    if (d.includes('easy')) diffCounts.easy++;
    else if (d.includes('moderate') || d.includes('medium')) diffCounts.moderate++;
    else if (d.includes('difficult') || d.includes('hard')) diffCounts.difficult++;
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <SectionCard title="AI Exam / TOS Builder" icon={ClipboardCheck} action={result ? (
        <div className="row-actions">
          <CopyButton text={outputText} />
          <button className="btn btn-primary btn-sm" onClick={printExam}><Printer size={14} /> Print Exam</button>
        </div>
      ) : null}>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 14px' }}>Generate test items with Table of Specifications (TOS), answer keys, and difficulty tags.</p>
        <div className="form-row-2" style={{ marginBottom: 16 }}>
          <label className="form-group"><span>Subject ID</span>
            <input className="input" type="number" value={form.subject_id} onChange={e => set('subject_id', e.target.value)} placeholder="Optional" /></label>
          <label className="form-group"><span>Grade Level</span>
            <select className="input" value={form.grade_level} onChange={e => set('grade_level', e.target.value)}><option>Grade 11</option><option>Grade 12</option></select></label>
          <label className="form-group"><span>Topic</span>
            <input className="input" value={form.topic} onChange={e => set('topic', e.target.value)} placeholder="e.g. Cell Division" /></label>
          <label className="form-group"><span>Exam Type</span>
            <select className="input" value={form.exam_type} onChange={e => set('exam_type', e.target.value)}>
              <option>prelim exam</option><option>midterm exam</option><option>finals exam</option><option>quiz</option><option>activity</option></select></label>
          <label className="form-group"><span>Number of Items</span>
            <input className="input" type="number" value={form.num_items} onChange={e => set('num_items', e.target.value)} /></label>
          <label className="form-group"><span>Difficulty Mix</span>
            <input className="input" value={form.difficulty_mix} onChange={e => set('difficulty_mix', e.target.value)} /></label>
        </div>
        <button className="btn btn-primary" onClick={generate} disabled={loading}>
          {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Generate Exam</button>
      </SectionCard>
      {error && <div className="err-banner" style={{ marginTop: 12 }}><AlertCircle size={14} /> {error}</div>}
      {loading && <LoadingOverlay text="Building exam with TOS and answer keys..." />}
      {result && !loading && (
        <div style={{ marginTop: 16 }}>
          {result.items && result.items.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--card)', border: '1px solid var(--border)', fontSize: 13 }}>
              <span className="badge badge-green">{diffCounts.easy} Easy</span>
              <span className="badge badge-yellow">{diffCounts.moderate} Moderate</span>
              <span className="badge badge-red">{diffCounts.difficult} Difficult</span>
              <span style={{ color: 'var(--text-dim)', marginLeft: 'auto' }}>{result.items.length} Total</span>
            </div>
          )}
          <SectionCard title="Generated Exam" icon={ClipboardCheck}>
            {result.tos && result.tos.length > 0 && (
              <FormSection title="Table of Specifications" icon={BarChart3}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.tos.map((t, i) => {
                    const pct = parseFloat(t.percentage) || 0;
                    return (
                      <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{t.objective}</span>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {diffBadge(t.difficulty)}
                            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t.count} items &middot; {t.percentage}</span>
                          </div>
                        </div>
                        <div style={{ height: 6, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, borderRadius: 4, background: pct >= 50 ? 'var(--success)' : pct >= 25 ? 'var(--warn)' : 'var(--accent)', transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </FormSection>
            )}
            {result.items && result.items.length > 0 && (
              <FormSection title={`Test Items (${result.items.length})`} icon={ClipboardCheck}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.items.map((item, i) => (
                    <div key={i} style={{ padding: 10, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4, flex: 1 }}>{i + 1}. {item.question}</div>
                        {diffBadge(item.difficulty)}
                      </div>
                      {item.options && item.options.map((opt, j) => (
                        <div key={j} style={{ fontSize: 13, padding: '2px 0', color: String.fromCharCode(65+j) === item.answer ? 'var(--success)' : 'var(--text-dim)' }}>{String.fromCharCode(65+j)}. {opt}</div>
                      ))}
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{item.objective}</div>
                    </div>
                  ))}
                </div>
              </FormSection>
            )}
            {result.items && result.items.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <button className="btn btn-sm" onClick={() => setShowAnswerKey(!showAnswerKey)}>
                  {showAnswerKey ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {showAnswerKey ? 'Hide' : 'Show'} Answer Key</button>
                {showAnswerKey && (
                  <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
                      {result.items.map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '4px 8px', borderRadius: 6, background: 'var(--bg)' }}>
                          <strong style={{ color: 'var(--text-dim)', minWidth: 20 }}>{i + 1}.</strong>
                          <span style={{ fontWeight: 700, color: 'var(--success)' }}>{item.answer}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {result.raw && <FormSection title="AI Output" icon={Cpu}><pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{result.raw}</pre></FormSection>}
          </SectionCard>
        </div>
      )}
      {!loading && !result && <EmptyState icon={ClipboardCheck} text="Configure the exam parameters above and click Generate to create test items with TOS and answer keys." />}
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

  function riskGaugePercent(level) {
    const l = String(level).toLowerCase();
    return l === 'critical' ? 100 : l === 'high' ? 75 : l === 'moderate' ? 50 : 25;
  }

  function riskGaugeColor(level) {
    const l = String(level).toLowerCase();
    return l === 'critical' ? 'var(--danger)' : l === 'high' ? '#f97316' : l === 'moderate' ? 'var(--warn)' : 'var(--success)';
  }

  const outputText = result ? JSON.stringify(result, null, 2) : '';

  return (
    <div>
      <SectionCard title="AI Student Analytics & Interventions" icon={BarChart3} action={result ? <CopyButton text={outputText} /> : null}>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 14px' }}>AI-powered risk assessment with specific intervention plans for at-risk students.</p>
        <div className="form-row" style={{ alignItems: 'flex-end' }}>
          <label style={{ flex: 1, minWidth: 250 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>Select Student</span>
            <select className="input" value={studentId} onChange={e => setStudentId(e.target.value)}>
              <option value="">Select a student...</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} (ID: {s.id})</option>)}
            </select>
          </label>
          <button className="btn btn-primary" onClick={analyze} disabled={loading || !studentId} style={{ height: 38 }}>
            {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Analyze
          </button>
        </div>
      </SectionCard>

      {error && <div className="err-banner" style={{ marginTop: 12 }}><AlertCircle size={14} /> {error}</div>}

      {loading && <LoadingOverlay text="Analyzing student data and generating intervention plan..." />}

      {result && !loading && (
        <div style={{ marginTop: 16 }}>
          <SectionCard title="Student Analytics Results" icon={BarChart3}>
            {result.risk_level && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Risk Level:</span>
                  <Badge status={result.risk_level === 'high' || result.risk_level === 'critical' ? 'red' : result.risk_level === 'moderate' ? 'yellow' : 'green'}>{result.risk_level}</Badge>
                </div>
                <div style={{ height: 10, borderRadius: 6, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${riskGaugePercent(result.risk_level)}%`, borderRadius: 6, background: riskGaugeColor(result.risk_level), transition: 'width 0.4s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-dim)' }}>
                  <span>Low</span><span>Moderate</span><span>High</span><span>Critical</span>
                </div>
              </div>
            )}

            {result.reasoning && <FormSection title="Reasoning" icon={Brain}><AIText text={result.reasoning} /></FormSection>}

            {result.factors && result.factors.length > 0 && (
              <FormSection title="Contributing Factors" icon={AlertTriangle}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                  {result.factors.map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)' }}>
                      <AlertTriangle size={16} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: 13, lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </FormSection>
            )}

            {result.interventions && result.interventions.length > 0 && (
              <FormSection title="Intervention Plan" icon={ClipboardCheck}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {result.interventions.map((iv, i) => (
                    <div key={i} style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <div style={{ width: 4, flexShrink: 0, background: i % 3 === 0 ? 'var(--accent)' : i % 3 === 1 ? 'var(--success)' : 'var(--warn)' }} />
                      <div style={{ padding: '10px 14px', flex: 1, display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 16, alignItems: 'center', background: 'var(--card)' }}>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 2 }}>Action</div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{iv.action}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 2 }}>Timeline</div>
                          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{iv.timeline}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 2 }}>Responsible</div>
                          <div style={{ fontSize: 12 }}>{iv.responsible}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </FormSection>
            )}

            {result.parent_recommendations && (
              <div style={{ padding: '14px 18px', borderRadius: 10, background: 'var(--card)', border: '2px solid var(--accent)', marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <GraduationCap size={18} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Parent Recommendations</span>
                </div>
                <AIText text={result.parent_recommendations} />
              </div>
            )}

            {result.raw && <FormSection title="AI Output" icon={Cpu}><pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{result.raw}</pre></FormSection>}
          </SectionCard>
        </div>
      )}

      {!loading && !result && (
        <EmptyState icon={BarChart3} text="Select a student and click Analyze to generate a risk assessment with intervention plans." />
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

  useEffect(() => { api('/students').then(r => setStudents(r.data || r.rows || r || [])).catch(() => {}); }, []);

  async function suggest() {
    if (!studentId) return;
    setLoading(true); setError(null); setResult(null);
    try {
      setResult(await api('/ai/enrollment-suggest', { method: 'POST', body: { student_id: Number(studentId) } }));
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  const outputText = result ? JSON.stringify(result, null, 2) : '';

  return (
    <div>
      <SectionCard title="AI Enrollment Suggestions" icon={GraduationCap} action={result ? <CopyButton text={outputText} /> : null}>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 14px' }}>AI recommends the best strand, section, and academic support for each student.</p>
        <div className="form-row" style={{ alignItems: 'flex-end' }}>
          <label style={{ flex: 1, minWidth: 250 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>Select Student</span>
            <select className="input" value={studentId} onChange={e => setStudentId(e.target.value)}>
              <option value="">Select a student...</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} (ID: {s.id})</option>)}
            </select>
          </label>
          <button className="btn btn-primary" onClick={suggest} disabled={loading || !studentId} style={{ height: 38 }}>
            {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Get Suggestions</button>
        </div>
      </SectionCard>
      {error && <div className="err-banner" style={{ marginTop: 12 }}><AlertCircle size={14} /> {error}</div>}
      {loading && <LoadingOverlay text="Analyzing student profile and generating enrollment recommendations..." />}
      {result && !loading && (
        <div style={{ marginTop: 16 }}>
          <SectionCard title="Enrollment Suggestions" icon={GraduationCap}>
            {result.recommended_strand && <FormSection title="Recommended Strand" icon={GraduationCap}><AIText text={result.recommended_strand} /></FormSection>}
            {result.reasoning && <FormSection title="Reasoning" icon={Brain}><AIText text={result.reasoning} /></FormSection>}
            {result.focus_areas && result.focus_areas.length > 0 && (
              <FormSection title="Focus Areas" icon={BarChart3}><ul style={{ margin: 0, paddingLeft: 18 }}>{result.focus_areas.map((f, i) => <li key={i}>{f}</li>)}</ul></FormSection>
            )}
            {result.support_needed && result.support_needed.length > 0 && (
              <FormSection title="Support Needed" icon={BookOpen}><ul style={{ margin: 0, paddingLeft: 18 }}>{result.support_needed.map((s, i) => <li key={i}>{s}</li>)}</ul></FormSection>
            )}
            {result.aral_eligible !== undefined && (
              <FormSection title="Aral Program Eligibility" icon={GraduationCap}>
                {result.aral_eligible ? 'This student is recommended for the Aral Program.' : 'Not eligible for Aral Program.'}</FormSection>
            )}
            {result.raw && <FormSection title="AI Output" icon={Cpu}><pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{result.raw}</pre></FormSection>}
          </SectionCard>
        </div>
      )}
      {!loading && !result && <EmptyState icon={GraduationCap} text="Select a student and click Get Suggestions to receive AI-powered strand and section recommendations." />}
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
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [expandedId, setExpandedId] = useState(null);
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

  const uniqueUsers = [...new Set(logs.map(r => r.user_name || r.username).filter(Boolean))];
  const filteredLogs = logs.filter(r => {
    if (search && !(r.message || '').toLowerCase().includes(search.toLowerCase()) && !(r.user_name || r.username || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (userFilter && (r.user_name || r.username) !== userFilter) return false;
    return true;
  });

  function exportCsv() {
    if (!filteredLogs.length) return;
    const header = 'Timestamp,User,Role,Message,Intent\n';
    const rows = filteredLogs.map(r =>
      `"${new Date(r.created_at).toLocaleString()}","${(r.user_name || r.username || '').replace(/"/g, '""')}","${r.role || ''}","${(r.message || '').replace(/"/g, '""').replace(/\n/g, ' ')}","${r.intent || ''}"`
    ).join('\n');
    downloadBlob(header + rows, 'chat-logs.csv', 'text/csv;charset=utf-8');
  }

  const kpiStyle = { padding: '10px 14px' };
  const kpiIconStyle = { color: 'var(--accent)' };

  return (
    <div>
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
          <div className="card kpi" style={kpiStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}><MessageSquare size={14} style={kpiIconStyle} /><span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Messages</span></div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.total_messages}</div>
          </div>
          <div className="card kpi" style={kpiStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}><GraduationCap size={14} style={kpiIconStyle} /><span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Users</span></div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.distinct_users}</div>
          </div>
          <div className="card kpi" style={kpiStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}><BarChart3 size={14} style={kpiIconStyle} /><span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Last 24h</span></div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.last_24h}</div>
          </div>
        </div>
      )}

      {error && <div className="err-banner" style={{ marginBottom: 12 }}><AlertCircle size={14} /> {error}</div>}

      <SectionCard title="AI Chat Logs" icon={MessageSquare} action={
        <div className="row-actions">
          <button className="btn btn-sm" onClick={exportCsv} disabled={loading || !filteredLogs.length}><Download size={13} /> Export CSV</button>
          <button className="btn btn-sm" onClick={() => load(offset)} disabled={loading}><RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh</button>
        </div>
      }>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <label style={{ flex: '1 1 200px', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input className="input" style={{ paddingLeft: 32 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search messages..." />
          </label>
          {uniqueUsers.length > 0 && (
            <select className="input" style={{ flex: '0 0 180px' }} value={userFilter} onChange={e => setUserFilter(e.target.value)}>
              <option value="">All users</option>
              {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          )}
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32 }}><Loader2 size={20} className="spin" /></div>
        ) : filteredLogs.length === 0 ? (
          <EmptyState icon={MessageSquare} text={logs.length === 0 ? 'No chat logs recorded yet.' : 'No logs match your search.'} />
        ) : (
          <div className="table-wrap">
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', width: 30 }}></th>
                  <th style={{ textAlign: 'left' }}>Timestamp</th>
                  <th style={{ textAlign: 'left' }}>User</th>
                  <th style={{ textAlign: 'left' }}>Role</th>
                  <th style={{ textAlign: 'left' }}>Message</th>
                  <th style={{ textAlign: 'left' }}>Intent</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((row) => (
                  <>
                    <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}>
                      <td style={{ padding: '0 6px' }}>{expandedId === row.id ? <ChevronUp size={14} style={{ color: 'var(--text-dim)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-dim)' }} />}</td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{new Date(row.created_at).toLocaleString()}</td>
                      <td>{row.user_name || row.username || ' - '}</td>
                      <td><Badge status={row.role === 'assistant' ? 'blue' : 'green'}>{row.role}</Badge></td>
                      <td style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(row.message || '').slice(0, 80)}</td>
                      <td style={{ color: 'var(--text-dim)' }}>{row.intent || ' - '}</td>
                    </tr>
                    {expandedId === row.id && (
                      <tr key={`${row.id}-expanded`}>
                        <td colSpan={6} style={{ padding: '0 0 0 30px', background: 'var(--bg)' }}>
                          <div style={{ padding: '8px 12px', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', borderBottom: '1px solid var(--border)' }}>{row.message || ''}</div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > limit && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
            <button className="btn btn-sm" disabled={offset === 0} onClick={() => load(offset - limit)}>Prev</button>
            <span style={{ fontSize: 12, alignSelf: 'center', color: 'var(--text-dim)' }}>{offset + 1} - {Math.min(offset + limit, total)} of {total}</span>
            <button className="btn btn-sm" disabled={offset + limit >= total} onClick={() => load(offset + limit)}>Next</button>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

const TAB_COMPONENTS = { report: ReportCard, form137: Form137, lesson: LessonPlan, exam: ExamBuilder, analytics: StudentAnalytics, enroll: EnrollmentSuggestions, chatlogs: ChatLogs };

export default function AIPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('report');
  const [info, setInfo] = useState(null);
  const visibleTabs = TABS.filter((t) => can(user?.role, ...TAB_ROLES[t.id]));
  const activeTab = visibleTabs.some((t) => t.id === tab) ? tab : (visibleTabs[0]?.id || null);
  const TabContent = TAB_COMPONENTS[activeTab];
  const activeTabMeta = TABS.find(t => t.id === activeTab);

  useEffect(() => { api('/ai/status').then(setInfo).catch(() => {}); }, []);

  return (
    <>
      <PageHead title="AI Tools" sub={info ? `${info.provider.toUpperCase()} - ${info.model}` : 'AI-powered features for MeridianEd'} />
      {info && !info.enabled && (
        <div className="err-banner" style={{ marginBottom: 12 }}>
          <AlertCircle size={14} /> AI is not configured. Set <code>{info.provider === 'groq' ? 'GROQ_API_KEY' : info.provider === 'ollama' ? 'Start Ollama locally' : info.provider === 'hf' ? 'HF_API_KEY' : 'OPENAI_API_KEY'}</code> in your environment.
        </div>
      )}
      {info && info.enabled && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--card)', border: '1px solid var(--border)', fontSize: 13 }}>
          <Cpu size={14} style={{ color: 'var(--accent)' }} />
          <span style={{ color: 'var(--text-dim)' }}>Provider:</span>
          <Badge status="green">{info.provider?.toUpperCase()}</Badge>
          <span style={{ color: 'var(--text-dim)' }}>Model:</span>
          <Badge status="blue">{info.model}</Badge>
          <span style={{ color: 'var(--text-dim)', marginLeft: 'auto' }}>{visibleTabs.length} tool{visibleTabs.length !== 1 ? 's' : ''} available</span>
        </div>
      )}
      {activeTab ? (
        <>
          <div className="tab-bar" style={{ marginBottom: 14 }}>
            {visibleTabs.map((tabItem) => (
              <button key={tabItem.id} className={activeTab === tabItem.id ? 'active' : ''} onClick={() => setTab(tabItem.id)}>
                <tabItem.icon size={14} /> {tabItem.label}
              </button>
            ))}
          </div>
          {activeTabMeta && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>{activeTabMeta.desc}</div>}
          <TabContent />
        </>
      ) : (
        <EmptyState icon={Brain} text="No AI tools available for your role." />
      )}
    </>
  );
}
