import { createContext, useContext, useEffect, useState } from 'react';
import { api, setSession, getStoredUser, getToken, clearSession, logout as apiLogout } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [ready, setReady] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    api('/auth/me', { retryNetwork: true })
      .then((d) => setUser(d.user))
      .catch((err) => {
        // Only drop the session on real auth failures (401/403). Transient
        // network errors — Render cold starts, timeouts, 5xx — keep the stored
        // session so users aren't silently logged out.
        if (err && (err.status === 401 || err.status === 403)) clearSession();
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    function onUnauthorized() {
      clearSession();
      setUser(null);
      setReady(true);
    }
    window.addEventListener('meridianed:unauthorized', onUnauthorized);
    return () => window.removeEventListener('meridianed:unauthorized', onUnauthorized);
  }, []);

  async function login(username, password) {
    const data = await api('/auth/login', { method: 'POST', body: { username, password }, auth: false, retryNetwork: true });
    if (data.requiresMfa) return { requiresMfa: true, tempToken: data.tempToken };
    setSession(data.token, data.refreshToken, data.user, data.csrfToken);
    setUser(data.user);
    setReady(true);
    return { user: data.user };
  }

  async function verifyMfa(tempToken, code) {
    const data = await api('/mfa/verify', {
      method: 'POST',
      body: { tempToken, code },
      auth: false,
      retryNetwork: true,
    });
    setSession(data.token, data.refreshToken, data.user, data.csrfToken);
    setUser(data.user);
    setReady(true);
    return { user: data.user };
  }

  async function logout() {
    await apiLogout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, verifyMfa, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function can(role, ...roles) {
  return roles.includes(role);
}
