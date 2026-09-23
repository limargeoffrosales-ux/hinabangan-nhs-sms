import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, ClipboardPenLine, Eye, CheckCircle2, FilePlus2, Shield, AlertTriangle, Clock, TrendingUp, BarChart3 } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Modal, Empty, ErrorBanner, Spinner, ConfirmModal, SkeletonTable } from '../components/ui';
import { useAuth } from '../lib/auth';
import { loadRecharts } from '../lib/lazy-recharts';
import { ChartTooltip, DonutChart } from '../design-system';

const TYPES = ['call_slip', 'bullying', 'inappropriate_behavior', 'fighting', 'vandalism', 'tardiness', 'disrespect', 'other'];

const SEVERITIES = ['minor', 'moderate', 'major'];
const STATUSES = ['open', 'under_review', 'resolved'];

const ACTION_TYPES = ['warning', 'counseling', 'parent_conference', 'detention', 'community_service', 'suspension', 'referral', 'other'];

const STATUS_BADGE = { open: 'badge-yellow', under_review: 'badge-blue', resolved: 'badge-green' };
const STATUS_ICON = { open: Clock, under_review: AlertTriangle, resolved: CheckCircle2 };
const SEVERITY_BADGE = { minor: 'badge-blue', moderate: 'badge-yellow', major: 'badge-red' };
const SEVERITY_COLOR = { minor: '#3b82f6', moderate: '#f59e0b', major: '#ef4444' };
const ACTION_BADGE = {
  warning: 'badge-yellow', counseling: 'badge-blue', parent_conference: 'badge-gray',
  detention: 'badge-red', community_service: 'badge-blue', suspension: 'badge-red',
  referral: 'badge-gray', other: 'badge-gray',
};
const TYPE_COLOR = {
  call_slip: '#6b7280', bullying: '#ef4444', inappropriate_behavior: '#f59e0b',
  fighting: '#dc2626', vandalism: '#8b5cf6', tardiness: '#3b82f6',
  disrespect: '#f97316', other: '#94a3b8',
};

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'guidance', 'teacher'];
const ADMIN = ['super_admin', 'school_admin', 'principal', 'assistant_principal'];
const PIE_COLORS = ['#4D96FF', '#2FD6A0', '#F5B942', '#FB7185', '#A78BFA', '#2DD4BF', '#F97316', '#6b7280'];

function fmtDate(d) {
  try { return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function StatCard({ icon: Icon, label, value, color, accent }) {
  return (
    <div className="kpi-mini" style={{ borderLeft: `3px solid ${accent || color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${accent || color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} style={{ color: accent || color }} />
        </div>
        <div>
          <div className="kpi-mini-value" style={{ color: accent || color }}>{value ?? '—'}</div>
          <div className="kpi-mini-label">{label}</div>
        </div>
      </div>
    </div>
  );
}

export default function Discipline() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = WRITE.includes(user?.role);
  const canDelete = ADMIN.includes(user?.role);

  const TYPE_LABEL = {
    call_slip: t('discipline.typeCallSlip', 'Call Slip'),
    bullying: t('discipline.typeBullying', 'Bullying'),
    inappropriate_behavior: t('discipline.typeInappropriateBehavior', 'Inappropriate Behavior'),
    fighting: t('discipline.typeFighting', 'Fighting / Physical Altercation'),
    vandalism: t('discipline.typeVandalism', 'Vandalism'),
    tardiness: t('discipline.typeTardiness', 'Chronic Tardiness'),
    disrespect: t('discipline.typeDisrespect', 'Disrespect / Defiance'),
    other: t('discipline.typeOther', 'Other'),
  };
  const SEVERITY_LABEL = {
    minor: t('discipline.severityMinor', 'Minor'),
    moderate: t('discipline.severityModerate', 'Moderate'),
    major: t('discipline.severityMajor', 'Major'),
  };
  const STATUS_LABEL = {
    open: t('discipline.statusOpen', 'Open'),
    under_review: t('discipline.statusUnderReview', 'Under review'),
    resolved: t('discipline.statusResolved', 'Resolved'),
  };
  const ACTION_LABEL = {
    warning: t('discipline.actionWarning', 'Verbal / Written Warning'),
    counseling: t('discipline.actionCounseling', 'Counseling Session'),
    parent_conference: t('discipline.actionParentConference', 'Parent Conference'),
    detention: t('discipline.actionDetention', 'Detention'),
    community_service: t('discipline.actionCommunityService', 'Community Service'),
    suspension: t('discipline.actionSuspension', 'Suspension'),
    referral: t('discipline.actionReferral', 'Referral (Guidance / Others)'),
    other: t('discipline.actionOther', 'Other Action'),
  };

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ q: '', status: '', type: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [sel, setSel] = useState(null);
  const [selLoading, setSelLoading] = useState(false);
  const [R, setR] = useState(null);

  const [createForm, setCreateForm] = useState({
    student_id: '', incident_type: 'call_slip', incident_date: today(), severity: 'minor', description: '',
  });
  const [saving, setSaving] = useState(false);

  const [actionForm, setActionForm] = useState({ action_type: 'warning', action_date: today(), notes: '' });
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => { loadRecharts().then(setR); }, []);

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
    await loadStudents();
    setShowCreate(true);
  }

  async function saveRecord(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/conduct', { method: 'POST', body: createForm });
      setShowCreate(false);
      load();
    } catch (e2) {
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
    setConfirmAction({ message: t('discipline.deleteConfirm', 'Delete the conduct record for {{name}}? This cannot be undone.', { name: r.student_name }), action: async () => {
      try {
        await api(`/conduct/${r.id}`, { method: 'DELETE' });
        setSel(null);
        load();
      } catch (e) {
        setError(e.message);
      }
    } });
  }

  const filteredStudents = useMemo(() => {
    if (!createForm.sname) return students;
    const q2 = createForm.sname.toLowerCase();
    return students.filter((s) =>
      `${s.last_name} ${s.first_name} ${s.lrn}`.toLowerCase().includes(q2));
  }, [students, createForm.sname]);

  // Chart data
  const typeData = useMemo(() => {
    const m = {};
    rows.forEach((r) => { const k = TYPE_LABEL[r.incident_type] || r.incident_type; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [rows, t]);

  const severityData = useMemo(() => {
    const m = {};
    rows.forEach((r) => { m[r.severity] = (m[r.severity] || 0) + 1; });
    return SEVERITIES.map((s) => ({ key: s, name: SEVERITY_LABEL[s], value: m[s] || 0 })).filter((d) => d.value > 0);
  }, [rows, t]);

  return (
    <>
      <PageHead title={t('discipline.title', 'Student Conduct & Discipline')} sub={t('discipline.subtitle', 'Call slips, bullying cases, and inappropriate behaviors — log incidents, track actions taken, and monitor case status')}>
        {canWrite && <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> {t('discipline.logIncident', 'Log Incident')}</button>}
      </PageHead>
      <ErrorBanner error={error} />

      {/* KPI Cards */}
      <div className="kpi-row" style={{ marginBottom: 14 }}>
        <StatCard icon={AlertTriangle} label={t('discipline.openCases', 'Open cases')} value={summary?.by_status?.open ?? 0} color="#f59e0b" accent="#f59e0b" />
        <StatCard icon={ClipboardPenLine} label={t('discipline.underReview', 'Under review')} value={summary?.by_status?.under_review ?? 0} color="#3b82f6" accent="#3b82f6" />
        <StatCard icon={CheckCircle2} label={t('discipline.resolved', 'Resolved')} value={summary?.by_status?.resolved ?? 0} color="#22c55e" accent="#22c55e" />
        <StatCard icon={TrendingUp} label={t('discipline.thisMonth', 'This month')} value={summary?.cases_this_month ?? 0} color="#8b5cf6" accent="#8b5cf6" />
        <StatCard icon={Shield} label={t('discipline.majorIncidents', 'Major incidents')} value={summary?.by_severity?.major ?? 0} color="#ef4444" accent="#ef4444" />
      </div>

      {/* Charts */}
      {R && rows.length > 0 && (
        <div className="grid grid-2" style={{ marginBottom: 14 }}>
          <div className="card" style={{ padding: 14 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 13.5 }}><BarChart3 size={14} style={{ verticalAlign: -2, marginRight: 4 }} />{t('discipline.incidentsByType', 'Incidents by Type')}</h4>
            <div style={{ height: 180 }}>
              <R.ResponsiveContainer width="100%" height="100%">
                <R.BarChart data={typeData} layout="vertical" margin={{ left: 4, right: 16 }}>
                  <R.CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" horizontal={false} />
                  <R.XAxis type="number" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} allowDecimals={false} />
                  <R.YAxis type="category" dataKey="name" width={130} tick={{ fill: 'var(--text-dim)', fontSize: 10 }} />
                  <R.Tooltip content={<ChartTooltip />} />
                  <R.Bar dataKey="value" name={t('discipline.incidentsSeries', 'Incidents')} radius={[0, 4, 4, 0]}>
                    {typeData.map((_, i) => <R.Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </R.Bar>
                </R.BarChart>
              </R.ResponsiveContainer>
            </div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 13.5 }}><Shield size={14} style={{ verticalAlign: -2, marginRight: 4 }} />{t('discipline.bySeverity', 'By Severity')}</h4>
            {severityData.filter((d) => d.value > 0).length > 0 ? (
              <DonutChart
                data={severityData.map((d) => ({ name: d.name, value: d.value, color: SEVERITY_COLOR[d.key] || '#94a3b8' }))}
                centerValue={rows.length}
                centerLabel={t('discipline.incidentsSeries', 'Incidents')}
                size={150}
                thickness={18}
              />
            ) : (
              <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 13 }}>—</div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="search-row">
        <input placeholder={t('discipline.searchPlaceholder', 'Search student name or LRN...')} value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">{t('discipline.allStatuses', 'All statuses')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
          <option value="">{t('discipline.allTypes', 'All incident types')}</option>
          {TYPES.map((k) => <option key={k} value={k}>{TYPE_LABEL[k]}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('discipline.colStudent', 'Student')}</th><th>{t('discipline.colType', 'Type')}</th><th style={{ textAlign: 'center' }}>{t('discipline.colSeverity', 'Severity')}</th>
                <th style={{ textAlign: 'center' }}>{t('discipline.colDate', 'Date')}</th><th style={{ textAlign: 'center' }}>{t('discipline.colStatus', 'Status')}</th>
                <th>{t('discipline.colReportedBy', 'Reported by')}</th><th style={{ textAlign: 'center' }}>{t('discipline.colActions', 'Actions')}</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8}><SkeletonTable rows={1} cols={8} /></td></tr> : rows.length === 0 ? (
                <tr><td colSpan={8} className="sub">{t('discipline.emptyRows', 'No conduct records match the current filters.')}</td></tr>
              ) : rows.map((r) => {
                const StatusIcon = STATUS_ICON[r.status] || Clock;
                return (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(r)}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.student_name}</div>
                      <div className="sub" style={{ fontSize: 11.5 }}>{r.grade_level || ''} {r.section_name || ''} {r.lrn ? `· LRN ${r.lrn}` : ''}</div>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: TYPE_COLOR[r.incident_type] || '#94a3b8', flexShrink: 0 }} />
                        {TYPE_LABEL[r.incident_type] || r.incident_type}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${SEVERITY_BADGE[r.severity] || 'badge-gray'}`}>{SEVERITY_LABEL[r.severity] || r.severity}</span>
                    </td>
                    <td style={{ textAlign: 'center' }} className="sub">{fmtDate(r.incident_date)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${STATUS_BADGE[r.status] || 'badge-gray'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <StatusIcon size={11} />{STATUS_LABEL[r.status] || r.status}
                      </span>
                    </td>
                    <td className="sub">{r.reported_by_name || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${r.action_count ? 'badge-blue' : 'badge-gray'}`}>{r.action_count}</span>
                    </td>
                    <td>
                      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="icon-btn" title={t('discipline.openCase', 'Open case')} aria-label={t('discipline.openCase', 'Open case')} onClick={() => openDetail(r)}><Eye size={15} aria-hidden="true" /></button>
                        {canDelete && (
                          <button className="icon-btn" title={t('discipline.delete', 'Delete')} aria-label={t('discipline.delete', 'Delete')} onClick={() => removeRecord(r)}><Trash2 size={15} aria-hidden="true" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Create Modal --- */}
      {showCreate && (
        <Modal title={t('discipline.createTitle', 'Log a conduct incident')} sub={t('discipline.createSubtitle', 'Record a call slip, bullying case, or behavioral report for monitoring')} onClose={() => setShowCreate(false)} wide>
          <form onSubmit={saveRecord}>
            <div className="form-row">
              <div>
                <label>{t('discipline.searchStudent', 'Search student')}</label>
                <input placeholder={t('discipline.searchStudentPh', 'Type to filter by name or LRN...')} value={createForm.sname || ''}
                  onChange={(e) => setCreateForm((f) => ({ ...f, sname: e.target.value }))} />
              </div>
              <div>
                <label>{t('discipline.studentRequired', 'Student *')}</label>
                <select required value={createForm.student_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, student_id: e.target.value }))}>
                  <option value="">{t('discipline.selectStudent', 'Select student...')}</option>
                  {filteredStudents.slice(0, 120).map((s) => (
                    <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} · LRN {s.lrn || '—'}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div>
                <label>{t('discipline.incidentTypeRequired', 'Incident type *')}</label>
                <select required value={createForm.incident_type}
                  onChange={(e) => setCreateForm((f) => ({ ...f, incident_type: e.target.value }))}>
                  {TYPES.map((k) => <option key={k} value={k}>{TYPE_LABEL[k]}</option>)}
                </select>
              </div>
              <div>
                <label>{t('discipline.colSeverity', 'Severity')}</label>
                <select value={createForm.severity} onChange={(e) => setCreateForm((f) => ({ ...f, severity: e.target.value }))}>
                  {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
                </select>
              </div>
              <div>
                <label>{t('discipline.incidentDateRequired', 'Incident date *')}</label>
                <input type="date" required value={createForm.incident_date}
                  onChange={(e) => setCreateForm((f) => ({ ...f, incident_date: e.target.value }))} />
              </div>
            </div>
            <label>{t('discipline.whatHappened', 'What happened?')}</label>
            <textarea rows={3} placeholder={t('discipline.descriptionPh', 'Describe the incident, witnesses, and context...')} value={createForm.description}
              onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowCreate(false)}>{t('discipline.cancel', 'Cancel')}</button>
              <button className="btn btn-primary" disabled={saving}>{saving ? t('discipline.saving', 'Saving...') : t('discipline.saveRecord', 'Save Record')}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* --- Detail Modal --- */}
      {sel && (
        <Modal title={t('discipline.detailTitle', 'Conduct case')} sub={`${sel.student_name} · LRN ${sel.lrn || '—'} · ${sel.grade_level || ''} ${sel.section_name ? '· ' + sel.section_name : ''}`} onClose={() => setSel(null)} wide>
          {selLoading ? <Spinner /> : (
            <>
              {/* Case header */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: TYPE_COLOR[sel.incident_type] || '#94a3b8' }} />
                  <strong style={{ fontSize: 14 }}>{TYPE_LABEL[sel.incident_type] || sel.incident_type}</strong>
                </div>
                <span className={`badge ${SEVERITY_BADGE[sel.severity] || 'badge-gray'}`}>{SEVERITY_LABEL[sel.severity] || sel.severity}</span>
                <span className={`badge ${STATUS_BADGE[sel.status] || 'badge-gray'}`}>{STATUS_LABEL[sel.status] || sel.status}</span>
                <span className="sub" style={{ fontSize: 12, marginLeft: 'auto' }}>
                  {t('discipline.openDays', 'Open {{days}} day(s) · Logged {{date}}', { days: sel.days_open, date: sel.created_at?.slice(0, 10) })}
                </span>
              </div>

              {/* Editable fields */}
              <div className="conduct-detail">
                <div className="form-row">
                  <div>
                    <label>{t('discipline.colType', 'Type')}</label>
                    <select value={sel.incident_type} onChange={(e) => updateSel({ incident_type: e.target.value })}>
                      {TYPES.map((k) => <option key={k} value={k}>{TYPE_LABEL[k]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>{t('discipline.colSeverity', 'Severity')}</label>
                    <select value={sel.severity} onChange={(e) => updateSel({ severity: e.target.value })}>
                      {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>{t('discipline.colDate', 'Date')}</label>
                    <input type="date" value={sel.incident_date} onChange={(e) => updateSel({ incident_date: e.target.value })} />
                  </div>
                  <div>
                    <label>{t('discipline.colStatus', 'Status')}</label>
                    <select value={sel.status} onChange={(e) => updateSel({ status: e.target.value })}>
                      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </div>
                </div>
                <label>{t('discipline.labelDescription', 'Description')}</label>
                <textarea rows={3} defaultValue={sel.description || ''} placeholder={t('discipline.noDescription', 'No description recorded')}
                  onBlur={(e) => { if (e.target.value !== (sel.description || '')) updateSel({ description: e.target.value }); }} />
                <div className="sub">{t('discipline.reportedBy', 'Reported by {{name}}', { name: sel.reported_by_name || '—' })}</div>
              </div>

              {/* Action timeline */}
              <h4 style={{ margin: '18px 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ClipboardPenLine size={15} /> {t('discipline.actionsTaken', 'Actions taken')} <span className="sub">({sel.actions?.length || 0})</span>
              </h4>
              {!sel.actions?.length ? <Empty text={t('discipline.emptyActions', 'No actions recorded yet — add an intervention below.')} /> : (
                <div className="conduct-timeline">
                  {sel.actions.map((a, idx) => (
                    <div className="conduct-ev" key={a.id} style={{ position: 'relative', paddingLeft: 20 }}>
                      <div style={{
                        position: 'absolute', left: 4, top: 0, bottom: 0, width: 2,
                        background: idx < (sel.actions?.length || 0) - 1 ? 'var(--border)' : 'transparent',
                      }} />
                      <div style={{
                        position: 'absolute', left: 0, top: 6, width: 10, height: 10, borderRadius: '50%',
                        background: ACTION_BADGE[a.action_type] === 'badge-red' ? '#ef4444' :
                          ACTION_BADGE[a.action_type] === 'badge-blue' ? '#3b82f6' :
                          ACTION_BADGE[a.action_type] === 'badge-yellow' ? '#f59e0b' : '#6b7280',
                        border: '2px solid var(--card)',
                      }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className={`badge ${ACTION_BADGE[a.action_type] || 'badge-gray'}`}>{ACTION_LABEL[a.action_type] || a.action_type}</span>
                        <span className="sub" style={{ fontSize: 11.5 }}>{fmtDate(a.action_date)} · {t('discipline.byActor', 'by {{name}}', { name: a.done_by_name || '—' })}</span>
                      </div>
                      <div className="conduct-ev-note" style={{ marginTop: 4 }}>{a.notes || '—'}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add action form */}
              <form onSubmit={addAction}>
                <div className="form-row" style={{ marginTop: 14 }}>
                  <div>
                    <label>{t('discipline.labelActionTaken', 'Action taken')}</label>
                    <select required value={actionForm.action_type} onChange={(e) => setActionForm((a) => ({ ...a, action_type: e.target.value }))}>
                      {ACTION_TYPES.map((k) => <option key={k} value={k}>{ACTION_LABEL[k]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>{t('discipline.colDate', 'Date')}</label>
                    <input type="date" required value={actionForm.action_date} onChange={(e) => setActionForm((a) => ({ ...a, action_date: e.target.value }))} />
                  </div>
                  <div>
                    <label>{t('discipline.labelNotes', 'Notes')}</label>
                    <input placeholder={t('discipline.notesPh', 'Outcome, commitment, next steps...')} value={actionForm.notes}
                      onChange={(e) => setActionForm((a) => ({ ...a, notes: e.target.value }))} />
                  </div>
                </div>
                <div className="modal-actions">
                  {canDelete && (
                    <button type="button" className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => removeRecord(sel)}>
                      <Trash2 size={14} /> {t('discipline.delete', 'Delete')}
                    </button>
                  )}
                  <button type="button" className="btn" onClick={() => setSel(null)}>{t('discipline.close', 'Close')}</button>
                  <button className="btn btn-primary"><FilePlus2 size={14} /> {t('discipline.recordAction', 'Record Action')}</button>
                </div>
              </form>
              {sel.status === 'open' && (
                <div className="sub" style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                  {t('discipline.hintStart', 'Logging an action automatically moves this case to')}{' '}
                  <strong>{t('discipline.statusUnderReview', 'Under review')}</strong>
                  {t('discipline.hintMiddle', '. Set it to')}{' '}
                  <strong>{t('discipline.statusResolved', 'Resolved')}</strong>{' '}
                  {t('discipline.hintEnd', 'once the intervention is complete.')}
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
