import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Radio, MapPin, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { ErrorBanner } from './ui';

const REPORT_INTERVAL_MS = 30000; // push a check-in every 30s while sharing
const MAX_ACCURACY_M = 250; // ignore GPS fixes worse than this
const POSITION_OPTS = { enableHighAccuracy: true, maximumAge: 15000, timeout: 12000 };

export default function PortalLiveTracker({ studentId, placement }) {
  const { t } = useTranslation();
  const [on, setOn] = useState(false);
  const [consenting, setConsenting] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | pending | live | denied | error
  const [lastPing, setLastPing] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState(null);
  const [granted, setGranted] = useState(placement.consent_status === 'granted');

  const watchIdRef = useRef(null);
  const posRef = useRef(null);
  const timerRef = useRef(null);

  const stop = useCallback(() => {
    if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    posRef.current = null;
    setOn(false);
  }, []);

  const report = useCallback(async () => {
    const p = posRef.current;
    if (!p) return;
    const a = p.accuracy != null ? Math.round(p.accuracy) : null;
    if (a != null && a > MAX_ACCURACY_M) {
      setStatus('pending');
      return;
    }
    try {
      await api('/immersion/tracking/location', {
        method: 'POST',
        body: { student_id: studentId, lat: Number(p.latitude.toFixed(7)), lng: Number(p.longitude.toFixed(7)), accuracy_m: a, source: 'device' },
      });
      setLastPing(new Date());
      setAccuracy(a);
      setStatus('live');
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }, [studentId]);

  const start = useCallback(async () => {
    setError(null);
    setStatus('pending');
    if (!navigator.geolocation) {
      setError(t('immersion.geoUnsupported', 'Live location is not supported by this browser.'));
      setStatus('error');
      return;
    }
    // Ensure consent granted first.
    if (!granted) {
      setConsenting(true);
      try {
        await api('/immersion/tracking/opt-in', {
          method: 'POST',
          body: { student_id: studentId, consent_status: 'granted' },
        });
        setGranted(true);
      } catch (e) {
        setError(e.message);
        setConsenting(false);
        setStatus('error');
        return;
      }
      setConsenting(false);
    }
    setOn(true);
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => { posRef.current = pos.coords; report(); },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setError(t('immersion.geoDenied', 'Location permission was denied. Please enable it in your browser.'));
            setStatus('denied');
          } else {
            setError(err.message || String(err.code));
            setStatus('error');
          }
        },
        POSITION_OPTS,
      );
    } catch (e) {
      setError(e.message);
      setStatus('error');
      setOn(false);
    }
  }, [granted, studentId, report, t]);

  useEffect(() => {
    if (!on) return;
    timerRef.current = setInterval(report, REPORT_INTERVAL_MS);
    report();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [on, report]);

  useEffect(() => () => stop(), [stop]);

  const canShare = placement.status === 'ongoing';

  return (
    <div className={`card portal-live ${on ? 'portal-live-on' : ''}`} style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div className="section-title" style={{ margin: 0 }}>
            <Radio size={14} /> {t('immersion.liveTitle', 'Live location sharing')}
          </div>
          {!canShare ? (
            <div className="sub" style={{ fontSize: 12 }}>{t('immersion.liveNotOngoing', 'Available once this placement is ongoing.')}</div>
          ) : granted ? (
            <div className="sub" style={{ fontSize: 12 }}>
              {t('immersion.liveGrantedHint', 'Your adviser can see your live location on the Career & TVL map while this is on.')}
            </div>
          ) : (
            <div className="sub" style={{ fontSize: 12 }}>
              {t('immersion.liveOptInHint', 'Opt in to share your real-time location during immersion hours. Your adviser can See it on the Career & TVL map.')}
            </div>
          )}
        </div>
        {canShare && (
          <button
            type="button"
            className={`btn btn-sm ${on ? 'btn-danger' : 'btn-primary'}`}
            onClick={on ? stop : start}
            disabled={status === 'pending' || consenting}
            aria-label={on ? t('immersion.liveStop', 'Stop sharing location') : t('immersion.liveStart', 'Start sharing location')}
          >
            {consenting ? '…' : on ? <Radio size={14} /> : <MapPin size={14} />} {on ? t('immersion.liveStop', 'Stop sharing') : t('immersion.liveStart', 'Share my location')}
          </button>
        )}
      </div>

      {canShare && (on || status === 'error' || status === 'denied') && (
        <div style={{ marginTop: 10 }}>
          {error && <ErrorBanner error={error} />}
          {on && (
            <div className="sub" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
              <span><Clock size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                {lastPing ? t('immersion.liveLastPing', 'Last ping {{time}}', { time: lastPing.toLocaleTimeString() }) : t('immersion.liveWaiting', 'Waiting for your location…')}
              </span>
              {accuracy != null && <span>{t('immersion.liveAccuracy', 'Accuracy ±{{m}} m', { m: accuracy })}</span>}
              {status === 'pending' && <span className="sub">{t('immersion.liveWeakSignal', 'Waiting for a more accurate signal…')}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}