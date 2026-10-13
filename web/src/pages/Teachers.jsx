import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { SUFFIXES, TEACHER_POSITIONS, TEACHER_STATUSES } from '../lib/constants';
import { PageHead, Badge, Modal, Empty, ErrorBanner, ConfirmModal, SearchInput, SkeletonTable } from '../components/ui';

const EMPTY_FORM = {
  employee_no: '', first_name: '', middle_name: '', last_name: '', suffix: '', sex: '',
  position: '', prc_no: '', email: '', contact: '', room: '', status: 'active', user_id: '',
};

export default function Teachers() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = can(user?.role, 'super_admin', 'school_admin', 'principal', 'assistant_principal', 'hr');
  const canLink = can(user?.role, 'super_admin', 'school_admin');
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = query ? `?q=${encodeURIComponent(query)}` : '';
      const res = await api(`/teachers${q}`);
      setRows(res.data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [query, load]);

  useEffect(() => {
    if (!canLink) return;
    api('/users?limit=500')
      .then((r) => setUsers(r.data || []))
      .catch(() => setUsers([]));
  }, [canLink]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(teacher) {
    setForm({ ...EMPTY_FORM, ...teacher, user_id: teacher.user_id ? String(teacher.user_id) : '' });
    setEditing(teacher.id);
    setShowModal(true);
  }

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e) {
    e.preventDefault();
    if (!form.last_name?.trim()) { setError(t('teachers.lastNameRequired', 'Last name is required')); return; }
    if (!form.first_name?.trim()) { setError(t('teachers.firstNameRequired', 'First name is required')); return; }
    setError(null);
    try {
      if (editing) await api(`/teachers/${editing}`, { method: 'PATCH', body: form });
      else await api('/teachers', { method: 'POST', body: form });
      setShowModal(false);
      load();
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function remove(teacher) {
    setConfirmAction({ message: t('teachers.removeConfirm'), action: async () => {
      try {
        await api(`/teachers/${teacher.id}`, { method: 'DELETE' });
      } catch (e) {
        setError(e.message);
      } finally {
        load();
      }
    } });
  }

  const field = (k, opts = {}) => (
    <input value={form[k] || ''} onChange={(e) => set(k, e.target.value)} {...opts} />
  );

  return (
    <>
      <PageHead title={t('teachers.title')} sub={t('teachers.subtitle')}>
        {canWrite && <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> {t('teachers.newTeacher')}</button>}
      </PageHead>
      <ErrorBanner error={error} />
      <div className="search-row">
        <SearchInput value={query} onChange={setQuery} placeholder={t('teachers.search')} />
      </div>
      {loading ? <SkeletonTable rows={8} cols={5} /> : rows.length === 0 ? <Empty text={t('teachers.noData')} /> : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('teachers.employeeNo')}</th><th>{t('teachers.name')}</th><th>{t('teachers.position')}</th><th>{t('teachers.room')}</th><th>{t('teachers.prcNo')}</th>
                <th>{t('teachers.email')}</th><th>{t('teachers.contact')}</th><th>{t('teachers.status')}</th>
                {canLink && <th>{t('teachers.loginAccount')}</th>}
                {canWrite && <th className="actions" style={{ textAlign: 'right' }}>{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{row.employee_no || '—'}</td>
                  <td><strong>{row.last_name}, {row.first_name} {row.middle_name || ''}</strong></td>
                  <td>{row.position || '—'}</td>
                  <td>{row.room || '—'}</td>
                  <td>{row.prc_no || '—'}</td>
                  <td>{row.email || '—'}</td>
                  <td>{row.contact || '—'}</td>
                  <td><Badge status={row.status} /></td>
                  {canLink && <td>{row.user_id ? <span className="muted">@{row.username || 'linked'}</span> : '—'}</td>}
                  {canWrite && (
                    <td className="row-actions" style={{ textAlign: 'right' }}>
                       <button className="btn btn-sm" onClick={() => openEdit(row)} aria-label="Edit teacher"><Pencil size={13} aria-hidden="true" /></button>{' '}
                       <button className="btn btn-sm btn-danger" onClick={() => remove(row)} aria-label="Delete teacher"><Trash2 size={13} aria-hidden="true" /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal
          title={editing ? t('teachers.editTeacher') : t('teachers.newTeacher')}
          sub={t('teachers.profileInfo')}
          onClose={() => setShowModal(false)}
          wide
        >
          <form onSubmit={save}>
            <div className="form-row">
              <div><label>{t('teachers.employeeNoLabel')}</label>{field('employee_no')}</div>
              <div><label>{t('teachers.firstName')} *</label>{field('first_name', { required: true })}</div>
              <div><label>{t('teachers.middleName')}</label>{field('middle_name')}</div>
              <div><label>{t('teachers.lastName')} *</label>{field('last_name', { required: true })}</div>
            </div>
            <div className="form-row">
              <div><label>{t('teachers.suffix')}</label>
                <select value={form.suffix || ''} onChange={(e) => set('suffix', e.target.value)}>
                  <option value="">{t('common.select')}</option>
                  {SUFFIXES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div><label>{t('teachers.sex')}</label>
                <select value={form.sex || ''} onChange={(e) => set('sex', e.target.value)}>
                  <option value="">{t('common.select')}</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </div>
              <div><label>{t('teachers.positionLabel')}</label>
                <select value={form.position || ''} onChange={(e) => set('position', e.target.value)}>
                  <option value="">{t('common.select')}</option>
                  {TEACHER_POSITIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div><label>{t('teachers.assignedRoom')} <span className="muted">{t('teachers.usedByProgram')}</span></label>{field('room', { placeholder: 'e.g. Rm 203' })}</div>
            </div>
            <div className="form-row">
              <div><label>{t('teachers.prcNoLabel')}</label>{field('prc_no')}</div>
              <div><label>{t('teachers.email')}</label>{field('email', { type: 'email' })}</div>
              <div><label>{t('teachers.contactLabel')}</label>{field('contact')}</div>
              <div><label>{t('teachers.status')}</label>
                <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {TEACHER_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            {canLink && (
              <div className="form-row">
                <div className="form-group">
                  <label>{t('teachers.loginAccountLabel')} <span className="muted">{t('teachers.loginAccountHint')}</span></label>
                  <select value={form.user_id} onChange={(e) => set('user_id', e.target.value)}>
                    <option value="">{t('common.none')}</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary">{t('teachers.saveTeacher')}</button>
            </div>
          </form>
        </Modal>
      )}
      {confirmAction && <ConfirmModal message={confirmAction.message} danger onConfirm={() => { confirmAction.action(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />}
    </>
  );
}
