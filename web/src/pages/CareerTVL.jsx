import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Briefcase, BadgeCheck, MapPin, LocateFixed, Users, CheckCircle2, XCircle, Radio } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { CHART_PALETTE } from '../lib/constants';
import { PageHead, ErrorBanner, Spinner } from '../components/ui';
import { DonutChart, ModernBarChart } from '../design-system';
import PlacementMap, { BADGE_FOR } from '../components/PlacementMap';

// Capitalize first letter of string (used for status name formatting)
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const MAP_WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'teacher'];
const BATCHES = ['Batch 1', 'Batch 2', 'Batch 3', 'Batch 4'];

const STATUS_COLORS = {
  pending: '#F5B942',
  ongoing: '#3b82f6',
  completed: '#22c55e',
  served: '#22c55e',
  withdrawn: '#ef4444',
};

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
  const { t } = useTranslation();
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

  // Live location tracking overlay (polled while enabled)
  const [liveOn, setLiveOn] = useState(false);
  const [liveRows, setLiveRows] = useState([]);
  const [liveErr, setLiveErr] = useState(null);
  const pollRef = useRef(null);

  const stopLive = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setLiveOn(false);
    setLiveRows([]);
  }, []);

  const pollLive = useCallback(async () => {
    if (!canMap) return;
    try {
      const qp = batch ? `?batch=${encodeURIComponent(batch)}` : '';
      const r = await api(`/immersion/tracking/live${qp}`, { timeoutMs: 15000, retryNetwork: false });
      setLiveRows(r?.data || []);
      setLiveErr(null);
    } catch (e) {
      setLiveErr(e.message);
    }
  }, [canMap, batch]);

  const toggleLive = useCallback(() => {
    if (liveOn) { stopLive(); return; }
    setLiveOn(true);
    pollLive();
    pollRef.current = setInterval(pollLive, 15000);
  }, [liveOn, pollLive, stopLive]);

  // Re-arm interval when pollLive changes (e.g. batch filter), keep a fresh call.
  useEffect(() => {
    if (!liveOn) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollLive();
    pollRef.current = setInterval(pollLive, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pollLive, liveOn]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const isImmersion = tab === 'immersion';

  const load = useCallback(async () => {
    setError(null);
    const qp = batch ? `?batch=${encodeURIComponent(batch)}` : '';
    try {
      const settled = await Promise.allSettled([
        api(`/dashboard/immersion-summary${qp}`, { timeoutMs: 30000, retryNetwork: false }),
        api(`/dashboard/jdvp-summary${qp}`, { timeoutMs: 30000, retryNetwork: false }),
        canMap ? api(`/immersion/map${qp}`, { timeoutMs: 30000, retryNetwork: false }) : Promise.resolve(null),
        canMap ? api(`/jdvp/map${qp}`, { timeoutMs: 30000, retryNetwork: false }) : Promise.resolve(null),
      ]);
      const firstErr = settled.find((r) => r.status === 'rejected');
      if (firstErr) { setError(firstErr.reason?.message || t('careerTvl.loadError', 'Failed to load Career & TVL data.')); }
      const val = (i) => settled[i]?.status === 'fulfilled' ? settled[i].value : null;
      setImmSummary(val(0)); setJdvpSummary(val(1));
      setImmRows(val(2)?.data || []); setJdvpRows(val(3)?.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [canMap, batch]);

  useEffect(() => { load(); }, [load]);

  // Tracing map — transferred from the standalone Immersion Map page.
  const rows = useMemo(() => isImmersion ? immRows : jdvpRows, [isImmersion, immRows, jdvpRows]);

  const hasCoord = (r) => {
    if (r.lat == null || r.lng == null) return false;
    if (String(r.lat).trim() === '' || String(r.lng).trim() === '') return false;
    return Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng));
  };

  const placed = useMemo(() => rows.filter((r) => hasCoord(r)).filter((r) => !batch || r.batch === batch), [rows, batch]);

  const missing = useMemo(() => rows.filter((r) => !hasCoord(r)).filter((r) => !batch || r.batch === batch), [rows, batch]);

  const mapPlaced = placed.length;

  // --- Graph data ----------------------------------------------------------
  const immStatusData = useMemo(() => {
    const m = {};
    (immSummary?.rows || []).forEach((r) => { m[r.status] = (m[r.status] || 0) + Number(r.learners); });
    const order = ['pending', 'ongoing', 'completed', 'served', 'withdrawn'];
    return Object.keys(m).sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((k) => ({ name: k, value: m[k] }));
  }, [immSummary]);

  const immPartnerData = useMemo(() => {
    const m = {};
    (immSummary?.rows || []).forEach((r) => {
      const key = r.partner_institution || r.program || t('careerTvl.unknown', 'Unknown');
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

  if (loading) return <Spinner />;

  return (
    <>
      <PageHead
        title={t('careerTvl.title', 'Career & TVL')}
        sub={t('careerTvl.subtitle', 'Work Immersion & JDVP placements, tracing map, and analytics')}
      />

      <div className="kpi-row" style={{ marginBottom: 14 }}>
        <StatChip icon={Briefcase} label={t('careerTvl.immersionLearners', 'Immersion learners')} value={immLearners} color="var(--accent)" />
        <StatChip icon={BadgeCheck} label={t('careerTvl.jdvpRecipients', 'JDVP recipients')} value={jdvpTotal} color="var(--accent-2)" />
        <StatChip icon={CheckCircle2} label={t('careerTvl.completedServed', 'Completed / served')} value={immStatusData.reduce((a, s) => a + (s.name === 'completed' || s.name === 'served' ? s.value : 0), 0) + (jdvpSummary?.batches || []).reduce((a, b) => a + (b.statuses?.served || 0), 0)} color="var(--success)" />
        <StatChip icon={XCircle} label={t('careerTvl.withdrawn', 'Withdrawn')} value={immWithdrawn + (jdvpSummary?.batches || []).reduce((a, b) => a + (b.statuses?.withdrawn || 0), 0)} color="var(--danger)" />
        {canMap && <StatChip icon={MapPin} label={t('careerTvl.placedOnMap', 'Placed on map')} value={mapPlaced} color="var(--accent)" />}
      </div>

      {error && <ErrorBanner error={error} />}

      {/* --- Graphs ------------------------------------------------------- */}
      <div className="grid grid-2" style={{ alignItems: 'stretch' }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}><Briefcase size={16} /> {t('careerTvl.workImmersionStatus', 'Work Immersion Status')}</h3>
{immStatusData.length > 0 ? (
            <DonutChart
              data={immStatusData.map((s, i) => ({
                name: s.name,
                value: s.value,
                color: STATUS_COLORS[s.name] || CHART_PALETTE[i % CHART_PALETTE.length],
              }))}
              centerValue={immLearners}
              centerLabel={t('careerTvl.immersionLearners', 'Learners')}
              size={170}
            />
          ) : <div className="sub">{t('careerTvl.noImmRecords', 'No immersion records yet.')}</div>}
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
          <h3 style={{ marginTop: 0 }}><Users size={16} /> {t('careerTvl.learnersPerPartner', 'Learners per Partner Institution')}</h3>
          {immPartnerData.length > 0 ? (
            <div style={{ height: 215 }}>
              <ModernBarChart
                data={immPartnerData}
                categoryKey="name"
                layout="vertical"
                series={[{ key: 'value', name: t('careerTvl.learners', 'Learners') }]}
                perBarColors={CHART_PALETTE}
                height={215}
                showLabels={true}
                labelSuffix=" learners"
                margin={{ left: 8, right: 24 }}
              />
            </div>
          ) : <div className="sub">{t('careerTvl.noPartnerRecords', 'No partner institutions recorded yet.')}</div>}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}><Briefcase size={16} /> {t('careerTvl.immByBatchStatus', 'Immersion Learners by Batch & Status')}</h3>
          {immBatchData.length > 0 ? (
            <div style={{ height: 220 }}>
              <ModernBarChart
                data={immBatchData}
                categoryKey="batch"
                series={['Pending', 'Ongoing', 'Completed', 'Served', 'Withdrawn']
                  .filter((s) => immBatchData.some((b) => b[s] > 0))
                  .map((s) => ({
                    key: s,
                    name: t(`careerTvl.status.${s.toLowerCase()}`, s),
                    color: STATUS_COLORS[s.toLowerCase()] || '#94a3b8',
                  }))}
                stacked
                height={220}
                showLabels={false}
                legend
              />
            </div>
          ) : <div className="sub">{t('careerTvl.noBatchData', 'No batch data yet.')}</div>}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}><BadgeCheck size={16} /> {t('careerTvl.jdvpByBatchGender', 'JDVP Recipients by Batch & Gender')}</h3>
          {jdvpBatchData.length > 0 ? (
            <div style={{ height: 220 }}>
              <ModernBarChart
                data={jdvpBatchData}
                categoryKey="batch"
                series={[
                  { key: 'Male', name: t('careerTvl.genderMale', 'Male'), color: '#4D96FF' },
                  { key: 'Female', name: t('careerTvl.genderFemale', 'Female'), color: '#F5B942' },
                ]}
                stacked
                height={220}
                showLabels={false}
                legend
              />
            </div>
          ) : <div className="sub">{t('careerTvl.noJdvpRecords', 'No JDVP recipients recorded yet.')}</div>}
        </div>
      </div>

      <div style={{ height: 18 }} />

      {/* --- Tracing map (transferred) ------------------------------------ */}
      {canMap ? (
        <>
          <div className="card-top">
            <div className="tabs" style={{ display: 'flex', gap: 8 }}>
              <button className={`tab-btn ${isImmersion ? 'active' : ''}`} onClick={() => setTab('immersion')}>
                <Briefcase size={14} /> {t('careerTvl.tabImmersion', 'Immersion')}
              </button>
              <button className={`tab-btn ${!isImmersion ? 'active' : ''}`} onClick={() => setTab('jdvp')}>
                <BadgeCheck size={14} /> {t('careerTvl.tabJdvp', 'JDVP')}
              </button>
            </div>
            <select className="input" style={{ width: 150 }} value={batch} onChange={(e) => setBatch(e.target.value)}>
              <option value="">{t('careerTvl.allBatches', 'All batches')}</option>
              {BATCHES.map((b) => <option key={b}>{b}</option>)}
            </select>
            <button className={`btn btn-sm ${liveOn ? 'btn-danger' : ''}`} type="button" onClick={toggleLive} aria-label={liveOn ? t('careerTvl.stopLiveAria', 'Stop live tracking') : t('careerTvl.showLiveAria', 'Show live tracking')}>
              <Radio size={13} /> {liveOn ? (liveRows.length ? `${t('careerTvl.live', 'Live')} · ${liveRows.length}` : t('careerTvl.liveEllipsis', 'Live…')) : t('careerTvl.live', 'Live')}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/immersion')}>
              <LocateFixed size={13} /> {t('careerTvl.setLocations', 'Set locations')}
            </button>
          </div>

          {liveErr && <ErrorBanner error={liveErr} />}
          {liveOn && !liveErr && (
            <div className="hint" style={{ margin: '10px 0' }}>
              <Radio size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
              {t('careerTvl.liveHint', 'Live location view is on — refreshing every 15s. Showing students who opted in and currently fit the selected batch. Pin colors pulse for check-ins in the last 10 minutes.')}
            </div>
          )}

          <div className="stat-row" style={{ margin: '12px 0' }}>
            <span className="stat-chip">{t('careerTvl.totalLearners', 'Total learners')} <b>{placed.length + missing.length}</b></span>
            <span className="stat-chip">{t('careerTvl.placedOnMap', 'Placed on map')} <b>{mapPlaced}</b></span>
            {missing.length > 0 && <span className="stat-chip stat-chip-warn">{t('careerTvl.needCoordinates', 'Need coordinates')} <b>{missing.length}</b></span>}
          </div>

          <div style={{ minHeight: '450px', width: '100%' }}>
  <PlacementMap rows={placed} missing={missing} isImmersion={isImmersion} live={liveOn ? liveRows : []} total={placed.length + missing.length} />
</div>
        </>
      ) : (
        <div className="hint" style={{ marginTop: 10 }}>
          {t('careerTvl.noMapAccess', 'The placement tracing map is available to administrators. Placements are tracked by school staff — ask an administrator to set locations.')}
        </div>
      )}

      <div style={{ height: 18 }} />

      {/* --- Summary tables ------------------------------------------------ */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}><Briefcase size={16} /> {t('careerTvl.immTableTitle', 'Work Immersion Status by Batch & Partner Institution')}</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>{t('careerTvl.thBatch', 'Batch')}</th><th>{t('careerTvl.thProgram', 'Program')}</th><th>{t('careerTvl.thPartner', 'Partner Institution')}</th><th style={{ textAlign: 'center' }}>{t('careerTvl.thPending', 'Pending')}</th><th style={{ textAlign: 'center' }}>{t('careerTvl.thOngoing', 'Ongoing')}</th><th style={{ textAlign: 'center' }}>{t('careerTvl.thCompleted', 'Completed')}</th><th style={{ textAlign: 'center' }}>{t('careerTvl.thServed', 'Served')}</th><th style={{ textAlign: 'center' }}>{t('careerTvl.thWithdrawn', 'Withdrawn')}</th><th style={{ textAlign: 'center' }}>{t('careerTvl.thMF', 'M / F')}</th><th style={{ textAlign: 'center' }}>{t('careerTvl.thTotal', 'Total')}</th></tr>
            </thead>
            <tbody>
              {(immSummary?.rows?.length || 0) === 0 && (
                <tr><td colSpan={10} className="sub">{t('careerTvl.noImmRecordsTable', 'No work immersion records yet — add them under Immersion & JDVP.')}</td></tr>
              )}
              {immSummary?.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.batch}</td><td>{r.program}</td><td>{r.partner_institution || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{r.status === 'pending' ? r.learners : 0}</td>
                  <td style={{ textAlign: 'center' }}>{r.status === 'ongoing' ? r.learners : 0}</td>
                  <td style={{ textAlign: 'center' }}>{r.status === 'completed' ? r.learners : 0}</td>
                  <td style={{ textAlign: 'center' }}>{r.status === 'served' ? r.learners : 0}</td>
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
        <h3 style={{ marginTop: 0 }}><BadgeCheck size={16} /> {t('careerTvl.jdvpByBatchGender', 'JDVP Recipients by Batch & Gender')}</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>{t('careerTvl.thBatch', 'Batch')}</th><th>{t('careerTvl.thProgram', 'Program')}</th><th style={{ textAlign: 'center' }}>{t('careerTvl.thMale', 'Male')}</th><th style={{ textAlign: 'center' }}>{t('careerTvl.thFemale', 'Female')}</th><th style={{ textAlign: 'center' }}>{t('careerTvl.thTotal', 'Total')}</th><th>{t('careerTvl.thStatusBreakdown', 'Status Breakdown')}</th></tr>
            </thead>
            <tbody>
              {(jdvpSummary?.rows?.length || 0) === 0 && (
                <tr><td colSpan={6} className="sub">{t('careerTvl.noJdvpRecordsTable', 'No JDVP recipients recorded yet — add them under Immersion & JDVP.')}</td></tr>
              )}
              {jdvpSummary?.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.batch}</td><td>{r.program || t('careerTvl.general', 'General')}</td>
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