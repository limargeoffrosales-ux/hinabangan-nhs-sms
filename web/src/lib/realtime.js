import { getApiBase, getToken } from './api';

// Client side of the SSE live feed (server: /api/v1/realtime/stream).
// Pages subscribe with guard(s) and get a tiny payload like
// { type: 'notification', event: 'grade_posted', ts } or
// { type: 'announcement', action: 'created', id }.
// The stream is a refetch *hint* only — clients always re-query their data.

let source = null;
const listeners = new Set();
let reconnectTimer = null;
let retryMs = 3000;

function connect() {
  const token = getToken();
  if (!token) return;
  try {
    const es = new EventSource(`${getApiBase()}/realtime/stream?token=${encodeURIComponent(token)}`);
    source = es;

    es.onopen = () => {
      retryMs = 3000;
    };

    es.onmessage = (e) => {
      let data;
      try { data = JSON.parse(e.data); } catch { return; }
      if (!data || typeof data.type !== 'string') return;
      for (const fn of listeners) {
        try { fn(data); } catch { /* subscriber error is non-fatal */ }
      }
    };

    es.onerror = () => {
      es.close();
      if (source === es) source = null;
      if (listeners.size && !reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, retryMs);
        retryMs = Math.min(retryMs * 1.8, 30000);
      }
    };
  } catch { /* EventSource unavailable */ }
}

function disconnect() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (source) { source.close(); source = null; }
}

// subscribeLive(fn) — fn receives every live frame. Returns an unsubscribe fn.
export function subscribeLive(fn) {
  listeners.add(fn);
  if (!source && typeof EventSource !== 'undefined') connect();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    listeners.delete(fn);
    if (listeners.size === 0) disconnect();
  };
}

// Reconnect when the user returns to the tab and the stream went stale.
window.addEventListener('focus', () => {
  if (listeners.size && !source) {
    retryMs = 3000;
    connect();
  }
});