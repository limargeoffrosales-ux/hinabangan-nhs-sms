import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, BadgeCheck, MapPin, LocateFixed, Users, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { PageHead, ErrorBanner, Spinner } from '../components/ui';
import { loadRecharts } from '../lib/lazy-recharts';
import PlacementMap, { BADGE_FOR } from '../components/PlacementMap';

const MAP_WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
const BATCHES = ['Batch 1', 'Batch 2', 'Batch 3', 'Batch 4'];

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const STATUS_COLORS = {
  pending: '#F5B942',
  ongoing: '#3b82f6',
  completed: '#22c55e',
  served: '#22c55e',
  withdrawn: '#ef4444',
};
const PIE_COLORS = ['#4D96FF', '#2FD6A0', '#2DD4BF', '#F5B942', '#FB7185', '#A78BFA'];

function StatChip({ icon: Icon, label, value, color }) {
  return (
    <div className="kpi-mini">
      <div className="kpi-mini-value" style={{ color }}>{value}</div>
      <div className="kpi-mini-label">{Icon && <Icon size={13} style={{ verticalAlign: -2, marginRight: 4 }} />}{label}</div>
    </div>
  );
}

export default function CareerTVL() {
  const { user } = useAuth();
  const canMap = can(user?.role, ...MAP_WRITE);
  const navigate = useNavigate();

  const [tab, setTab] = useState('immersion');
  const [batch, setBatch] = useState('');
  const [immRows, setImmRows] = useState([]);
  const [jdvpRows, setJdvpRows] = useState([]);
  const [immSummary, setImmSummary] = useState(null);
  const [jdvpSummary, setJdvpSummary] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [R, setR] = useState(null);

  useEffect(() => { loadRecharts().then(setR); }, []);

  const isImmersion = tab === 'immersion';

  const load = useCallback(async () => {
    setError(null);
    try {
      const settled = await Promise.allSettled([
        api('/dashboard/immersion-summary', { timeoutMs: 30000, retryNetwork: false }),
        api('/dashboard/jdvp-summary', { timeoutMs: 30000, retryNetwork: false }),
        canMap ? api('/immersion/map', { timeoutMs: 30000, retryNetwork: false }) : Promise.resolve(null),
        canMap ? api('/jdvp/map', { timeoutMs: 30000, retryNetwork: false }) : Promise.resolve(null),
      ]);
      const firstErr = settled.find((r) => r.status === 'rejected');
      if (firstErr) { setError(firstErr.reason?.message || 'Failed to load Career & TVL data.'); }
      const val = (i) => settled[i]?.status === 'fulfilled' ? settled[i].value : null;
      setImmSummary(val(0)); setJdvpSummary(val(1));
      setImmRows(val(2)?.data || []); setJdvpRows(val(3)?.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [canMap]);

  useEffect(() => { load(); }, [load]);

  // Tracing map — transferred from the standalone Immersion Map page.
  const rows = useMemo(() => isImmersion ? immRows : jdvpRows, [isImmersion, immRows, jdvpRows]);

  const placed = useMemo(() => rows.filter((r) => {
    const lt = Number(r.lat), ln = Number(r.lng);
    return Number.isFinite(lt) && Number.isFinite(ln);
  }).filter((r) => !batch || r.batch === batch), [rows, batch]);

  const missing = useMemo(() => rows.filter((r) => {
    const lt = Number(r.lat), ln = Number(r.lng);
    return !(Number.isFinite(lt) && Number.isFinite(ln));
  }).filter((r) => !batch || r.batch === batch), [rows, batch]);

  // --- Graph data ----------------------------------------------------------
  const immStatusData = useMemo(() => {
    const m = {};
    (immSummary?.rows || []).forEach((r) => { m[r.status] = (m[r.status] || 0) + Number(r.learners); });
    const order = ['pending', 'ongoing', 'completed', 'withdrawn'];
    return Object.keys(m).sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((k) => ({ name: k, value: m[k] }));
  }, [immSummary]);

  const immPartnerData = useMemo(() => {
    const m = {};
    (immSummary?.rows || []).forEach((r) => {
      const key = r.partner_institution || r.program || 'Unknown';
      m[key] = (m[key] || 0) + Number(r.learners);
    });
    return Object.entries(m)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [immSummary]);

  const immBatchData = useMemo(() => {
    const statusKeys = [...new Set((immSummary?.rows || []).map((r) => r.status))];
    return (immSummary?.batches || []).map((b) => {
      const row = { batch: b.batch };
      statusKeys.forEach((s) => { row[cap(s)] = b.statuses?.[s] || 0; });
      return row;
    });
  }, [immSummary]);

  const jdvpBatchData = useMemo(() => (jdvpSummary?.batches || []).map((b) => ({
    batch: b.batch,
    Male: b.male,
    Female: b.female,
    Total: b.total,
  })), [jdvpSummary]);

  const immLearners = useMemo(() => (immSummary?.batches || []).reduce((a, b) => a + b.learners, 0), [immSummary]);
  const immWithdrawn = immStatusData.find((s) => s.name === 'withdrawn')?.value || 0;
  const jdvpTotal = (jdvpSummary?.batches || []).reduce((a, b) => a + b.total, 0);
  const mapPlaced = placed.length;

  if (loading) return <Spinner />;

  const tooltipStyle = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 };

  return (
    <>
      <PageHead
        title="Career & TVL"
        sub="Work Immersion & JDVP placements, tracing map, and analytics"
      />

      <div className="kpi-row" style={{ marginBottom: 14 }}>
        <StatChip icon={Briefcase} label="Immersion learners" value={immLearners} color="var(--accent)" />
        <StatChip icon={BadgeCheck} label="JDVP recipients" value={jdvpTotal} color="var(--accent-2)" />
        <StatChip icon={CheckCircle2} label="Completed / served" value={immStatusData.reduce((a, s) => a + (s.name === 'completed' || s.name === 'served' ? s.value : 0), 0) + (jdvpSummary?.batches || []).reduce((a, b) => a + (b.statuses?.served || 0), 0)} color="#22c55e" />
        <StatChip icon={XCircle} label="Withdrawn" value={immWithdrawn + (jdvpSummary?.batches || []).reduce((a, b) => a + (b.statuses?.withdrawn || 0), 0)} color="#ef4444" />
        {canMap && <StatChip icon={MapPin} label="Placed on map" value={mapPlaced} color="#3b82f6" />}
      </div>

      {error && <ErrorBanner error={error} />}

      {/* --- Graphs ------------------------------------------------------- */}
      <div className="grid grid-2" style={{ alignItems: 'stretch' }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}><Briefcase size={16} /> Work Immersion Status</h3>
          {immStatusData.length > 0 && R ? (
            <div style={{ height: 215 }}>
              <R.ResponsiveContainer width="100%" height="100%">
                <R.PieChart>
                  <R.Pie data={immStatusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2} stroke="var(--card)">
                    {immStatusData.map((_, i) => <R.Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </R.Pie>
                  <R.Tooltip contentStyle={tooltipStyle} />
                  <R.Legend wrapperStyle={{ fontSize: 12 }} />
                </R.PieChart>
              </R.ResponsiveContainer>
            </div>
          ) : <div className="sub">No immersion records yet.</div>}
          <div className="table-wrap" style={{ marginTop: 4 }}>
            <table>
              <tbody>
                {immStatusData.map((s) => (
                  <tr key={s.name}>
                    <td><span className={`badge ${BADGE_FOR[s.name] || 'badge-gray'}`}>{s.name}</span></td>
                    <td style={{ textAlign: 'center' }}><strong>{s.value}</strong></td>
                    <td style={{ textAlign: 'right' }} className="sub">{immLearners ? Math.round(s.value / immLearners * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}><Users size={16} /> Learners per Partner Institution</h3>
          {immPartnerData.length > 0 && R ? (
            <div style={{ height: 215 }}>
              <R.ResponsiveContainer width="100%" height="100%">
                <R.BarChart data={immPartnerData} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <R.CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" horizontal={false} />
                  <R.XAxis type="number" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} allowDecimals={false} />
                  <R.YAxis type="category" dataKey="name" width={150} tick={{ fill: 'var(--text-dim)', fontSize: 10.5 }} />
                  <R.Tooltip contentStyle={tooltipStyle} />
                  <R.Bar dataKey="value" name="Learners" radius={[0, 4, 4, 0]}>
                    {immPartnerData.map((_, i) => <R.Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </R.Bar>
                </R.BarChart>
              </R.ResponsiveContainer>
            </div>
          ) : <div className="sub">No partner institutions recorded yet.</div>}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}><Briefcase size={16} /> Immersion Learners by Batch &amp; Status</h3>
          {immBatchData.length > 0 && R ? (
            <div style={{ height: 220 }}>
              <R.ResponsiveContainer width="100%" height="100%">
                <R.BarChart data={immBatchData} margin={{ top: 4 }}>
                  <R.CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" vertical={false} />
                  <R.XAxis dataKey="batch" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
                  <R.YAxis tick={{ fill: 'var(--text-dim)', fontSize: 12 }} allowDecimals={false} />
                  <R.Tooltip contentStyle={tooltipStyle} />
                  <R.Legend wrapperStyle={{ fontSize: 12 }} />
                  {['Pending', 'Ongoing', 'Completed', 'Withdrawn'].filter((s) => immBatchData.some((b) => b[s] > 0)).map((s) => (
                    <R.Bar key={s} dataKey={s} stackId="s" fill={STATUS_COLORS[s.toLowerCase()] || '#94a3b8'} radius={[0, 0, 0, 0]} />
                  ))}
                </R.BarChart>
              </R.ResponsiveContainer>
            </div>
          ) : <div className="sub">No batch data yet.</div>}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}><BadgeCheck size={16} /> JDVP Recipients by Batch &amp; Gender</h3>
          {jdvpBatchData.length > 0 && R ? (
            <div style={{ height: 220 }}>
              <R.ResponsiveContainer width="100%" height="100%">
                <R.BarChart data={jdvpBatchData} margin={{ top: 4 }}>
                  <R.CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" vertical={false} />
                  <R.XAxis dataKey="batch" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
                  <R.YAxis tick={{ fill: 'var(--text-dim)', fontSize: 12 }} allowDecimals={false} />
                  <R.Tooltip contentStyle={tooltipStyle} />
                  <R.Legend wrapperStyle={{ fontSize: 12 }} />
                  <R.Bar dataKey="Male" stackId="g" fill="#4D96FF" />
                  <R.Bar dataKey="Female" stackId="g" fill="#F5B942" radius={[4, 4, 0, 0]} />
                </R.BarChart>
              </R.ResponsiveContainer>
            </div>
          ) : <div className="sub">No JDVP recipients recorded yet.</div>}
        </div>
      </div>

      <div style={{ height: 18 }} />

      {/* --- Tracing map (transferred) ------------------------------------ */}
      {canMap ? (
        <>
          <div className="card-top">
            <div className="tabs" style={{ display: 'flex', gap: 8 }}>
              <button className={`tab-btn ${isImmersion ? 'active' : ''}`} onClick={() => setTab('immersion')}>
                <Briefcase size={14} /> Immersion
              </button>
              <button className={`tab-btn ${!isImmersion ? 'active' : ''}`} onClick={() => setTab('jdvp')}>
                <BadgeCheck size={14} /> JDVP
              </button>
            </div>
            <select className="input" style={{ width: 150 }} value={batch} onChange={(e) => setBatch(e.target.value)}>
              <option value="">All batches</option>
              {BATCHES.map((b) => <option key={b}>{b}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/immersion')}>
              <LocateFixed size={13} /> Set locations
            </button>
          </div>

          <div className="stat-row" style={{ margin: '12px 0' }}>
            <span className="stat-chip">Total learners <b>{rows.length}</b></span>
            <span className="stat-chip">Placed on map <b>{mapPlaced}</b></span>
            {missing.length > 0 && <span className="stat-chip stat-chip-warn">Need coordinates <b>{missing.length}</b></span>}
          </div>

          <PlacementMap rows={placed} missing={missing} isImmersion={isImmersion} />
        </>
      ) : (
        <div className="hint" style={{ marginTop: 10 }}>
          The placement tracing map is available to administrators. Placements are tracked by school staff — ask an administrator to set locations.
        </div>
      )}

      <div style={{ height: 18 }} />

      {/* --- Summary tables ------------------------------------------------ */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}><Briefcase size={16} /> Work Immersion Status by Batch &amp; Partner Institution</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Batch</th><th>Program</th><th>Partner Institution</th><th style={{ textAlign: 'center' }}>Pending</th><th style={{ textAlign: 'center' }}>Ongoing</th><th style={{ textAlign: 'center' }}>Completed</th><th style={{ textAlign: 'center' }}>Withdrawn</th><th style={{ textAlign: 'center' }}>M / F</th><th style={{ textAlign: 'center' }}>Total</th></tr>
            </thead>
            <tbody>
              {(immSummary?.rows?.length || 0) === 0 && (
                <tr><td colSpan={9} className="sub">No work immersion records yet — add them under Immersion &amp; JDVP.</td></tr>
              )}
              {immSummary?.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.batch}</td><td>{r.program}</td><td>{r.partner_institution || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{r.status === 'pending' ? r.learners : 0}</td>
                  <td style={{ textAlign: 'center' }}>{r.status === 'ongoing' ? r.learners : 0}</td>
                  <td style={{ textAlign: 'center' }}>{r.status === 'completed' ? r.learners : 0}</td>
                  <td style={{ textAlign: 'center' }}>{r.status === 'withdrawn' ? r.learners : 0}</td>
                  <td style={{ textAlign: 'center' }} className="sub">{r.male} / {r.female}</td>
                  <td style={{ textAlign: 'center' }}><strong>{r.learners}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div className="card">
        <h3 style={{ marginTop: 0 }}><BadgeCheck size={16} /> JDVP Recipients by Batch &amp; Gender</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Batch</th><th>Program</th><th style={{ textAlign: 'center' }}>Male</th><th style={{ textAlign: 'center' }}>Female</th><th style={{ textAlign: 'center' }}>Total</th><th>Status Breakdown</th></tr>
            </thead>
            <tbody>
              {(jdvpSummary?.rows?.length || 0) === 0 && (
                <tr><td colSpan={6} className="sub">No JDVP recipients recorded yet — add them under Immersion &amp; JDVP.</td></tr>
              )}
              {jdvpSummary?.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.batch}</td><td>{r.program || 'General'}</td>
                  <td style={{ textAlign: 'center' }}>{r.sex === 'Male' ? r.n : 0}</td>
                  <td style={{ textAlign: 'center' }}>{r.sex === 'Female' ? r.n : 0}</td>
                  <td style={{ textAlign: 'center' }}><strong>{r.n}</strong></td>
                  <td><span className={`badge ${BADGE_FOR[r.status] || 'badge-blue'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}