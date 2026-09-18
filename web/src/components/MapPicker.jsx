import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Click-to-place map that feeds lat/lng back to a form.
export default function MapPicker({ lat, lng, onChange, height = 220 }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { zoomControl: false }).setView([lat || 11.7, lng || 125.3], 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      markerRef.current = L.marker([Number(lat), Number(lng)]).addTo(map);
      map.setView([Number(lat), Number(lng)], 14);
    }
    map.on('click', (e) => {
      if (markerRef.current) map.removeLayer(markerRef.current);
      markerRef.current = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);
      onChange(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6));
    });
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lat == null || lng == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
      if (markerRef.current) { map.removeLayer(markerRef.current); markerRef.current = null; }
      return;
    }
    if (!markerRef.current) markerRef.current = L.marker([Number(lat), Number(lng)]).addTo(map);
    else markerRef.current.setLatLng([Number(lat), Number(lng)]);
  }, [lat, lng]);

  return <div ref={elRef} style={{ height, width: '100%', borderRadius: 8, overflow: 'hidden' }} />;
}