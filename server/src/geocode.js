const logger = require('./logger');

// Address -> coordinates resolution for placement tracing.
// Uses OpenStreetMap's Nominatim service (free, no API key). Callers should
// cache heavily and keep volume low — Nominatim asks for 1 request/second max
// and a descriptive User-Agent, which we honor here.
//
// Env knobs:
//   GEOCODE_URL             override the endpoint (tests / self-hosted nominatim)
//   GEOCODE_DISABLED=1      never call out (offline/harness mode)
//   GEOCODE_USER_AGENT      User-Agent sent to Nominatim
//   GEOCODE_MIN_INTERVAL_MS min delay between requests (Nominatim wants >= 1000)

const DISABLED = process.env.GEOCODE_DISABLED === '1';
const BASE_URL = process.env.GEOCODE_URL || 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = process.env.GEOCODE_USER_AGENT || ('HinabanganNHS-SMS/1.0 (school management system; contact: admin@hinabangan-nhs.edu.ph)');
const MIN_INTERVAL = Math.max(0, Number(process.env.GEOCODE_MIN_INTERVAL_MS || 1150));
const CACHE_MAX = 500;

let lastCall = 0;
const cache = new Map();

function normalize(address) {
  return String(address || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Returns { lat, lng } or null when unresolved.
async function geocodeAddress(address) {
  if (DISABLED || !address) return null;
  const key = normalize(address);
  if (!key) return null;
  if (cache.has(key)) return cache.get(key);

  const wait = lastCall + MIN_INTERVAL - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const url = `${BASE_URL}?format=json&limit=1&countrycodes=ph&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      cache.set(key, null);
      logger.warn({ status: res.status, address }, 'Geocoding request failed');
      return null;
    }
    const body = await res.json();
    const hit = Array.isArray(body) ? body[0] : null;
    const out = hit && hit.lat && hit.lon
      ? { lat: Number(hit.lat), lng: Number(hit.lon) }
      : null;
    cache.set(key, out);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    if (!out) logger.warn({ address }, 'Geocoding returned no result');
    return out;
  } catch (e) {
    logger.warn({ err: e.message, address }, 'Geocoding failed');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { geocodeAddress, normalize };