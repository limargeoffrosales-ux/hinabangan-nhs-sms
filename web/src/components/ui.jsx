import { useEffect, useRef } from 'react';

export function Badge({ status }) {
  const map = {
    present: 'badge-green', active: 'badge-green', enrolled: 'badge-green', PASSED: 'badge-green', ok: 'badge-green',
    absent: 'badge-red', FAILED: 'badge-red', dropped: 'badge-red', disabled: 'badge-red',
    late: 'badge-yellow', normal: 'badge-blue', excused: 'badge-blue', transferred: 'badge-blue', high: 'badge-blue', aral: 'badge-blue',
    urgent: 'badge-red', inactive: 'badge-red', on_leave: 'badge-yellow',
    green: 'badge-green', red: 'badge-red', yellow: 'badge-yellow', blue: 'badge-blue', gray: 'badge-gray',
    'badge-green': 'badge-green', 'badge-red': 'badge-red', 'badge-yellow': 'badge-yellow', 'badge-blue': 'badge-blue', 'badge-gray': 'badge-gray',
  };
  const cls = map[status] || 'badge-gray';
  return <span className={`badge ${cls}`} role="status">{String(status).toUpperCase()}</span>;
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <h2>{title}</h2>
      {sub && <p className="sub">{sub}</p>}
      {children}
    </div>
  );
}

export function Empty({ text }) {
  return <div className="empty" role="status">{text || 'Nothing here yet.'}</div>;
}

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Loading" />;
}

export function ErrorBanner({ error }) {
  if (!error) return null;
  return <div className="err-banner" role="alert" aria-live="assertive">{error}</div>;
}

export function Modal({ title, sub, onClose, children, wide }) {
  const modalRef = useRef(null);
  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const prev = document.activeElement;
    el.focus();
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const focusable = el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    el.addEventListener('keydown', onKey);
    return () => { el.removeEventListener('keydown', onKey); if (prev) prev.focus(); };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" ref={modalRef} role="dialog" aria-modal="true" aria-label={title}
        style={wide ? { maxWidth: 760 } : null} onClick={(e) => e.stopPropagation()} tabIndex={-1}>
        <h3>{title}</h3>
        {sub && <div className="sub">{sub}</div>}
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ message, onConfirm, onCancel, danger }) {
  return (
    <Modal title="Confirm" onClose={onCancel}>
      <p style={{ fontSize: 14, marginBottom: 16 }}>{message}</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{danger ? 'Delete' : 'Confirm'}</button>
      </div>
    </Modal>
  );
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
