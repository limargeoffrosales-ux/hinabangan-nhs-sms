import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { SUFFIXES, SHS_TRACKS, STUDENT_STATUSES } from '../lib/constants';
import { PageHead, Badge, Modal, Empty, ErrorBanner, Spinner } from '../components/ui';

const EMPTY_FORM = {
  lrn: '', first_name: '', middle_name: '', last_name: '', suffix: '', sex: 'Male',
  birth_date: '', birth_place: '', religion: '', address: '', contact: '',
  guardian_name: '', guardian_contact: '', guardian_relation: 'Parent',
  grade_level: 'Grade 11', track_strand: '', status: 'enrolled',
};

const GRADE_LEVELS = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'College'];

export default function Students() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = can(user?.role, 'super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accountsRow, setAccountsRow] = useState(null);
  const [accountsData, setAccountsData] = useState(null);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [linkQuery, setLinkQuery] = useState('');
  const [linkResults, setLinkResults] = useState([]);

  async function loadAccounts(id) {
    setAccountsLoading(true);
    try {
      const res = await api(`/students/${id}/accounts`);
      setAccountsData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setAccountsLoading(false);
    }
  }

  async function openAccounts(s) {
    setAccountsRow(s);
    setAccountsData(null);
    setLinkQuery('');
    setLinkResults([]);
    await loadAccounts(s.id);
  }

  async function searchAccounts() {
    const q = linkQuery.trim();
    if (!q) return;
    try {
      const res = await api(`/users?q=${encodeURIComponent(q)}&limit=8`);
      setLinkResults(res.data);
    } catch (e) {
      setError(e.message);
    }
  }

  async function linkStudentAccount(userId) {
    try {
      await api(`/students/${accountsRow.id}/account`, { method: 'PUT', body: { user_id: userId } });
      setLinkQuery('');
      setLinkResults([]);
      await loadAccounts(accountsRow.id);
    } catch (e) {
      setError(e.message);
    }
  }

  async function unlinkStudentAccount() {
    if (!confirm(t('students.unlinkConfirm'))) return;
    try {
      await api(`/students/${accountsRow.id}/account`, { method: 'PUT', body: { user_id: null } });
      await loadAccounts(accountsRow.id);
    } catch (e) {
      setError(e.message);
    }
  }

  async function linkParent(userId) {
    try {
      await api(`/students/${accountsRow.id}/parents`, { method: 'POST', body: { user_id: userId, relation: 'Parent' } });
      setLinkQuery('');
      setLinkResults([]);
      await loadAccounts(accountsRow.id);
    } catch (e) {
      setError(e.message);
    }
  }

  async function unlinkParent(userId) {
    if (!confirm(t('students.removeParentConfirm'))) return;
    try {
      await api(`/students/${accountsRow.id}/parents/${userId}`, { method: 'DELETE' });
      await loadAccounts(accountsRow.id);
    } catch (e) {
      setError(e.message);
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api(query ? `/students?q=${encodeURIComponent(query)}&limit=100` : '/students?limit=100');
      setRows(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(s) {
    setForm({ ...EMPTY_FORM, ...s, birth_date: (s.birth_date || '').slice(0, 10) });
    setEditing(s.id);
    setShowModal(true);
  }

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await api(`/students/${editing}`, { method: 'PATCH', body: form });
      } else {
        await api('/students', { method: 'POST', body: form });
      }
      setShowModal(false);
      load();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(s) {
    if (!confirm(t('students.deleteConfirm') + ` ${s.first_name} ${s.last_name}?`)) return;
    await api(`/students/${s.id}`, { method: 'DELETE' });
    load();
  }

  const field = (k, opts = {}) => {
    const p = { value: form[k] || '', onChange: (e) => set(k, e.target.value), ...opts };
    if (opts.options) {
      return (
        <select {...p}>
          <option value="">{t('common.select')}</option>
          {opts.options.map((o) => {
            const val = typeof o === 'object' ? o.value : o;
            const lbl = typeof o === 'object' ? o.label : o;
            return <option key={val} value={val}>{lbl}</option>;
          })}
        </select>
      );
    }
    return <input {...p} />;
  };

  return (
    <>
      <PageHead title={t('students.title')} sub={t('students.subtitle')}>
        {canWrite && <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> {t('students.newStudent')}</button>}
      </PageHead>
      <ErrorBanner error={error} />
      <div className="search-row">
        <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-dim)' }} />
          <input style={{ paddingLeft: 32 }} placeholder={t('students.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      {loading ? <Spinner /> : rows.length === 0 ? <Empty text={t('students.noData')} /> : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('students.lrn')}</th><th>{t('students.name')}</th><th>{t('students.sex')}</th><th>{t('students.gradeLevel')}</th><th>{t('students.strandTrack')}</th>
                <th>{t('students.guardian')}</th><th>{t('students.status')}</th>{canWrite && <th style={{ textAlign: 'right' }}>{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontFamily: 'monospace' }}>{s.lrn}</td>
                  <td><strong>{s.last_name}, {s.first_name} {s.middle_name || ''}</strong> {s.suffix}</td>
                  <td>{s.sex}</td>
                  <td>{s.grade_level}</td>
                  <td>{s.track_strand || '—'}</td>
                  <td>{s.guardian_name || '—'}</td>
                  <td><Badge status={s.status} /></td>
                  {canWrite && (
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-sm" title={t('students.portalAccounts')} onClick={() => openAccounts(s)}><Link2 size={13} /></button>{' '}
                      <button className="btn btn-sm" onClick={() => openEdit(s)}><Pencil size={13} /></button>{' '}
                      <button className="btn btn-sm btn-danger" onClick={() => remove(s)}><Trash2 size={13} /></button>
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
          title={editing ? t('students.editStudent') : t('students.newStudent')}
          sub={editing ? t('students.updatingRecord', { lrn: form.lrn }) : t('students.autoGenerateLrn')}
          onClose={() => setShowModal(false)}
          wide
        >
          <form onSubmit={save}>
            <div className="form-row">
              <div><label>{t('students.firstName')} *</label>{field('first_name', { required: true })}</div>
              <div><label>{t('students.middleName')}</label>{field('middle_name')}</div>
              <div><label>{t('students.lastName')} *</label>{field('last_name', { required: true })}</div>
              <div><label>{t('students.suffix')}</label>{field('suffix', { options: SUFFIXES })}</div>
            </div>
            <div className="form-row">
              <div><label>{t('students.sex')} *</label>{field('sex', { options: ['Male', 'Female'] })}</div>
              <div><label>{t('students.birthDate')}</label>{field('birth_date', { type: 'date' })}</div>
              <div><label>{t('students.birthPlace')}</label>{field('birth_place')}</div>
              <div><label>{t('students.religion')}</label>{field('religion')}</div>
            </div>
            <div className="form-row">
              <div><label>{t('students.gradeLevel')} *</label>{field('grade_level', { options: GRADE_LEVELS })}</div>
              <div><label>{t('students.strandTrack')} (SHS)</label>{field('track_strand', { options: SHS_TRACKS })}</div>
              <div><label>{t('students.address')}</label>{field('address')}</div>
              <div><label>{t('students.contactNo')}</label>{field('contact')}</div>
            </div>
            <div className="form-row">
              <div><label>{t('students.guardianName')}</label>{field('guardian_name')}</div>
              <div><label>{t('students.guardianContact')}</label>{field('guardian_contact')}</div>
              <div><label>{t('students.relationship')}</label>{field('guardian_relation')}</div>
              <div><label>{t('students.status')}</label>{field('status', { options: STUDENT_STATUSES })}</div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" disabled={saving}>{saving ? t('common.saving') : t('students.saveStudent')}</button>
            </div>
          </form>
        </Modal>
      )}

      {accountsRow && (
        <Modal
          title={`${t('students.portalAccounts')} — ${accountsRow.last_name}, ${accountsRow.first_name}`}
          sub={t('students.linkStudentLogin')}
          onClose={() => setAccountsRow(null)}
          wide
        >
          {accountsLoading ? <Spinner /> : accountsData && (
            <>
              <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-dim)' }}>{t('students.studentLogin')}</h4>
              {accountsData.student_account ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div><strong>{accountsData.student_account.username}</strong> <span className="sub">— {accountsData.student_account.name || ''} · {accountsData.student_account.status}</span></div>
                  <button className="btn btn-sm btn-danger" onClick={unlinkStudentAccount}>{t('students.unlink')}</button>
                </div>
              ) : (
                <div className="sub" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>{t('students.noStudentLogin')}</div>
              )}

              <div className="form-row" style={{ marginTop: 12 }}>
                <div style={{ flex: 2 }}><label>{t('students.linkByUsername')}</label><input placeholder={t('students.searchPortal')} value={linkQuery} onChange={(e) => setLinkQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchAccounts()} /></div>
                <div><button className="btn" onClick={searchAccounts}>{t('common.search')}</button></div>
              </div>
              {linkResults.map((u) => (
                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ minWidth: 0 }}><strong>{u.username}</strong> <span className="sub">— {u.name || ''} · {u.role} · {u.status}</span></div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-sm" disabled={u.role !== 'student'} onClick={() => linkStudentAccount(u.id)}>{t('students.setAsStudent')}</button>
                    <button className="btn btn-sm" disabled={u.role !== 'parent'} onClick={() => linkParent(u.id)}>{t('students.linkAsParent')}</button>
                  </div>
                </div>
              ))}

              <h4 style={{ margin: '16px 0 4px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-dim)' }}>{t('students.linkedParents')}</h4>
              {accountsData.parents.length === 0 && <div className="sub" style={{ padding: '8px 0' }}>{t('students.noParents')}</div>}
              {accountsData.parents.map((p) => (
                <div key={p.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div><strong>{p.name || p.username}</strong> <span className="sub">— {p.username} · {p.relation} · {p.status}</span></div>
                  <button className="btn btn-sm btn-danger" onClick={() => unlinkParent(p.user_id)}>{t('students.unlink')}</button>
                </div>
              ))}
            </>
          )}
        </Modal>
      )}
    </>
  );
}
