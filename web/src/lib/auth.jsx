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
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => clearSession())
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
    const data = await api('/auth/login', { method: 'POST', body: { username, password }, auth: false });
    setSession(data.token, data.refreshToken, data.user);
    setUser(data.user);
    setReady(true);
    return data.user;
  }

  async function logout() {
    await apiLogout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>
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
