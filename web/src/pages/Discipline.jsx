import { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, Trash2, ClipboardPenLine, Eye, CheckCircle2, FilePlus2 } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Modal, Empty, ErrorBanner, Spinner, ConfirmModal } from '../components/ui';
import { useAuth } from '../lib/auth';

const TYPES = [
  ['call_slip', 'Call Slip'],
  ['bullying', 'Bullying'],
  ['inappropriate_behavior', 'Inappropriate Behavior'],
  ['fighting', 'Fighting / Physical Altercation'],
  ['vandalism', 'Vandalism'],
  ['tardiness', 'Chronic Tardiness'],
  ['disrespect', 'Disrespect / Defiance'],
  ['other', 'Other'],
];

const SEVERITIES = ['minor', 'moderate', 'major'];
const STATUSES = ['open', 'under_review', 'resolved'];

const ACTION_TYPES = [
  ['warning', 'Verbal / Written Warning'],
  ['counseling', 'Counseling Session'],
  ['parent_conference', 'Parent Conference'],
  ['detention', 'Detention'],
  ['community_service', 'Community Service'],
  ['suspension', 'Suspension'],
  ['referral', 'Referral (Guidance / Others)'],
  ['other', 'Other Action'],
];

const STATUS_BADGE = { open: 'badge-yellow', under_review: 'badge-blue', resolved: 'badge-green' };
const SEVERITY_BADGE = { minor: 'badge-blue', moderate: 'badge-yellow', major: 'badge-red' };
const ACTION_BADGE = {
  warning: 'badge-yellow', counseling: 'badge-blue', parent_conference: 'badge-gray',
  detention: 'badge-red', community_service: 'badge-blue', suspension: 'badge-red',
  referral: 'badge-gray', other: 'badge-gray',
};

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'guidance', 'teacher'];
const ADMIN = ['super_admin', 'school_admin', 'principal', 'assistant_principal'];

function labelOf(list, key) {
  return list.find(([k]) => k === key)?.[1] || key;
}

function fmtDate(d) {
  try { return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function Discipline() {
  const { user } = useAuth();
  const canWrite = WRITE.includes(user?.role);
  const canDelete = ADMIN.includes(user?.role);

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ q: '', status: '', type: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [sel, setSel] = useState(null);
  const [selLoading, setSelLoading] = useState(false);

  const [createForm, setCreateForm] = useState({
    student_id: '', incident_type: 'call_slip', incident_date: today(), severity: 'minor', description: '',
  });
  const [, setSaveMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const [actionForm, setActionForm] = useState({ action_type: 'warning', action_date: today(), notes: '' });
  const [confirmAction, setConfirmAction] = useState(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.q) p.set('q', filters.q);
    if (filters.status) p.set('status', filters.status);
    if (filters.type) p.set('type', filters.type);
    p.set('limit', '200');
    return p.toString();
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, sum] = await Promise.allSettled([api(`/conduct?${qs}`), api('/conduct/summary')]);
      setRows(list.status === 'fulfilled' ? list.value.data : []);
      setSummary(sum.status === 'fulfilled' ? sum.value : null);
      const errs = [list, sum].filter((r) => r.status === 'rejected').map((r) => r.reason.message);
      if (errs.length) throw new Error(errs.join('; '));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => { load(); }, [load]);

  async function loadStudents() {
    try {
      const res = await api('/students?limit=200');
      setStudents(res.data);
    } catch {}
  }

  async function openCreate() {
    setCreateForm({ student_id: '', incident_type: 'call_slip', incident_date: today(), severity: 'minor', description: '' });
    setSaveMsg(null);
    await loadStudents();
    setShowCreate(true);
  }

  async function saveRecord(e) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    setError(null);
    try {
      await api('/conduct', { method: 'POST', body: createForm });
      setShowCreate(false);
      load();
    } catch (e2) {
      setSaveMsg(null);
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(r) {
    setSelLoading(true);
    setError(null);
    try {
      const res = await api(`/conduct/${r.id}`);
      setSel(res.data);
      setActionForm({ action_type: 'warning', action_date: today(), notes: '' });
    } catch (e) {
      setError(e.message);
    } finally {
      setSelLoading(false);
    }
  }

  async function updateSel(patch) {
    setError(null);
    try {
      await api(`/conduct/${sel.id}`, { method: 'PATCH', body: patch });
      const res = await api(`/conduct/${sel.id}`);
      setSel(res.data);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function addAction(e) {
    e.preventDefault();
    setError(null);
    try {
      await api(`/conduct/${sel.id}/actions`, { method: 'POST', body: actionForm });
      const res = await api(`/conduct/${sel.id}`);
      setSel(res.data);
      setActionForm({ action_type: 'warning', action_date: today(), notes: '' });
      load();
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function removeRecord(r) {
    setConfirmAction({ message: `Delete the conduct record for ${r.student_name}? This cannot be undone.`, action: async () => {
      try {
        await api(`/conduct/${r.id}`, { method: 'DELETE' });
        setSel(null);
        load();
      } catch (e) {
        setError(e.message);
      }
    } });
  }

  const summaryChips = [
    ['Open cases', summary?.by_status?.open ?? 0, 'var(--warn)'],
    ['Under review', summary?.by_status?.under_review ?? 0, 'var(--accent)'],
    ['Resolved', summary?.by_status?.resolved ?? 0, 'var(--accent-2)'],
    ['Cases this month', summary?.cases_this_month ?? 0, 'var(--accent)'],
    ['Major incidents', summary?.by_severity?.major ?? 0, 'var(--danger)'],
  ];

  const filteredStudents = useMemo(() => {
    if (!createForm.sname) return students;
    const q2 = createForm.sname.toLowerCase();
    return students.filter((s) =>
      `${s.last_name} ${s.first_name} ${s.lrn}`.toLowerCase().includes(q2));
  }, [students, createForm.sname]);

  return (
    <>
      <PageHead title="Student Conduct & Discipline" sub="Call slips, bullying cases, and inappropriate behaviors — log incidents, track actions taken, and monitor case status">
        {canWrite && <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> Log Incident</button>}
      </PageHead>
      <ErrorBanner error={error} />

      <div className="kpi-row" style={{ marginBottom: 14 }}>
        {summaryChips.map(([label, value, color]) => (
          <div className="kpi-mini" key={label}>
            <div className="kpi-mini-value" style={{ color }}>{value ?? '—'}</div>
            <div className="kpi-mini-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="search-row">
        <input placeholder="Search student name or LRN…" value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
          <option value="">All incident types</option>
          {TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th><th>Grade / Section</th><th>Incident</th><th style={{ textAlign: 'center' }}>Severity</th>
                <th style={{ textAlign: 'center' }}>Date</th><th style={{ textAlign: 'center' }}>Status</th>
                <th>Reported by</th><th style={{ textAlign: 'center' }}>Actions</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={9}><Spinner /></td></tr> : rows.length === 0 ? (
                <tr><td colSpan={9} className="sub">No conduct records match the current filters.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.student_name}</div>
                    <div className="sub" style={{ fontSize: 12 }}>LRN {r.lrn || '—'}</div>
                  </td>
                  <td>{r.grade_level || '—'} {r.section_name ? `· ${r.section_name}` : ''}</td>
                  <td>{labelOf(TYPES, r.incident_type)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${SEVERITY_BADGE[r.severity] || 'badge-gray'}`}>{r.severity}</span>
                  </td>
                  <td style={{ textAlign: 'center' }} className="sub">{fmtDate(r.incident_date)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${STATUS_BADGE[r.status] || 'badge-gray'}`}>{r.status.replace('_', ' ')}</span>
                  </td>
                  <td className="sub">{r.reported_by_name || '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${r.action_count ? 'badge-blue' : 'badge-gray'}`}>{r.action_count}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" title="Open case" aria-label="Open case" onClick={() => openDetail(r)}><Eye size={15} aria-hidden="true" /></button>
                      {canDelete && (
                        <button className="icon-btn" title="Delete" aria-label="Delete" onClick={() => removeRecord(r)}><Trash2 size={15} aria-hidden="true" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <Modal title="Log a conduct incident" sub="Record a call slip, bullying case, or behavioral report for monitoring" onClose={() => setShowCreate(false)} wide>
          <form onSubmit={saveRecord}>
            <div className="form-row">
              <div>
                <label>Search student</label>
                <input placeholder="Type to filter by name or LRN…" value={createForm.sname || ''}
                  onChange={(e) => setCreateForm((f) => ({ ...f, sname: e.target.value }))} />
              </div>
              <div>
                <label>Student *</label>
                <select required value={createForm.student_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, student_id: e.target.value }))}>
                  <option value="">Select student…</option>
                  {filteredStudents.slice(0, 120).map((s) => (
                    <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} · LRN {s.lrn || '—'}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div>
                <label>Incident type *</label>
                <select required value={createForm.incident_type}
                  onChange={(e) => setCreateForm((f) => ({ ...f, incident_type: e.target.value }))}>
                  {TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <div>
                <label>Severity</label>
                <select value={createForm.severity} onChange={(e) => setCreateForm((f) => ({ ...f, severity: e.target.value }))}>
                  {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label>Incident date *</label>
                <input type="date" required value={createForm.incident_date}
                  onChange={(e) => setCreateForm((f) => ({ ...f, incident_date: e.target.value }))} />
              </div>
            </div>
            <label>What happened?</label>
            <textarea rows={3} placeholder="Describe the incident, witnesses, and context…" value={createForm.description}
              onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Record'}</button>
            </div>
          </form>
        </Modal>
      )}

      {sel && (
        <Modal title="Conduct case" sub={`${sel.student_name} · LRN ${sel.lrn || '—'} · ${sel.grade_level || ''} ${sel.section_name ? '· ' + sel.section_name : ''}`} onClose={() => setSel(null)} wide>
          {selLoading ? <Spinner /> : (
            <>
              <div className="conduct-detail">
                <label style={{ marginTop: 0 }}>Incident</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select value={sel.incident_type} onChange={(e) => updateSel({ incident_type: e.target.value })}>
                    {TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <select value={sel.severity} onChange={(e) => updateSel({ severity: e.target.value })}>
                    {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input type="date" value={sel.incident_date} onChange={(e) => updateSel({ incident_date: e.target.value })} />
                  <select value={sel.status} onChange={(e) => updateSel({ status: e.target.value })}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <label>Description</label>
                <textarea rows={3} defaultValue={sel.description || ''} placeholder="No description recorded"
                  onBlur={(e) => { if (e.target.value !== (sel.description || '')) updateSel({ description: e.target.value }); }} />
                <div className="sub">
                  Reported by {sel.reported_by_name || '—'} · logged {sel.created_at?.slice(0, 10)} · open {sel.days_open} day(s)
                </div>
              </div>

              <h4 style={{ margin: '18px 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ClipboardPenLine size={15} /> Actions taken <span className="sub">({sel.actions?.length || 0})</span>
              </h4>
              {!sel.actions?.length ? <Empty text="No actions recorded yet — add an intervention below." /> : (
                <div className="conduct-timeline">
                  {sel.actions.map((a) => (
                    <div className="conduct-ev" key={a.id}>
                      <span className={`badge ${ACTION_BADGE[a.action_type] || 'badge-gray'}`}>{labelOf(ACTION_TYPES, a.action_type)}</span>
                      <span className="sub" style={{ marginLeft: 8 }}>{fmtDate(a.action_date)}</span>
                      <div className="conduct-ev-note">{a.notes || '—'}</div>
                      <div className="sub" style={{ fontSize: 11.5 }}>by {a.done_by_name || '—'}</div>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={addAction}>
                <div className="form-row" style={{ marginTop: 14 }}>
                  <div>
                    <label>Action taken</label>
                    <select required value={actionForm.action_type} onChange={(e) => setActionForm((a) => ({ ...a, action_type: e.target.value }))}>
                      {ACTION_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Date</label>
                    <input type="date" required value={actionForm.action_date} onChange={(e) => setActionForm((a) => ({ ...a, action_date: e.target.value }))} />
                  </div>
                  <div>
                    <label>Notes</label>
                    <input placeholder="Outcome, commitment, next steps…" value={actionForm.notes}
                      onChange={(e) => setActionForm((a) => ({ ...a, notes: e.target.value }))} />
                  </div>
                </div>
                <div className="modal-actions">
                  {canDelete && (
                    <button type="button" className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => removeRecord(sel)}>
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
                  <button type="button" className="btn" onClick={() => setSel(null)}>Close</button>
                  <button className="btn btn-primary"><FilePlus2 size={14} /> Record Action</button>
                </div>
              </form>
              {sel.status === 'open' && (
                <div className="sub" style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                  Logging an action automatically moves this case to <strong>Under review</strong>. Set it to <strong>Resolved</strong> once the intervention is complete.
                </div>
              )}
            </>
          )}
        </Modal>
      )}
      {confirmAction && <ConfirmModal message={confirmAction.message} danger onConfirm={() => { confirmAction.action(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />}
    </>
  );
}
