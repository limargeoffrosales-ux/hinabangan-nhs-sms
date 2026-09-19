import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { PageHead, Empty, ErrorBanner, Spinner } from '../components/ui';
import PlacementMap from '../components/PlacementMap';

export default function ImmersionMap() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    api('/immersion/map', { timeoutMs: 30000, retryNetwork: false })
      .then((r) => setRows(r?.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const hasCoord = (r) => Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng));
  const placed = useMemo(() => rows.filter(hasCoord), [rows]);
  const missing = useMemo(() => rows.filter((r) => !hasCoord(r)), [rows]);

  return (
    <>
      <PageHead
        title="Immersion Placement Map"
        sub="Interactive map of work immersion placements — each pin is a partner institution with its learner count."
      />

      {error && <ErrorBanner error={error} />}
      {loading ? <Spinner /> : !rows.length && !error ? (
        <Empty text="No plotted placements yet — add immersion records with an address under Immersion &amp; JDVP." />
      ) : (
        <>
          <div className="stat-row" style={{ margin: '12px 0' }}>
            <span className="stat-chip">Total institutions <b>{rows.length}</b></span>
            <span className="stat-chip">Placed on map <b>{placed.length}</b></span>
            {missing.length > 0 && <span className="stat-chip stat-chip-warn">Need coordinates <b>{missing.length}</b></span>}
          </div>
          <PlacementMap rows={placed} missing={missing} isImmersion />
        </>
      )}
    </>
  );
}