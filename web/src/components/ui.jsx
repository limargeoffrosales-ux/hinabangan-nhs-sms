export function Badge({ status }) {
  const map = {
    present: 'badge-green', active: 'badge-green', enrolled: 'badge-green', PASSED: 'badge-green', ok: 'badge-green',
    absent: 'badge-red', FAILED: 'badge-red', dropped: 'badge-red', disabled: 'badge-red',
    late: 'badge-yellow', normal: 'badge-blue', excused: 'badge-blue', transferred: 'badge-blue', high: 'badge-blue',
    urgent: 'badge-red',
  };
  const cls = map[status] || 'badge-gray';
  return <span className={`badge ${cls}`}>{String(status).toUpperCase()}</span>;
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
  return <div className="empty">{text || 'Nothing here yet.'}</div>;
}

export function Spinner() {
  return <div className="spinner" />;
}

export function ErrorBanner({ error }) {
  if (!error) return null;
  return <div className="err-banner">{error}</div>;
}

export function Modal({ title, sub, onClose, children, wide }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={wide ? { maxWidth: 760 } : null} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {sub && <div className="sub">{sub}</div>}
        {children}
      </div>
    </div>
  );
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
