import { useEffect, useState, useCallback } from 'react';
import { Shield, Download, Trash2, AlertTriangle, CheckCircle2, XCircle, Eye, Users, ChevronLeft, ChevronRight, FileText, Edit2 } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Badge, Modal, Empty, ErrorBanner, Spinner, ConfirmModal } from '../components/ui';
import { useAuth, can } from '../lib/auth';

const TABS = [
  { key: 'retention', label: 'Data Retention' },
  { key: 'erasure', label: 'Erasure Requests' },
  { key: 'audit', label: 'Access Audit Logs' },
  { key: 'roles', label: 'Role Permission Reviews' },
  { key: 'consent', label: 'Consent Forms' },
];

const STATUS_BADGE = {
  pending: 'badge-yellow',
  approved: 'badge-green',
  rejected: 'badge-red',
};

export default function Privacy() {
  const { user } = useAuth();
  const isSuperAdmin = can(user?.role, 'super_admin');

  const [tab, setTab] = useState('retention');
  const [error, setError] = useState(null);

  const [policies, setPolicies] = useState([]);
  const [policiesLoading, setPoliciesLoading] = useState(true);
  const [purgeResult, setPurgeResult] = useState(null);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [purgeBusy, setPurgeBusy] = useState(null);

  const [erasureRequests, setErasureRequests] = useState([]);
  const [erasureLoading, setErasureLoading] = useState(true);
  const [showErasureModal, setShowErasureModal] = useState(false);
  const [erasureForm, setErasureForm] = useState({ student_id: '', reason: '' });
  const [students, setStudents] = useState([]);
  const [erasureBusy, setErasureBusy] = useState(false);

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditFilter, setAuditFilter] = useState('');
  const PAGE_SIZE = 50;

  const [roleUsers, setRoleUsers] = useState([]);
  const [roleLoading, setRoleLoading] = useState(true);

  const [consentForms, setConsentForms] = useState([]);
  const [consentLoading, setConsentLoading] = useState(true);
  const [consentCounts, setConsentCounts] = useState([]);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [editingForm, setEditingForm] = useState(null);
  const [consentForm, setConsentForm] = useState({ title: '', description: '', content: '', form_type: 'custom', is_active: true, require_sign: true });
  const [consentBusy, setConsentBusy] = useState(false);

  const [exportBusy, setExportBusy] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const loadPolicies = useCallback(async () => {
    setPoliciesLoading(true);
    setError(null);
    try {
      const res = await api('/privacy/retention');
      setPolicies(res.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setPoliciesLoading(false);
    }
  }, []);

  const loadErasure = useCallback(async () => {
    setErasureLoading(true);
    setError(null);
    try {
      const res = await api('/privacy/erasure-requests');
      setErasureRequests(res.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setErasureLoading(false);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    setError(null);
    try {
      const offset = (auditPage - 1) * PAGE_SIZE;
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (auditFilter) params.set('filter', auditFilter);
      const res = await api(`/privacy/access-logs?${params}`);
      setAuditLogs(res.data || []);
      setAuditTotal(res.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setAuditLoading(false);
    }
  }, [auditPage, auditFilter]);

  const loadRoles = useCallback(async () => {
    setRoleLoading(true);
    setError(null);
    try {
      const res = await api('/privacy/role-reviews');
      setRoleUsers(res.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setRoleLoading(false);
    }
  }, []);

  const loadConsent = useCallback(async () => {
    setConsentLoading(true);
    setError(null);
    try {
      const [formsRes, countsRes] = await Promise.all([
        api('/consents/forms'),
        api('/consents/responses/counts'),
      ]);
      setConsentForms(formsRes.data || []);
      setConsentCounts(countsRes.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setConsentLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'retention') loadPolicies();
    if (tab === 'erasure') loadErasure();
    if (tab === 'audit') loadAudit();
    if (tab === 'roles') loadRoles();
    if (tab === 'consent') loadConsent();
  }, [tab, loadPolicies, loadErasure, loadAudit, loadRoles, loadConsent]);

  useEffect(() => {
    if (tab === 'audit') loadAudit();
  }, [tab, auditPage, auditFilter, loadAudit]);

  async function purgeNow(policy) {
    setPurgeBusy(policy.id);
    setPurgeResult(null);
    setError(null);
    try {
      const res = await api(`/privacy/retention/${policy.id}/purge`, { method: 'POST' });
      setPurgeResult({ id: policy.id, count: res.purged || 0 });
      loadPolicies();
    } catch (e) {
      setError(e.message);
    } finally {
      setPurgeBusy(null);
    }
  }

  async function togglePolicy(p) {
    setError(null);
    try {
      await api(`/privacy/retention/${p.id}`, {
        method: 'PATCH',
        body: { enabled: !p.enabled },
      });
      loadPolicies();
    } catch (e) {
      setError(e.message);
    }
  }

  async function savePolicyDays(p, days) {
    setError(null);
    try {
      await api(`/privacy/retention/${p.id}`, {
        method: 'PATCH',
        body: { retention_days: Number(days) },
      });
      setEditingPolicy(null);
      loadPolicies();
    } catch (e) {
      setError(e.message);
    }
  }

  async function createErasureRequest(e) {
    e.preventDefault();
    setErasureBusy(true);
    setError(null);
    try {
      await api('/privacy/erasure-requests', {
        method: 'POST',
        body: { student_id: erasureForm.student_id, reason: erasureForm.reason },
      });
      setShowErasureModal(false);
      setErasureForm({ student_id: '', reason: '' });
      loadErasure();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setErasureBusy(false);
    }
  }

  async function loadStudents() {
    try {
      const res = await api('/students?limit=500');
      setStudents(res.data || []);
    } catch {}
  }

  function openErasureModal() {
    setErasureForm({ student_id: '', reason: '' });
    setShowErasureModal(true);
    loadStudents();
  }

  async function exportPii(req) {
    setExportBusy(req.id);
    setError(null);
    try {
      const res = await api(`/privacy/erasure-requests/${req.id}/export`);
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pii-export-${req.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setExportBusy(null);
    }
  }

  async function approveErase(req) {
    setConfirmAction({ message: 'This will permanently erase student PII. Continue?', action: async () => {
      setError(null);
      try {
        await api(`/privacy/erasure-requests/${req.id}/approve`, { method: 'POST' });
        loadErasure();
      } catch (e) {
        setError(e.message);
      }
    } });
  }

  async function suspendUser(u) {
    setConfirmAction({ message: `Suspend user ${u.username}?`, action: async () => {
      setError(null);
      try {
        await api(`/privacy/role-reviews/${u.id}/suspend`, { method: 'POST' });
        loadRoles();
      } catch (e) {
        setError(e.message);
      }
    } });
  }

  async function restoreUser(u) {
    setError(null);
    try {
      await api(`/privacy/role-reviews/${u.id}/restore`, { method: 'POST' });
      loadRoles();
    } catch (e) {
      setError(e.message);
    }
  }

  function openConsentModal(form) {
    if (form) {
      setEditingForm(form);
      setConsentForm({ title: form.title, description: form.description || '', content: form.content, form_type: form.form_type, is_active: form.is_active, require_sign: form.require_sign });
    } else {
      setEditingForm(null);
      setConsentForm({ title: '', description: '', content: '', form_type: 'custom', is_active: true, require_sign: true });
    }
    setShowConsentModal(true);
  }

  async function saveConsentForm(e) {
    e.preventDefault();
    setConsentBusy(true);
    setError(null);
    try {
      const body = { ...consentForm };
      if (editingForm) {
        await api(`/consents/forms/${editingForm.id}`, { method: 'PATCH', body });
      } else {
        await api('/consents/forms', { method: 'POST', body });
      }
      setShowConsentModal(false);
      setEditingForm(null);
      setConsentForm({ title: '', description: '', content: '', form_type: 'custom', is_active: true, require_sign: true });
      loadConsent();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setConsentBusy(false);
    }
  }

  async function deleteConsentForm(form) {
    setConfirmAction({ message: `Delete form "${form.title}"? This cannot be undone.`, action: async () => {
      setError(null);
      try {
        await api(`/consents/forms/${form.id}`, { method: 'DELETE' });
        loadConsent();
      } catch (e) {
        setError(e.message);
      }
    } });
  }

  function passwordExpired(dateStr) {
    if (!dateStr) return true;
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = (now - d) / (1000 * 60 * 60 * 24);
    return diffDays > 90;
  }

  return (
    <div>
      <PageHead title="Privacy & Data Compliance" sub="Data retention, right-to-access/erasure, and access audit (RA 10173)" />
      <ErrorBanner error={error} />

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`btn ${tab === t.key ? 'btn-primary' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'retention' && (
        <div className="card">
          <h3><Shield size={16} style={{ verticalAlign: -2, marginRight: 6 }} />Data Retention Policies</h3>
          <p className="sub" style={{ marginTop: 0 }}>Control how long different types of data are kept</p>
          {policiesLoading ? <Spinner /> : policies.length === 0 ? <Empty text="No retention policies configured." /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Entity</th>
                    <th>Retention (days)</th>
                    <th>Enabled</th>
                    <th>Last Purged</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.entity}</strong></td>
                      <td>
                        {editingPolicy === p.id ? (
                          <form onSubmit={(e) => { e.preventDefault(); savePolicyDays(p, e.target.days.value); }} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                            <input name="days" type="number" defaultValue={p.retention_days} className="input" style={{ width: 80 }} min={1} />
                            <button className="btn btn-sm btn-primary" type="submit">Save</button>
                            <button className="btn btn-sm" type="button" onClick={() => setEditingPolicy(null)}>Cancel</button>
                          </form>
                        ) : (
                          <span style={{ cursor: 'pointer' }} onClick={() => setEditingPolicy(p.id)}>
                            {p.retention_days} days <span className="muted">(edit)</span>
                          </span>
                        )}
                      </td>
                      <td>
                        <button className="btn btn-sm" onClick={() => togglePolicy(p)}>
                          {p.enabled ? <CheckCircle2 size={14} color="var(--success)" /> : <XCircle size={14} color="var(--danger)" />}
                          {p.enabled ? ' Enabled' : ' Disabled'}
                        </button>
                      </td>
                      <td style={{ fontSize: 13 }}>{p.last_purged_at ? p.last_purged_at.replace('T', ' ').slice(0, 16) : '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-sm btn-danger"
                          disabled={purgeBusy === p.id}
                          onClick={() => purgeNow(p)}
                        >
                          <Trash2 size={13} />
                          {purgeBusy === p.id ? ' Purging...' : ' Purge Now'}
                        </button>
                        {purgeResult && purgeResult.id === p.id && (
                          <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--success)' }}>
                            {purgeResult.count} records purged
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'erasure' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0 }}><AlertTriangle size={16} style={{ verticalAlign: -2, marginRight: 6 }} />Erasure Requests</h3>
              <p className="sub" style={{ margin: '4px 0 0' }}>Manage right-to-erasure requests under RA 10173</p>
            </div>
            <button className="btn btn-primary" onClick={openErasureModal}>+ New Request</button>
          </div>
          {erasureLoading ? <Spinner /> : erasureRequests.length === 0 ? <Empty text="No erasure requests yet." /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Status</th>
                    <th>Requested By</th>
                    <th>Created</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {erasureRequests.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.student_name || `Student #${r.student_id}`}</strong></td>
                      <td><span className={`badge ${STATUS_BADGE[r.status] || 'badge-gray'}`}>{r.status}</span></td>
                      <td>{r.requested_by_name || r.requested_by}</td>
                      <td style={{ fontSize: 13 }}>{r.created_at?.replace('T', ' ').slice(0, 16)}</td>
                      <td className="row-actions">
                        <button
                          className="btn btn-sm"
                          disabled={exportBusy === r.id}
                          onClick={() => exportPii(r)}
                          title="Export PII"
                        >
                          <Download size={13} /> {exportBusy === r.id ? '...' : 'Export PII'}
                        </button>
                        {isSuperAdmin && r.status === 'pending' && (
                          <button
                            className="btn btn-sm btn-primary"
                            style={{ marginLeft: 4 }}
                            onClick={() => approveErase(r)}
                          >
                            Approve & Process
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div className="card">
          <h3><Eye size={16} style={{ verticalAlign: -2, marginRight: 6 }} />Access Audit Logs</h3>
          <p className="sub" style={{ marginTop: 0 }}>Track who accessed student records</p>
          <div style={{ marginBottom: 12 }}>
            <input
              className="input"
              style={{ maxWidth: 300 }}
              placeholder="Filter by student or user..."
              value={auditFilter}
              onChange={(e) => { setAuditFilter(e.target.value); setAuditPage(1); }}
            />
          </div>
          {auditLoading ? <Spinner /> : auditLogs.length === 0 ? <Empty text="No access logs found." /> : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>User</th>
                      <th>Student</th>
                      <th>Action</th>
                      <th>IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{r.created_at?.replace('T', ' ').slice(0, 19)}</td>
                        <td>{r.username || '—'}</td>
                        <td>{r.student_name || `#${r.student_id || '—'}`}</td>
                        <td><strong style={{ fontSize: 12.5 }}>{r.action}</strong></td>
                        <td style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{r.ip_address || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <span className="muted" style={{ fontSize: 13 }}>
                  Page {auditPage} of {Math.max(1, Math.ceil(auditTotal / PAGE_SIZE))} ({auditTotal} total)
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="btn btn-sm"
                    disabled={auditPage <= 1}
                    onClick={() => setAuditPage((p) => p - 1)}
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <button
                    className="btn btn-sm"
                    disabled={auditPage >= Math.ceil(auditTotal / PAGE_SIZE)}
                    onClick={() => setAuditPage((p) => p + 1)}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'roles' && (
        <div className="card">
          <h3><Users size={16} style={{ verticalAlign: -2, marginRight: 6 }} />Role Permission Reviews</h3>
          <p className="sub" style={{ marginTop: 0 }}>Periodic review of user access and permissions</p>
          {roleLoading ? <Spinner /> : roleUsers.length === 0 ? <Empty text="No users found." /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>MFA</th>
                    <th>Last Password Change</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {roleUsers.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{u.username}</td>
                      <td><strong>{u.name}</strong></td>
                      <td><Badge status={u.role?.replace(/_/g, ' ')} /></td>
                      <td>
                        {u.mfa_enabled ? (
                          <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={13} /> Enabled
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <XCircle size={13} /> Off
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {passwordExpired(u.last_password_change) ? (
                          <span style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <AlertTriangle size={13} /> Expired
                          </span>
                        ) : (
                          u.last_password_change?.slice(0, 10) || '—'
                        )}
                      </td>
                      <td><Badge status={u.status || 'active'} /></td>
                      <td style={{ textAlign: 'right' }}>
                        {u.id !== user?.id && (
                          u.status === 'suspended' ? (
                            <button className="btn btn-sm btn-primary" onClick={() => restoreUser(u)}>Restore</button>
                          ) : (
                            <button className="btn btn-sm btn-danger" onClick={() => suspendUser(u)}>Suspend</button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'consent' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0 }}><FileText size={16} style={{ verticalAlign: -2, marginRight: 6 }} />Consent Forms</h3>
              <p className="sub" style={{ margin: '4px 0 0' }}>Manage consent forms and track user responses</p>
            </div>
            <button className="btn btn-primary" onClick={() => openConsentModal(null)}>+ New Form</button>
          </div>
          {consentCounts.length > 0 && (
            <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-dim)' }}>
              Response counts: {consentCounts.map((c) => (
                <span key={c.id} style={{ marginRight: 14 }}><strong>{c.title}</strong>: {c.n}</span>
              ))}
            </div>
          )}
          {consentLoading ? <Spinner /> : consentForms.length === 0 ? <Empty text="No consent forms yet." /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Active</th>
                    <th>Require Sign</th>
                    <th>Responses</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {consentForms.map((f) => (
                    <tr key={f.id}>
                      <td><strong>{f.title}</strong></td>
                      <td><Badge status={f.form_type?.replace(/_/g, ' ')} /></td>
                      <td>
                        <span style={{ color: f.is_active ? 'var(--success)' : 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                          {f.is_active ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                          {f.is_active ? ' Yes' : ' No'}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{f.require_sign ? 'Yes' : 'No'}</td>
                      <td><strong>{f.response_count}</strong></td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-sm" onClick={() => openConsentModal(f)} style={{ marginRight: 4 }}>
                          <Edit2 size={13} /> Edit
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteConsentForm(f)}>
                          <Trash2 size={13} /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showErasureModal && (
        <Modal title="New Erasure Request" sub="Submit a right-to-erasure request for a student record" onClose={() => setShowErasureModal(false)}>
          <form onSubmit={createErasureRequest}>
            <label>Student *</label>
            <select
              className="input"
              required
              value={erasureForm.student_id}
              onChange={(e) => setErasureForm({ ...erasureForm, student_id: e.target.value })}
            >
              <option value="">— select student —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} — {s.lrn || 'No LRN'}</option>
              ))}
            </select>
            <label>Reason *</label>
            <textarea
              className="input"
              required
              rows={3}
              placeholder="Reason for erasure request..."
              value={erasureForm.reason}
              onChange={(e) => setErasureForm({ ...erasureForm, reason: e.target.value })}
            />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowErasureModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={erasureBusy}>
                {erasureBusy ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {showConsentModal && (
        <Modal title={editingForm ? 'Edit Consent Form' : 'New Consent Form'} sub={editingForm ? 'Update consent form details' : 'Create a new consent form'} onClose={() => { setShowConsentModal(false); setEditingForm(null); }}>
          <form onSubmit={saveConsentForm}>
            <label>Title *</label>
            <input
              className="input"
              required
              placeholder="Form title..."
              value={consentForm.title}
              onChange={(e) => setConsentForm({ ...consentForm, title: e.target.value })}
            />
            <label>Form Type</label>
            <select
              className="input"
              value={consentForm.form_type}
              onChange={(e) => setConsentForm({ ...consentForm, form_type: e.target.value })}
            >
              <option value="custom">Custom</option>
              <option value="data_privacy">Data Privacy</option>
              <option value="photo_video">Photo / Video</option>
              <option value="ai_usage">AI Usage</option>
            </select>
            <label>
              <input
                type="checkbox"
                checked={consentForm.is_active}
                onChange={(e) => setConsentForm({ ...consentForm, is_active: e.target.checked })}
                style={{ marginRight: 6 }}
              />
              Active
            </label>
            <label>
              <input
                type="checkbox"
                checked={consentForm.require_sign}
                onChange={(e) => setConsentForm({ ...consentForm, require_sign: e.target.checked })}
                style={{ marginRight: 6 }}
              />
              Require Signature
            </label>
            <label>Description</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Short description..."
              value={consentForm.description}
              onChange={(e) => setConsentForm({ ...consentForm, description: e.target.value })}
            />
            <label>Content *</label>
            <textarea
              className="input"
              required
              rows={6}
              placeholder="Full consent form content..."
              value={consentForm.content}
              onChange={(e) => setConsentForm({ ...consentForm, content: e.target.value })}
            />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => { setShowConsentModal(false); setEditingForm(null); }}>Cancel</button>
              <button className="btn btn-primary" disabled={consentBusy}>
                {consentBusy ? 'Saving...' : (editingForm ? 'Update Form' : 'Create Form')}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {confirmAction && <ConfirmModal message={confirmAction.message} danger onConfirm={() => { confirmAction.action(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />}
    </div>
  );
}
