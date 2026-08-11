import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, KeyRound } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Badge, Modal, Empty, ErrorBanner, Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';

const EMPTY_FORM = { username: '', password: '', name: '', role: 'teacher', email: '', phone: '' };

export default function Users() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [resetPw, setResetPw] = useState(null);

  const isAdmin = ['super_admin', 'school_admin'].includes(user?.role);

  async function load() {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [u, r] = await Promise.all([api('/users?limit=200'), api('/users/roles')]);
      setRows(u.data);
      setRoles(r.data);
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
      load();
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function remove(u) {
    if (!confirm(`Delete user "${u.username}"?`)) return;
    try {
      await api(`/users/${u.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    if (!resetPw || String(resetPw.password).length < 12) {
      return setError('New password must be at least 12 characters.');
    }
    setError(null);
    try {
      await api(`/users/${resetPw.id}`, { method: 'PATCH', body: { password: resetPw.password } });
      alert(`Password updated for ${resetPw.username}.`);
      setResetPw(null);
    } catch (e2) {
      setError(e2.message);
    }
  }

  if (!isAdmin) {
    return <PageHead title="Users & Roles"><Empty text="You do not have permission to manage users." /></PageHead>;
  }

  return (
    <>
      <PageHead title="Users & Roles" sub="Role-based access control — each user maps to a DepEd role with its own permissions">
        <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> New User</button>
      </PageHead>
      <ErrorBanner error={error} />
      {loading ? <Spinner /> : rows.length === 0 ? <Empty text="No users yet." /> : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th><th>Name</th><th>Role</th><th>Email</th>
                <th>Status</th><th>Created</th><th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontFamily: 'monospace' }}>{u.username}</td>
                  <td><strong>{u.name}</strong></td>
                  <td><Badge status={u.role.replace(/_/g, ' ')} /></td>
                  <td>{u.email || '—'}</td>
                  <td><Badge status={u.status} /></td>
                  <td style={{ fontSize: 13 }}>{u.created_at?.slice(0, 10)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm" onClick={() => setResetPw(u)} title="Reset password"><KeyRound size={13} /></button>{' '}
                    <button className="btn btn-sm" onClick={() => openEdit(u)}><Pencil size={13} /></button>{' '}
                    {user.id !== u.id && (
                      <button className="btn btn-sm btn-danger" onClick={() => remove(u)}><Trash2 size={13} /></button>
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
          title={editing ? 'Edit User' : 'New User'}
          sub={editing ? 'Leave the password blank to keep the current one' : 'Password must be at least 12 characters'}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={save}>
            <div className="form-row">
              <div><label>Username *</label><input required value={form.username} onChange={(e) => set('username', e.target.value)} /></div>
              <div><label>Name *</label><input required value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div>
                <label>Role *</label>
                <select required value={form.role} onChange={(e) => set('role', e.target.value)}>
                  <option value="">— select —</option>
                  {roles.map((r) => <option key={r.role} value={r.role}>{r.role.replace(/_/g, ' ')}{r.admin ? ' (admin)' : ''}</option>)}
                </select>
              </div>
              <div><label>{editing ? 'New password' : 'Password *'}</label><input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required={!editing} /></div>
            </div>
            <div className="form-row">
              <div><label>Email</label><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
              <div><label>Phone</label><input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary">{editing ? 'Save changes' : 'Create user'}</button>
            </div>
          </form>
        </Modal>
      )}

      {resetPw && (
        <Modal
          title={`Reset Password — ${resetPw.username}`}
          sub={`For ${resetPw.name} (${resetPw.role.replace(/_/g, ' ')})`}
          onClose={() => setResetPw(null)}
        >
          <form onSubmit={resetPassword}>
            <label>New password (min 12 characters)</label>
            <input type="password" autoFocus value={resetPw.password || ''} onChange={(e) => setResetPw({ ...resetPw, password: e.target.value })} />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setResetPw(null)}>Cancel</button>
              <button className="btn btn-primary">Update password</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
