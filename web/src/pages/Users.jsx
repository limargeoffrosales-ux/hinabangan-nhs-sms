import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, KeyRound } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Badge, Modal, Empty, ErrorBanner, ConfirmModal, SkeletonTable } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';

const EMPTY_FORM = { username: '', password: '', name: '', role: 'teacher', email: '', phone: '' };

export default function Users() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [resetPw, setResetPw] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkReset, setBulkReset] = useState(false);
  const [bulkPassword, setBulkPassword] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  const [regCodes, setRegCodes] = useState([]);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeRole, setCodeRole] = useState('student');
  const [codeMaxUses, setCodeMaxUses] = useState(1);
  const [codeDesc, setCodeDesc] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);

  const isAdmin = ['super_admin', 'school_admin'].includes(user?.role);
  const canDeleteUser = user?.role === 'super_admin';

  const loadRegCodes = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await api('/users/registration-codes');
      setRegCodes(res.data || []);
    } catch {}
  }, [isAdmin]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [u, r] = await Promise.all([api('/users?limit=200'), api('/users/roles')]);
      setRows(u.data);
      setRoles(r.data);
      setError(null);
      loadRegCodes();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, loadRegCodes]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(u) {
    setForm({ ...EMPTY_FORM, ...u, password: '' });
    setEditing(u.id);
    setShowModal(true);
  }

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e) {
    e.preventDefault();
    setError(null);
    try {
      const body = editing ? { ...form, password: form.password || undefined } : form;
      if (editing) await api(`/users/${editing}`, { method: 'PATCH', body });
      else await api('/users', { method: 'POST', body });
      setShowModal(false);
      toast.success(t('common.saved', 'Changes saved successfully'));
      load();
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function remove(u) {
    setConfirmAction({ message: t('users.deleteConfirm', { username: u.username }), action: async () => {
      try {
        await api(`/users/${u.id}`, { method: 'DELETE' });
        load();
      } catch (e) {
        setError(e.message);
      }
    } });
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((u) => u.id)));
  }

  async function handleBulkReset(e) {
    e.preventDefault();
    if (!bulkPassword || String(bulkPassword).length < 12) {
      return setError(t('users.passwordMin12'));
    }
    setError(null);
    try {
      const res = await api('/users/bulk-reset-password', {
        method: 'POST',
        body: { user_ids: [...selected], password: bulkPassword },
      });
      setBulkReset(false);
      setBulkPassword('');
      setSelected(new Set());
      toast.success(`${res.reset} ${t('users.passwordsReset')}`);
      load();
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    if (!resetPw || String(resetPw.password).length < 12) {
      return setError(t('users.passwordMin12'));
    }
    setError(null);
    try {
      await api(`/users/${resetPw.id}`, { method: 'PATCH', body: { password: resetPw.password } });
      setResetPw(null);
      load();
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function handleGenerateCode(e) {
    e.preventDefault();
    setCodeBusy(true);
    setError(null);
    try {
      const res = await api('/users/registration-codes', {
        method: 'POST',
        body: { role: codeRole, max_uses: Number(codeMaxUses) || 1, description: codeDesc },
      });
      toast.success(`Generated Access Code: ${res.code}`);
      setShowCodeModal(false);
      setCodeDesc('');
      loadRegCodes();
    } catch (err) {
      setError(err.message);
    } finally {
      setCodeBusy(false);
    }
  }

  async function handleRevokeCode(id) {
    try {
      await api(`/users/registration-codes/${id}`, { method: 'DELETE' });
      toast.success('Access code revoked');
      loadRegCodes();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleApproveUser(id) {
    try {
      await api(`/users/${id}`, { method: 'PATCH', body: { status: 'active' } });
      toast.success('User account approved and activated');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRejectUser(id) {
    setConfirmAction({
      message: 'Are you sure you want to reject and remove this pending registration?',
      action: async () => {
        try {
          await api(`/users/${id}`, { method: 'DELETE' });
          toast.success('Pending registration rejected and removed');
          load();
        } catch (err) {
          setError(err.message);
        }
      },
    });
  }

  if (!isAdmin) {
    return <PageHead title={t('users.title')}><Empty text={t('users.noPermission')} /></PageHead>;
  }

  const pendingUsers = rows.filter((u) => u.status === 'pending');

  return (
    <>
      <PageHead title={t('users.title')} sub={t('users.subtitle')}>
        <div className="row" style={{ gap: 8 }}>
          {selected.size > 0 && (
            <button className="btn btn-warn" onClick={() => setBulkReset(true)}>
              <KeyRound size={15} /> {t('users.bulkReset')} ({selected.size})
            </button>
          )}
          <button className="btn" onClick={() => setShowCodeModal(true)} style={{ background: 'var(--accent-2)', color: '#fff' }}>
            <KeyRound size={15} /> Generate Access Code
          </button>
          <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> {t('users.newUser')}</button>
        </div>
      </PageHead>
      <ErrorBanner error={error} />

      {/* Pending Registrations Approval Queue */}
      {pendingUsers.length > 0 && (
        <div className="card table-wrap" style={{ marginBottom: 16, border: '1px solid rgba(var(--rgb-warn), 0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <h3 style={{ margin: 0 }}>Pending Registrations Approval <span className="count-pill">{pendingUsers.length}</span></h3>
              <p className="sub" style={{ margin: '2px 0 0 0' }}>Review and approve or reject new user signup requests.</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Role</th>
                <th>Email / Phone</th>
                <th>Signed Up</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingUsers.map((u) => (
                <tr key={u.id}>
                  <td><code style={{ fontSize: 13, fontWeight: 'bold' }}>{u.username}</code></td>
                  <td><strong>{u.name}</strong></td>
                  <td><Badge status="normal">{u.role}</Badge></td>
                  <td>{u.email || u.phone || '—'}</td>
                  <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-sm btn-primary" onClick={() => handleApproveUser(u.id)} style={{ marginRight: 6, background: 'var(--success)' }}>Approve</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleRejectUser(u.id)}>Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Superadmin Registration Access Codes Table */}
      {regCodes.length > 0 && (
        <div className="card table-wrap" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <h3 style={{ margin: 0 }}>Registration Access Codes <span className="count-pill">{regCodes.length}</span></h3>
              <p className="sub" style={{ margin: '2px 0 0 0' }}>Mandatory access codes generated by Superadmin for user registration.</p>
            </div>
            <button className="btn btn-sm" onClick={() => setShowCodeModal(true)} style={{ background: 'var(--accent-2)', color: '#fff' }}>
              <Plus size={13} /> New Code
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Access Code</th>
                <th>Target Role</th>
                <th>Description</th>
                <th>Uses</th>
                <th>Status</th>
                <th>Created Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {regCodes.map((c) => (
                <tr key={c.id}>
                  <td><code style={{ fontSize: 13, fontWeight: 'bold', background: 'var(--bg-soft)', padding: '2px 8px', borderRadius: 4 }}>{c.code}</code></td>
                  <td><Badge status="normal">{c.role}</Badge></td>
                  <td>{c.description || <span className="muted">—</span>}</td>
                  <td>{c.used_count} / {c.max_uses}</td>
                  <td><Badge status={c.status === 'active' && c.used_count < c.max_uses ? 'present' : 'absent'}>{c.status === 'active' && c.used_count >= c.max_uses ? 'exhausted' : c.status}</Badge></td>
                  <td>{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                  <td>
                    {c.status === 'active' && (
                      <button className="btn btn-sm btn-danger" onClick={() => handleRevokeCode(c.id)}>Revoke</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {loading ? <SkeletonTable rows={8} cols={5} /> : rows.length === 0 ? <Empty text={t('users.noData')} /> : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleSelectAll} aria-label="Select all" />
                </th>
                <th>{t('users.username')}</th><th>{t('users.name')}</th><th>{t('users.role')}</th><th>{t('users.email')}</th>
                <th>{t('users.status')}</th><th>{t('users.created')}</th><th style={{ textAlign: 'right' }}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleSelect(u.id)} aria-label={`Select ${u.username}`} />
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{u.username}</td>
                  <td><strong>{u.name}</strong></td>
                  <td><Badge status={(u.role || '').replace(/_/g, ' ')} /></td>
                  <td>{u.email || '—'}</td>
                  <td><Badge status={u.status} /></td>
                  <td style={{ fontSize: 13 }}>{u.created_at?.slice(0, 10)}</td>
                  <td className="row-actions" style={{ textAlign: 'right' }}>
                    <button className="btn btn-sm" onClick={() => setResetPw(u)} title="Reset password"><KeyRound size={13} /></button>{' '}
                    <button className="btn btn-sm" onClick={() => openEdit(u)} aria-label="Edit user"><Pencil size={13} aria-hidden="true" /></button>{' '}
                    {canDeleteUser && user.id !== u.id && (
                       <button className="btn btn-sm btn-danger" onClick={() => remove(u)} aria-label="Delete user"><Trash2 size={13} aria-hidden="true" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal
          title={editing ? t('users.editUser') : t('users.newUser')}
          sub={editing ? t('users.leaveBlank') : t('users.passwordMin')}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={save}>
            <div className="form-row">
              <div><label>{t('users.username')} *</label><input required value={form.username} onChange={(e) => set('username', e.target.value)} /></div>
              <div><label>{t('users.name')} *</label><input required value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div>
                <label>{t('users.role')} *</label>
                <select required value={form.role} onChange={(e) => set('role', e.target.value)}>
                  <option value="">{t('common.select')}</option>
                  {roles.map((r) => <option key={r.role} value={r.role}>{r.role.replace(/_/g, ' ')}{r.admin ? ' (admin)' : ''}</option>)}
                </select>
              </div>
              <div><label>{editing ? t('users.newPassword') : t('users.password')} *</label><input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required={!editing} /></div>
            </div>
            <div className="form-row">
              <div><label>{t('users.email')}</label><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
              <div><label>{t('users.phone')}</label><input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary">{editing ? t('users.saveChanges') : t('users.createUser')}</button>
            </div>
          </form>
        </Modal>
      )}

      {resetPw && (
        <Modal
          title={`${t('users.resetPassword')} — ${resetPw.username}`}
          sub={`${t('common.for')} ${resetPw.name} (${resetPw.role.replace(/_/g, ' ')})`}
          onClose={() => setResetPw(null)}
        >
          <form onSubmit={resetPassword}>
            <label>{t('users.newPasswordLabel')}</label>
            <input type="password" autoFocus value={resetPw.password || ''} onChange={(e) => setResetPw({ ...resetPw, password: e.target.value })} />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setResetPw(null)}>{t('common.cancel')}</button>
              <button className="btn btn-primary">{t('users.updatePassword')}</button>
            </div>
          </form>
        </Modal>
      )}

      {bulkReset && (
        <Modal
          title={t('users.bulkResetTitle')}
          sub={t('users.bulkResetSub', { count: selected.size })}
          onClose={() => setBulkReset(false)}
        >
          <form onSubmit={handleBulkReset}>
            <label>{t('users.newPasswordLabel')}</label>
            <input type="password" autoFocus value={bulkPassword} onChange={(e) => setBulkPassword(e.target.value)} placeholder={t('users.newPasswordPlaceholder')} />
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{t('users.bulkResetWarning')}</p>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setBulkReset(false)}>{t('common.cancel')}</button>
              <button className="btn btn-warn">{t('users.resetNPasswords', { count: selected.size })}</button>
            </div>
          </form>
        </Modal>
      )}

      {showCodeModal && (
        <Modal
          title="Generate Registration Access Code"
          sub="Generate a unique 8-character access code required for account registration."
          onClose={() => setShowCodeModal(false)}
        >
          <form onSubmit={handleGenerateCode}>
            <label>Target Role for Access Code</label>
            <select className="input" value={codeRole} onChange={(e) => setCodeRole(e.target.value)}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="parent">Parent</option>
              <option value="staff">Staff</option>
            </select>
            <label style={{ marginTop: 10 }}>Maximum Allowed Uses</label>
            <input type="number" className="input" min="1" max="100" value={codeMaxUses} onChange={(e) => setCodeMaxUses(e.target.value)} required />
            <label style={{ marginTop: 10 }}>Description / Notes (Optional)</label>
            <input className="input" placeholder="e.g. For Grade 11 STEM Section A students" value={codeDesc} onChange={(e) => setCodeDesc(e.target.value)} />
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn" onClick={() => setShowCodeModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={codeBusy}>{codeBusy ? 'Generating…' : 'Generate Code'}</button>
            </div>
          </form>
        </Modal>
      )}

      {confirmAction && <ConfirmModal message={confirmAction.message} danger onConfirm={() => { confirmAction.action(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />}

    </>
  );
}
