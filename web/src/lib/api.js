const TOKEN_KEY = 'meridianed_token';
const REFRESH_KEY = 'meridianed_refresh';
const BASE_KEY = 'meridianed_api_base';
const USER_KEY = 'meridianed_user';
const CSRF_KEY = 'meridianed_csrf';
const UNAUTHORIZED_EVENT = 'meridianed:unauthorized';
const ABORT_RE = /aborted/i;

// Browser-cancelled requests and AbortController timeouts both surface as an
// opaque AbortError whose message is "signal is aborted without reason".
// Translate it everywhere so that text never reaches the UI.
/**
 * @param {unknown} err
 * @returns {string | null}
 */
export function friendlyAbortMessage(err) {
  const e = /** @type {{ name?: string; message?: string }} */ (/** @type {unknown} */ (err));
  if (e && (e.name === 'AbortError' || ABORT_RE.test(String(e.message)))) {
    return 'Request was interrupted — please try again.';
  }
  return null;
}

/**
 * @returns {string}
 */
export function getApiBase() {
  const stored = localStorage.getItem(BASE_KEY);
  if (stored && stored.trim()) return stored.trim().replace(/\/+$/, '');
  return '/api/v1';
}

/**
 * @param {string} base
 */
export function setApiBase(base) {
  if (base && base.trim()) localStorage.setItem(BASE_KEY, base.trim().replace(/\/+$/, ''));
  else localStorage.removeItem(BASE_KEY);
}

export function getStoredApiBase() {
  return getApiBase();
}

// Rewrites a legacy Cloudflare R2 public-bucket URL (https://*.r2.dev/<key>)
// back to the authenticated serve proxy. Keeps stored photo/document URLs
// working after the bucket is flipped private — the proxy then redirects to a
// short-lived presigned URL instead of the CDN.
const R2_HOST_RE = /^https?:\/\/[^/]+\.r2\.dev\//i;
/**
 * @param {string} url
 * @returns {string | null}
 */
export function fileUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (R2_HOST_RE.test(url)) {
    const key = url.replace(R2_HOST_RE, '');
    if (key) return `${getApiBase()}/uploads/file/${key}`;
  }
  return url;
}

/** @type {Promise<boolean> | null} */
let refreshPromise = null;

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return sessionStorage.getItem(REFRESH_KEY);
}

export function getCsrfToken() {
  return sessionStorage.getItem(CSRF_KEY);
}

/**
 * @param {string} token
 * @param {string} refreshToken
 * @param {object | undefined} user
 * @param {string} csrfToken
 */
export function setSession(token, refreshToken, user, csrfToken) {
  sessionStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) sessionStorage.setItem(REFRESH_KEY, refreshToken);
  if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  if (csrfToken) sessionStorage.setItem(CSRF_KEY, csrfToken);
}

export function getStoredUser() {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.id || !parsed.role || !parsed.username) {
      sessionStorage.removeItem(USER_KEY);
      return null;
    }
    return parsed;
  } catch {
    sessionStorage.removeItem(USER_KEY);
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(CSRF_KEY);
  localStorage.removeItem('meridianed_ai_chat');
}

/** @type {Promise<string | null> | null} */
let currentSchoolYearPromise = null;

// Fetches the server-driven current school year (cached per session).
// Wrapped in a timeout so a hung cold start can never pin the promise forever.
export function getCurrentSchoolYear() {
  if (!currentSchoolYearPromise) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    currentSchoolYearPromise = fetch(`${getApiBase()}/school-year`, {
      method: 'GET',
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('bad status');
        const data = await res.json();
        return data.school_year || null;
      })
      .catch(() => null)
      .finally(() => {
        clearTimeout(timer);
        currentSchoolYearPromise = null;
      });
  }
  return currentSchoolYearPromise;
}

export function notifyUnauthorized() {
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

async function requestCsrfToken() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${getApiBase()}/auth/csrf-token`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${getToken()}` },
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.csrfToken) {
      sessionStorage.setItem(CSRF_KEY, data.csrfToken);
      return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** @param {number | undefined} status @param {string | undefined} message @returns {boolean} */
function isCsrfFailure(status, message) {
  if (status !== 403) return false;
  if (!message) return false;
  const m = String(message).toLowerCase();
  return m.includes('csrf') || m.includes('csrf token') || m.includes('invalid or missing csrf');
}

const RETRY_DELAYS_MS = [6000, 12000, 18000];
const BOOT_DELAYS_MS = [15000, 30000, 45000];
let warmLast = 0;

// Render's free tier sleeps the instance when idle. While it boots, the edge
// proxy can answer with gateway codes (502/503/504/520/408) instead of waiting
// for the app to come up. Those are transient — the boot usually completes
// within a minute — so they deserve the longest, boot-aware backoff rather than
// an instant "Request failed" error.
const BOOT_STATUSES = new Set([408, 502, 503, 504, 520]);

/** @param {HttpError} err @returns {boolean} */
function isRetryableNetworkFail(err) {
  if (!err) return false;
  if (friendlyAbortMessage(err)) return false; // user/browser cancel — never retry
  const status = Number(err.status);
  if (status) {
    if (BOOT_STATUSES.has(status)) return true;
    if (status >= 400) return false; // a real HTTP error
  }
  const m = String(err.message || '');
  const name = String(err.name || '');
  return status === 0
    || name === 'TypeError'
    || /timed out|failed to fetch|fetch failed|networkerror|network error|load failed/i.test(m);
}

const sleep = /** @param {number} ms @returns {Promise<void>} */ (ms) => new Promise((r) => setTimeout(r, ms));

// Render free tier sleeps the instance when idle; the first request after a
// nap can hang for 60–90s while it boots. Warming up on page load hides that
// cost before the user actually signs in.
export async function warmServer(options = {}) {
  if (Date.now() - warmLast < 60000) return;
  try {
    await api('/health', { auth: false, timeoutMs: 90000, retryNetwork: true, ...options });
    warmLast = Date.now();
  } catch { /* best-effort only */ }
}

/**
 * @typedef {object} ApiOptions
 * @property {string} [method]
 * @property {unknown} [body]
 * @property {boolean} [auth]
 * @property {number} [timeoutMs]
 * @property {boolean} [retryNetwork]
 * @property {boolean} [__csrfRetry]
 */

/**
 * @typedef {Error & { status?: number, name?: string, message?: string }} HttpError
 */

/**
 * @param {string} message
 * @param {number} status
 * @returns {HttpError}
 */
function httpError(message, status) {
  /** @type {HttpError} */
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * @param {unknown} err
 * @returns {HttpError}
 */
function toHttpError(err) {
  if (err instanceof Error) return /** @type {HttpError} */ (err);
  const e = new Error(typeof err === 'string' ? err : 'Request failed');
  return e;
}

/**
 * @param {string} path
 * @param {ApiOptions} opts
 */
async function apiInternal(path, opts) {
  const { method = 'GET', body, auth = true, timeoutMs = 75000 } = opts;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  /** @type {Record<string, string>} */
  const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
  if (auth && getToken()) headers.Authorization = `Bearer ${getToken()}`;
  if (auth && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  }
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    let res;
    try {
      /** @type {RequestInit} */
      const init = { method, headers, signal: controller.signal };
      if (body !== undefined) {
        init.body = isFormData ? /** @type {FormData} */ (body) : JSON.stringify(body);
      }
      res = await fetch(`${getApiBase()}${path}`, init);
    } catch (err) {
      // fetch aborts for two reasons: our timeout, or the browser cancelling
      // the request (navigation, connection drop, resource pressure). Both
      // surface as an opaque AbortError ("signal is aborted without reason") —
      // turn them into errors people can act on.
      if (timedOut) {
        throw httpError(`Request timed out after ${Math.round(timeoutMs / 1000)}s`, 408);
      }
      const abortMsg = friendlyAbortMessage(err);
      if (abortMsg) throw httpError(abortMsg, 0);
      throw /** @type {unknown} */ (err);
    }
    if (res.status === 401 && auth) {
      const ok = await tryRefresh();
      if (ok) return apiInternal(path, opts);
      clearSession();
      notifyUnauthorized();
      throw httpError('Session expired — please sign in again', 401);
    }
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; }
    catch { data = { error: `Request failed (${res.status})` }; }
    if (!res.ok) {
      throw httpError(data.error || `Request failed (${res.status})`, res.status);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} path
 * @param {ApiOptions & object} opts
 * @returns {Promise<Record<string, unknown>>}
 */
export async function api(path, opts = {}) {
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(opts.method || 'GET');
  // Retrying every GET by default is too aggressive: silent long blocks (up to
  // 36s) stack with the 30s page polls and pause UIs during an outage. Boot
  // backoff stays automatic; general network retries are opt-in.
  const allowRetry = opts.retryNetwork === true;
  /** @type {HttpError | undefined} */
  let lastErr;
  for (let attempt = 0; ; attempt++) {
    try {
      return await apiInternal(path, opts);
    } catch (err) {
      lastErr = /** @type {HttpError} */ (toHttpError(err));
    }
    // Self-heal stale/missing CSRF tokens: refresh the token once and retry.
    if (isMutating && opts.auth !== false && isCsrfFailure(lastErr.status, lastErr.message)) {
      const refreshed = await requestCsrfToken();
      if (refreshed) {
        try {
          return await apiInternal(path, { ...opts, __csrfRetry: true });
        } catch (retryErr) {
          const retryErr2 = /** @type {HttpError} */ (toHttpError(retryErr));
          if (isCsrfFailure(retryErr2.status, retryErr2.message)) {
            clearSession();
            notifyUnauthorized();
            throw httpError('Session expired — please sign in again', 401);
          }
          throw retryErr2;
        }
      }
    }
    const boot = BOOT_STATUSES.has(Number(lastErr.status));
    const delay = boot ? BOOT_DELAYS_MS[attempt] : RETRY_DELAYS_MS[attempt];
    if (delay === undefined || !isRetryableNetworkFail(lastErr)) break;
    if (!boot && !allowRetry) break;
    await sleep(delay);
  }
  // Last-resort guard: no remaining abort (browser-cancelled request) may
  // surface the opaque "signal is aborted without reason" text to the UI.
  const abortMsg = friendlyAbortMessage(lastErr);
  if (abortMsg) throw httpError(abortMsg, 0);
  // A sleeping instance that never finished booting should say so, not show a
  // bare "Request failed (NNN)".
  if (BOOT_STATUSES.has(Number(lastErr.status))) {
    throw httpError('The server is starting up — please wait a moment and try again.', lastErr.status || 0);
  }
  throw lastErr;
}

async function tryRefresh() {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function doRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${getApiBase()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const data = await res.json();
    // The server rotates the refresh token AND the CSRF token on every refresh;
    // persisting the rotated CSRF here avoids a guaranteed 403 + self-heal round
    // trip on the first mutating request after a refresh.
    setSession(data.token, data.refreshToken, undefined, data.csrfToken);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function logout() {
  try {
    await fetch(`${getApiBase()}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: getRefreshToken() }),
    });
  } catch {}
  clearSession();
}
