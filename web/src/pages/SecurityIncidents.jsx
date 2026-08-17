import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, AlertTriangle, CheckCircle2, XCircle, Trash2, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Empty, ErrorBanner, Spinner } from '../components/ui';

const SEVERITY_CLS = {
  low: 'badge-blue',
  medium: 'badge-yellow',
  high: 'badge-red',
  critical: 'badge-red',
};

function stringifyDetails(d) {
  if (!d) return '—';
  try {
    const obj = typeof d === 'string' ? JSON.parse(d) : d;
    return JSON.stringify(obj, null, 2);
  } catch {
    return typeof d === 'string' ? d : String(d);
  }
}

export default function SecurityIncidents() {
  const { t } = useTranslation();
  const [incidents, setIncidents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('unresolved');
  const [typeFilter, setTypeFilter] = useState('');
  const [types, setTypes] = useState([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter === 'unresolved') params.set('resolved', 'false');
      if (typeFilter) params.set('type', typeFilter);
      const res = await api(`/security-incidents?${params.toString()}`);
      setIncidents(res.data || []);
      const uniqueTypes = [...new Set((res.data || []).map((i) => i.incident_type))];
      setTypes(uniqueTypes);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary() {
    try {
      const res = await api('/security-incidents/stats');
      setSummary(res);
    } catch {}
  }

  useEffect(() => { load(); loadSummary(); }, [filter, typeFilter]);

  async function resolve(id) {
    if (!confirm(t('si.resolveConfirm'))) return;
    setError(null);
    try {
      await api(`/security-incidents/${id}/resolve`, { method: 'PATCH' });
      load();
      loadSummary();
    } catch (e) {
      setError(e.message);
    }
  }

  async function purgeOld() {
    if (!confirm(t('si.purgeConfirm'))) return;
    setError(null);
    try {
      const res = await api('/security-incidents/purge-old', { method: 'DELETE' });
      alert(`Purged ${res.deleted} incidents older than ${res.retentionDays} days`);
      load();
      loadSummary();
    } catch (e) {
      setError(e.message);
    }
  }

  function formatTime(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString();
  }

  return (
    <div>
      <PageHead title={t('si.title')} sub={t('si.subtitle')} />
      <ErrorBanner error={error} />

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--red, #ef4444)' }}>{summary?.unresolved ?? '—'}</div>
          <div className="sub" style={{ marginTop: 2 }}>{t('si.unresolved')}</div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--amber, #f59e0b)' }}>{summary?.today ?? '—'}</div>
          <div className="sub" style={{ marginTop: 2 }}>{t('si.today')}</div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--red, #ef4444)' }}>{summary?.highSeverity ?? '—'}</div>
          <div className="sub" style={{ marginTop: 2 }}>{t('si.high')}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className={`btn ${filter === 'unresolved' ? 'btn-primary' : ''}`} onClick={() => setFilter('unresolved')}>
          {t('si.unresolvedOnly')}
        </button>
        <button className={`btn ${filter === 'all' ? 'btn-primary' : ''}`} onClick={() => setFilter('all')}>
          {t('si.all')}
        </button>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)' }}>
          <option value="">All Types</option>
          {types.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
        </select>
        <button className="btn" onClick={load} title="Refresh"><RefreshCw size={14} /></button>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={purgeOld} style={{ color: 'var(--muted, #94a3b8)' }}><Trash2 size={14} /> {t('si.purge')}</button>
      </div>

      {/* Table */}
      {loading ? <Spinner /> : incidents.length === 0 ? <Empty text={t('si.noIncidents')} /> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('si.type')}</th>
                <th>{t('si.severity')}</th>
                <th>{t('si.sourceIp')}</th>
                <th>{t('si.user')}</th>
                <th>{t('si.details')}</th>
                <th>{t('si.created')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr key={inc.id} style={{ opacity: inc.resolved ? 0.5 : 1 }}>
                  <td><code style={{ fontSize: 12 }}>{inc.incident_type}</code></td>
                  <td><span className={`badge ${SEVERITY_CLS[inc.severity] || 'badge-gray'}`}>{(inc.severity || '—').toUpperCase()}</span></td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{inc.source_ip || '—'}</td>
                  <td>{inc.username || '—'}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {stringifyDetails(inc.details)}
                  </td>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatTime(inc.created_at)}</td>
                  <td>
                    {!inc.resolved ? (
                      <button className="btn btn-sm" onClick={() => resolve(inc.id)} title={t('si.resolve')}>
                        <CheckCircle2 size={14} />
                      </button>
                    ) : (
                      <span className="badge badge-green"><CheckCircle2 size={12} /> {t('si.resolved')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
