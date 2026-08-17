import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Plus, Pencil, Trash2, Filter, Clock, CheckCircle, FileText, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { PageHead, Spinner, Empty, Badge, Modal, ErrorBanner } from '../components/ui';

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'teacher'];
const STATUSES = ['draft', 'ready', 'taught', 'revised'];
const STATUS_COLORS = { draft: 'badge-gray', ready: 'badge-blue', taught: 'badge-green', revised: 'badge-yellow' };
const EMPTY_FORM = {
  title: '', subject_id: '', section_id: '', school_year: '2026-2027', quarter: '',
  objectives: '', content_outline: '', teaching_strategy: '', materials: '', assessment_plan: '',
  competency_ids: [], duration_minutes: 60, scheduled_date: '', status: 'draft', notes: '',
};

export default function Lessons() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = can(user?.role, ...WRITE);
  const [rows, setRows] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState({ subject: '', quarter: '', status: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api('/subjects?limit=300'),
      api('/sections?limit=200'),
      api('/lessons?limit=300'),
    ]).then(([s, sec, l]) => {
      setSubjects(s.data);
      setSections(sec.data);
      setRows(l.data);
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
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
        competency_ids: lesson.competency_ids ? JSON.parse(lesson.competency_ids) : [],
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

  async function remove(id) {
    if (!confirm('Delete this lesson plan?')) return;
    try {
      await api(`/lessons/${id}`, { method: 'DELETE' });
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e2) {
      setError(e2.message);
    }
  }

  const filtered = rows.filter((r) =>
    (!filter.subject || String(r.subject_id) === filter.subject) &&
    (!filter.quarter || String(r.quarter) === filter.quarter) &&
    (!filter.status || r.status === filter.status)
  );

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
        </div>
        <div className="sub" style={{ marginTop: 8 }}>{filtered.length} {t('lessons.lessonsFound', 'lessons found')}</div>
      </div>

      {filtered.length === 0 ? (
        <Empty text={t('lessons.noLessons', 'No lesson plans yet. Click "New Lesson" to create one.')} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filtered.map((l) => (
            <div key={l.id} className="card" style={{ cursor: 'pointer' }} onClick={() => openForm(l)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: 15 }}><BookOpen size={14} /> {l.title}</h3>
                  <div className="sub" style={{ fontSize: 12 }}>{l.subject_code} — {l.subject_title}</div>
                  {l.section_name && <div className="sub" style={{ fontSize: 12 }}>{l.grade_level} — {l.section_name}</div>}
                </div>
                <span className={`badge ${STATUS_COLORS[l.status]}`}>{l.status}</span>
              </div>
              {l.objectives && <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '8px 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{l.objectives}</p>}
              <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 12, color: 'var(--text-dim)' }}>
                {l.quarter && <span>Q{l.quarter}</span>}
                {l.duration_minutes && <span><Clock size={12} /> {l.duration_minutes} min</span>}
                {l.scheduled_date && <span>{l.scheduled_date}</span>}
                {l.competency_ids && JSON.parse(l.competency_ids || '[]').length > 0 && (
                  <span><CheckCircle size={12} /> {JSON.parse(l.competency_ids).length} competencies</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
    </div>
  );
}
