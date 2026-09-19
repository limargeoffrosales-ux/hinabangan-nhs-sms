import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Radio, LocateFixed } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { PageHead, Empty, ErrorBanner, Spinner } from '../components/ui';
import PlacementMap from '../components/PlacementMap';

const MAP_WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];

export default function ImmersionMap() {
  const { user } = useAuth();
  const canMap = can(user?.role, ...MAP_WRITE);
  const [rows, setRows] = useState([]);
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
      const r = await api('/immersion/tracking/live', { timeoutMs: 15000, retryNetwork: false });
      setLiveRows(r?.data || []);
      setLiveErr(null);
    } catch (e) {
      setLiveErr(e.message);
    }
  }, [canMap]);

  const toggleLive = useCallback(() => {
    if (liveOn) { stopLive(); return; }
    setLiveOn(true);
    pollLive();
    pollRef.current = setInterval(pollLive, 15000);
  }, [liveOn, pollLive, stopLive]);

  // Re-arm interval when pollLive changes, keep a fresh call.
  useEffect(() => {
    if (!liveOn) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollLive();
    pollRef.current = setInterval(pollLive, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pollLive, liveOn]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const load = () => {
    setLoading(true);
    setError(null);
    api('/immersion/map', { timeoutMs: 30000, retryNetwork: false })
      .then((r) => setRows(r?.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const hasCoord = (r) => {
    if (r.lat == null || r.lng == null) return false;
    if (String(r.lat).trim() === '' || String(r.lng).trim() === '') return false;
    return Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng));
  };
  const placed = useMemo(() => rows.filter(hasCoord), [rows]);
  const missing = useMemo(() => rows.filter((r) => !hasCoord(r)), [rows]);

  return (
    <>
      <PageHead
        title="Immersion Placement Map"
        sub="Interactive map of work immersion placements — pin colors show placement status. Toggle Live to overlay students sharing their real-time location."
      />

      {error && <ErrorBanner error={error} />}
      {loading ? <Spinner /> : !canMap ? (
        <div className="hint" style={{ marginTop: 10 }}>
          The placement tracing map is available to administrators. Placements are tracked by school staff — ask an administrator to set locations.
        </div>
      ) : !rows.length && !error ? (
        <Empty text="No plotted placements yet — add immersion records with an address under Immersion &amp; JDVP." />
      ) : (
        <>
          <div className="card-top">
            <button className={`btn btn-sm ${liveOn ? 'btn-danger' : ''}`} type="button" onClick={toggleLive} aria-label={liveOn ? 'Stop live tracking' : 'Show live tracking'}>
              <Radio size={13} /> {liveOn ? (liveRows.length ? `Live · ${liveRows.length}` : 'Live…') : 'Live'}
            </button>
            <span className="sub" style={{ fontSize: 12 }}><LocateFixed size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Placement pins + students' live check-ins combined</span>
          </div>

          {liveErr && <ErrorBanner error={liveErr} />}
          {liveOn && !liveErr && (
            <div className="hint" style={{ margin: '10px 0' }}>
              <Radio size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
              Live location view is on — refreshing every 15s. Showing students who opted in during immersion hours. Pin colors pulse for check-ins in the last 10 minutes.
            </div>
          )}

          <div className="stat-row" style={{ margin: '12px 0' }}>
            <span className="stat-chip">Total placements <b>{rows.length}</b></span>
            <span className="stat-chip">Placed on map <b>{placed.length}</b></span>
            {missing.length > 0 && <span className="stat-chip stat-chip-warn">Need coordinates <b>{missing.length}</b></span>}
          </div>
          <PlacementMap rows={placed} missing={missing} isImmersion live={liveOn ? liveRows : []} total={rows.length} />
        </>
      )}
    </>
  );
}