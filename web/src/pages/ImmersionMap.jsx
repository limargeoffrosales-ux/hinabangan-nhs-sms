import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import DOMPurify from 'dompurify';
import { Briefcase, BadgeCheck, MapPin, LocateFixed } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { PageHead, Empty, ErrorBanner } from '../components/ui';

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
const BATCHES = ['Batch 1', 'Batch 2', 'Batch 3', 'Batch 4'];
const PIN_COLOR = {
  pending: '#f59e0b',
  ongoing: '#3b82f6',
  completed: '#22c55e',
  served: '#22c55e',
  withdrawn: '#ef4444',
};

function esc(v) {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function pinIcon(color) {
  return L.divIcon({
    className: 'imm-pin-wrap',
    html: `<div class="imm-pin" style="background:${color}"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export default function ImmersionMap() {
  const { user } = useAuth();
  const canWrite = can(user?.role, ...WRITE);
  const navigate = useNavigate();
  const [tab, setTab] = useState('immersion');
  const [batch, setBatch] = useState('');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  const isImmersion = tab === 'immersion';

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api(isImmersion ? '/immersion/map' : '/jdvp/map');
      setRows(r.data || []);
    } catch (e) {
      setError(e.message);
    }
  }, [isImmersion]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current).setView([11.7, 125.3], 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  const placed = useMemo(() => rows.filter((r) => {
    const lt = Number(r.lat), ln = Number(r.lng);
    return Number.isFinite(lt) && Number.isFinite(ln);
  }).filter((r) => !batch || r.batch === batch), [rows, batch]);

  const missing = useMemo(() => rows.filter((r) => {
    const lt = Number(r.lat), ln = Number(r.lng);
    return !(Number.isFinite(lt) && Number.isFinite(ln));
  }).filter((r) => !batch || r.batch === batch), [rows, batch]);

  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    placed.forEach((r) => {
      const color = PIN_COLOR[r.status] || '#94a3b8';
      const popup = DOMPurify.sanitize(
        `<div style="min-width:210px">
          <strong>${esc(r.student_name)}</strong> <span class="sub">(${esc(r.grade_level)})</span>
          <div class="sub" style="font-family:monospace;font-size:11px">LRN ${esc(r.lrn)}</div>
          <div style="margin-top:6px">${isImmersion ? esc(r.partner_institution || r.program) : esc(r.program || r.batch)}</div>
          ${r.address ? `<div class="sub">📍 ${esc(r.address)}</div>` : ''}
          <div class="sub">${esc(r.batch)} · <span class="badge badge-${r.status === 'withdrawn' ? 'red' : (r.status === 'completed' || r.status === 'served') ? 'green' : r.status === 'ongoing' ? 'blue' : 'yellow'}">${esc(r.status)}</span></div>
          ${r.start_date ? `<div class="sub">${esc(r.start_date)}${r.end_date ? ' → ' + esc(r.end_date) : ''}</div>` : ''}
          <div class="sub" style="margin-top:6px">${Number(r.lat).toFixed(5)}, ${Number(r.lng).toFixed(5)}</div>
        </div>`
      );
      L.marker([Number(r.lat), Number(r.lng)], { icon: pinIcon(color) })
        .bindPopup(popup)
        .addTo(layer);
    });
    if (placed.length) {
      map.fitBounds(L.latLngBounds(placed.map((r) => [Number(r.lat), Number(r.lng)])).pad(0.08));
    } else {
      map.setView([11.7, 125.3], 11);
    }
  }, [placed, isImmersion]);

  return (
    <>
      <PageHead
        title="Program Tracing Map"
        sub={isImmersion
          ? 'Live map of learner placements across Work Immersion partner sites'
          : 'Live map of JDVP recipient placements by batch'}
      />

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
        <span className="stat-chip">Placed on map <b>{placed.length}</b></span>
        {missing.length > 0 && <span className="stat-chip stat-chip-warn">Need coordinates <b>{missing.length}</b></span>}
      </div>

      {error && <ErrorBanner error={error} />}

      <div className="map-layout">
        <div className="card map-card">
          <div ref={mapEl} className="map-canvas" />
        </div>
        <div className="card map-side">
          <div className="section-title"><MapPin size={14} /> Missing coordinates</div>
          {!missing.length ? (
            <span className="sub">All {rows.length ? (isImmersion ? 'immersion' : 'JDVP') : ''} records in this view are plotted.</span>
          ) : (
            <ul className="map-side-list">
              {missing.map((r) => (
                <li key={r.id}>
                  <div><strong>{r.student_name}</strong> <span className="sub">({r.grade_level})</span></div>
                  <div className="sub">{r.batch}{r.partner_institution ? ` · ${r.partner_institution}` : ''}</div>
                  <div className="sub">Open the {isImmersion ? 'Immersion' : 'JDVP'} page and set an address or pin.</div>
                </li>
              ))}
            </ul>
          )}
          {!placed.length && !rows.length && !error && <Empty text="No records yet." />}
        </div>
      </div>

      {!canWrite && (
        <div className="hint" style={{ marginTop: 10 }}>
          Placements on this map are tracked by school staff. Please ask an administrator to set locations.
        </div>
      )}
    </>
  );
}