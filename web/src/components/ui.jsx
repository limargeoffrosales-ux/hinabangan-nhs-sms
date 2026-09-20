import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';

export function Badge({ status, children }) {
  const map = {
    present: 'badge-green', active: 'badge-green', enrolled: 'badge-green', PASSED: 'badge-green', ok: 'badge-green',
    absent: 'badge-red', FAILED: 'badge-red', dropped: 'badge-red', disabled: 'badge-red',
    late: 'badge-yellow', normal: 'badge-blue', excused: 'badge-blue', transferred: 'badge-blue', high: 'badge-blue', aral: 'badge-blue',
    urgent: 'badge-red', inactive: 'badge-red', on_leave: 'badge-yellow',
    green: 'badge-green', red: 'badge-red', yellow: 'badge-yellow', blue: 'badge-blue', gray: 'badge-gray',
    'badge-green': 'badge-green', 'badge-red': 'badge-red', 'badge-yellow': 'badge-yellow', 'badge-blue': 'badge-blue', 'badge-gray': 'badge-gray',
  };
  const cls = map[status] || 'badge-gray';
  return <span className={`badge ${cls}`} role="status">{children || String(status).toUpperCase()}</span>;
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

export function EmptyState({ icon: Icon, text, children }) {
  return (
    <div className="empty-state" role="status">
      {Icon && <div className="empty-state-icon"><Icon size={24} /></div>}
      {text && <div className="empty-state-text">{text}</div>}
      {children}
    </div>
  );
}

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Loading" />;
}

export function Skeleton({ lines = 3, card, className = '' }) {
  if (card) {
    return (
      <div className={`skeleton-card ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className={`skeleton skeleton-line ${i === lines - 1 ? 'skeleton-last' : ''}`} />
        ))}
      </div>
    );
  }
  return (
    <div className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`skeleton skeleton-line ${i === lines - 1 ? 'skeleton-last' : ''}`} />
      ))}
    </div>
  );
}

export function ErrorBanner({ error }) {
  if (!error) return null;
  return <div className="err-banner" role="alert" aria-live="assertive">{error}</div>;
}

export function Modal({ title, sub, onClose, children, wide }) {
  const modalRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const prev = document.activeElement;
    el.focus();
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current(); }
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
  }, []);
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
      <div className="modal-actions">
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{danger ? 'Delete' : 'Confirm'}</button>
      </div>
    </Modal>
  );
}

export function KPICard({ to, icon: Icon, value, label, sub, color = 'var(--accent)' }) {
  const inner = (
    <div className="kpi-card">
      <div className="kpi-icon" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>{Icon && <Icon size={20} />}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
  if (to) {
    return <Link className="card kpi" style={{ textDecoration: 'none', cursor: 'pointer' }} to={to}>{inner}</Link>;
  }
  return <div className="card kpi">{inner}</div>;
}

export function SectionCard({ title, icon: Icon, children, action, className = '' }) {
  return (
    <div className={`card ${className}`}>
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {Icon && <Icon size={16} style={{ color: 'var(--accent)' }} />}
          <h3 style={{ margin: 0 }}>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="search-box">
      <Search size={15} />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || 'Search...'} />
    </div>
  );
}

export function StatChip({ label, value, icon: Icon, warn }) {
  return (
    <div className={`stat-chip-v2 ${warn ? 'stat-chip-warn' : ''}`}>
      {Icon && <Icon size={14} />}
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export function FunnelBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.round(value / max * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 6 }}>
        <span style={{ color: 'var(--text-dim)' }}>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="funnel-bar-bg">
        <div className="funnel-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function FeedItem({ icon: Icon, children, color }) {
  return (
    <div className="feed-item">
      <div className="feed-dot" style={color ? { background: color } : undefined} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function QuickActions({ items }) {
  return (
    <div className="quick-grid">
      {items.map((q) => (
        <Link className="btn btn-sm quick-link" to={q.to} key={q.to}>
          {q.icon && <q.icon size={13} />} {q.label}
        </Link>
      ))}
    </div>
  );
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
