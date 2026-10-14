import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import DOMPurify from 'dompurify';
import { sanitizeError } from '../lib/api';

export function Badge({ status = '', children, ...rest }) {
  const map = {
    present: 'badge-green', active: 'badge-green', enrolled: 'badge-green', PASSED: 'badge-green', ok: 'badge-green',
    absent: 'badge-red', FAILED: 'badge-red', dropped: 'badge-red', disabled: 'badge-red',
    late: 'badge-yellow', normal: 'badge-blue', excused: 'badge-blue', transferred: 'badge-blue', high: 'badge-blue', aral: 'badge-blue', simulated: 'badge-yellow',
    urgent: 'badge-red', inactive: 'badge-red', on_leave: 'badge-yellow',
    green: 'badge-green', red: 'badge-red', yellow: 'badge-yellow', blue: 'badge-blue', gray: 'badge-gray',
    'badge-green': 'badge-green', 'badge-red': 'badge-red', 'badge-yellow': 'badge-yellow', 'badge-blue': 'badge-blue', 'badge-gray': 'badge-gray',
  };
  const cls = map[String(status)] || 'badge-gray';
  return <span className={`badge ${cls}`} role="status" {...rest}>{children || String(status).toUpperCase()}</span>;
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
  const { t } = useTranslation();
  return <div className="empty" role="status">{text || t('common.noData')}</div>;
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

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-line" style={{ width: '40%', height: 18, marginBottom: 16 }} />
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, marginBottom: 12 }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className={`skeleton skeleton-line ${r === rows - 1 && c === cols - 1 ? 'skeleton-last' : ''}`}
              style={{ height: 14, width: `${60 + Math.random() * 40}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, 1fr)`, gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card" style={{ padding: 20 }}>
          <div className="skeleton skeleton-line" style={{ width: 40, height: 40, borderRadius: 8, marginBottom: 12 }} />
          <div className="skeleton skeleton-line" style={{ width: '60%', height: 22, marginBottom: 8 }} />
          <div className="skeleton skeleton-line skeleton-last" style={{ width: '80%', height: 14 }} />
        </div>
      ))}
    </div>
  );
}

export function ErrorBanner({ error }) {
  if (!error) return null;
  // Sanitize centrally: most call sites pass a raw `err.message`, which can carry
  // server internals (SQL, stack fragments, driver codes). Everything rendered
  // here passes through sanitizeError so those never reach the user.
  const text = typeof error === 'object' && error !== null
    ? sanitizeError(error)
    : String(error);
  if (!text || !text.trim()) return null;
  return <div className="err-banner" role="alert" aria-live="assertive">{text}</div>;
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
  const { t } = useTranslation();
  return (
    <Modal title={t('common.confirm')} onClose={onCancel}>
      <p style={{ fontSize: 14, marginBottom: 16 }}>{message}</p>
      <div className="modal-actions">
        <button className="btn" onClick={onCancel}>{t('common.cancel')}</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{danger ? t('common.delete') : t('common.confirm')}</button>
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
  const { t } = useTranslation();
  return (
    <div className="search-box">
      <Search size={15} />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || `${t('common.search')}…`} />
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

/* ── Rich Text Editor ─────────────────────────────────────── */
function sanitizeHtml(html) {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

export function RichTextEditor({ value, onChange, placeholder, rows = 4 }) {
  const ref = useRef(null);
  const focused = useRef(false);
  const lastHtml = useRef('');
  const { t } = useTranslation();

  useEffect(() => {
    if (ref.current && !focused.current && value !== undefined) {
      ref.current.innerHTML = value || '';
      lastHtml.current = value || '';
    }
  }, []);

  function exec(cmd, val) {
    document.execCommand(cmd, false, val || null);
    ref.current?.focus();
  }

  function handleInput() {
    const html = sanitizeHtml(ref.current?.innerHTML || '');
    if (html !== lastHtml.current) {
      lastHtml.current = html;
      onChange?.(html);
    }
  }

  function handleKeyDown(e) {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'b') { e.preventDefault(); exec('bold'); }
      else if (e.key === 'i') { e.preventDefault(); exec('italic'); }
      else if (e.key === 'u') { e.preventDefault(); exec('underline'); }
      else if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); exec('undo'); }
      else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); exec('redo'); }
    }
  }

  const btnBase = { background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 7px', cursor: 'pointer', fontSize: 12, color: 'var(--text-dim)', lineHeight: 1, fontFamily: 'var(--font-ui)' };
  const Sep = () => <span style={{ width: 1, background: 'var(--border)', margin: '2px 4px', flexShrink: 0 }} />;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: '4px 6px', borderBottom: '1px solid var(--border)', background: 'var(--bg-soft)' }}>
        <button type="button" style={btnBase} onClick={() => exec('bold')} title="Bold (Ctrl+B)"><b>B</b></button>
        <button type="button" style={btnBase} onClick={() => exec('italic')} title="Italic (Ctrl+I)"><i>I</i></button>
        <button type="button" style={btnBase} onClick={() => exec('underline')} title="Underline (Ctrl+U)"><u>U</u></button>
        <button type="button" style={btnBase} onClick={() => exec('strikeThrough')} title="Strikethrough"><s>S</s></button>
        <Sep />
        <button type="button" style={btnBase} onClick={() => exec('formatBlock', '<h2>')} title="Heading 2">H2</button>
        <button type="button" style={btnBase} onClick={() => exec('formatBlock', '<h3>')} title="Heading 3">H3</button>
        <button type="button" style={btnBase} onClick={() => exec('formatBlock', '<p>')} title="Paragraph">¶</button>
        <Sep />
        <button type="button" style={btnBase} onClick={() => exec('insertUnorderedList')} title="Bullet list">•</button>
        <button type="button" style={btnBase} onClick={() => exec('insertOrderedList')} title="Numbered list">1.</button>
        <Sep />
        <button type="button" style={btnBase} onClick={() => exec('insertHorizontalRule')} title="Horizontal rule">―</button>
        <button type="button" style={btnBase} onClick={() => { const url = prompt(t('editor.enterUrl', 'Enter URL:')); if (url) exec('createLink', url); }} title="Insert link">Link</button>
        <Sep />
        <button type="button" style={btnBase} onClick={() => exec('undo')} title="Undo (Ctrl+Z)">↩</button>
        <button type="button" style={btnBase} onClick={() => exec('redo')} title="Redo (Ctrl+Y)">↪</button>
      </div>
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-label={placeholder || t('editor.ariaLabel', 'Text editor')}
        aria-multiline="true"
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; handleInput(); }}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        style={{ minHeight: rows * 24, padding: '8px 10px', fontSize: 14, lineHeight: 1.6, outline: 'none', color: 'var(--text)' }}
        data-placeholder={placeholder || ''}
      />
    </div>
  );
}

/* ── Command Palette (Cmd+K) ──────────────────────────────── */
const PALETTE_GROUPS = [
  { groupKey: 'palette.group.main', items: [
    { labelKey: 'nav.dashboard', to: '/' },
  ]},
  { groupKey: 'palette.group.people', items: [
    { labelKey: 'nav.students', to: '/students' },
    { labelKey: 'nav.teachers', to: '/teachers' },
    { labelKey: 'nav.users', to: '/users' },
  ]},
  { groupKey: 'palette.group.academics', items: [
    { labelKey: 'nav.curriculum', to: '/curriculum' },
    { labelKey: 'nav.subjects', to: '/subjects' },
    { labelKey: 'nav.sections', to: '/sections' },
    { labelKey: 'nav.enrollment', to: '/enroll' },
    { labelKey: 'nav.lessons', to: '/lessons' },
    { labelKey: 'nav.learning', to: '/learning' },
    { labelKey: 'nav.classRecords', to: '/grades' },
    { labelKey: 'nav.assignments', to: '/assignments' },
    { labelKey: 'nav.gradingScales', to: '/grading-scales' },
    { labelKey: 'nav.rankings', to: '/rankings' },
    { labelKey: 'nav.attendance', to: '/attendance' },
  ]},
  { groupKey: 'palette.group.programs', items: [
    { labelKey: 'nav.aral', to: '/aral' },
    { labelKey: 'nav.immersion', to: '/immersion' },
    { labelKey: 'nav.careerTvl', to: '/career-tvl' },
    { labelKey: 'nav.certifications', to: '/certifications' },
    { labelKey: 'nav.submissions', to: '/submissions' },
    { labelKey: 'nav.compliance', to: '/compliance' },
    { labelKey: 'nav.interventions', to: '/interventions' },
    { labelKey: 'nav.guidance', to: '/guidance' },
    { labelKey: 'nav.conduct', to: '/discipline' },
  ]},
  { groupKey: 'palette.group.resources', items: [
    { labelKey: 'nav.rooms', to: '/rooms' },
    { labelKey: 'nav.announcements', to: '/announcements' },
    { labelKey: 'nav.notifications', to: '/notifications' },
    { labelKey: 'nav.consent', to: '/consent' },
    { labelKey: 'nav.analytics', to: '/analytics' },
    { labelKey: 'nav.depedForms', to: '/deped-forms' },
  ]},
  { groupKey: 'palette.group.system', items: [
    { labelKey: 'nav.aiTools', to: '/ai' },
    { labelKey: 'nav.designSystem', to: '/design-system' },
    { labelKey: 'nav.privacy', to: '/privacy' },
    { labelKey: 'nav.mfa', to: '/mfa' },
    { labelKey: 'nav.auditLogs', to: '/audit' },
  ]},
];

const PALETTE_FLAT = PALETTE_GROUPS.flatMap((g) => g.items);

function getRecentPalette() {
  try { return JSON.parse(localStorage.getItem('palette_recent') || '[]'); } catch { return []; }
}
function addRecentPalette(to) {
  const recent = getRecentPalette().filter((r) => r !== to);
  recent.unshift(to);
  localStorage.setItem('palette_recent', JSON.stringify(recent.slice(0, 5)));
}

export function CommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const recent = getRecentPalette();
  const recentItems = recent.map((to) => PALETTE_FLAT.find((i) => i.to === to)).filter(Boolean);

  const filtered = query.trim()
    ? PALETTE_FLAT.filter((item) => t(item.labelKey).toLowerCase().includes(query.toLowerCase()))
    : [];

  const displayItems = query.trim() ? filtered : recentItems.length ? recentItems : PALETTE_FLAT.slice(0, 10);
  const showGroups = !query.trim() && !recentItems.length;

  useEffect(() => {
    function handler(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    function onToggle() { setOpen((v) => !v); }
    window.addEventListener('keydown', handler);
    window.addEventListener('command-palette-toggle', onToggle);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('command-palette-toggle', onToggle);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  function handleKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(displayItems.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' && displayItems[activeIdx]) { go(displayItems[activeIdx].to); }
  }

  function go(to) {
    addRecentPalette(to);
    setOpen(false);
    navigate(to);
  }

  if (!open) return null;

  const kbdStyle = { fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-soft)', border: '1px solid var(--border)', color: 'var(--text-dim)' };

  return (
    <div className="modal-backdrop" style={{ zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '15vh' }}
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div style={{ background: 'var(--card-solid)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 520, boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <Search size={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKey}
            placeholder={t('palette.searchPlaceholder', 'Search pages…')}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 15, fontFamily: 'var(--font-ui)' }} />
          <kbd style={kbdStyle}>ESC</kbd>
        </div>
        <div ref={listRef} style={{ maxHeight: 360, overflowY: 'auto', padding: '4px 0' }}>
          {displayItems.length === 0 && (
            <div style={{ padding: '20px 14px', color: 'var(--text-dim)', fontSize: 13, textAlign: 'center' }}>{t('palette.noResults', { query })}</div>
          )}
          {showGroups ? (
            PALETTE_GROUPS.map((group) => {
              const groupIdx = displayItems.indexOf(group.items[0]);
              if (groupIdx === -1) return null;
              return (
                <div key={group.groupKey}>
                  <div style={{ padding: '6px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t(group.groupKey)}</div>
                  {group.items.map((item) => {
                    const idx = displayItems.indexOf(item);
                    if (idx === -1) return null;
                    return (
                      <button key={item.to} data-idx={idx} onClick={() => go(item.to)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '7px 14px', background: idx === activeIdx ? 'var(--card-hover)' : 'none', border: 'none', color: 'var(--text)', fontSize: 14, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-ui)' }}
                        onMouseEnter={() => setActiveIdx(idx)}>
                        <span style={{ flex: 1 }}>{t(item.labelKey)}</span>
                        <kbd style={kbdStyle}>↵</kbd>
                      </button>
                    );
                  })}
                </div>
              );
            })
          ) : (
            displayItems.map((item, i) => (
              <button key={item.to} data-idx={i} onClick={() => go(item.to)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '7px 14px', background: i === activeIdx ? 'var(--card-hover)' : 'none', border: 'none', color: 'var(--text)', fontSize: 14, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-ui)' }}
                onMouseEnter={() => setActiveIdx(i)}>
                <span style={{ flex: 1 }}>{t(item.labelKey)}</span>
                <kbd style={kbdStyle}>↵</kbd>
              </button>
            ))
          )}
        </div>
        <div style={{ padding: '6px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-dim)', display: 'flex', gap: 12 }}>
          <span><kbd style={kbdStyle}>↑↓</kbd> {t('palette.navigate')}</span>
          <span><kbd style={kbdStyle}>↵</kbd> {t('palette.open')}</span>
          <span><kbd style={kbdStyle}>esc</kbd> {t('palette.close')}</span>
          {!query.trim() && <span style={{ marginLeft: 'auto', opacity: 0.6 }}>{t('palette.typeToSearch')}</span>}
        </div>
      </div>
    </div>
  );
}
