import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import DOMPurify from 'dompurify';

const TYPE_COLOR = { immersion: '#2563eb', jdvp: '#0d9488' };
const STATUS_CLASS = {
  pending: 'badge-yellow', ongoing: 'badge-blue', completed: 'badge-green',
  served: 'badge-green', withdrawn: 'badge-red',
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

// Plots a list of placements on a Leaflet map. Each row is a student placement
// plus a `type` of 'immersion' | 'jdvp'.
export default function PlacementMap({ rows = [], height = 360 }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  const placed = useMemo(() => rows.filter((r) => {
    const lt = Number(r.lat), ln = Number(r.lng);
    return Number.isFinite(lt) && Number.isFinite(ln);
  }), [rows]);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: true }).setView([11.7, 125.3], 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    placed.forEach((r) => {
      const color = TYPE_COLOR[r.type] || TYPE_COLOR.immersion;
      const isImm = r.type === 'immersion';
      const popup = DOMPurify.sanitize(
        `<div style="min-width:210px">
          <strong>${esc(r.student_name)}</strong> <span class="sub">(${esc(r.grade_level)})</span>
          <div class="sub" style="font-family:monospace;font-size:11px">LRN ${esc(r.lrn)}</div>
          <div style="margin-top:6px">${esc(isImm ? r.partner_institution || r.program : r.program || r.batch)}</div>
          ${r.address ? `<div class="sub">📍 ${esc(r.address)}</div>` : ''}
          <div class="sub">${esc(r.batch)} · <span class="badge ${STATUS_CLASS[r.status] || 'badge-gray'}">${esc(r.status)}</span></div>
          ${isImm && r.start_date ? `<div class="sub">${esc(r.start_date)}${r.end_date ? ' → ' + esc(r.end_date) : ''}</div>` : ''}
          <div class="sub" style="margin-top:6px">${esc(isImm ? 'Work Immersion' : 'JDVP')}</div>
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
  }, [placed]);

  return <div ref={mapEl} style={{ height, width: '100%', borderRadius: 10, overflow: 'hidden', zIndex: 0 }} />;
}