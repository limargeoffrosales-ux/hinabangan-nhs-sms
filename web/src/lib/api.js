const TOKEN_KEY = 'meridianed_token';
const REFRESH_KEY = 'meridianed_refresh';
const BASE_KEY = 'meridianed_api_base';
const UNAUTHORIZED_EVENT = 'meridianed:unauthorized';

export function getApiBase() {
  const stored = localStorage.getItem(BASE_KEY);
  if (stored && stored.trim()) return stored.trim().replace(/\/+$/, '');
  return '/api/v1';
}

export function setApiBase(base) {
  if (base && base.trim()) localStorage.setItem(BASE_KEY, base.trim().replace(/\/+$/, ''));
  else localStorage.removeItem(BASE_KEY);
}

export function getStoredApiBase() {
  return getApiBase();
}

let refreshPromise = null;
let refreshRetries = 0;
const MAX_REFRESH_RETRIES = 2;

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setSession(token, refreshToken, user) {
  localStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  if (user) localStorage.setItem('meridianed_user', JSON.stringify(user));
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('meridianed_user') || 'null');
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem('meridianed_user');
}

export function notifyUnauthorized() {
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

export async function api(path, { method = 'GET', body, auth = true, timeoutMs = 30000 } = {}) {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
  if (auth && getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${getApiBase()}${path}`, {
      method,
      headers,
      body: body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined,
      signal: controller.signal,
    });
  if (res.status === 401 && auth) {
    if (refreshRetries >= MAX_REFRESH_RETRIES) {
      refreshRetries = 0;
      clearSession();
      notifyUnauthorized();
      const err = new Error('Session expired — please sign in again');
      err.status = 401;
      throw err;
    }
    refreshRetries++;
    const ok = await tryRefresh();
    if (ok) return api(path, { method, body, auth, timeoutMs });
    refreshRetries = 0;
    clearSession();
    notifyUnauthorized();
    const err = new Error('Session expired — please sign in again');
    err.status = 401;
    throw err;
  }
  refreshRetries = 0;
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; }
  catch { data = { error: `Request failed (${res.status})` }; }
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
  } finally {
    clearTimeout(timer);
  }
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
  try {
    const res = await fetch(`${getApiBase()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setSession(data.token, data.refreshToken);
    return true;
  } catch {
    return false;
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
