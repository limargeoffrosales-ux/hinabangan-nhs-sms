import { useEffect, useState, useCallback } from 'react';
import { Switch, ToggleOn, ToggleOff, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { ErrorBanner, Badge, Button } from './ui';

const PING_INTERVAL = 2 * 60 * 1000; // 2 minutes

export default function LocationSharingToggle({ studentId, placementStatus, onToggle }) {
  const [enabled, setEnabled] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [pingInterval, setPingInterval] = useState(null);
  const [lastPing, setLastPing] = useState(null);
  const [error, setError] = useState(null);
  const [consentGiven, setConsentGiven] = useState(false);

  // Check if placement is active
  const isActive = placementStatus === 'active' || placementStatus === 'ongoing';

  // Show consent note first time
  useEffect(() => {
    const hasConsentedBefore = localStorage.getItem('location_consent_given_' + studentId);
    if (!hasConsentedBefore && enabled) {
      setShowConsent(true);
    }
  }, [enabled, studentId]);

  // Request location permission and start sharing
  const startSharing = useCallback(async () => {
    if (!isActive) {
      setError('Location sharing can only be enabled during active work immersion placement.');
      return;
    }

    try {
      if (!navigator.geolocation) {
        setError('Geolocation is not supported by your browser.');
        return;
      }

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      setConsentGiven(true);
      localStorage.setItem('location_consent_given_' + studentId, '1');
      setShowConsent(false);
      setEnabled(true);

      // Start ping loop
      startPingLoop(position.coords);
    } catch (err) {
      setError('Unable to access location. Please ensure location permissions are enabled for this site.');
      console.error('Geolocation error:', err);
    }
  }, [isActive, studentId]);

  // Stop sharing
  const stopSharing = useCallback(() => {
    setEnabled(false);
    if (pingInterval) {
      clearInterval(pingInterval);
      setPingInterval(null);
    }
  }, []);

  // Start ping loop
  const startPingLoop = useCallback((coords) => {
    if (pingInterval) {
      clearInterval(pingInterval);
    }

    setPingInterval(window.setInterval(async () => {
      try {
        await api('/immersion/location-ping', {
          method: 'POST',
          body: {
            student_id: studentId,
            latitude: coords.latitude,
            longitude: coords.longitude,
            timestamp: new Date().toISOString()
          },
          auth: true
        });
        setLastPing(new Date());
      } catch (e) {
        console.error('Location ping failed:', e);
        if (e.status === 401 || e.status === 403) {
          stopSharing();
        }
      }
    }, PING_INTERVAL));
  }, [studentId]);

  // Initialize on mount if enabled
  useEffect(() => {
    if (enabled && !pingInterval) {
      startSharing();
    }
  }, [enabled, startSharing]);

  return (
    <div style={{ maxWidth: 400 }}>
      <ErrorBanner error={error} />

      <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12 }}>
        <h4 style={{ margin: '0 0 8 0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Badge status={enabled ? 'success' : 'critical'} size="small">
            {enabled ? 'Live' : 'Off'}
          </Badge>
        </h4>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          {enabled ? 'Your location is currently being shared' : 'Share your live location during immersion hours'}
        </p>

        {/* Consent note - shown first time */}
        {showConsent && (
          <div style={{ background: 'var(--card)', padding: 12, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
            <strong>📍 Location Sharing Consent</strong>
            <p style={{ fontSize: 12, marginBottom: 0 }}>
              When enabled, your browser will share your real-time location during work immersion hours
              (approximately 8am–4pm). Your location will only be visible to your assigned adviser or
              coordinator — never to other students.
            </p>
            <ul style={{ fontSize: 11, marginTop: 4, marginBottom: 0 }}>
              <li>📍 What is collected: Latitude, longitude, and timestamp of each ping</li>
              <li>👁️ Who can see it: Only your adviser or coordinator</li>
              <li>🔧 How to disable: Toggle the switch OFF at any time</li>
              <li>🗑️ Data purging: Old pings are cleared once immersion ends</li>
            </ul>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button
                className="btn btn-sm btn-link text-primary"
                onClick={() => {
                  setConsentGiven(true);
                  localStorage.setItem('location_consent_given_' + studentId, '1');
                  setShowConsent(false);
                  startSharing();
                }}
              >
                I Agree & Continue
              </button>
              <button
                className="btn btn-sm btn-link text-secondary"
                onClick={() => {
                  setShowConsent(false);
                  setEnabled(false);
                }}
              >
                Not Now
              </button>
            </div>
          </div>
        )}

        {/* Toggle switch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text)' }}>
            {enabled ? 'Currently sharing location' : 'Share location during immersion hours'}
          </span>
          <label style={{ flex: 1, position: 'relative', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => {
                if (e.target.checked) {
                  startSharing();
                } else {
                  stopSharing();
                }
              }}
              style={{ width: 0, height: 0, padding: 0, margin: 0, opacity: 0, cursor: 'pointer' }}
            />
            <span
              style={{
                width: 40,
                height: 20,
                background: 'var(--border)',
                borderRadius: 10,
                position: 'relative',
                transition: 'all 0.3s ease'
              }}
            >
              <span
                style={{ width: 20, height: 20, background: '#18181b', borderRadius: 10, position: 'absolute', top: 0, left: 0, transition: 'all 0.3s ease' }}
              />
              <span
                style={{ width: 20, height: 20, background: '#18181b', borderRadius: 10, position: 'absolute', bottom: 0, right: 0, transition: 'all 0.3s ease' }}
              />
              <span
                style={{ position: 'absolute', top: 2, left: 4, width: 16, height: 16, background: '#fff', borderRadius: 5 }}
              />
              <span
                style={{ position: 'absolute', top: 2, right: 4, width: 16, height: 16, background: '#fff', borderRadius: 5 }}
              />
            </span>
          </label>
        </div>

        {/* Status info */}
        {enabled && lastPing && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            Last ping: {lastPing.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}

        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-sm"
            onClick={stopSharing}
            style={{ width: 'auto' }}
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}