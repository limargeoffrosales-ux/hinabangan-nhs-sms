import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Users as UsersIcon } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { SHS_TRACKS, SECTION_STATUSES } from '../lib/constants';
import { PageHead, Badge, Modal, Empty, ErrorBanner, Spinner } from '../components/ui';

const EMPTY_FORM = { name: '', grade_level: 'Grade 11', strand: '', adviser_teacher_id: '', room: '', capacity: 40, school_year: '2025-2026', status: 'active' };

export default function Sections() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = can(user?.role, 'super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar');
  const [rows, setRows] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [roster, setRoster] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [s, tp] = await Promise.all([api('/sections?limit=200'), api('/teachers?limit=200')]);
      setRows(s.data);
      setTeachers(tp.data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(s) {
    setForm({ ...EMPTY_FORM, ...s, adviser_teacher_id: s.adviser_teacher_id || '' });
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
      const body = { ...form, adviser_teacher_id: form.adviser_teacher_id || null };
      if (editing) await api(`/sections/${editing}`, { method: 'PATCH', body });
      else await api('/sections', { method: 'POST', body });
      setShowModal(false);
      load();
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function remove(s) {
    if (!confirm(t('sections.deleteConfirm', { name: s.name, year: s.school_year }))) return;
    await api(`/sections/${s.id}`, { method: 'DELETE' });
    load();
  }

  async function showRoster(s) {
    const res = await api(`/sections/${s.id}/students`);
    setRoster({ section: s, students: res.data });
  }

  return (
    <>
      <PageHead title={t('sections.title')} sub={t('sections.subtitle')}>
        {canWrite && <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> {t('sections.newSection')}</button>}
      </PageHead>
      <ErrorBanner error={error} />
      {loading ? <Spinner /> : rows.length === 0 ? <Empty text={t('sections.noData')} /> : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('sections.sectionName')}</th><th>{t('sections.schoolYear')}</th><th>{t('sections.gradeLevel')}</th><th>{t('sections.strand')}</th>
                <th>{t('sections.adviser')}</th><th>{t('sections.room')}</th><th>{t('sections.capacity')}</th><th>{t('sections.status')}</th>
                <th style={{ textAlign: 'right' }}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.school_year}</td>
                  <td>{s.grade_level}</td>
                  <td>{s.strand || '—'}</td>
                  <td>{s.adviser_name || '—'}</td>
                  <td>{s.room || '—'}</td>
                  <td>{s.capacity}</td>
                  <td><Badge status={s.status} /></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm" title={t('sections.viewRoster')} onClick={() => showRoster(s)}><UsersIcon size={13} /></button>{' '}
                    {canWrite && <><button className="btn btn-sm" onClick={() => openEdit(s)}><Pencil size={13} /></button>{' '}
                    <button className="btn btn-sm btn-danger" onClick={() => remove(s)}><Trash2 size={13} /></button></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal
          title={editing ? t('sections.editSection') : t('sections.newSection')}
          sub={t('sections.sectionInfo')}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={save}>
            <div className="form-row">
              <div><label>{t('sections.name')} *</label><input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="HUMSS 11-A" /></div>
              <div><label>{t('sections.schoolYear')} *</label><input required value={form.school_year} onChange={(e) => set('school_year', e.target.value)} placeholder="2025-2026" /></div>
            </div>
            <div className="form-row">
              <div><label>{t('sections.gradeLevel')} *</label>
                <select value={form.grade_level} onChange={(e) => set('grade_level', e.target.value)}>
                  {['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'College'].map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div><label>{t('sections.strand')}</label>
                <select value={form.strand || ''} onChange={(e) => set('strand', e.target.value)}>
                  <option value="">{t('common.select')}</option>
                  {SHS_TRACKS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div><label>{t('sections.adviser')}</label>
                <select value={form.adviser_teacher_id} onChange={(e) => set('adviser_teacher_id', e.target.value)}>
                  <option value="">{t('common.none')}</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.last_name}, {t.first_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div><label>{t('sections.room')}</label><input value={form.room} onChange={(e) => set('room', e.target.value)} /></div>
              <div><label>{t('sections.capacity')}</label><input type="number" min="1" max="60" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} /></div>
              <div><label>{t('sections.status')}</label>
                <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {SECTION_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary">{t('sections.saveSection')}</button>
            </div>
          </form>
        </Modal>
      )}

      {roster && (
        <Modal
          title={`Roster — ${roster.section.name}`}
          sub={`${roster.section.school_year} · ${roster.section.grade_level} · ${roster.students.length} ${t('sections.enrolledLearners')}`}
          onClose={() => setRoster(null)}
          wide
        >
          {roster.students.length === 0 ? <Empty text={t('sections.noEnrolled')} /> : (
            <table>
              <thead>
                <tr><th>LRN</th><th>Name</th><th>Sex</th></tr>
              </thead>
              <tbody>
                {roster.students.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: 'monospace' }}>{s.lrn}</td>
                    <td>{s.last_name}, {s.first_name} {s.middle_name || ''}</td>
                    <td>{s.sex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </>
  );
}
