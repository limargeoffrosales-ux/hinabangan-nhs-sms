import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { SUFFIXES, TEACHER_POSITIONS, TEACHER_STATUSES } from '../lib/constants';
import { PageHead, Badge, Modal, Empty, ErrorBanner, Spinner } from '../components/ui';

const EMPTY_FORM = {
  employee_no: '', first_name: '', middle_name: '', last_name: '', suffix: '', sex: '',
  position: '', prc_no: '', email: '', contact: '', room: '', status: 'active',
};

export default function Teachers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);

  async function load() {
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

  function openEdit(t) {
    setForm({ ...EMPTY_FORM, ...t });
    setEditing(t.id);
    setShowModal(true);
  }

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e) {
    e.preventDefault();
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

  async function remove(t) {
    if (!confirm(`Remove ${t.first_name} ${t.last_name} from the teachers directory?`)) return;
    await api(`/teachers/${t.id}`, { method: 'DELETE' });
    load();
  }

  const field = (k, opts = {}) => (
    <input value={form[k] || ''} onChange={(e) => set(k, e.target.value)} {...opts} />
  );

  return (
    <>
      <PageHead title="Teachers" sub="Faculty directory with positions and PRC records">
        <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> New Teacher</button>
      </PageHead>
      <ErrorBanner error={error} />
      <div className="search-row">
        <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-dim)' }} />
          <input style={{ paddingLeft: 32 }} placeholder="Search teachers…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      {loading ? <Spinner /> : rows.length === 0 ? <Empty text="No teachers found." /> : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee No.</th><th>Name</th><th>Position</th><th>Assigned Room</th><th>PRC No.</th>
                <th>Email</th><th>Contact</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontFamily: 'monospace' }}>{t.employee_no || '—'}</td>
                  <td><strong>{t.last_name}, {t.first_name} {t.middle_name || ''}</strong></td>
                  <td>{t.position || '—'}</td>
                  <td>{t.room || '—'}</td>
                  <td>{t.prc_no || '—'}</td>
                  <td>{t.email || '—'}</td>
                  <td>{t.contact || '—'}</td>
                  <td><Badge status={t.status} /></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm" onClick={() => openEdit(t)}><Pencil size={13} /></button>{' '}
                    <button className="btn btn-sm btn-danger" onClick={() => remove(t)}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal
          title={editing ? 'Edit Teacher' : 'New Teacher'}
          sub="Profile information used across class records, sections, and reporting"
          onClose={() => setShowModal(false)}
          wide
        >
          <form onSubmit={save}>
            <div className="form-row">
              <div><label>Employee no.</label>{field('employee_no')}</div>
              <div><label>First name *</label>{field('first_name', { required: true })}</div>
              <div><label>Middle name</label>{field('middle_name')}</div>
              <div><label>Last name *</label>{field('last_name', { required: true })}</div>
            </div>
            <div className="form-row">
              <div><label>Suffix</label>
                <select value={form.suffix || ''} onChange={(e) => set('suffix', e.target.value)}>
                  <option value="">— select —</option>
                  {SUFFIXES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div><label>Sex</label>
                <select value={form.sex || ''} onChange={(e) => set('sex', e.target.value)}>
                  <option value="">— select —</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </div>
              <div><label>Position</label>
                <select value={form.position || ''} onChange={(e) => set('position', e.target.value)}>
                  <option value="">— select —</option>
                  {TEACHER_POSITIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div><label>Assigned room <span className="muted">(used by program generator)</span></label>{field('room', { placeholder: 'e.g. Rm 203' })}</div>
            </div>
            <div className="form-row">
              <div><label>PRC no.</label>{field('prc_no')}</div>
              <div><label>Email</label>{field('email', { type: 'email' })}</div>
              <div><label>Contact</label>{field('contact')}</div>
              <div><label>Status</label>
                <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {TEACHER_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary">Save teacher</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
