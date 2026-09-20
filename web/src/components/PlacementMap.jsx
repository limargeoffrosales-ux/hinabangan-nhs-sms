import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import DOMPurify from 'dompurify';
import { Search, Layers, LocateFixed, School, ExternalLink, Navigation, MapPin } from 'lucide-react';
import { Empty } from './ui';

// School HQ used for "distance from school" figures (Hinabangan NHS — approx).
const SCHOOL_COORDS = { lat: 11.7056, lng: 125.2656 };
const SCHOOL_LABEL = 'Hinabangan NHS (approx)';

// Esri's street layer is primary: some school networks and ad-blockers block
// tile.openstreetmap.org, so OpenStreetMap is kept as the fallback instead.
const BASE = {
  street: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    label: 'Streets',
    options: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      className: 'tile-street',
      minZoom: 0,
      maxZoom: 19,
    }
  },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', label: 'Satellite' },
  labels: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}' },
};
const STREET_FALLBACK = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
};

const NOTE_STYLE = { position: 'absolute', zIndex: 1000, left: '50%', transform: 'translateX(-50%)', bottom: 48, background: 'rgba(15,23,42,0.85)', color: '#fff', fontSize: 11.5, lineHeight: 1.45, padding: '7px 12px', borderRadius: 8, maxWidth: '85%', textAlign: 'center', pointerEvents: 'none' };
const NOTE_WARN_STYLE = { ...NOTE_STYLE, background: 'rgba(185,28,28,0.92)' };

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

function companyIcon(count) {
  return L.divIcon({
    className: 'imm-pin-wrap',
    html: `<div class="imm-pin" style="background:#7c3aed;min-width:30px;text-align:center"><span class="imm-pin-tag">${count} student${count > 1 ? 's' : ''}</span></div>`,
    iconSize: [36, 26],
    iconAnchor: [18, 26],
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
const LIVE_INSIDE_COLOR = '#22c55e';
const GEOFENCE_RADIUS_M = 300;
const GEOFENCE_COLOR = '#3b82f6';

function liveIcon(recent, inside) {
  const color = inside == null ? LIVE_COLOR : inside ? LIVE_INSIDE_COLOR : LIVE_COLOR;
  return L.divIcon({
    className: 'imm-pin-wrap imm-live-wrap',
    html: `<div class="imm-live-pin" style="background:${color}"><span class="imm-live-ring"></span></div>${recent ? '<span class="imm-live-tag">LIVE</span>' : ''}`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
}

export default function PlacementMap({ rows = [], missing = [], isImmersion = true, live = [], total = rows.length, companyMode = false }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const liveLayerRef = useRef(null);
  const geofenceLayerRef = useRef(null);
  const companyLayerRef = useRef(null);
  const tl = useRef({ street: null, satellite: null, labels: null, streetFB: null });
  const schoolMarkerRef = useRef(null);
  const searchMarkerRef = useRef(null);
  const rowsKeyRef = useRef(null);
  const markerMapRef = useRef(new Map());

  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [baseKey, setBaseKey] = useState('street');
  const [showLabels, setShowLabels] = useState(false);
  const [clusterHint, setClusterHint] = useState(false);
  const [zoom, setZoom] = useState(11);
  const [fallbackNote, setFallbackNote] = useState(false);
  const [searchMsg, setSearchMsg] = useState(null);
  const [geoNote, setGeoNote] = useState(null);
  const [sidebarSearch, setSidebarSearch] = useState('');

  const labelRef = useRef('immersion');
  labelRef.current = isImmersion ? 'immersion' : 'JDVP';

  // --- map bootstrap --------------------------------------------------------
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: true, attributionControl: true }).setView([SCHOOL_COORDS.lat, SCHOOL_COORDS.lng], 11);
    tl.current.street = L.tileLayer(BASE.street.url, { attribution: OUTPUT_ATTR, maxZoom: 19 }).addTo(map);
    let streetFails = 0;
    tl.current.street.on('tileerror', () => {
      streetFails += 1;
      if (streetFails >= 3 && !tl.current.streetFB) {
        tl.current.streetFB = L.tileLayer(STREET_FALLBACK.url, { attribution: OUTPUT_ATTR, maxZoom: 19 });
        tl.current.streetFB.addTo(map);
        map.removeLayer(tl.current.street);
        tl.current.street = tl.current.streetFB;
        setFallbackNote(true);
      }
    });
    tl.current.satellite = L.tileLayer(BASE.satellite.url, { attribution: OUTPUT_ATTR, maxZoom: 19 });
    tl.current.labels = L.tileLayer(BASE.labels.url, { attribution: OUTPUT_ATTR });
    L.control.scale({ position: 'bottomright' }).addTo(map);

    // Ad-blockers / firewalls sometimes fail tiles silently (no 'tileerror'
    // event). If no street tile has loaded within a few seconds, force an
    // alternate street base so the map never stays gray.
    const swappedRef = { current: false };
    const trySwapStreet = () => {
      if (swappedRef.current) return;
      const loaded = document.querySelectorAll('.leaflet-container .leaflet-tile-loaded').length;
      if (loaded === 0 && tl.current.street && !tl.current.streetFB) {
        tl.current.streetFB = L.tileLayer(STREET_FALLBACK.url, { attribution: OUTPUT_ATTR, maxZoom: 19 });
        tl.current.streetFB.addTo(map);
        map.removeLayer(tl.current.street);
        // keep live/sub-panes above the new base
        map.removeLayer(liveLayerRef.current);
        map.removeLayer(geofenceLayerRef.current);
        map.removeLayer(companyLayerRef.current);
        map.removeLayer(schoolMarkerRef.current);
        tl.current.street = tl.current.streetFB;
        swappedRef.current = true;
        liveLayerRef.current.addTo(map);
        geofenceLayerRef.current.addTo(map);
        companyLayerRef.current.addTo(map);
        schoolMarkerRef.current.addTo(map);
        setFallbackNote(true);
      }
    };
    const t1 = setTimeout(trySwapStreet, 4000);
    const t2 = setTimeout(trySwapStreet, 8000);

    layerRef.current = L.layerGroup().addTo(map);
    liveLayerRef.current = L.layerGroup().addTo(map);
    geofenceLayerRef.current = L.layerGroup().addTo(map);
    companyLayerRef.current = L.layerGroup().addTo(map);
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
      clearTimeout(t1);
      clearTimeout(t2);
      map.remove();
      mapRef.current = null; layerRef.current = null; liveLayerRef.current = null;
      geofenceLayerRef.current = null; companyLayerRef.current = null;
      schoolMarkerRef.current = null; searchMarkerRef.current = null;
      tl.current = { street: null, satellite: null, labels: null, streetFB: null };
      markerMapRef.current.clear();
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
        ${m.address ? `<div class="sub">\u{1F4CD} ${esc(m.address)}</div>` : ''}
        <div class="sub">${esc(m.batch)} · <span class="badge ${BADGE_FOR[m.status] || 'badge-gray'}">${esc(m.status)}</span></div>
        ${m.start_date ? `<div class="sub">${esc(m.start_date)}${m.end_date ? ' \u2192 ' + esc(m.end_date) : ''}</div>` : ''}
        <div class="sub" style="margin-top:6px">\u{1F3EB} ${fmtKm(km)} from school</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <a class="popup-link" target="_blank" rel="noopener noreferrer" href="${gmapsLink(Number(m.lat).toFixed(6), Number(m.lng).toFixed(6))}">Open in Google Maps</a>
          <a class="popup-link" target="_blank" rel="noopener noreferrer" href="${gdirsLink(Number(m.lat).toFixed(6), Number(m.lng).toFixed(6))}">Directions from school</a>
        </div>
      </div>`,
    );
    const marker = L.marker([Number(m.lat), Number(m.lng)], { icon: pinIcon(color) })
      .bindPopup(popup)
      .addTo(layerRef.current);
    markerMapRef.current.set(m.student_id, marker);
    return marker;
  }, [isImmersion]);

  const rowsKey = useCallback((list) => list.map((x) => x.id).join(','), []);

  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    companyLayerRef.current.clearLayers();
    markerMapRef.current.clear();
    if (!rows.length) return;

    if (companyMode) {
      const groups = {};
      rows.forEach((r) => {
        const key = r.partner_institution || 'Unknown';
        if (!groups[key]) groups[key] = { name: key, students: [], lat: null, lng: null };
        groups[key].students.push(r);
        if (groups[key].lat == null && r.lat != null) { groups[key].lat = Number(r.lat); groups[key].lng = Number(r.lng); }
      });
      Object.values(groups).forEach((g) => {
        if (g.lat == null) return;
        const popup = DOMPurify.sanitize(
          `<div style="min-width:250px">
            <strong>${esc(g.name)}</strong>
            <div class="sub">${g.students.length} student${g.students.length > 1 ? 's' : ''} placed here</div>
            <ul style="margin:8px 0;padding-left:16px;font-size:12px;list-style:disc">
              ${g.students.map((s) => `<li>${esc(s.student_name)} <span class="sub">(${esc(s.grade_level || '')}) \u00b7 ${esc(s.batch)}</span></li>`).join('')}
            </ul>
            <div style="display:flex;gap:8px;margin-top:4px">
              <a class="popup-link" target="_blank" rel="noopener noreferrer" href="${gmapsLink(g.lat, g.lng)}">Open in Google Maps</a>
            </div>
          </div>`,
        );
        L.marker([g.lat, g.lng], { icon: companyIcon(g.students.length) })
          .bindPopup(popup)
          .addTo(companyLayerRef.current);
        g.students.forEach((s) => { markerMapRef.current.set(s.student_id, null); });
      });
      const coords = Object.values(groups).filter((g) => g.lat != null).map((g) => [g.lat, g.lng]);
      if (coords.length) map.fitBounds(L.latLngBounds(coords).pad(0.1));
    } else {
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
              `<div style="min-width:180px"><strong>${g.length} students</strong><div class="sub">Zoom in to see individual pins \u2014 approximate locations for ${labelRef.current} placements in this area.</div></div>`,
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
        const ok = rows.filter((r) => {
          if (r.lat == null || r.lng == null) return false;
          if (String(r.lat).trim() === '' || String(r.lng).trim() === '') return false;
          return Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng));
        });
        if (ok.length) map.fitBounds(L.latLngBounds(ok.map((r) => [Number(r.lat), Number(r.lng)])).pad(0.06));
      }
    }
  }, [rows, zoom, addPin, rowsKey, companyMode]);

  useEffect(() => { rowsKeyRef.current = null; }, [isImmersion]);

  // --- geofence circles (300m around each company) --------------------------
  useEffect(() => {
    const layer = geofenceLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    const groups = {};
    rows.forEach((r) => {
      if (r.lat == null || r.lng == null) return;
      const key = r.partner_institution || 'Unknown';
      if (!groups[key]) groups[key] = { lat: Number(r.lat), lng: Number(r.lng) };
    });
    Object.values(groups).forEach((g) => {
      L.circle([g.lat, g.lng], {
        radius: GEOFENCE_RADIUS_M,
        color: GEOFENCE_COLOR,
        weight: 1.5,
        fillColor: GEOFENCE_COLOR,
        fillOpacity: 0.07,
        dashArray: '6 4',
        interactive: false,
      }).addTo(layer);
    });
  }, [rows]);

  // --- live tracking pins with geofence coloring ----------------------------
  useEffect(() => {
    const map = mapRef.current, layer = liveLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!live.length) return;

    const companyMap = {};
    rows.forEach((r) => {
      if (r.partner_institution && r.lat != null) {
        companyMap[r.partner_institution] = { lat: Number(r.lat), lng: Number(r.lng) };
      }
    });

    const now = Date.now();
    live.forEach((m) => {
      const capturedMs = Date.parse(m.captured_at);
      const recent = Number.isFinite(capturedMs) && (now - capturedMs) < 10 * 60 * 1000;

      let inside = null;
      const company = m.partner_institution ? companyMap[m.partner_institution] : null;
      if (company) {
        const d = haversine(company.lat, company.lng, Number(m.lat), Number(m.lng));
        inside = d * 1000 <= GEOFENCE_RADIUS_M;
      }

      const badgeHtml = inside == null
        ? '<span class="badge badge-red">LIVE</span>'
        : inside
          ? '<span class="badge badge-green">LIVE</span>'
          : '<span class="badge badge-red">LIVE</span>';

      const popup = DOMPurify.sanitize(
        `<div style="min-width:210px">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
            <strong>${esc(m.student_name)}</strong> ${badgeHtml}
          </div>
          <div class="sub" style="font-family:monospace;font-size:11px">LRN ${esc(m.lrn)}</div>
          <div style="margin-top:6px">${esc(m.partner_institution || m.program || '')}</div>
          <div class="sub">${esc(m.batch)} \u00b7 Last seen <b>${recent ? 'just now' : esc(new Date(capturedMs).toLocaleTimeString())}</b></div>
          ${m.accuracy_m != null ? `<div class="sub">Accuracy \u00b1${Math.round(m.accuracy_m)} m</div>` : ''}
          ${inside != null ? `<div class="sub" style="color:${inside ? LIVE_INSIDE_COLOR : LIVE_COLOR}">${inside ? '\u2713 Inside' : '\u2717 Outside'} geofence (${GEOFENCE_RADIUS_M} m)</div>` : ''}
          <div class="sub">${cap(m.source)} report</div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <a class="popup-link" target="_blank" rel="noopener noreferrer" href="${gmapsLink(Number(m.lat).toFixed(6), Number(m.lng).toFixed(6))}">Open in Google Maps</a>
          </div>
        </div>`,
      );
      L.marker([Number(m.lat), Number(m.lng)], { icon: liveIcon(recent, inside), zIndexOffset: 1000 })
        .bindPopup(popup)
        .addTo(layer);
    });
  }, [live, rows]);

  // --- search (Nominatim) -----------------------------------------------------
  const doSearch = useCallback(async (term) => {
    if (!term.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=6&dedupe=0&accept-language=fil,en` +
          `&countrycodes=ph&viewbox=124.80,12.10,125.60,11.40&bounded=0&q=${encodeURIComponent(term)}`,
        { headers: { Accept: 'application/json' } },
      );
      const j = await r.json();
      const list = Array.isArray(j) ? j : [];
      setResults(list);
      setSearchMsg(list.length ? null : 'no-results');
    } catch {
      setResults([]);
      setSearchMsg('blocked');
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!q.trim()) { setResults([]); setSearchMsg(null); setOpen(false); return; }
    setSearchMsg(null);
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

  const panToStudent = useCallback((studentId) => {
    const map = mapRef.current;
    if (!map) return;
    const marker = markerMapRef.current.get(studentId);
    if (marker) {
      const ll = marker.getLatLng();
      map.flyTo([ll.lat, ll.lng], Math.max(map.getZoom(), 14));
      marker.openPopup();
    }
  }, []);

  const locate = useCallback(() => {
    if (!navigator.geolocation) { setGeoNote('no-gps'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => goTo(pos.coords.latitude, pos.coords.longitude, 'You are here'),
      (err) => {
        setGeoNote(err && err.code === err.PERMISSION_DENIED ? 'denied' : 'no-gps');
        setTimeout(() => setGeoNote(null), 9000);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [goTo]);

  const nearest = useMemo(() => dist.slice(0, 3), [dist]);
  const farthest = dist[dist.length - 1];

  const liveInside = useMemo(() => {
    if (!live.length) return { inside: 0, outside: 0 };
    const companyMap = {};
    rows.forEach((r) => {
      if (r.partner_institution && r.lat != null) {
        companyMap[r.partner_institution] = { lat: Number(r.lat), lng: Number(r.lng) };
      }
    });
    let inside = 0, outside = 0;
    live.forEach((m) => {
      const c = m.partner_institution ? companyMap[m.partner_institution] : null;
      if (c) {
        const d = haversine(c.lat, c.lng, Number(m.lat), Number(m.lng));
        if (d * 1000 <= GEOFENCE_RADIUS_M) inside++; else outside++;
      }
    });
    return { inside, outside };
  }, [live, rows]);

  const filteredStudents = useMemo(() => {
    if (!sidebarSearch.trim()) return dist;
    const term = sidebarSearch.toLowerCase();
    return dist.filter(({ r }) =>
      (r.student_name || '').toLowerCase().includes(term) ||
      (r.batch || '').toLowerCase().includes(term) ||
      (r.partner_institution || '').toLowerCase().includes(term) ||
      (r.grade_level || '').toLowerCase().includes(term) ||
      (r.lrn || '').toLowerCase().includes(term)
    );
  }, [dist, sidebarSearch]);

  return (
    <div className="map-wrap">
      <div className="map-stage">
      {/* Search */}
      <div className="gm-search-ctl">
        <Search size={15} className="gm-search-icon" />
        <input
          className="gm-search-input"
          placeholder="Search place or address\u2026"
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
          <div className="gm-search-none sub">
            {searchMsg === 'blocked'
              ? 'Search is unreachable \u2014 likely blocked by this network or an ad-blocker, or you are offline. Use "Locate me" or set pins from the Immersion page.'
              : `No results for \u201c${q}\u201d. Try a town, barangay or landmark (e.g., Catbalogan).`}
          </div>
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
            <button key={k} type="button" className={`gm-layer-btn ${baseKey === k ? 'active' : ''}`}
              onClick={() => { setBaseKey(k); if (k !== 'satellite') setShowLabels(false); }}>
              {v.label}
            </button>
          ))}
          <button type="button" className={`gm-layer-btn ${baseKey === 'satellite' && showLabels ? 'active' : ''}`}
            onClick={() => { if (baseKey === 'street') setBaseKey('satellite'); setShowLabels((s) => !s); }} title="Place labels">
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
          <>
            <div className="gm-legend-row">
              <span className="gm-legend-dot gm-legend-live" style={{ background: LIVE_INSIDE_COLOR }} />
              <span className="sub" style={{ fontSize: 11 }}>Live \u2014 inside ({liveInside.inside})</span>
            </div>
            <div className="gm-legend-row">
              <span className="gm-legend-dot gm-legend-live" style={{ background: LIVE_COLOR }} />
              <span className="sub" style={{ fontSize: 11 }}>Live \u2014 outside ({liveInside.outside})</span>
            </div>
          </>
        )}
      </div>

      <div ref={mapEl} className="map-canvas" />

      {clusterHint && (
        <div className="gm-cluster-hint">Clustered view \u2014 zoom in for individual students.</div>
      )}
      {fallbackNote && (
        <div style={NOTE_STYLE}>
          Street tiles were slow to load on this network — showing an alternate street map.
        </div>
      )}
      {geoNote && (
        <div style={NOTE_WARN_STYLE}>
          {geoNote === 'denied'
            ? 'Location is blocked by the browser. Click the shield/location icon in the address bar and allow location, then try "Locate me" again.'
            : 'Could not get your position \u2014 no GPS signal or the request timed out.'}
        </div>
      )}
      </div>

      {/* Sidebar */}
      <div className="card map-side">
        <div className="section-title"><MapPin size={14} /> Placement overview</div>
        <div className="stat-row" style={{ margin: '8px 0' }}>
          <span className="stat-chip">Total <b>{total}</b></span>
          {dist[0]?.r && <span className="stat-chip">Nearest <b className="gm-chip-green">{fmtKm(dist[0].km)}</b></span>}
          {farthest?.r && <span className="stat-chip">Farthest <b>{fmtKm(farthest.km)}</b></span>}
        </div>

        {/* Student search */}
        <div style={{ margin: '8px 0' }}>
          <input
            className="input"
            type="text"
            placeholder="Search students\u2026"
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            style={{ width: '100%', fontSize: 12 }}
          />
        </div>

        <div className="section-title"><Navigation size={14} /> Students {!sidebarSearch ? '(nearest)' : `(${filteredStudents.length})`}</div>
        {!filteredStudents.length ? <Empty text={sidebarSearch ? 'No students match your search.' : `No plotted ${labelRef.current} records yet.`} /> : (
          <ul className="map-side-list" style={{ maxHeight: 280, overflowY: 'auto' }}>
            {filteredStudents.map(({ r, km }) => (
              <li key={r.id} style={{ cursor: 'pointer' }} onClick={() => r.lat != null && panToStudent(r.student_id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{r.student_name}</strong>
                  {r.lat != null && <span className="badge badge-green">{fmtKm(km)}</span>}
                </div>
                <div className="sub">{r.batch}{r.partner_institution ? ` \u00b7 ${r.partner_institution}` : ''}</div>
                {r.lat != null && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <a className="popup-link" target="_blank" rel="noopener noreferrer" href={gmapsLink(Number(r.lat), Number(r.lng))} onClick={(e) => e.stopPropagation()}>Map</a>
                    <a className="popup-link" target="_blank" rel="noopener noreferrer" href={gdirsLink(Number(r.lat), Number(r.lng))} onClick={(e) => e.stopPropagation()}>Directions</a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="section-title" style={{ marginTop: 16 }}><LocateFixed size={14} /> Live now</div>
        {!live.length ? (
          <span className="sub">No live location check-ins right now. Students share their location from the portal during immersion hours.</span>
        ) : (
          <ul className="map-side-list">
            {live.map((m) => {
              const c = m.partner_institution ? rows.find((r) => r.partner_institution === m.partner_institution && r.lat != null) : null;
              const inside = c ? haversine(Number(c.lat), Number(c.lng), Number(m.lat), Number(m.lng)) * 1000 <= GEOFENCE_RADIUS_M : null;
              return (
                <li key={m.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong>{m.student_name}</strong>
                    <span className={`badge ${inside == null ? 'badge-red' : inside ? 'badge-green' : 'badge-red'}`}>LIVE</span>
                  </div>
                  <div className="sub">{m.batch}{m.partner_institution ? ` \u00b7 ${m.partner_institution}` : ''}</div>
                  <div className="sub">{new Date(m.captured_at).toLocaleTimeString()}</div>
                </li>
              );
            })}
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
                <div className="sub">{r.batch}{r.partner_institution ? ` \u00b7 ${r.partner_institution}` : ''}</div>
                <div className="sub">Open the {isImmersion ? 'Immersion' : 'JDVP'} page and set an address or pin.</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
