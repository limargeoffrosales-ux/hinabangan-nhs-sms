import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Filter } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { PageHead, Spinner, Empty, Modal, ErrorBanner, ConfirmModal, SearchInput } from '../components/ui';

const ADMIN = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
const TYPES = ['NCII', 'TESDA', 'OTHER'];
const STATUSES = ['active', 'expired', 'pending'];
const STATUS_COLORS = { active: 'badge-green', expired: 'badge-red', pending: 'badge-yellow' };
const TYPE_COLORS = { NCII: 'badge-blue', TESDA: 'badge-purple', OTHER: 'badge-gray' };
const EMPTY_FORM = {
  student_id: '', certification_type: 'NCII', cert_name: '', specialization: '',
  date_acquired: '', expiry_date: '', status: 'active', issuing_body: '', certificate_no: '', notes: '',
};

export default function Certifications() {
  const { user } = useAuth();
  const isAdmin = can(user?.role, ...ADMIN);
  const [rows, setRows] = useState([]);
  const [students, setStudents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState({ type: '', status: '' });
  const [search, setSearch] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [certs, sum, stus] = await Promise.allSettled([
        api('/certifications'),
        api('/certifications/summary'),
        api('/students?limit=500'),
      ]);
      if (certs.status === 'fulfilled') setRows(certs.value.data);
      if (sum.status === 'fulfilled') setSummary(sum.value);
      if (stus.status === 'fulfilled') setStudents(stus.value.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function openForm(cert) {
    if (cert) {
      setEditing(cert.id);
      setForm({
        student_id: cert.student_id || '',
        certification_type: cert.certification_type || 'NCII',
        cert_name: cert.cert_name || '',
        specialization: cert.specialization || '',
        date_acquired: cert.date_acquired ? cert.date_acquired.slice(0, 10) : '',
        expiry_date: cert.expiry_date ? cert.expiry_date.slice(0, 10) : '',
        status: cert.status || 'active',
        issuing_body: cert.issuing_body || '',
        certificate_no: cert.certificate_no || '',
        notes: cert.notes || '',
      });
    } else {
      setEditing(null);
      setForm({ ...EMPTY_FORM });
    }
    setShowModal(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { ...form, student_id: Number(form.student_id) };
      if (editing) {
        await api(`/certifications/${editing}`, { method: 'PATCH', body });
      } else {
        await api('/certifications', { method: 'POST', body });
      }
      await loadData();
      setShowModal(false);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    setConfirmAction({ message: 'Delete this certification record?', action: async () => {
      try {
        await api(`/certifications/${id}`, { method: 'DELETE' });
        setRows((r) => r.filter((x) => x.id !== id));
      } catch (e2) {
        setError(e2.message);
      }
    } });
  }

  const filtered = rows.filter((r) =>
    (!filter.type || r.certification_type === filter.type) &&
    (!filter.status || r.status === filter.status) &&
    (!search || `${r.first_name} ${r.last_name} ${r.cert_name}`.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHead title="TVL Certifications" sub="Track NCII, TESDA, and other vocational certifications for SHS students">
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => openForm(null)}>
            <Plus size={15} /> Add Certification
          </button>
        )}
      </PageHead>
      <ErrorBanner error={error} />

      {/* Summary KPIs */}
      {summary && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="kpi-row">
            <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--accent)' }}>{summary.total}</div><div className="kpi-mini-label">Total</div></div>
            {summary.by_type?.map((t) => (
              <div key={t.certification_type} className="kpi-mini"><div className="kpi-mini-value" style={{ color: t.certification_type === 'NCII' ? 'var(--accent)' : t.certification_type === 'TESDA' ? 'var(--accent-2)' : 'var(--text-dim)' }}>{t.count}</div><div className="kpi-mini-label">{t.certification_type}</div></div>
            ))}
            <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--success)' }}>{summary.by_status?.find((s) => s.status === 'active')?.count || 0}</div><div className="kpi-mini-label">Active</div></div>
            <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--warn)' }}>{summary.expiring_soon}</div><div className="kpi-mini-label">Expiring (30d)</div></div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="form-row" style={{ gap: 8, flexWrap: 'wrap', display: 'flex', alignItems: 'center' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search student or cert name…" />
          <label style={{ margin: 0 }}>
            <Filter size={14} /> Type
            <select value={filter.type} onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))} style={{ marginTop: 4 }}>
              <option value="">All</option>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label style={{ margin: 0 }}>
            Status
            <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))} style={{ marginTop: 4 }}>
              <option value="">All</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <div className="sub" style={{ marginTop: 8 }}>{filtered.length} records found</div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Empty text="No certification records yet." />
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Certification</th>
                  <th>Type</th>
                  <th>Specialization</th>
                  <th style={{ textAlign: 'center' }}>Acquired</th>
                  <th style={{ textAlign: 'center' }}>Expiry</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  {isAdmin && <th style={{ width: 80 }}></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.last_name}, {r.first_name}</div>
                      {r.section_name && <div className="sub" style={{ fontSize: 12 }}>{r.grade_level} — {r.section_name}</div>}
                    </td>
                    <td>
                      <div>{r.cert_name}</div>
                      {r.certificate_no && <div className="sub" style={{ fontSize: 11 }}>#{r.certificate_no}</div>}
                    </td>
                    <td><span className={`badge ${TYPE_COLORS[r.certification_type] || 'badge-gray'}`}>{r.certification_type}</span></td>
                    <td className="sub">{r.specialization || '—'}</td>
                    <td style={{ textAlign: 'center' }} className="sub">{r.date_acquired ? r.date_acquired.slice(0, 10) : '—'}</td>
                    <td style={{ textAlign: 'center' }} className="sub">{r.expiry_date ? r.expiry_date.slice(0, 10) : '—'}</td>
                    <td style={{ textAlign: 'center' }}><span className={`badge ${STATUS_COLORS[r.status]}`}>{r.status}</span></td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-sm" onClick={() => openForm(r)} title="Edit"><Pencil size={12} /></button>
                          <button className="btn btn-sm" onClick={() => remove(r.id)} title="Delete"><Trash2 size={12} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form modal */}
      {showModal && (
        <Modal title={editing ? 'Edit Certification' : 'Add Certification'} onClose={() => setShowModal(false)}>
          <form onSubmit={save}>
            <div className="grid-2" style={{ gap: 12 }}>
              <label>Student *
                <select required value={form.student_id} onChange={(e) => setForm((f) => ({ ...f, student_id: e.target.value }))}>
                  <option value="">Select student…</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} ({s.grade_level || 'N/A'})</option>)}
                </select>
              </label>
              <label>Certification Name *
                <input required value={form.cert_name} onChange={(e) => setForm((f) => ({ ...f, cert_name: e.target.value }))} placeholder="e.g. NCII Cookery, TESDA Servicing Electronic Products" />
              </label>
              <label>Type *
                <select value={form.certification_type} onChange={(e) => setForm((f) => ({ ...f, certification_type: e.target.value }))}>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label>Specialization
                <input value={form.specialization} onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))} placeholder="e.g. Electrical Installation" />
              </label>
              <label>Date Acquired
                <input type="date" value={form.date_acquired} onChange={(e) => setForm((f) => ({ ...f, date_acquired: e.target.value }))} />
              </label>
              <label>Expiry Date
                <input type="date" value={form.expiry_date} onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))} />
              </label>
              <label>Status
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>Issuing Body
                <input value={form.issuing_body} onChange={(e) => setForm((f) => ({ ...f, issuing_body: e.target.value }))} placeholder="e.g. TESDA, DepEd" />
              </label>
              <label>Certificate No.
                <input value={form.certificate_no} onChange={(e) => setForm((f) => ({ ...f, certificate_no: e.target.value }))} />
              </label>
            </div>
            <label style={{ marginTop: 12 }}>Notes
              <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
      {confirmAction && <ConfirmModal message={confirmAction.message} danger onConfirm={() => { confirmAction.action(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />}
    </div>
  );
}
