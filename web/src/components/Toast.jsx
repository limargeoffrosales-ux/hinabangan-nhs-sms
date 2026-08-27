import { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useMemo(() => ({
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur || 6000),
    info: (msg, dur) => addToast(msg, 'info', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur || 5000),
  }), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, toast }}>
      {children}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380 }}>
        {toasts.map(t => (
          <div
            key={t.id}
            onClick={() => removeToast(t.id)}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              animation: 'toast-in 0.25s ease-out',
              background: t.type === 'success' ? '#f0fdf4' : t.type === 'error' ? '#fef2f2' : t.type === 'warning' ? '#fffbeb' : '#f0f9ff',
              color: t.type === 'success' ? '#166534' : t.type === 'error' ? '#991b1b' : t.type === 'warning' ? '#92400e' : '#1e40af',
              border: `1px solid ${t.type === 'success' ? '#bbf7d0' : t.type === 'error' ? '#fecaca' : t.type === 'warning' ? '#fde68a' : '#bfdbfe'}`,
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }`}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { toast: { success: () => {}, error: () => {}, info: () => {}, warning: () => {} } };
  return ctx;
}
