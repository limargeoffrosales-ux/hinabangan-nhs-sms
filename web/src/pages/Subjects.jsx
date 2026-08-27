import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { PageHead, Modal, Empty, ErrorBanner, Spinner, ConfirmModal } from '../components/ui';

const TERM_LABELS = { first: 'First Term', second: 'Second Term', third: 'Third Term', all: 'All Terms' };
const TERM_OPTIONS = [
  { value: 'all', label: 'All Terms — offered in every term' },
  { value: 'first', label: 'First Term' },
  { value: 'second', label: 'Second Term' },
  { value: 'third', label: 'Third Term' },
  { value: '', label: 'Not term-based (whole-year)' },
];
const CATEGORIES = [
  { value: 'core', label: 'Core Subjects' },
  { value: 'arts-humanities', label: 'Academic — Arts, Social Sciences & Humanities' },
  { value: 'business-entrepreneurship', label: 'Academic — Business & Entrepreneurship' },
  { value: 'stem', label: 'Academic — Science, Technology, Engineering & Math' },
  { value: 'sports-health-wellness', label: 'Academic — Sports, Health & Wellness' },
  { value: 'field-experience', label: 'Academic — Field Experience' },
  { value: 'tvl-aesthetic', label: 'TechPro — Aesthetic, Wellness & Human Care' },
  { value: 'tvl-agri-fishery', label: 'TechPro — Agri-Fishery & Food Innovation' },
  { value: 'tvl-artisanry', label: 'TechPro — Artisanry & Creative Enterprise' },
  { value: 'tvl-automotive', label: 'TechPro — Automotive & Small Engine' },
  { value: 'tvl-construction', label: 'TechPro — Construction & Building' },
  { value: 'tvl-creative-design', label: 'TechPro — Creative Arts & Design' },
  { value: 'tvl-hospitality', label: 'TechPro — Hospitality & Tourism' },
  { value: 'tvl-industrial', label: 'TechPro — Industrial Technologies' },
  { value: 'tvl-ict', label: 'TechPro — ICT & Computer Programming' },
  { value: 'tvl-maritime', label: 'TechPro — Maritime' },
];
const EMPTY_FORM = { code: '', title: '', description: '', grade_level: 'Grade 11', track: 'academic', units: 0, term: 'all', category: '' };

function TermBadge({ term }) {
  if (!term) return <span className="term-badge term-quar">Not term-based</span>;
  const map = { first: 'term-red', second: 'term-gold', third: 'term-blue', all: 'term-green' };
  return <span className={`term-badge ${map[term] || 'term-gray'}`}>{TERM_LABELS[term]}</span>;
}

export default function Subjects() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = can(user?.role, 'super_admin', 'school_admin', 'principal', 'assistant_principal');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [gradeFilter, setGradeFilter] = useState('');
  const [termFilter, setTermFilter] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '300' });
      if (gradeFilter) qs.set('grade_level', gradeFilter);
      if (termFilter) qs.set('term', termFilter);
      const res = await api(`/subjects?${qs}`);
      setRows(res.data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [gradeFilter, termFilter]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(s) {
    setForm({ ...EMPTY_FORM, ...s, term: s.term || '' });
    setEditing(s.id);
    setShowModal(true);
  }

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e) {
    e.preventDefault();
    setError(null);
    try {
      const body = { ...form, term: form.term || null };
      if (editing) await api(`/subjects/${editing}`, { method: 'PATCH', body });
      else await api('/subjects', { method: 'POST', body });
      setShowModal(false);
      load();
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function remove(s) {
    setConfirmAction({ message: t('subjects.deleteConfirm', { code: s.code }), action: async () => { await api(`/subjects/${s.id}`, { method: 'DELETE' }); load(); } });
  }

  async function toggleOffered(s) {
    await api(`/subjects/${s.id}`, { method: 'PATCH', body: { is_offered: s.is_offered ? 0 : 1 } });
    load();
  }

  const isSHS = form.grade_level === 'Grade 11' || form.grade_level === 'Grade 12';

  const field = (k, opts = {}) => (
    <input value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)} {...opts} />
  );

  return (
    <>
      <PageHead title={t('subjects.title')} sub={t('subjects.subtitle')}>
        {canWrite && <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> {t('subjects.newSubject')}</button>}
      </PageHead>
      <div className="card filters-row" style={{ marginBottom: 12, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
        <select className="input" style={{ maxWidth: 180 }} value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
          <option value="">{t('subjects.allGradeLevels')}</option>
          {['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <select className="input" style={{ maxWidth: 200 }} value={termFilter} onChange={(e) => setTermFilter(e.target.value)}>
          <option value="">{t('subjects.allTerms')}</option>
          {TERM_OPTIONS.filter((t) => t.value).map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button className="btn btn-sm" onClick={load}>{t('common.refresh')}</button>
      </div>
      <ErrorBanner error={error} />
      {loading ? <Spinner /> : rows.length === 0 ? <Empty text={t('subjects.noData')} /> : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('subjects.code')}</th><th>{t('subjects.subjectTitle')}</th><th>{t('subjects.gradeLevel')}</th><th>{t('subjects.track')}</th><th>{t('subjects.category')}</th>
                <th>{t('subjects.termOffered')}</th><th>{t('subjects.units')}</th><th style={{ textAlign: 'center' }}>{t('subjects.offered')}</th><th style={{ textAlign: 'right' }}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontFamily: 'monospace' }}><strong>{s.code}</strong></td>
                  <td>{s.title}</td>
                  <td>{s.grade_level}</td>
                  <td className="track-chip">{(s.track || '').toUpperCase()}</td>
                  <td className="sub">{CATEGORIES.find((c) => c.value === s.category)?.label || '—'}</td>
                  <td><TermBadge term={s.term} /></td>
                  <td>{s.units}</td>
                  <td style={{ textAlign: 'center' }}>
                    {canWrite ? (
                      <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" checked={!!s.is_offered} onChange={() => toggleOffered(s)} />
                        <span className={s.is_offered ? 'badge badge-green' : 'badge'}>{s.is_offered ? t('subjects.offered') : t('subjects.notOffered')}</span>
                      </label>
                    ) : (
                      <span className={s.is_offered ? 'badge badge-green' : 'badge'}>{s.is_offered ? t('subjects.offered') : t('subjects.notOffered')}</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {canWrite && <><button className="btn btn-sm" onClick={() => openEdit(s)} aria-label="Edit subject"><Pencil size={13} aria-hidden="true" /></button>{' '}
                    <button className="btn btn-sm btn-danger" onClick={() => remove(s)} aria-label="Delete subject"><Trash2 size={13} aria-hidden="true" /></button></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal
          title={editing ? t('subjects.editSubject') : t('subjects.newSubject')}
          sub={t('subjects.subjectInfo')}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={save}>
            <div className="form-row">
              <div><label>{t('subjects.code')} *</label>{field('code', { required: true, placeholder: 'SSHS-GENMATH' })}</div>
              <div><label>{t('subjects.subjectTitle')} *</label>{field('title', { required: true })}</div>
            </div>
            <div className="form-row">
              <div><label>{t('subjects.gradeLevel')} *</label>
                <select value={form.grade_level} onChange={(e) => set('grade_level', e.target.value)}>
                  {['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'College'].map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div><label>{t('subjects.track')}</label>
                <select value={form.track} onChange={(e) => set('track', e.target.value)}>
                  <option value="general">General (JHS)</option>
                  <option value="academic">Academic — SSHS Core / Elective</option>
                  <option value="tvl">Technical-Professional (TechPro)</option>
                  <option value="sports">Sports elective</option>
                  <option value="arts">Arts & Design elective</option>
                </select>
              </div>
              <div><label>{t('subjects.units')}</label>{field('units', { type: 'number', step: '0.5', min: 0 })}</div>
            </div>
            <label>{t('subjects.category')}
              <select style={{ marginTop: 6 }} value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">{t('common.none')}</option>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            {isSHS && (
              <label>{t('subjects.termOffered')} *
                <select required style={{ marginTop: 6 }} value={form.term} onChange={(e) => set('term', e.target.value)}>
                  <option value="">Select term…</option>
                  {TERM_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
            )}
            <label>{t('subjects.description')}</label>
            <textarea rows={3} value={form.description || ''} onChange={(e) => set('description', e.target.value)} />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary">{t('subjects.saveSubject')}</button>
            </div>
          </form>
        </Modal>
      )}
      {confirmAction && <ConfirmModal message={confirmAction.message} danger onConfirm={() => { confirmAction.action(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />}
    </>
  );
}