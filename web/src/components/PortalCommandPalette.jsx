import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

const PORTAL_PALETTE_GROUPS = [
  { groupKey: 'portal.group.overview', items: [
    { labelKey: 'portal.home', to: '/portal' },
  ]},
  { groupKey: 'portal.group.learning', items: [
    { labelKey: 'portal.grades', to: '/portal/grades' },
    { labelKey: 'portal.analytics', to: '/portal/analytics' },
    { labelKey: 'portal.schedule', to: '/portal/schedule' },
    { labelKey: 'portal.assignments', to: '/portal/assignments' },
    { labelKey: 'portal.attendance', to: '/portal/attendance' },
  ]},
  { groupKey: 'portal.group.career', items: [
    { labelKey: 'portal.portfolio', to: '/portal/portfolio' },
    { labelKey: 'portal.immersion', to: '/portal/immersion' },
    { labelKey: 'portal.certifications', to: '/portal/certifications' },
    { labelKey: 'portal.enroll', to: '/portal/enroll' },
  ]},
  { groupKey: 'portal.group.news', items: [
    { labelKey: 'portal.announcements', to: '/portal/announcements' },
  ]},
  { groupKey: 'portal.group.account', items: [
    { labelKey: 'portal.profile', to: '/portal/profile' },
  ]},
];

const PORTAL_PALETTE_FLAT = PORTAL_PALETTE_GROUPS.flatMap((g) => g.items);

function getRecent() {
  try { return JSON.parse(localStorage.getItem('portal_palette_recent') || '[]'); } catch { return []; }
}
function addRecent(to) {
  const recent = getRecent().filter((r) => r !== to);
  recent.unshift(to);
  localStorage.setItem('portal_palette_recent', JSON.stringify(recent.slice(0, 5)));
}

export default function PortalCommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const recentItems = getRecent().map((to) => PORTAL_PALETTE_FLAT.find((i) => i.to === to)).filter(Boolean);
  const filtered = query.trim()
    ? PORTAL_PALETTE_FLAT.filter((item) => t(item.labelKey).toLowerCase().includes(query.toLowerCase()))
    : [];
  const displayItems = query.trim() ? filtered : recentItems.length ? recentItems : PORTAL_PALETTE_FLAT.slice(0, 8);
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
    window.addEventListener('portal-palette-toggle', onToggle);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('portal-palette-toggle', onToggle);
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
    else if (e.key === 'Enter' && displayItems[activeIdx]) go(displayItems[activeIdx].to);
  }

  function go(to) {
    addRecent(to);
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
            PORTAL_PALETTE_GROUPS.map((group) => {
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