import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Plus, Filter, Clock, CheckCircle, Send, Eye, Copy, RotateCcw } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { PageHead, Spinner, Empty, Modal, ErrorBanner, ConfirmModal } from '../components/ui';

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'teacher'];
const REVIEWERS = ['super_admin', 'school_admin', 'principal', 'assistant_principal'];
const STATUSES = ['draft', 'ready', 'taught', 'revised'];
const SUB_STATUSES = ['draft', 'submitted', 'returned', 'approved'];
const STATUS_COLORS = { draft: 'badge-gray', ready: 'badge-blue', taught: 'badge-green', revised: 'badge-yellow' };
const SUB_COLORS = { draft: 'badge-gray', submitted: 'badge-blue', returned: 'badge-yellow', approved: 'badge-green' };
const EMPTY_FORM = {
  title: '', subject_id: '', section_id: '', school_year: '2026-2027', quarter: '',
  objectives: '', content_outline: '', teaching_strategy: '', materials: '', assessment_plan: '',
  competency_ids: [], duration_minutes: 60, scheduled_date: '', status: 'draft', notes: '',
};

export default function Lessons() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = can(user?.role, ...WRITE);
  const canReview = can(user?.role, ...REVIEWERS);
  const [rows, setRows] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState({ subject: '', quarter: '', status: '', submission: '' });
  const [saving, setSaving] = useState(false);
  const [showReview, setShowReview] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    Promise.allSettled([
      api('/subjects?limit=300'),
      api('/sections?limit=200'),
      api('/lessons?limit=300'),
    ]).then(([s, sec, l]) => {
      if (s.status === 'fulfilled') setSubjects(s.value.data);
      if (sec.status === 'fulfilled') setSections(sec.value.data);
      if (l.status === 'fulfilled') setRows(l.value.data);
      const errors = [s, sec, l].filter((r) => r.status === 'rejected').map((r) => r.reason?.message).filter(Boolean);
      if (errors.length) setError(errors.join('; '));
    }).finally(() => setLoading(false));
  }, []);

  async function loadCompetencies(subjectId, quarter) {
    if (!subjectId) { setCompetencies([]); return; }
    let url = `/competency-tracker/competencies?subject_id=${subjectId}`;
    if (quarter) url += `&quarter=${quarter}`;
    try {
      const r = await api(url);
      setCompetencies(r.data || []);
    } catch { setCompetencies([]); }
  }

  function openForm(lesson) {
    if (lesson) {
      setEditing(lesson.id);
      setForm({
        title: lesson.title || '',
        subject_id: lesson.subject_id || '',
        section_id: lesson.section_id || '',
        school_year: lesson.school_year || '2026-2027',
        quarter: lesson.quarter || '',
        objectives: lesson.objectives || '',
        content_outline: lesson.content_outline || '',
        teaching_strategy: lesson.teaching_strategy || '',
        materials: lesson.materials || '',
        assessment_plan: lesson.assessment_plan || '',
        competency_ids: (() => { try { return lesson.competency_ids ? JSON.parse(lesson.competency_ids) : []; } catch { return []; } })(),
        duration_minutes: lesson.duration_minutes || 60,
        scheduled_date: lesson.scheduled_date || '',
        status: lesson.status || 'draft',
        notes: lesson.notes || '',
      });
      loadCompetencies(lesson.subject_id, lesson.quarter);
    } else {
      setEditing(null);
      setForm({ ...EMPTY_FORM });
      setCompetencies([]);
    }
    setShowModal(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { ...form, quarter: form.quarter || null, section_id: form.section_id || null };
      if (editing) {
        await api(`/lessons/${editing}`, { method: 'PATCH', body });
      } else {
        await api('/lessons', { method: 'POST', body });
      }
      const res = await api('/lessons?limit=300');
      setRows(res.data);
      setShowModal(false);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitLesson(id) {
    try {
      await api(`/lessons/${id}/submit`, { method: 'POST' });
      const res = await api('/lessons?limit=300');
      setRows(res.data);
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function reviewLesson(action) {
    if (!showReview) return;
    setReviewing(true);
    try {
      await api(`/lessons/${showReview.id}/review`, { method: 'POST', body: { action, review_notes: reviewNotes } });
      const res = await api('/lessons?limit=300');
      setRows(res.data);
      setShowReview(null);
      setReviewNotes('');
    } catch (e2) {
      setError(e2.message);
    } finally {
      setReviewing(false);
    }
  }

  async function copyLesson(id) {
    try {
      const r = await api(`/lessons/${id}/copy`, { method: 'POST' });
      const res = await api('/lessons?limit=300');
      setRows(res.data);
      openForm(res.data.find((l) => l.id === r.id));
    } catch (e2) {
      setError(e2.message);
    }
  }

  const filtered = rows.filter((r) =>
    (!filter.subject || String(r.subject_id) === filter.subject) &&
    (!filter.quarter || String(r.quarter) === filter.quarter) &&
    (!filter.status || r.status === filter.status) &&
    (!filter.submission || r.submission_status === filter.submission)
  );

  const counts = { draft: 0, submitted: 0, returned: 0, approved: 0 };
  rows.forEach((r) => { counts[r.submission_status] = (counts[r.submission_status] || 0) + 1; });

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHead title={t('lessons.title', 'Lesson Plans')} sub={t('lessons.subtitle', 'Plan, track, and align lessons with the SHS curriculum competencies')}>
        {canWrite && (
          <button className="btn btn-primary" onClick={() => openForm(null)}>
            <Plus size={15} /> {t('lessons.newLesson', 'New Lesson')}
          </button>
        )}
      </PageHead>
      <ErrorBanner error={error} />

      {/* Submission overview KPIs */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="kpi-row">
          <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--text-dim)' }}>{counts.draft}</div><div className="kpi-mini-label">Drafts</div></div>
          <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--accent)' }}>{counts.submitted}</div><div className="kpi-mini-label">Submitted</div></div>
          <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--warn)' }}>{counts.returned}</div><div className="kpi-mini-label">Returned</div></div>
          <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--success)' }}>{counts.approved}</div><div className="kpi-mini-label">Approved</div></div>
        </div>
      </div>

      <div className="card">
        <div className="form-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <label style={{ margin: 0 }}>
            <Filter size={14} /> {t('lessons.subject', 'Subject')}
            <select value={filter.subject} onChange={(e) => setFilter((f) => ({ ...f, subject: e.target.value }))} style={{ marginTop: 4 }}>
              <option value="">{t('lessons.allSubjects', 'All subjects')}</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.title}</option>)}
            </select>
          </label>
          <label style={{ margin: 0 }}>
            {t('lessons.quarter', 'Quarter')}
            <select value={filter.quarter} onChange={(e) => setFilter((f) => ({ ...f, quarter: e.target.value }))} style={{ marginTop: 4 }}>
              <option value="">{t('lessons.allQuarters', 'All quarters')}</option>
              <option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option>
            </select>
          </label>
          <label style={{ margin: 0 }}>
            {t('lessons.status', 'Status')}
            <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))} style={{ marginTop: 4 }}>
              <option value="">{t('lessons.allStatuses', 'All')}</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label style={{ margin: 0 }}>
            Submission
            <select value={filter.submission} onChange={(e) => setFilter((f) => ({ ...f, submission: e.target.value }))} style={{ marginTop: 4 }}>
              <option value="">All</option>
              {SUB_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <div className="sub" style={{ marginTop: 8 }}>{filtered.length} {t('lessons.lessonsFound', 'lessons found')}</div>
      </div>

      {filtered.length === 0 ? (
        <Empty text={t('lessons.noLessons', 'No lesson plans yet. Click "New Lesson" to create one.')} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {filtered.map((l) => (
            <div key={l.id} className="card" style={{ cursor: 'pointer' }} onClick={() => openForm(l)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: 15 }}><BookOpen size={14} /> {l.title}</h3>
                  <div className="sub" style={{ fontSize: 12 }}>{l.subject_code} — {l.subject_title}</div>
                  {l.section_name && <div className="sub" style={{ fontSize: 12 }}>{l.grade_level} — {l.section_name}</div>}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <span className={`badge ${STATUS_COLORS[l.status]}`}>{l.status}</span>
                  {l.submission_status && l.submission_status !== 'draft' && (
                    <span className={`badge ${SUB_COLORS[l.submission_status]}`}>{l.submission_status}</span>
                  )}
                </div>
              </div>
              {l.objectives && <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '8px 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{l.objectives}</p>}
              <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 12, color: 'var(--text-dim)' }}>
                {l.quarter && <span>Q{l.quarter}</span>}
                {l.duration_minutes && <span><Clock size={12} /> {l.duration_minutes} min</span>}
                {l.scheduled_date && <span>{l.scheduled_date}</span>}
                {(() => { try { const ids = l.competency_ids ? JSON.parse(l.competency_ids) : []; return ids.length > 0 ? <span><CheckCircle size={12} /> {ids.length} competencies</span> : null; } catch { return null; } })()}
              </div>
              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                {/* Teacher: submit own draft/returned lessons */}
                {canWrite && (l.submission_status === 'draft' || l.submission_status === 'returned') && (
                  <button className="btn btn-sm btn-primary" onClick={() => submitLesson(l.id)} title="Submit for review">
                    <Send size={12} /> Submit
                  </button>
                )}
                {/* Admin: review submitted lessons */}
                {canReview && l.submission_status === 'submitted' && (
                  <button className="btn btn-sm" style={{ background: 'var(--success)', color: 'var(--text)' }} onClick={() => { setShowReview(l); setReviewNotes(l.review_notes || ''); }} title="Review this lesson">
                    <Eye size={12} /> Review
                  </button>
                )}
                {/* Copy as template */}
                {canWrite && (
                  <button className="btn btn-sm" onClick={() => copyLesson(l.id)} title="Copy as template">
                    <Copy size={12} /> Copy
                  </button>
                )}
                {l.review_notes && (
                  <span className="sub" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <RotateCcw size={11} /> Review notes
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lesson form modal */}
      {showModal && (
        <Modal title={editing ? t('lessons.editLesson', 'Edit Lesson') : t('lessons.newLesson', 'New Lesson')} onClose={() => setShowModal(false)} wide>
          <form onSubmit={save}>
            <div className="grid-2" style={{ gap: 12 }}>
              <label>{t('lessons.titleLabel', 'Title')} *
                <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </label>
              <label>{t('lessons.subjectLabel', 'Subject')} *
                <select required value={form.subject_id} onChange={(e) => { setForm((f) => ({ ...f, subject_id: e.target.value })); loadCompetencies(e.target.value, form.quarter); }}>
                  <option value="">Select subject…</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.title}</option>)}
                </select>
              </label>
              <label>{t('lessons.sectionLabel', 'Section')}
                <select value={form.section_id} onChange={(e) => setForm((f) => ({ ...f, section_id: e.target.value }))}>
                  <option value="">All sections</option>
                  {sections.map((s) => <option key={s.id} value={s.id}>{s.grade_level} — {s.name}</option>)}
                </select>
              </label>
              <label>{t('lessons.quarterLabel', 'Quarter')}
                <select value={form.quarter} onChange={(e) => { setForm((f) => ({ ...f, quarter: e.target.value })); loadCompetencies(form.subject_id, e.target.value); }}>
                  <option value="">None</option>
                  <option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option>
                </select>
              </label>
              <label>{t('lessons.schoolYear', 'School Year')}
                <input value={form.school_year} onChange={(e) => setForm((f) => ({ ...f, school_year: e.target.value }))} />
              </label>
              <label>{t('lessons.duration', 'Duration (min)')}
                <input type="number" min="5" value={form.duration_minutes} onChange={(e) => setForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))} />
              </label>
              <label>{t('lessons.scheduledDate', 'Scheduled Date')}
                <input type="date" value={form.scheduled_date} onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))} />
              </label>
              <label>{t('lessons.statusLabel', 'Status')}
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <label style={{ marginTop: 12 }}>{t('lessons.objectives', 'Learning Objectives')}
              <textarea rows={3} value={form.objectives} onChange={(e) => setForm((f) => ({ ...f, objectives: e.target.value }))} placeholder="What students will learn…" />
            </label>
            <label>{t('lessons.content', 'Content Outline')}
              <textarea rows={3} value={form.content_outline} onChange={(e) => setForm((f) => ({ ...f, content_outline: e.target.value }))} />
            </label>
            <div className="grid-2" style={{ gap: 12 }}>
              <label>{t('lessons.strategy', 'Teaching Strategy')}
                <input value={form.teaching_strategy} onChange={(e) => setForm((f) => ({ ...f, teaching_strategy: e.target.value }))} placeholder="e.g. Direct Instruction, Cooperative Learning" />
              </label>
              <label>{t('lessons.materials', 'Materials')}
                <input value={form.materials} onChange={(e) => setForm((f) => ({ ...f, materials: e.target.value }))} placeholder="Textbook, worksheets, etc." />
              </label>
            </div>
            <label>{t('lessons.assessmentPlan', 'Assessment Plan')}
              <textarea rows={2} value={form.assessment_plan} onChange={(e) => setForm((f) => ({ ...f, assessment_plan: e.target.value }))} />
            </label>
            {competencies.length > 0 && (
              <label>{t('lessons.linkedCompetencies', 'Linked Competencies')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {competencies.map((c) => {
                    const checked = form.competency_ids.includes(c.id);
                    return (
                      <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', background: checked ? 'var(--accent)' : 'transparent', color: checked ? '#fff' : 'var(--text)' }}>
                        <input type="checkbox" checked={checked} onChange={() => {
                          setForm((f) => ({
                            ...f,
                            competency_ids: checked ? f.competency_ids.filter((x) => x !== c.id) : [...f.competency_ids, c.id],
                          }));
                        }} style={{ display: 'none' }} />
                        {c.code}
                      </label>
                    );
                  })}
                </div>
              </label>
            )}
            <label>{t('lessons.notes', 'Notes')}
              <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Review modal */}
      {showReview && (
        <Modal title="Review Lesson Plan" onClose={() => setShowReview(null)}>
          <div style={{ marginBottom: 12 }}>
            <h4 style={{ margin: '0 0 4px' }}>{showReview.title}</h4>
            <div className="sub" style={{ fontSize: 13 }}>{showReview.subject_code} — {showReview.subject_title}</div>
            {showReview.teacher_name && <div className="sub" style={{ fontSize: 13 }}>Teacher: {showReview.teacher_name}</div>}
          </div>
          <label>Review Notes
            <textarea rows={3} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Optional notes for the teacher…" />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setShowReview(null)}>Cancel</button>
            <button type="button" className="btn" style={{ background: 'var(--warn)', color: 'var(--text)' }} disabled={reviewing} onClick={() => reviewLesson('return')}>
              <RotateCcw size={14} /> Return
            </button>
            <button type="button" className="btn btn-primary" disabled={reviewing} onClick={() => reviewLesson('approve')}>
              <CheckCircle size={14} /> Approve
            </button>
          </div>
        </Modal>
      )}
      {confirmAction && <ConfirmModal message={confirmAction.message} danger onConfirm={() => { confirmAction.action(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />}
    </div>
  );
}
