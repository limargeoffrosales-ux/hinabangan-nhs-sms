import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LifeBuoy, Plus, Pencil, Trash2, Filter, MessageCircle, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { PageHead, Spinner, Empty, Modal, ErrorBanner } from '../components/ui';

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'guidance'];
const CASE_TYPES = ['behavioral', 'academic', 'personal', 'career', 'bullying', 'substance', 'other'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const SESSION_TYPES = ['counseling', 'assessment', 'follow_up', 'parent_meeting', 'referral'];
const PRIORITY_COLORS = { low: 'badge-gray', normal: 'badge-blue', high: 'badge-yellow', urgent: 'badge-red' };
const STATUS_COLORS = { open: 'badge-blue', in_progress: 'badge-yellow', resolved: 'badge-green', closed: 'badge-gray' };
const EMPTY_CASE = { student_id: '', case_type: 'behavioral', priority: 'normal', assigned_to: '', summary: '' };
const EMPTY_SESSION = { session_type: 'counseling', notes: '', action_items: '', session_date: '' };

export default function Guidance() {
  const { user } = useAuth();
  const isAdmin = can(user?.role, ...WRITE);
  const [cases, setCases] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(null);
  const [caseForm, setCaseForm] = useState({ ...EMPTY_CASE });
  const [sessionForm, setSessionForm] = useState({ ...EMPTY_SESSION });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState({ status: '', case_type: '' });
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseDetail, setCaseDetail] = useState(null);
  const [caseDetailLoading, setCaseDetailLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [c, s] = await Promise.allSettled([api('/guidance/cases'), api('/guidance/cases/summary')]);
      if (c.status === 'fulfilled') setCases(c.value.data);
      if (s.status === 'fulfilled') setSummary(s.value);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  async function saveCase(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const body = { ...caseForm, student_id: Number(caseForm.student_id), assigned_to: caseForm.assigned_to ? Number(caseForm.assigned_to) : null };
      if (showCaseModal.editing) await api(`/guidance/cases/${showCaseModal.editing}`, { method: 'PATCH', body: { case_type: body.case_type, priority: body.priority, assigned_to: body.assigned_to, summary: body.summary } });
      else await api('/guidance/cases', { method: 'POST', body });
      await loadData(); setShowCaseModal(false);
    } catch (e2) { setError(e2.message); } finally { setSaving(false); }
  }

  async function saveSession(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await api(`/guidance/cases/${showSessionModal}/sessions`, { method: 'POST', body: sessionForm });
      await loadData(); setShowSessionModal(null);
      if (selectedCase) loadCaseDetail(selectedCase);
    } catch (e2) { setError(e2.message); } finally { setSaving(false); }
  }

  async function loadCaseDetail(id) {
    setCaseDetailLoading(true);
    try { const r = await api(`/guidance/cases/${id}`); setCaseDetail(r); } catch { setCaseDetail(null); setError('Failed to load case details'); } finally { setCaseDetailLoading(false); }
  }

  async function updateCaseStatus(id, status) {
    try { await api(`/guidance/cases/${id}`, { method: 'PATCH', body: { status } }); await loadData(); if (selectedCase === id) loadCaseDetail(id); } catch (e2) { setError(e2.message); }
  }

  async function removeCase(id) { if (!confirm('Delete case?')) return; try { await api(`/guidance/cases/${id}`, { method: 'DELETE' }); setCases((r) => r.filter((x) => x.id !== id)); if (selectedCase === id) { setSelectedCase(null); setCaseDetail(null); } } catch (e2) { setError(e2.message); } }

  const filtered = cases.filter((c) =>
    (!filter.status || c.status === filter.status) && (!filter.case_type || c.case_type === filter.case_type)
  );

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHead title="Guidance Office" sub="Student case management and counseling sessions">
        {isAdmin && <button className="btn btn-primary" onClick={() => { setCaseForm({ ...EMPTY_CASE }); setShowCaseModal({ editing: null }); }}><Plus size={15} /> New Case</button>}
      </PageHead>
      <ErrorBanner error={error} />

      {summary && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="kpi-row">
            <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--accent)' }}>{summary.total}</div><div className="kpi-mini-label">Total Cases</div></div>
            {summary.by_status?.map((s) => (
              <div key={s.status} className="kpi-mini"><div className="kpi-mini-value" style={{ color: s.status === 'open' ? 'var(--accent)' : s.status === 'in_progress' ? 'var(--warn)' : s.status === 'resolved' ? 'var(--success)' : 'var(--text-dim)' }}>{s.count}</div><div className="kpi-mini-label">{s.status.replace('_', ' ')}</div></div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="form-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <label style={{ margin: 0 }}><Filter size={14} /> Status <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))} style={{ marginTop: 4 }}>
            <option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select></label>
          <label style={{ margin: 0 }}>Type <select value={filter.case_type} onChange={(e) => setFilter((f) => ({ ...f, case_type: e.target.value }))} style={{ marginTop: 4 }}>
            <option value="">All</option>{CASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select></label>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedCase ? '1fr 1fr' : '1fr', gap: 16 }}>
        {/* Case list */}
        <div>
          {filtered.length === 0 ? <Empty text="No guidance cases." /> : filtered.map((c) => (
            <div key={c.id} className="card" style={{ cursor: 'pointer', border: selectedCase === c.id ? '2px solid var(--accent)' : undefined, marginBottom: 12 }} onClick={() => { setSelectedCase(c.id); loadCaseDetail(c.id); }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 4px', fontSize: 14 }}>{c.student_name || `Student #${c.student_id}`}</h4>
                  <div className="sub" style={{ fontSize: 12 }}>{c.grade_level} {c.section_name ? `— ${c.section_name}` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <span className={`badge ${PRIORITY_COLORS[c.priority]}`}>{c.priority}</span>
                  <span className={`badge ${STATUS_COLORS[c.status]}`}>{c.status.replace('_', ' ')}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
                <span className="badge badge-gray">{c.case_type}</span>
                {c.opened_by_name && <span>Opened by {c.opened_by_name}</span>}
                {c.assigned_to_name && <span>→ {c.assigned_to_name}</span>}
              </div>
              {c.summary && <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '6px 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.summary}</p>}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                <button className="btn btn-sm" onClick={() => { setCaseForm({ student_id: c.student_id, case_type: c.case_type, priority: c.priority, assigned_to: c.assigned_to || '', summary: c.summary || '' }); setShowCaseModal({ editing: c.id }); }}><Pencil size={12} /></button>
                {c.status === 'open' && <button className="btn btn-sm" style={{ background: 'var(--accent)', color: '#fff' }} onClick={() => updateCaseStatus(c.id, 'in_progress')}>Start</button>}
                {c.status === 'in_progress' && <button className="btn btn-sm" style={{ background: 'var(--success)', color: '#fff' }} onClick={() => updateCaseStatus(c.id, 'resolved')}>Resolve</button>}
                <button className="btn btn-sm" onClick={() => removeCase(c.id)}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Case detail */}
        {selectedCase && (
          <div>
            {caseDetail ? (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ margin: '0 0 4px' }}>{caseDetail.student_name}</h3>
                  <button className="btn btn-sm" onClick={() => { setSelectedCase(null); setCaseDetail(null); }}>✕</button>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <span className={`badge ${PRIORITY_COLORS[caseDetail.priority]}`}>{caseDetail.priority}</span>
                  <span className={`badge ${STATUS_COLORS[caseDetail.status]}`}>{caseDetail.status.replace('_', ' ')}</span>
                  <span className="badge badge-gray">{caseDetail.case_type}</span>
                </div>
                {caseDetail.summary && <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>{caseDetail.summary}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => { setSessionForm({ ...EMPTY_SESSION }); setShowSessionModal(selectedCase); }}><Plus size={12} /> Add Session</button>
                </div>
                <h4 style={{ margin: '16px 0 8px' }}>Session History ({caseDetail.sessions?.length || 0})</h4>
                {caseDetail.sessions?.length === 0 ? <div className="sub">No sessions recorded.</div> : caseDetail.sessions?.map((s) => (
                  <div key={s.id} style={{ borderLeft: '3px solid var(--border)', paddingLeft: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span className="badge badge-gray">{s.session_type.replace('_', ' ')}</span>
                      <span className="sub">{s.session_date?.slice(0, 10)}</span>
                    </div>
                    <p style={{ fontSize: 13, margin: '4px 0', whiteSpace: 'pre-wrap' }}>{s.notes}</p>
                    {s.action_items && <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>Action: {s.action_items}</p>}
                    {s.conducted_by_name && <div className="sub" style={{ fontSize: 11 }}>By {s.conducted_by_name}</div>}
                  </div>
                ))}
              </div>
            ) : caseDetailLoading ? <Spinner /> : <div className="sub">Failed to load case details. <button className="btn btn-sm" onClick={() => loadCaseDetail(selectedCase)}>Retry</button></div>}
          </div>
        )}
      </div>

      {/* Case modal */}
      {showCaseModal && (
        <Modal title={showCaseModal.editing ? 'Edit Case' : 'New Guidance Case'} onClose={() => setShowCaseModal(false)}>
          <form onSubmit={saveCase}>
            <label>Student ID *<input required type="number" value={caseForm.student_id} onChange={(e) => setCaseForm((f) => ({ ...f, student_id: e.target.value }))} disabled={!!showCaseModal.editing} /></label>
            <div className="grid-2" style={{ gap: 12 }}>
              <label>Case Type<select value={caseForm.case_type} onChange={(e) => setCaseForm((f) => ({ ...f, case_type: e.target.value }))}>
                {CASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select></label>
              <label>Priority<select value={caseForm.priority} onChange={(e) => setCaseForm((f) => ({ ...f, priority: e.target.value }))}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select></label>
            </div>
            <label>Summary<textarea rows={3} value={caseForm.summary} onChange={(e) => setCaseForm((f) => ({ ...f, summary: e.target.value }))} placeholder="Brief description of the case…" /></label>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowCaseModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Session modal */}
      {showSessionModal && (
        <Modal title="Add Counseling Session" onClose={() => setShowSessionModal(null)}>
          <form onSubmit={saveSession}>
            <label>Session Type *<select required value={sessionForm.session_type} onChange={(e) => setSessionForm((f) => ({ ...f, session_type: e.target.value }))}>
              {SESSION_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select></label>
            <label>Date<input type="datetime-local" value={sessionForm.session_date} onChange={(e) => setSessionForm((f) => ({ ...f, session_date: e.target.value }))} /></label>
            <label>Session Notes *<textarea rows={4} required value={sessionForm.notes} onChange={(e) => setSessionForm((f) => ({ ...f, notes: e.target.value }))} placeholder="What was discussed…" /></label>
            <label>Action Items<textarea rows={2} value={sessionForm.action_items} onChange={(e) => setSessionForm((f) => ({ ...f, action_items: e.target.value }))} placeholder="Follow-up steps…" /></label>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowSessionModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
