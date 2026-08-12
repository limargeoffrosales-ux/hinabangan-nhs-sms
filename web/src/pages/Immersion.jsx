import { useEffect, useState } from 'react';
import { Briefcase, BadgeCheck, Plus, Trash2, Pencil } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { PageHead, Empty, Spinner, ErrorBanner, Modal } from '../components/ui';

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
const PROGRAMS = ['EIM', 'CSS', 'Garment Artisanry', 'Academic'];
const IMMERSION_STATUSES = ['pending', 'ongoing', 'completed', 'withdrawn'];
const JDVP_STATUSES = ['pending', 'served', 'withdrawn'];
const STATUS_CLASS = { pending: 'badge-yellow', ongoing: 'badge-blue', completed: 'badge-green', served: 'badge-green', withdrawn: 'badge-red' };

function emptyForm() {
  return { student_id: '', batch: 'Batch 1', program: PROGRAMS[0], partner_institution: '', status: 'ongoing', start_date: '', end_date: '', remarks: '' };
}

export default function Immersion() {
  const { user } = useAuth();
  const canWrite = can(user?.role, ...WRITE);
  const [tab, setTab] = useState('immersion');
  const [students, setStudents] = useState([]);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setError(null);
    try {
      const path = tab === 'immersion' ? '/immersion?limit=200' : '/jdvp?limit=200';
      const [r, st] = await Promise.all([api(path), api('/students?limit=200')]);
      setRows(r.data || []);
      setStudents(st.data || []);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, [tab]);

  function openAdd() { setForm(emptyForm()); setEditId(null); setModal(true); }
  function openEdit(r) {
    setForm({
      student_id: String(r.student_id), batch: r.batch, program: r.program || PROGRAMS[0],
      partner_institution: r.partner_institution || '', status: r.status, start_date: r.start_date || '',
      end_date: r.end_date || '', remarks: r.remarks || '',
    });
    setEditId(r.id);
    setModal(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const path = tab === 'immersion' ? '/immersion' : '/jdvp';
      if (tab === 'immersion') {
        const body = {
          student_id: Number(form.student_id), batch: form.batch, program: form.program,
          partner_institution: form.partner_institution, status: form.status,
          start_date: form.start_date || null, end_date: form.end_date || null, remarks: form.remarks || null,
        };
        if (editId) await api(`${path}/${editId}`, { method: 'PATCH', body });
        else await api(path, { method: 'POST', body });
      } else {
        const body = {
          student_id: Number(form.student_id), batch: form.batch, program: form.program,
          status: form.status, remarks: form.remarks || null,
        };
        if (editId) await api(`${path}/${editId}`, { method: 'PATCH', body });
        else await api(path, { method: 'POST', body });
      }
      setModal(false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this record?')) return;
    try {
      await api(`/${tab}/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  const isImmersion = tab === 'immersion';

  return (
    <>
      <PageHead
        title={isImmersion ? 'Work Immersion' : 'JDVP Recipients'}
        sub={isImmersion
          ? 'Learner records for Work Immersion by batch, program and partner institution (EIM · CSS · Garment Artisanry · Academic)'
          : 'Joint Delivery Voucher Program recipients by batch'}
      />

      <div className="card-top">
        <div className="tabs" style={{ display: 'flex', gap: 8 }}>
          <button className={`tab-btn ${isImmersion ? 'active' : ''}`} onClick={() => setTab('immersion')}>
            <Briefcase size={14} /> Work Immersion
          </button>
          <button className={`tab-btn ${!isImmersion ? 'active' : ''}`} onClick={() => setTab('jdvp')}>
            <BadgeCheck size={14} /> JDVP Recipients
          </button>
        </div>
        {canWrite && (
          <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={13} /> Add {isImmersion ? 'immersion record' : 'recipient'}</button>
        )}
      </div>

      <div style={{ height: 14 }} />
      {error && <ErrorBanner error={error} />}
      {!rows.length && !error ? <Empty text={`No ${isImmersion ? 'work immersion' : 'JDVP'} records yet.`} /> : (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>Learner</th><th>LRN</th><th>Grade</th><th>Batch</th>
                {isImmersion && <th>Program</th>}
                {isImmersion && <th>Partner Institution</th>}
                {isImmersion && <th>Dates</th>}
                <th style={{ textAlign: 'center' }}>Status</th>
                <th>Remarks</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.student_name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12.5 }}>{r.lrn}</td>
                  <td className="sub">{r.grade_level}</td>
                  <td><span className="badge badge-blue">{r.batch}</span></td>
                  {isImmersion && <td>{r.program}</td>}
                  {isImmersion && <td>{r.partner_institution || '—'}</td>}
                  {isImmersion && <td className="sub">{[r.start_date, r.end_date].filter(Boolean).join(' → ') || '—'}</td>}
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${STATUS_CLASS[r.status] || 'badge-gray'}`}>{r.status}</span>
                  </td>
                  <td className="sub">{r.remarks || '—'}</td>
                  {canWrite && (
                    <td className="row-actions">
                      <button className="icon-btn" title="Edit" onClick={() => openEdit(r)}><Pencil size={14} /></button>
                      <button className="icon-btn" title="Delete" onClick={() => remove(r.id)}><Trash2 size={14} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={editId ? `Edit ${isImmersion ? 'immersion' : 'JDVP'} record` : `Add ${isImmersion ? 'immersion' : 'JDVP'} record`}
          sub={isImmersion ? 'Assign a learner to a batch/program with partner institution.' : 'Tag a learner as a JDVP recipient for a batch.'}
          onClose={() => setModal(false)}>
          <div className="form-row">
            <label>Learner
              <select className="input" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
                <option value="">— select learner —</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} — {s.grade_level} ({s.lrn})</option>
                ))}
              </select>
            </label>
            <label>Batch
              <select className="input" value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })}>
                {['Batch 1', 'Batch 2', 'Batch 3', 'Batch 4'].map((b) => <option key={b}>{b}</option>)}
              </select>
            </label>
            {isImmersion && (
              <label>Program
                <select className="input" value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })}>
                  {PROGRAMS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
            )}
            <label>Status
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {(isImmersion ? IMMERSION_STATUSES : JDVP_STATUSES).map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>
          {isImmersion && (
            <div className="form-row">
              <label>Partner Institution
                <input className="input" value={form.partner_institution} onChange={(e) => setForm({ ...form, partner_institution: e.target.value })} placeholder="e.g. Local Training Center" />
              </label>
              <label>Start date
                <input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </label>
              <label>End date
                <input type="date" className="input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </label>
            </div>
          )}
          <label style={{ marginTop: 12 }}>Remarks
            <textarea className="input" rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="Optional notes" />
          </label>
          <div className="modal-actions">
            <button className="btn btn-sm" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || !form.student_id}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}