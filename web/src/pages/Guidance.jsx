import { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Filter, Users, AlertTriangle, CheckCircle2, Clock, BookOpen, Heart, Briefcase, ShieldAlert, HelpCircle, BarChart3, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { PageHead, Spinner, Empty, Modal, ErrorBanner, ConfirmModal, Badge, SkeletonCards, SkeletonTable } from '../components/ui';
import { loadRecharts } from '../lib/lazy-recharts';

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'guidance'];
const CASE_TYPES = ['behavioral', 'academic', 'personal', 'career', 'bullying', 'substance', 'other'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const SESSION_TYPES = ['counseling', 'assessment', 'follow_up', 'parent_meeting', 'referral'];
const PRIORITY_COLORS = { low: 'badge-gray', normal: 'badge-blue', high: 'badge-yellow', urgent: 'badge-red' };
const PRIORITY_DOT = { low: '#94a3b8', normal: '#3b82f6', high: '#f59e0b', urgent: '#ef4444' };
const STATUS_COLORS = { open: 'badge-blue', in_progress: 'badge-yellow', resolved: 'badge-green', closed: 'badge-gray' };
const STATUS_ICON = { open: Clock, in_progress: AlertTriangle, resolved: CheckCircle2, closed: ShieldAlert };
const CASE_TYPE_ICON = { behavioral: AlertTriangle, academic: BookOpen, personal: Heart, career: Briefcase, bullying: ShieldAlert, substance: HelpCircle, other: HelpCircle };
const CASE_TYPE_COLOR = { behavioral: '#f97316', academic: '#3b82f6', personal: '#ec4899', career: '#8b5cf6', bullying: '#ef4444', substance: '#f59e0b', other: '#6b7280' };
const SESSION_COLOR = { counseling: '#3b82f6', assessment: '#8b5cf6', follow_up: '#f59e0b', parent_meeting: '#ec4899', referral: '#22c55e' };
const PIE_COLORS = ['#4D96FF', '#2FD6A0', '#F5B942', '#FB7185', '#A78BFA', '#2DD4BF', '#F97316'];
const EMPTY_CASE = { student_id: '', case_type: 'behavioral', priority: 'normal', assigned_to: '', summary: '' };
const EMPTY_SESSION = { session_type: 'counseling', notes: '', action_items: '', session_date: '' };

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="kpi-mini" style={{ borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} style={{ color }} />
        </div>
        <div>
          <div className="kpi-mini-value" style={{ color }}>{value ?? '—'}</div>
          <div className="kpi-mini-label">{label}</div>
        </div>
      </div>
    </div>
  );
}

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
  const [confirmAction, setConfirmAction] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [R, setR] = useState(null);

  useEffect(() => { loadRecharts().then(setR); }, []);
  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [c, s] = await Promise.allSettled([api('/guidance/cases'), api('/guidance/cases/summary')]);
      if (c.status === 'fulfilled') setCases(c.value.data);
      if (s.status === 'fulfilled') setSummary(s.value);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  async function loadStudents() {
    try {
      const res = await api('/students?limit=200');
      setStudents(res.data);
    } catch {}
  }

  async function openCreateCase() {
    setCaseForm({ ...EMPTY_CASE });
    setStudentSearch('');
    await loadStudents();
    setShowCaseModal({ editing: null });
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

  async function removeCase(id) {
    setConfirmAction({ message: 'Delete this case and all its sessions? This cannot be undone.', action: async () => {
      try {
        await api(`/guidance/cases/${id}`, { method: 'DELETE' });
        setCases((r) => r.filter((x) => x.id !== id));
        if (selectedCase === id) { setSelectedCase(null); setCaseDetail(null); }
        loadData();
      } catch (e2) { setError(e2.message); }
    } });
  }

  const filteredStudents = useMemo(() => {
    if (!studentSearch) return students;
    const q = studentSearch.toLowerCase();
    return students.filter((s) => `${s.last_name} ${s.first_name} ${s.lrn}`.toLowerCase().includes(q));
  }, [students, studentSearch]);

  const filtered = cases.filter((c) =>
    (!filter.status || c.status === filter.status) && (!filter.case_type || c.case_type === filter.case_type)
  );

  // Count active filters
  const activeFilters = (filter.status ? 1 : 0) + (filter.case_type ? 1 : 0);

  // Chart data
  const typeData = useMemo(() => {
    const m = {};
    cases.forEach((c) => { const t = c.case_type || 'other'; m[t] = (m[t] || 0) + 1; });
    return CASE_TYPES.filter((t) => m[t]).map((t) => ({ name: t.charAt(0).toUpperCase() + t.slice(1), value: m[t] }));
  }, [cases]);

  const priorityData = useMemo(() => {
    const m = {};
    cases.forEach((c) => { m[c.priority] = (m[c.priority] || 0) + 1; });
    return PRIORITIES.filter((p) => m[p]).map((p) => ({ name: p.charAt(0).toUpperCase() + p.slice(1), value: m[p] }));
  }, [cases]);

  const tooltipStyle = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 };

  if (loading) return (<><SkeletonCards count={4} /><div style={{ marginTop: 16 }}><SkeletonTable rows={5} cols={4} /></div></>);

  const summaryTotal = summary?.total ?? cases.length;
  const byStatus = {};
  (summary?.by_status || []).forEach((s) => { byStatus[s.status] = s.count; });

  return (
    <div>
      <PageHead title="Guidance Office" sub="Student case management and counseling sessions">
        {isAdmin && <button className="btn btn-primary" onClick={openCreateCase}><Plus size={15} /> New Case</button>}
      </PageHead>
      <ErrorBanner error={error} />

      {/* KPI Cards */}
      <div className="kpi-row" style={{ marginBottom: 14 }}>
        <StatCard icon={Users} label="Total Cases" value={summaryTotal} color="#3b82f6" />
        <StatCard icon={Clock} label="Open" value={byStatus.open ?? 0} color="#f59e0b" />
        <StatCard icon={AlertTriangle} label="In Progress" value={byStatus.in_progress ?? 0} color="#8b5cf6" />
        <StatCard icon={CheckCircle2} label="Resolved" value={byStatus.resolved ?? 0} color="#22c55e" />
        <StatCard icon={ShieldAlert} label="Closed" value={byStatus.closed ?? 0} color="#6b7280" />
      </div>

      {/* Charts */}
      {R && cases.length > 0 && (
        <div className="grid grid-2" style={{ marginBottom: 14 }}>
          <div className="card" style={{ padding: 14 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 13.5 }}><BarChart3 size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Cases by Type</h4>
            <div style={{ height: 180 }}>
              <R.ResponsiveContainer width="100%" height="100%">
                <R.PieChart>
                  <R.Pie data={typeData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={3} stroke="var(--card)">
                    {typeData.map((d, i) => <R.Cell key={d.name} fill={CASE_TYPE_COLOR[d.name.toLowerCase()] || PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </R.Pie>
                  <R.Tooltip contentStyle={tooltipStyle} />
                  <R.Legend wrapperStyle={{ fontSize: 11 }} />
                </R.PieChart>
              </R.ResponsiveContainer>
            </div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 13.5 }}><TrendingUp size={14} style={{ verticalAlign: -2, marginRight: 4 }} />By Priority</h4>
            <div style={{ height: 180 }}>
              <R.ResponsiveContainer width="100%" height="100%">
                <R.BarChart data={priorityData}>
                  <R.CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" vertical={false} />
                  <R.XAxis dataKey="name" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
                  <R.YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} allowDecimals={false} />
                  <R.Tooltip contentStyle={tooltipStyle} />
                  <R.Bar dataKey="value" name="Cases" radius={[4, 4, 0, 0]}>
                    {priorityData.map((d) => <R.Cell key={d.name} fill={PRIORITY_DOT[d.name.toLowerCase()] || '#94a3b8'} />)}
                  </R.Bar>
                </R.BarChart>
              </R.ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="form-row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Filter size={14} /> Filters {activeFilters > 0 && <span className="count-pill">{activeFilters}</span>}
          </span>
          <label style={{ margin: 0 }}>Status
            <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))} style={{ marginTop: 4 }}>
              <option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </label>
          <label style={{ margin: 0 }}>Type
            <select value={filter.case_type} onChange={(e) => setFilter((f) => ({ ...f, case_type: e.target.value }))} style={{ marginTop: 4 }}>
              <option value="">All</option>{CASE_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </label>
          {activeFilters > 0 && <button className="btn btn-sm" onClick={() => setFilter({ status: '', case_type: '' })}>Clear</button>}
          <span className="sub" style={{ marginLeft: 'auto', fontSize: 12 }}>{filtered.length} case(s)</span>
        </div>
      </div>

      {/* Split view */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedCase ? 'minmax(340px, 1fr) minmax(340px, 1.2fr)' : '1fr', gap: 16 }}>
        {/* Case list */}
        <div>
          {filtered.length === 0 ? <Empty text="No guidance cases." /> : filtered.map((c) => {
            const TypeIcon = CASE_TYPE_ICON[c.case_type] || HelpCircle;
            const StatusIcon = STATUS_ICON[c.status] || Clock;
            return (
              <div key={c.id} className="card" style={{
                cursor: 'pointer', marginBottom: 12, transition: 'box-shadow 0.15s, border-color 0.15s',
                border: selectedCase === c.id ? '2px solid var(--accent)' : '2px solid transparent',
                borderLeft: `4px solid ${PRIORITY_DOT[c.priority] || '#94a3b8'}`,
              }} onClick={() => { setSelectedCase(c.id); loadCaseDetail(c.id); }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: `${CASE_TYPE_COLOR[c.case_type] || '#6b7280'}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <TypeIcon size={13} style={{ color: CASE_TYPE_COLOR[c.case_type] || '#6b7280' }} />
                      </div>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{c.student_name || `Student #${c.student_id}`}</h4>
                    </div>
                    <div className="sub" style={{ fontSize: 12 }}>{c.grade_level} {c.section_name ? `· ${c.section_name}` : ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <span className={`badge ${PRIORITY_COLORS[c.priority]}`}>{c.priority}</span>
                    <span className={`badge ${STATUS_COLORS[c.status]}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <StatusIcon size={10} />{c.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 12, color: 'var(--text-dim)', flexWrap: 'wrap' }}>
                  <span className="badge badge-gray">{c.case_type}</span>
                  {c.opened_by_name && <span>by {c.opened_by_name}</span>}
                  {c.assigned_to_name && <span>→ {c.assigned_to_name}</span>}
                </div>
                {c.summary && <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '6px 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.45 }}>{c.summary}</p>}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                  <button className="btn btn-sm" onClick={() => { setCaseForm({ student_id: c.student_id, case_type: c.case_type, priority: c.priority, assigned_to: c.assigned_to || '', summary: c.summary || '' }); setShowCaseModal({ editing: c.id }); }}><Pencil size={12} /></button>
                  {c.status === 'open' && <button className="btn btn-sm" style={{ background: 'var(--accent)', color: '#fff' }} onClick={() => updateCaseStatus(c.id, 'in_progress')}>Start</button>}
                  {c.status === 'in_progress' && <button className="btn btn-sm" style={{ background: 'var(--success)', color: '#fff' }} onClick={() => updateCaseStatus(c.id, 'resolved')}>Resolve</button>}
                  <button className="btn btn-sm btn-danger" onClick={() => removeCase(c.id)}><Trash2 size={12} /></button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Case detail */}
        {selectedCase && (
          <div>
            {caseDetail ? (
              <div className="card" style={{ position: 'sticky', top: 80 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: '0 0 2px' }}>{caseDetail.student_name}</h3>
                    <div className="sub" style={{ fontSize: 12 }}>{caseDetail.grade_level} {caseDetail.section_name ? `· ${caseDetail.section_name}` : ''}</div>
                  </div>
                  <button className="btn btn-sm" onClick={() => { setSelectedCase(null); setCaseDetail(null); }}>✕</button>
                </div>
                <div style={{ display: 'flex', gap: 6, margin: '10px 0', flexWrap: 'wrap' }}>
                  <span className={`badge ${PRIORITY_COLORS[caseDetail.priority]}`}>{caseDetail.priority}</span>
                  <span className={`badge ${STATUS_COLORS[caseDetail.status]}`}>{caseDetail.status.replace('_', ' ')}</span>
                  <span className="badge badge-gray">{caseDetail.case_type}</span>
                  {caseDetail.assigned_to_name && <span className="badge badge-gray">Assigned: {caseDetail.assigned_to_name}</span>}
                </div>
                {caseDetail.summary && (
                  <div style={{ background: 'var(--bg-soft, #f8fafc)', borderRadius: 8, padding: 10, fontSize: 13, lineHeight: 1.5, color: 'var(--text)', marginTop: 8, whiteSpace: 'pre-wrap' }}>
                    {caseDetail.summary}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => { setSessionForm({ ...EMPTY_SESSION }); setShowSessionModal(selectedCase); }}><Plus size={12} /> Add Session</button>
                </div>

                {/* Session timeline */}
                <h4 style={{ margin: '18px 0 10px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                  Session History <span className="sub">({caseDetail.sessions?.length || 0})</span>
                </h4>
                {caseDetail.sessions?.length === 0 ? (
                  <div className="sub" style={{ padding: 12 }}>No sessions recorded yet.</div>
                ) : caseDetail.sessions?.map((s, idx) => (
                  <div key={s.id} style={{ position: 'relative', paddingLeft: 20, marginBottom: 14 }}>
                    <div style={{ position: 'absolute', left: 4, top: 0, bottom: 0, width: 2, background: idx < (caseDetail.sessions?.length || 0) - 1 ? 'var(--border)' : 'transparent' }} />
                    <div style={{
                      position: 'absolute', left: 0, top: 6, width: 10, height: 10, borderRadius: '50%',
                      background: SESSION_COLOR[s.session_type] || '#6b7280', border: '2px solid var(--card)',
                    }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="badge badge-gray">{s.session_type.replace('_', ' ')}</span>
                      <span className="sub" style={{ fontSize: 11.5 }}>{s.session_date?.slice(0, 10)} {s.conducted_by_name ? `· by ${s.conducted_by_name}` : ''}</span>
                    </div>
                    <p style={{ fontSize: 13, margin: '4px 0', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{s.notes}</p>
                    {s.action_items && <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={11} /> {s.action_items}</div>}
                  </div>
                ))}
              </div>
            ) : caseDetailLoading ? <Spinner /> : <div className="sub">Failed to load case details. <button className="btn btn-sm" onClick={() => loadCaseDetail(selectedCase)}>Retry</button></div>}
          </div>
        )}
      </div>

      {/* Case modal */}
      {showCaseModal && (
        <Modal title={showCaseModal.editing ? 'Edit Case' : 'New Guidance Case'} onClose={() => setShowCaseModal(false)} wide>
          <form onSubmit={saveCase}>
            {!showCaseModal.editing && (
              <>
                <label>Search student</label>
                <input placeholder="Type to filter by name or LRN..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
                <label>Student *</label>
                <select required value={caseForm.student_id} onChange={(e) => setCaseForm((f) => ({ ...f, student_id: e.target.value }))}>
                  <option value="">Select student...</option>
                  {filteredStudents.slice(0, 120).map((s) => (
                    <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} · {s.grade_level} · LRN {s.lrn || '—'}</option>
                  ))}
                </select>
              </>
            )}
            {showCaseModal.editing && <input type="hidden" value={caseForm.student_id} />}
            <div className="form-row">
              <div>
                <label>Case Type *</label>
                <select value={caseForm.case_type} onChange={(e) => setCaseForm((f) => ({ ...f, case_type: e.target.value }))}>
                  {CASE_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label>Priority</label>
                <select value={caseForm.priority} onChange={(e) => setCaseForm((f) => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <label>Summary</label>
            <textarea rows={3} value={caseForm.summary} onChange={(e) => setCaseForm((f) => ({ ...f, summary: e.target.value }))} placeholder="Brief description of the case..." />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowCaseModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Session modal */}
      {showSessionModal && (
        <Modal title="Add Counseling Session" sub="Record a counseling session, assessment, or parent meeting" onClose={() => setShowSessionModal(null)}>
          <form onSubmit={saveSession}>
            <div className="form-row">
              <div>
                <label>Session Type *</label>
                <select required value={sessionForm.session_type} onChange={(e) => setSessionForm((f) => ({ ...f, session_type: e.target.value }))}>
                  {SESSION_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
                </select>
              </div>
              <div>
                <label>Date</label>
                <input type="datetime-local" value={sessionForm.session_date} onChange={(e) => setSessionForm((f) => ({ ...f, session_date: e.target.value }))} />
              </div>
            </div>
            <label>Session Notes *</label>
            <textarea rows={4} required value={sessionForm.notes} onChange={(e) => setSessionForm((f) => ({ ...f, notes: e.target.value }))} placeholder="What was discussed, observations, student response..." />
            <label>Action Items</label>
            <textarea rows={2} value={sessionForm.action_items} onChange={(e) => setSessionForm((f) => ({ ...f, action_items: e.target.value }))} placeholder="Follow-up steps, referrals, recommendations..." />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowSessionModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Session'}</button>
            </div>
          </form>
        </Modal>
      )}
      {confirmAction && <ConfirmModal message={confirmAction.message} danger onConfirm={() => { confirmAction.action(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />}
    </div>
  );
}
