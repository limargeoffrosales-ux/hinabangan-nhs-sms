const TOKEN_KEY = 'meridianed_token';
const REFRESH_KEY = 'meridianed_refresh';
const BASE_KEY = 'meridianed_api_base';
const USER_KEY = 'meridianed_user';
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

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return sessionStorage.getItem(REFRESH_KEY);
}

export function setSession(token, refreshToken, user) {
  sessionStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) sessionStorage.setItem(REFRESH_KEY, refreshToken);
  if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
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
    const ok = await tryRefresh();
    if (ok) return api(path, { method, body, auth, timeoutMs });
    clearSession();
    notifyUnauthorized();
    const err = new Error('Session expired — please sign in again');
    err.status = 401;
    throw err;
  }
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
