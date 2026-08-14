import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Link2 } from 'lucide-react';
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
    if (!confirm('Unlink this portal account from the student?')) return;
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
    if (!confirm('Remove this parent link?')) return;
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
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
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
    if (!confirm(`Delete student record of ${s.first_name} ${s.last_name}? This cannot be undone.`)) return;
    await api(`/students/${s.id}`, { method: 'DELETE' });
    load();
  }

  const field = (k, opts = {}) => {
    const p = { value: form[k] || '', onChange: (e) => set(k, e.target.value), ...opts };
    if (opts.options) {
      return (
        <select {...p}>
          <option value="">— select —</option>
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
      <PageHead title="Student Information System" sub="Complete learner profiles with LRN, guardians, and enrollment status">
        {canWrite && <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> New Student</button>}
      </PageHead>
      <ErrorBanner error={error} />
      <div className="search-row">
        <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-dim)' }} />
          <input style={{ paddingLeft: 32 }} placeholder="Search by name or LRN…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      {loading ? <Spinner /> : rows.length === 0 ? <Empty text="No students found." /> : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>LRN</th><th>Name</th><th>Sex</th><th>Grade Level</th><th>Strand / Track</th>
                <th>Guardian</th><th>Status</th>{canWrite && <th style={{ textAlign: 'right' }}>Actions</th>}
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
                      <button className="btn btn-sm" title="Portal accounts" onClick={() => openAccounts(s)}><Link2 size={13} /></button>{' '}
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
          title={editing ? 'Edit Student' : 'New Student'}
          sub={editing ? `Updating record with LRN ${form.lrn}` : 'LRN is generated automatically when left blank'}
          onClose={() => setShowModal(false)}
          wide
        >
          <form onSubmit={save}>
            <div className="form-row">
              <div><label>First name *</label>{field('first_name', { required: true })}</div>
              <div><label>Middle name</label>{field('middle_name')}</div>
              <div><label>Last name *</label>{field('last_name', { required: true })}</div>
              <div><label>Suffix</label>{field('suffix', { options: SUFFIXES })}</div>
            </div>
            <div className="form-row">
              <div><label>Sex *</label>{field('sex', { options: ['Male', 'Female'] })}</div>
              <div><label>Birth date</label>{field('birth_date', { type: 'date' })}</div>
              <div><label>Birth place</label>{field('birth_place')}</div>
              <div><label>Religion</label>{field('religion')}</div>
            </div>
            <div className="form-row">
              <div><label>Grade level *</label>{field('grade_level', { options: GRADE_LEVELS })}</div>
              <div><label>Strand / Track (SHS)</label>{field('track_strand', { options: SHS_TRACKS })}</div>
              <div><label>Address</label>{field('address')}</div>
              <div><label>Contact no.</label>{field('contact')}</div>
            </div>
            <div className="form-row">
              <div><label>Guardian name</label>{field('guardian_name')}</div>
              <div><label>Guardian contact</label>{field('guardian_contact')}</div>
              <div><label>Relationship</label>{field('guardian_relation')}</div>
              <div><label>Status</label>{field('status', { options: STUDENT_STATUSES })}</div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save student'}</button>
            </div>
          </form>
        </Modal>
      )}

      {accountsRow && (
        <Modal
          title={`Portal accounts — ${accountsRow.last_name}, ${accountsRow.first_name}`}
          sub="Link a student or parent login so they can access the portal."
          onClose={() => setAccountsRow(null)}
          wide
        >
          {accountsLoading ? <Spinner /> : accountsData && (
            <>
              <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-dim)' }}>Student login</h4>
              {accountsData.student_account ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div><strong>{accountsData.student_account.username}</strong> <span className="sub">— {accountsData.student_account.name || ''} · {accountsData.student_account.status}</span></div>
                  <button className="btn btn-sm btn-danger" onClick={unlinkStudentAccount}>Unlink</button>
                </div>
              ) : (
                <div className="sub" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>No student portal login linked yet.</div>
              )}

              <div className="form-row" style={{ marginTop: 12 }}>
                <div style={{ flex: 2 }}><label>Link by username</label><input placeholder="Search portal accounts…" value={linkQuery} onChange={(e) => setLinkQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchAccounts()} /></div>
                <div><button className="btn" onClick={searchAccounts}>Search</button></div>
              </div>
              {linkResults.map((u) => (
                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ minWidth: 0 }}><strong>{u.username}</strong> <span className="sub">— {u.name || ''} · {u.role} · {u.status}</span></div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-sm" disabled={u.role !== 'student'} onClick={() => linkStudentAccount(u.id)}>Set as student</button>
                    <button className="btn btn-sm" disabled={u.role !== 'parent'} onClick={() => linkParent(u.id)}>Link as parent</button>
                  </div>
                </div>
              ))}

              <h4 style={{ margin: '16px 0 4px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-dim)' }}>Linked parents</h4>
              {accountsData.parents.length === 0 && <div className="sub" style={{ padding: '8px 0' }}>No linked parents. Parents can see grades, attendance and schedule of this student.</div>}
              {accountsData.parents.map((p) => (
                <div key={p.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div><strong>{p.name || p.username}</strong> <span className="sub">— {p.username} · {p.relation} · {p.status}</span></div>
                  <button className="btn btn-sm btn-danger" onClick={() => unlinkParent(p.user_id)}>Unlink</button>
                </div>
              ))}
            </>
          )}
        </Modal>
      )}
    </>
  );
}
