import { useEffect, useState, useCallback, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin, Location, Search, LayerList, Toolbar, Tooltip, Circle,
  CheckCircle, XCircle, Info, Shield, Map, Pin
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, usePermission } from '../lib/auth';
import { ErrorBanner, Spinner, Badge, Button, Input, Select, Option } from '../ui';
import { useNavigate, useLocation, useRouteMatch } from 'react-router-dom';

export default function ImmersionMap() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const match = useRouteMatch();

  // Permissions: coordinators see all, advisers see only their advisees
  const isCoordinator = user?.role === 'super_admin' || user?.role === 'school_admin';
  const isAdviser = user?.role === 'assistant_principal' || user?.role === 'teacher';

  // State
  const [map, setMap] = useState(null);
  const [markers] = useState([]); // { id, lat, lng, label, studentIds, type }
  const [students] = useState([]); // All students with placements
  const [filteredStudents] = useState([]); // Search-filtered students
  const [searchQuery] = useState('');
  const [showLiveLocations] = useState(false);
  const [geofenceRadius] = useState(300); // meters, default 300m
  const [showConsentNote] = useState(true);
  const [consentGiven] = useState(false);

  // Consent note content
  const consentText = [
    '📍 Live Location Sharing',
    '',
    'When enabled, your browser will share your real-time location',
    'during your work immersion hours (approximately 8am–4pm).',
    '',
    '✅ What is collected:',
    '   • Latitude and longitude coordinates',
    '   • Timestamp of each location ping',
    '   • Your current placement venue',
    '',
    '✅ Who can see your location:',
    '   • Only your assigned adviser or coordinator',
    '   • Never visible to other students',
    '',
    '❌ Location sharing is disabled when you leave the page',
    '   or turn off the toggle.',
    '',
    '📜 Consent: By enabling this feature, you agree to this '
    'collection and viewing of your live location data.',
    '',
    '🔧 How to disable:',
    '   • Toggle the switch OFF at any time',
    '   • Your location will stop updating immediately.',
    ''
  ];

  // Initialize Leaflet map
  useEffect(() => {
    if (!document.getElementById('immersion-map')) return;

    const mapElement = document.getElementById('immersion-map');
    const institutionLat = user?.placement?.venue?.lat || 11.7056;
    const institutionLng = user?.placement?.venue?.lng || 125.2656;

    const map = L.map('immersion-map').setView([institutionLat, institutionLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.html', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // ... rest of map initialization
    return () => map?.remove();
  }, [user]);

  // Load students with placements
  useEffect(() => {
    (async () => {
      try {
        const r = await api('/immersion/map/students');
        setStudents(r.data || []);
        filterStudents();
      } catch (e) {
        console.error('Failed to load students:', e);
      }
    })();
  }, []);

  // Filter students by search query
  const filterStudents = useCallback(() => {
    const query = searchQuery.toLowerCase();
    filteredStudents.forEach(s => {
      const matches =
        (s.first_name + ' ' + s.last_name).toLowerCase().includes(query) ||
        (s.section || '').toLowerCase().includes(query) ||
        (s.strand || '').toLowerCase().includes(query) ||
        s.lrn.toLowerCase().includes(query);
      s._matches = matches;
    });
  }, [searchQuery]);

  // Geocode an address
  const geocodeAddress = useCallback(async (address) => {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`,
        { headers: { 'User-Agent': 'Hinabanga-NHS/1.0' } }
      );
      const results = await r.json();
      return results.length > 0 ? { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) } : null;
    } catch (e) {
      console.error('Geocoding error:', e);
      return null;
    }
  }, []);

  // Add a pin to the map
  const addPin = useCallback((id, lat, lng, label, studentIds, type = 'company') => {
    if (!map) return;

    const color = type === 'company'
      ? '#3b82f6'
      : studentIds.length > 0
        ? '#10b981'
        : '#6b7280';

    const studentCount = studentIds ? studentIds.length : 0;
    const pin = L.marker([lat, lng], { icon: L.icon({
      iconUrl: '/ markers-icon.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupContent: `<div><strong>${label}</strong><br/>${studentCount} student${studentCount !== 1 ? 's' : ''}</div>`
    }) });

    pin.bindPopup(`<strong>${label}</strong><br/>${studentCount} student${studentCount !== 1 ? 's' : ''} placed here`);
    pin.addTo(map);

    // Add click handler to pan to student
    pin.on('click', () => {
      // Fly to the marker location
      map.flyTo([lat, lng], 16);
    });

    return pin;
  }, [map]);

  // ... more implementation

  return (
    <div className="h-96 w-full">
      <div id="immersion-map" ref={mapRef => setMap(mapRef ? L.map(mapRef) : null)} />
      {/* Sidebar with student list */}
      <div className="p-4 border-l">
        <Input
          placeholder="Search students by name, section, or strand..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <div className="space-y-1">
          {filteredStudents.map(student => (
            <Button
              key={student.lrn}
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                if (map && student.venue_lat && student.venue_lng) {
                  map.flyTo([student.venue_lat, student.venue_lng], 16);
                }
              }}
            >
              <span className="font-medium">{student.first_name} {student.last_name}</span>
              <span className="text-xs text-muted-foreground">
                {student.section} - {student.strand || '—'}
              </span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}