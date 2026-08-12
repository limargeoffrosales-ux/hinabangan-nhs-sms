import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Badge, Modal, Empty, ErrorBanner, Spinner } from '../components/ui';

const EMPTY_FORM = {
  lrn: '', first_name: '', middle_name: '', last_name: '', suffix: '', sex: 'Male',
  birth_date: '', birth_place: '', religion: '', address: '', contact: '',
  guardian_name: '', guardian_contact: '', guardian_relation: 'Parent',
  grade_level: 'Grade 11', track_strand: '', status: 'enrolled',
};

const GRADE_LEVELS = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'College'];

export default function Students() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

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
          {opts.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return <input {...p} />;
  };

  return (
    <>
      <PageHead title="Student Information System" sub="Complete learner profiles with LRN, guardians, and enrollment status">
        <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> New Student</button>
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
                <th>Guardian</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th>
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
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm" onClick={() => openEdit(s)}><Pencil size={13} /></button>{' '}
                    <button className="btn btn-sm btn-danger" onClick={() => remove(s)}><Trash2 size={13} /></button>
                  </td>
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
              <div><label>Suffix</label>{field('suffix')}</div>
            </div>
            <div className="form-row">
              <div><label>Sex *</label>{field('sex', { options: ['Male', 'Female'] })}</div>
              <div><label>Birth date</label>{field('birth_date', { type: 'date' })}</div>
              <div><label>Birth place</label>{field('birth_place')}</div>
              <div><label>Religion</label>{field('religion')}</div>
            </div>
            <div className="form-row">
              <div><label>Grade level *</label>{field('grade_level', { options: GRADE_LEVELS })}</div>
              <div><label>Strand / Track (SHS)</label>{field('track_strand')}</div>
              <div><label>Address</label>{field('address')}</div>
              <div><label>Contact no.</label>{field('contact')}</div>
            </div>
            <div className="form-row">
              <div><label>Guardian name</label>{field('guardian_name')}</div>
              <div><label>Guardian contact</label>{field('guardian_contact')}</div>
              <div><label>Relationship</label>{field('guardian_relation')}</div>
              <div><label>Status</label>{field('status', { options: ['enrolled', 'transferred', 'dropped', 'graduated'] })}</div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save student'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
