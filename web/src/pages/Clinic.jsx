import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Pill, Stethoscope } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { PageHead, Spinner, Empty, Modal, ErrorBanner, ConfirmModal } from '../components/ui';

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'nurse'];
const OUTCOMES = ['treated', 'referred', 'sent_home', 'monitoring'];
const OUTCOME_COLORS = { treated: 'badge-green', referred: 'badge-blue', sent_home: 'badge-yellow', monitoring: 'badge-purple' };
const EMPTY_VISIT = { student_id: '', visitor_name: '', complaint: '', diagnosis: '', treatment: '', temperature: '', blood_pressure: '', referred_to: '', outcome: 'treated', notes: '' };
const EMPTY_MED = { name: '', category: '', quantity: 0, unit: 'pieces', expiry_date: '', supplier: '', status: 'active' };

export default function Clinic() {
  const { user } = useAuth();
  const isAdmin = can(user?.role, ...WRITE);
  const [tab, setTab] = useState('visits');
  const [visits, setVisits] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [visitSummary, setVisitSummary] = useState(null);
  const [medSummary, setMedSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showMedModal, setShowMedModal] = useState(false);
  const [showDispenseModal, setShowDispenseModal] = useState(null);
  const [visitForm, setVisitForm] = useState({ ...EMPTY_VISIT });
  const [medForm, setMedForm] = useState({ ...EMPTY_MED });
  const [dispenseForm, setDispenseForm] = useState({ quantity: 1, visit_id: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [, setStudents] = useState([]);
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [v, vs, m, ms, st] = await Promise.allSettled([
        api('/clinic/visits'), api('/clinic/visits/summary'), api('/clinic/medicines'), api('/clinic/medicines/summary'), api('/students?limit=500'),
      ]);
      if (v.status === 'fulfilled') setVisits(v.value.data);
      if (vs.status === 'fulfilled') setVisitSummary(vs.value);
      if (m.status === 'fulfilled') setMedicines(m.value.data);
      if (ms.status === 'fulfilled') setMedSummary(ms.value);
      if (st.status === 'fulfilled') setStudents(st.value.data);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  async function saveVisit(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await api('/clinic/visits', { method: 'POST', body: { ...visitForm, student_id: visitForm.student_id ? Number(visitForm.student_id) : null, temperature: visitForm.temperature ? Number(visitForm.temperature) : null } });
      await loadData(); setShowVisitModal(false);
    } catch (e2) { setError(e2.message); } finally { setSaving(false); }
  }

  async function saveMed(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const body = { ...medForm, quantity: Number(medForm.quantity) };
      if (showMedModal.editing) await api(`/clinic/medicines/${showMedModal.editing}`, { method: 'PATCH', body });
      else await api('/clinic/medicines', { method: 'POST', body });
      await loadData(); setShowMedModal(false);
    } catch (e2) { setError(e2.message); } finally { setSaving(false); }
  }

  async function dispenseMed(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await api('/clinic/dispense', { method: 'POST', body: { ...dispenseForm, medicine_id: showDispenseModal.id, quantity: Number(dispenseForm.quantity), visit_id: dispenseForm.visit_id ? Number(dispenseForm.visit_id) : null } });
      await loadData(); setShowDispenseModal(null);
    } catch (e2) { setError(e2.message); } finally { setSaving(false); }
  }

  async function removeVisit(id) {
    setConfirmAction({ message: 'Delete?', action: async () => { try { await api(`/clinic/visits/${id}`, { method: 'DELETE' }); await loadData(); } catch (e2) { setError(e2.message); } } });
  }
  async function removeMed(id) {
    setConfirmAction({ message: 'Delete?', action: async () => { try { await api(`/clinic/medicines/${id}`, { method: 'DELETE' }); await loadData(); } catch (e2) { setError(e2.message); } } });
  }

  const filteredVisits = dateFilter ? visits.filter((v) => v.visit_date?.slice(0, 10) === dateFilter) : visits;

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHead title="School Clinic" sub="Health visits, medicine inventory, and dispensing">
        {isAdmin && tab === 'visits' && <button className="btn btn-primary" onClick={() => { setVisitForm({ ...EMPTY_VISIT }); setShowVisitModal(true); }}><Plus size={15} /> Log Visit</button>}
        {isAdmin && tab === 'medicines' && <button className="btn btn-primary" onClick={() => { setMedForm({ ...EMPTY_MED }); setShowMedModal({ editing: null }); }}><Plus size={15} /> Add Medicine</button>}
      </PageHead>
      <ErrorBanner error={error} />

      {/* KPIs */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="kpi-row">
          {tab === 'visits' ? (<>
            <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--accent)' }}>{visitSummary?.total ?? 0}</div><div className="kpi-mini-label">Visits</div></div>
            {visitSummary?.by_outcome?.map((o) => (
              <div key={o.outcome} className="kpi-mini"><div className="kpi-mini-value" style={{ color: o.outcome === 'treated' ? 'var(--success)' : 'var(--accent)' }}>{o.count}</div><div className="kpi-mini-label">{o.outcome}</div></div>
            ))}
          </>) : (<>
            <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--accent)' }}>{medSummary?.total ?? 0}</div><div className="kpi-mini-label">Medicines</div></div>
            <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--accent-2)' }}>{medSummary?.total_qty ?? 0}</div><div className="kpi-mini-label">Total Qty</div></div>
            <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--warn)' }}>{medSummary?.low_stock ?? 0}</div><div className="kpi-mini-label">Low Stock</div></div>
            <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--danger)' }}>{medSummary?.expiring_soon ?? 0}</div><div className="kpi-mini-label">Expiring (30d)</div></div>
          </>)}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <button className={`btn btn-sm ${tab === 'visits' ? 'btn-primary' : ''}`} onClick={() => setTab('visits')}><Stethoscope size={14} /> Visits</button>
        <button className={`btn btn-sm ${tab === 'medicines' ? 'btn-primary' : ''}`} onClick={() => setTab('medicines')}><Pill size={14} /> Medicines</button>
      </div>

      {tab === 'visits' && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <label style={{ margin: 0 }}>Filter by date <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={{ marginLeft: 8 }} /></label>
          </div>
          {filteredVisits.length === 0 ? <Empty text="No clinic visits recorded." /> : (
            <div className="card"><div className="table-wrap"><table>
              <thead><tr><th>Date</th><th>Visitor</th><th>Complaint</th><th>Diagnosis</th><th style={{ textAlign: 'center' }}>Temp</th><th style={{ textAlign: 'center' }}>Outcome</th>{isAdmin && <th></th>}</tr></thead>
              <tbody>{filteredVisits.map((v) => (
                <tr key={v.id}>
                  <td className="sub">{v.visit_date?.slice(0, 16).replace('T', ' ')}</td>
                  <td>{v.student_name || v.visitor_name || v.teacher_name || '—'}<div className="sub" style={{ fontSize: 11 }}>{v.student_name ? 'Student' : v.teacher_name ? 'Teacher' : 'Walk-in'}</div></td>
                  <td>{v.complaint}</td>
                  <td className="sub">{v.diagnosis || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{v.temperature ? `${v.temperature}°` : '—'}</td>
                  <td style={{ textAlign: 'center' }}><span className={`badge ${OUTCOME_COLORS[v.outcome] || 'badge-gray'}`}>{v.outcome}</span></td>
                  {isAdmin && <td><button className="btn btn-sm" onClick={() => removeVisit(v.id)}><Trash2 size={12} /></button></td>}
                </tr>
              ))}</tbody>
            </table></div></div>
          )}
        </>
      )}

      {tab === 'medicines' && (
        <>
          {medicines.length === 0 ? <Empty text="No medicines in inventory." /> : (
            <div className="card"><div className="table-wrap"><table>
              <thead><tr><th>Medicine</th><th>Category</th><th style={{ textAlign: 'center' }}>Qty</th><th>Unit</th><th style={{ textAlign: 'center' }}>Expiry</th><th style={{ textAlign: 'center' }}>Status</th>{isAdmin && <th></th>}</tr></thead>
              <tbody>{medicines.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.name}</strong>{m.supplier && <div className="sub" style={{ fontSize: 11 }}>{m.supplier}</div>}</td>
                  <td className="sub">{m.category || '—'}</td>
                  <td style={{ textAlign: 'center' }}><strong style={{ color: m.quantity <= 5 ? 'var(--danger)' : 'var(--text)' }}>{m.quantity}</strong></td>
                  <td className="sub">{m.unit}</td>
                  <td style={{ textAlign: 'center' }} className="sub">{m.expiry_date?.slice(0, 10) || '—'}</td>
                  <td style={{ textAlign: 'center' }}><span className={`badge ${m.status === 'active' ? 'badge-green' : m.status === 'depleted' ? 'badge-red' : 'badge-yellow'}`}>{m.status}</span></td>
                  {isAdmin && <td><div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-sm" onClick={() => { setMedForm(m); setShowMedModal({ editing: m.id }); }} title="Edit"><Pencil size={12} /></button>
                    <button className="btn btn-sm" onClick={() => { setDispenseForm({ quantity: 1, visit_id: '', notes: '' }); setShowDispenseModal(m); }} title="Dispense" disabled={m.quantity <= 0}><Pill size={12} /></button>
                    <button className="btn btn-sm" onClick={() => removeMed(m.id)} title="Delete"><Trash2 size={12} /></button>
                  </div></td>}
                </tr>
              ))}</tbody>
            </table></div></div>
          )}
        </>
      )}

      {/* Visit modal */}
      {showVisitModal && (
        <Modal title="Log Clinic Visit" onClose={() => setShowVisitModal(false)}>
          <form onSubmit={saveVisit}>
            <div className="grid-2" style={{ gap: 12 }}>
              <label>Student ID
                <input type="number" value={visitForm.student_id} onChange={(e) => setVisitForm((f) => ({ ...f, student_id: e.target.value }))} placeholder="Leave blank for walk-in" />
              </label>
              <label>Visitor Name<input value={visitForm.visitor_name} onChange={(e) => setVisitForm((f) => ({ ...f, visitor_name: e.target.value }))} placeholder="If not a registered student" /></label>
              <label>Complaint *<input required value={visitForm.complaint} onChange={(e) => setVisitForm((f) => ({ ...f, complaint: e.target.value }))} /></label>
              <label>Diagnosis<input value={visitForm.diagnosis} onChange={(e) => setVisitForm((f) => ({ ...f, diagnosis: e.target.value }))} /></label>
              <label>Treatment<textarea rows={2} value={visitForm.treatment} onChange={(e) => setVisitForm((f) => ({ ...f, treatment: e.target.value }))} /></label>
              <label>Temperature<input type="number" step="0.1" value={visitForm.temperature} onChange={(e) => setVisitForm((f) => ({ ...f, temperature: e.target.value }))} placeholder="36.5" /></label>
              <label>Blood Pressure<input value={visitForm.blood_pressure} onChange={(e) => setVisitForm((f) => ({ ...f, blood_pressure: e.target.value }))} placeholder="120/80" /></label>
              <label>Referred To<input value={visitForm.referred_to} onChange={(e) => setVisitForm((f) => ({ ...f, referred_to: e.target.value }))} placeholder="e.g. RHU, Hospital" /></label>
              <label>Outcome<select value={visitForm.outcome} onChange={(e) => setVisitForm((f) => ({ ...f, outcome: e.target.value }))}>
                {OUTCOMES.map((o) => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
              </select></label>
            </div>
            <label>Notes<textarea rows={2} value={visitForm.notes} onChange={(e) => setVisitForm((f) => ({ ...f, notes: e.target.value }))} /></label>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowVisitModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Medicine modal */}
      {showMedModal && (
        <Modal title={showMedModal.editing ? 'Edit Medicine' : 'Add Medicine'} onClose={() => setShowMedModal(false)}>
          <form onSubmit={saveMed}>
            <div className="grid-2" style={{ gap: 12 }}>
              <label>Name *<input required value={medForm.name} onChange={(e) => setMedForm((f) => ({ ...f, name: e.target.value }))} /></label>
              <label>Category<input value={medForm.category} onChange={(e) => setMedForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Analgesic, Antibiotic" /></label>
              <label>Quantity<input type="number" min="0" value={medForm.quantity} onChange={(e) => setMedForm((f) => ({ ...f, quantity: e.target.value }))} /></label>
              <label>Unit<select value={medForm.unit} onChange={(e) => setMedForm((f) => ({ ...f, unit: e.target.value }))}>
                <option>pieces</option><option>tablets</option><option>ml</option><option>bottles</option><option>tubes</option><option>sachets</option>
              </select></label>
              <label>Expiry Date<input type="date" value={medForm.expiry_date} onChange={(e) => setMedForm((f) => ({ ...f, expiry_date: e.target.value }))} /></label>
              <label>Supplier<input value={medForm.supplier} onChange={(e) => setMedForm((f) => ({ ...f, supplier: e.target.value }))} /></label>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowMedModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Dispense modal */}
      {showDispenseModal && (
        <Modal title={`Dispense: ${showDispenseModal.name}`} onClose={() => setShowDispenseModal(null)}>
          <form onSubmit={dispenseMed}>
            <label>Quantity * (available: {showDispenseModal.quantity})<input type="number" min="1" max={showDispenseModal.quantity} required value={dispenseForm.quantity} onChange={(e) => setDispenseForm((f) => ({ ...f, quantity: e.target.value }))} /></label>
            <label>Dispensed To<input value={dispenseForm.dispensed_to} onChange={(e) => setDispenseForm((f) => ({ ...f, dispensed_to: e.target.value }))} placeholder="Student/Teacher name" /></label>
            <label>Notes<textarea rows={2} value={dispenseForm.notes} onChange={(e) => setDispenseForm((f) => ({ ...f, notes: e.target.value }))} /></label>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowDispenseModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Dispensing…' : 'Dispense'}</button>
            </div>
          </form>
        </Modal>
      )}
      {confirmAction && <ConfirmModal message={confirmAction.message} danger onConfirm={() => { confirmAction.action(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />}
    </div>
  );
}
