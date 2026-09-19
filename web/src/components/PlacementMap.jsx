import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import DOMPurify from 'dompurify';
import { Search, Layers, LocateFixed, School, ExternalLink, Navigation, MapPin } from 'lucide-react';
import { Empty } from './ui';

// School HQ used for "distance from school" figures (Hinabangan NHS — approx).
const SCHOOL_COORDS = { lat: 11.7056, lng: 125.2656 };
const SCHOOL_LABEL = 'Hinabangan NHS (approx)';

const BASE = {
  street: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    label: 'Streets',
    options: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      className: 'tile-street',
      // Prevent tiles from being requested too quickly
      minZoom: 0,
      maxZoom: 19,
    }
  },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', label: 'Satellite' },
  labels: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}' },
};

export const PIN_COLOR = {
  pending: '#f59e0b', ongoing: '#3b82f6', completed: '#22c55e', served: '#22c55e', withdrawn: '#ef4444',
};
export const BADGE_FOR = {
  pending: 'badge-yellow', ongoing: 'badge-blue', completed: 'badge-green', served: 'badge-green', withdrawn: 'badge-red',
};

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function esc(v) {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtKm(km) {
  return km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(1)} km`;
}

function pinIcon(color, label) {
  return L.divIcon({
    className: 'imm-pin-wrap',
    html: `<div class="imm-pin" style="background:${color}">${label ? `<span class="imm-pin-tag">${esc(label)}</span>` : ''}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });
}

function clusterIcon(count) {
  return L.divIcon({
    className: 'imm-cluster-wrap',
    html: `<div class="imm-cluster">${count}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function gmapsLink(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
function gdirsLink(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&origin=${SCHOOL_COORDS.lat},${SCHOOL_COORDS.lng}&destination=${lat},${lng}`;
}

const OUTPUT_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &middot; ' +
  '<a href="https://www.esri.com">Esri</a>';

export const LIVE_COLOR = '#ef4444';

function liveIcon(recent) {
  return L.divIcon({
    className: 'imm-pin-wrap imm-live-wrap',
    html: `<div class="imm-live-pin" style="background:${LIVE_COLOR}"><span class="imm-live-ring"></span></div>${recent ? '<span class="imm-live-tag">LIVE</span>' : ''}`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
}

export default function PlacementMap({ rows = [], missing = [], isImmersion = true, live = [] }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const liveLayerRef = useRef(null);
  const tl = useRef({ street: null, satellite: null, labels: null });
  const schoolMarkerRef = useRef(null);
  const searchMarkerRef = useRef(null);
  const rowsKeyRef = useRef(null);

  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [baseKey, setBaseKey] = useState('street');
  const [showLabels, setShowLabels] = useState(false);
  const [clusterHint, setClusterHint] = useState(false);
  const [zoom, setZoom] = useState(11);

  const labelRef = useRef('immersion');
  labelRef.current = isImmersion ? 'immersion' : 'JDVP';

  // --- map bootstrap --------------------------------------------------------
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: true, attributionControl: true }).setView([SCHOOL_COORDS.lat, SCHOOL_COORDS.lng], 11);
    tl.current.street = L.tileLayer(BASE.street.url, { attribution: OUTPUT_ATTR, maxZoom: 19 }).addTo(map);
    tl.current.satellite = L.tileLayer(BASE.satellite.url, { attribution: OUTPUT_ATTR, maxZoom: 19 });
    tl.current.labels = L.tileLayer(BASE.labels.url, { attribution: OUTPUT_ATTR });
    L.control.layers(
      { [BASE.street.label]: tl.current.street, [BASE.satellite.label]: tl.current.satellite },
      { 'Place labels': tl.current.labels },
      { position: 'topright' },
    ).addTo(map);
    L.control.scale({ position: 'bottomright' }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    liveLayerRef.current = L.layerGroup().addTo(map);
    schoolMarkerRef.current = L.marker([SCHOOL_COORDS.lat, SCHOOL_COORDS.lng], {
      icon: pinIcon('#2563eb', 'SCH'),
    }).bindPopup(DOMPurify.sanitize(
      `<div style="min-width:180px"><strong>${SCHOOL_LABEL}</strong><div class="sub">School headquarters — distances shown on pins are from here.</div></div>`,
    )).addTo(map);

    const syncZoom = () => setZoom(map.getZoom());
    map.on('zoomend moveend', syncZoom);
    syncZoom();
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null; layerRef.current = null; liveLayerRef.current = null; schoolMarkerRef.current = null; searchMarkerRef.current = null;
      tl.current = { street: null, satellite: null, labels: null };
    };
  }, []);

  // --- base/overlay toggle ----------------------------------------------------
  useEffect(() => {
    const map = mapRef.current, t = tl.current;
    if (!map || !t.street) return;
    if (baseKey === 'street') {
      if (!map.hasLayer(t.street)) t.street.addTo(map);
      if (map.hasLayer(t.satellite)) t.satellite.remove();
      if (map.hasLayer(t.labels)) t.labels.remove();
    } else {
      if (map.hasLayer(t.street)) t.street.remove();
      if (!map.hasLayer(t.satellite)) t.satellite.addTo(map);
      if (showLabels ? !map.hasLayer(t.labels) : map.hasLayer(t.labels)) {
        if (showLabels) t.labels.addTo(map); else t.labels.remove();
      }
    }
  }, [baseKey, showLabels]);

  // --- placements + clustering ----------------------------------------------
  const dist = useMemo(() => rows.map((r) => ({
    r,
    km: haversine(SCHOOL_COORDS.lat, SCHOOL_COORDS.lng, Number(r.lat), Number(r.lng)),
  })).sort((a, b) => a.km - b.km), [rows]);

  const addPin = useCallback((m) => {
    const color = PIN_COLOR[m.status] || '#94a3b8';
    const km = haversine(SCHOOL_COORDS.lat, SCHOOL_COORDS.lng, Number(m.lat), Number(m.lng));
    const popup = DOMPurify.sanitize(
      `<div style="min-width:230px">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
          <strong>${esc(m.student_name)}</strong> <span class="sub">(${esc(m.grade_level)})</span>
        </div>
        <div class="sub" style="font-family:monospace;font-size:11px">LRN ${esc(m.lrn)}</div>
        <div style="margin-top:6px">${isImmersion ? esc(m.partner_institution || m.program) : esc(m.program || m.batch)}</div>
        ${m.address ? `<div class="sub">📍 ${esc(m.address)}</div>` : ''}
        <div class="sub">${esc(m.batch)} · <span class="badge ${BADGE_FOR[m.status] || 'badge-gray'}">${esc(m.status)}</span></div>
        ${m.start_date ? `<div class="sub">${esc(m.start_date)}${m.end_date ? ' → ' + esc(m.end_date) : ''}</div>` : ''}
        <div class="sub" style="margin-top:6px">🏫 ${fmtKm(km)} from school</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <a class="popup-link" target="_blank" rel="noopener noreferrer" href="${gmapsLink(Number(m.lat).toFixed(6), Number(m.lng).toFixed(6))}">Open in Google Maps</a>
          <a class="popup-link" target="_blank" rel="noopener noreferrer" href="${gdirsLink(Number(m.lat).toFixed(6), Number(m.lng).toFixed(6))}">Directions from school</a>
        </div>
      </div>`,
    );
    L.marker([Number(m.lat), Number(m.lng)], { icon: pinIcon(color) })
      .bindPopup(popup)
      .addTo(layerRef.current);
  }, [isImmersion]);

  const rowsKey = useCallback((list) => list.map((x) => x.id).join(','), []);

  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!rows.length) return;

    const doCluster = zoom < 12 && rows.length > 40;
    setClusterHint(doCluster);

    if (doCluster) {
      const metersPerPx = 156543.03392 * Math.cos(SCHOOL_COORDS.lat * Math.PI / 180) / Math.pow(2, zoom);
      const cell = (70 * metersPerPx) / 111320;
      const groups = {};
      rows.forEach((m) => {
        const k = `${Math.round(Number(m.lat) / cell)}|${Math.round(Number(m.lng) / cell)}`;
        (groups[k] = groups[k] || []).push(m);
      });
      Object.values(groups).forEach((g) => {
        if (g.length < 2) { g.forEach((m) => addPin(m)); return; }
        const lat = g.reduce((a, m) => a + Number(m.lat), 0) / g.length;
        const lng = g.reduce((a, m) => a + Number(m.lng), 0) / g.length;
        L.marker([lat, lng], { icon: clusterIcon(g.length) })
          .bindPopup(DOMPurify.sanitize(
            `<div style="min-width:180px"><strong>${g.length} students</strong><div class="sub">Zoom in to see individual pins — approximate locations for ${labelRef.current} placements in this area.</div></div>`,
          ))
          .on('click', () => map.flyTo([lat, lng], Math.min(zoom + 2, 17)))
          .addTo(layer);
      });
    } else {
      rows.forEach((m) => addPin(m));
    }

    const key = rowsKey(rows);
    if (rowsKeyRef.current !== key) {
      rowsKeyRef.current = key;
      const ok = rows.filter((r) => Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng)));
      if (ok.length) map.fitBounds(L.latLngBounds(ok.map((r) => [Number(r.lat), Number(r.lng)])).pad(0.06));
    }
  }, [rows, zoom, addPin, rowsKey]);

  useEffect(() => { rowsKeyRef.current = null; }, [isImmersion]);

  // --- live tracking pins (overlay, never clustered) -----------------------
  useEffect(() => {
    const map = mapRef.current, layer = liveLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!live.length) return;
    const now = Date.now();
    live.forEach((m) => {
      const capturedMs = Date.parse(m.captured_at);
      const recent = Number.isFinite(capturedMs) && (now - capturedMs) < 10 * 60 * 1000;
      const popup = DOMPurify.sanitize(
        `<div style="min-width:210px">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
            <strong>${esc(m.student_name)}</strong> <span class="badge badge-red">LIVE</span>
          </div>
          <div class="sub" style="font-family:monospace;font-size:11px">LRN ${esc(m.lrn)}</div>
          <div style="margin-top:6px">${esc(m.partner_institution || m.program || '')}</div>
          <div class="sub">${esc(m.batch)} · Last seen <b>${recent ? 'just now' : esc(new Date(capturedMs).toLocaleTimeString())}</b></div>
          ${m.accuracy_m != null ? `<div class="sub">Accuracy ±${Math.round(m.accuracy_m)} m</div>` : ''}
          <div class="sub">${cap(m.source)} report</div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <a class="popup-link" target="_blank" rel="noopener noreferrer" href="${gmapsLink(Number(m.lat).toFixed(6), Number(m.lng).toFixed(6))}">Open in Google Maps</a>
          </div>
        </div>`,
      );
      L.marker([Number(m.lat), Number(m.lng)], { icon: liveIcon(recent), zIndexOffset: 1000 })
        .bindPopup(popup)
        .addTo(layer);
    });
  }, [live]);

  // --- search (Nominatim) -----------------------------------------------------
  const doSearch = useCallback(async (term) => {
    if (!term.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(term)}`,
        { headers: { Accept: 'application/json' } },
      );
      const j = await r.json();
      setResults(Array.isArray(j) ? j : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    const t = setTimeout(() => { if (open) doSearch(q); }, 450);
    return () => clearTimeout(t);
  }, [q, open, doSearch]);

  const goTo = useCallback((lat, lng, label) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15));
    if (searchMarkerRef.current) {
      searchMarkerRef.current.setLatLng([lat, lng]);
    } else {
      searchMarkerRef.current = L.marker([lat, lng], { icon: pinIcon('#16a34a') })
        .bindPopup(DOMPurify.sanitize(`<strong>${esc(label || 'Search result')}</strong><div class="sub">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>`))
        .addTo(map);
    }
    searchMarkerRef.current.openPopup();
    setResults([]); setOpen(false);
  }, []);

  const locate = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => goTo(pos.coords.latitude, pos.coords.longitude, 'You are here'),
      () => { /* denied — ignore */ },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [goTo]);

  const nearest = useMemo(() => dist.slice(0, 3), [dist]);
  const farthest = dist[dist.length - 1];

  return (
    <div className="map-wrap">
      <div className="map-stage">
      {/* Search */}
      <div className="gm-search-ctl">
        <Search size={15} className="gm-search-icon" />
        <input
          className="gm-search-input"
          placeholder="Search place or address…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {searching && <span className="gm-search-spin" />}
        {open && results.length > 0 && (
          <ul className="gm-search-results">
            {results.map((r) => (
              <li key={r.place_id} onMouseDown={(e) => e.preventDefault()} onClick={() => goTo(Number(r.lat), Number(r.lon), r.display_name)}>
                <MapPin size={13} />
                <span>{r.display_name}</span>
              </li>
            ))}
          </ul>
        )}
        {open && results.length === 0 && !searching && q.trim() && (
          <div className="gm-search-none sub">No results.</div>
        )}
      </div>

      {/* Locate me */}
      <button className="gm-locate-ctl btn-icon" type="button" title="My location" aria-label="Use my location" onClick={locate}>
        <LocateFixed size={16} />
      </button>

      {/* Layer toggle (Google-style) */}
      <div className="gm-layers-ctl">
        <div className="gm-layers-row">
          <Layers size={14} />
          <span style={{ fontSize: 11.5, fontWeight: 600 }}>Map</span>
        </div>
        <div className="gm-layers-row">
          {Object.entries(BASE).filter(([k]) => k !== 'labels').map(([k, v]) => (
            <button key={k} type="button" className={`gm-layer-btn ${baseKey === k ? 'active' : ''}`} onClick={() => setBaseKey(k)}>
              {v.label}
            </button>
          ))}
          <button type="button" className={`gm-layer-btn ${showLabels ? 'active' : ''}`} onClick={() => setShowLabels((s) => !s)} title="Place labels">
            Labels
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="gm-legend">
        <div className="gm-legend-title"><School size={13} /> School <span className="gm-legend-sch">SCH</span></div>
        {Object.entries(PIN_COLOR).map(([s, c]) => (
          <div key={s} className="gm-legend-row">
            <span className="gm-legend-dot" style={{ background: c }} />
            <span className="sub" style={{ fontSize: 11 }}>{cap(s)}</span>
          </div>
        ))}
        {live.length > 0 && (
          <div className="gm-legend-row">
            <span className="gm-legend-dot gm-legend-live" style={{ background: LIVE_COLOR }} />
            <span className="sub" style={{ fontSize: 11 }}>Live now ({live.length})</span>
          </div>
        )}
      </div>

      <div ref={mapEl} className="map-canvas" />

      {clusterHint && (
        <div className="gm-cluster-hint">Clustered view — zoom in for individual students.</div>
      )}
      </div>

      {/* Sidebar */}
      <div className="card map-side">
        <div className="section-title"><MapPin size={14} /> Placement overview</div>
        <div className="stat-row" style={{ margin: '8px 0' }}>
          <span className="stat-chip">Total <b>{rows.length}</b></span>
          {dist[0]?.r && <span className="stat-chip">Nearest <b className="gm-chip-green">{fmtKm(dist[0].km)}</b></span>}
          {farthest?.r && <span className="stat-chip">Farthest <b>{fmtKm(farthest.km)}</b></span>}
        </div>

        <div className="section-title"><Navigation size={14} /> Nearest students</div>
        {!nearest.length ? <Empty text={`No plotted ${labelRef.current} records yet.`} /> : (
          <ul className="map-side-list">
            {nearest.map(({ r, km }) => (
              <li key={r.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{r.student_name}</strong>
                  <span className="badge badge-green">{fmtKm(km)}</span>
                </div>
                <div className="sub">{r.batch}{r.partner_institution ? ` · ${r.partner_institution}` : ''}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <a className="popup-link" target="_blank" rel="noopener noreferrer" href={gmapsLink(Number(r.lat), Number(r.lng))}>Map</a>
                  <a className="popup-link" target="_blank" rel="noopener noreferrer" href={gdirsLink(Number(r.lat), Number(r.lng))}>Directions</a>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="section-title" style={{ marginTop: 16 }}><LocateFixed size={14} /> Live now</div>
        {!live.length ? (
          <span className="sub">No live location check-ins right now. Students share their location from the portal during immersion hours.</span>
        ) : (
          <ul className="map-side-list">
            {live.map((m) => (
              <li key={m.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{m.student_name}</strong>
                  <span className="badge badge-red">LIVE</span>
                </div>
                <div className="sub">{m.batch}{m.partner_institution ? ` · ${m.partner_institution}` : ''}</div>
                <div className="sub">{new Date(m.captured_at).toLocaleTimeString()}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <a className="popup-link" target="_blank" rel="noopener noreferrer" href={gmapsLink(Number(m.lat), Number(m.lng))}>Map</a>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="section-title" style={{ marginTop: 16 }}><ExternalLink size={14} /> Missing coordinates</div>
        {!missing.length ? (
          <span className="sub">All {rows.length} records in this view are plotted.</span>
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
      </div>
    </div>
  );
}