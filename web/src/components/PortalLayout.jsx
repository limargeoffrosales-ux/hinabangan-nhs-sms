import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Home, GraduationCap, CalendarCheck, CalendarRange, Megaphone, LogOut, KeyRound,
  NotebookPen, Globe, Briefcase, BookOpen, BarChart3, Award, ClipboardList, UserRound,
  Menu, Moon, Sun, Check, Search, Trophy,
} from 'lucide-react';
import { useAuth, can } from '../lib/auth';
import { GroupedNav, useTheme } from '../design-system';
import { Modal, initials } from './ui';
import PortalCommandPalette from './PortalCommandPalette';
import { api } from '../lib/api';

const PORTAL_NAV_GROUPS = [
  {
    id: 'overview',
    label: 'portal.group.overview',
    items: [
      { id: '/portal', label: 'portal.home', icon: <Home size={16} /> },
    ],
  },
  {
    id: 'learning',
    label: 'portal.group.learning',
    items: [
      { id: '/portal/grades', label: 'portal.grades', icon: <GraduationCap size={16} /> },
      { id: '/portal/analytics', label: 'portal.analytics', icon: <BarChart3 size={16} /> },
      { id: '/portal/schedule', label: 'portal.schedule', icon: <CalendarRange size={16} /> },
      { id: '/portal/assignments', label: 'portal.assignments', icon: <NotebookPen size={16} /> },
      { id: '/portal/attendance', label: 'portal.attendance', icon: <CalendarCheck size={16} /> },
    ],
  },
  {
    id: 'career',
    label: 'portal.group.career',
    items: [
      { id: '/portal/portfolio', label: 'portal.portfolio', icon: <BookOpen size={16} /> },
      { id: '/portal/immersion', label: 'portal.immersion', icon: <Briefcase size={16} /> },
      { id: '/portal/certifications', label: 'portal.certifications', icon: <Award size={16} /> },
      { id: '/portal/enroll', label: 'portal.enroll', icon: <ClipboardList size={16} /> },
    ],
  },
  {
    id: 'news',
    label: 'portal.group.news',
    items: [
      { id: '/portal/announcements', label: 'portal.announcements', icon: <Megaphone size={16} /> },
      { id: '/portal/sports-news', label: 'portal.sportsNews', icon: <Trophy size={16} /> },
    ],
  },
  {
    id: 'account',
    label: 'portal.group.account',
    items: [
      { id: '/portal/profile', label: 'portal.profile', icon: <UserRound size={16} /> },
    ],
  },
];

export default function PortalLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isParent = can(user?.role, 'parent', 'guardian');
  const [pwOpen, setPwOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState(null);
  const [pwMsg, setPwMsg] = useState(null);

  async function onLogout() {
    await logout();
    navigate('/login');
  }

  async function onChangePassword(e) {
    e.preventDefault();
    setPwErr(null);
    setPwMsg(null);
    if (pw.next.length < 12) return setPwErr(t('pw.tooShort'));
    if (pw.next !== pw.confirm) return setPwErr(t('pw.noMatch'));
    setPwBusy(true);
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword: pw.current, newPassword: pw.next } });
      setPwMsg(t('pw.updated'));
      setPw({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPwErr(err.message || t('pw.failed'));
    } finally {
      setPwBusy(false);
    }
  }

  function pickLang(lng) {
    i18n.changeLanguage(lng);
    localStorage.setItem('meridianed_lang', lng);
    setLangOpen(false);
  }

  function go(to) {
    setMenuOpen(false);
    if (to.startsWith('/')) navigate(to);
  }

  const activeId = location.pathname;

  return (
    <div className="app-shell">
      <PortalCommandPalette />
      <a href="#main-content" className="skip-link">{t('layout.skipToContent')}</a>
      <div className={`sidebar-overlay ${menuOpen ? 'show' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`} role="navigation" aria-label={t('portalTitle')}>
        <div className="brand">
          <div className="brand-seal">
            <img className="brand-logo" src="/logo.jpg" alt="" />
          </div>
          <div className="brand-text-group">
            <span className="brand-name">{t('brand')}</span>
            <span className="brand-sub">{isParent ? t('portal.roleParent') : t('portal.roleStudent')}</span>
          </div>
        </div>
        <div className="brand-divider"></div>
        <GroupedNav
          collapsible={false}
          groups={PORTAL_NAV_GROUPS.map((g) => ({
            id: g.id,
            label: t(g.label),
            items: g.items.map((i) => ({
              id: i.id,
              label: t(i.label),
              icon: i.icon,
            })),
          }))}
          activeId={activeId}
          onNavigate={go}
          className="portal-sidebar-nav"
        />
        <div style={{ marginTop: 'auto', padding: '12px 4px 4px', borderTop: '1px solid var(--border)' }}>
          <button
            className="sidebar-link"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-dim)', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', cursor: 'pointer' }}
            onClick={() => window.dispatchEvent(new Event('portal-palette-toggle'))}
          >
            <span><Search size={12} style={{ verticalAlign: -2, marginRight: 6 }} />{t('layout.quickSearch')}</span>
            <kbd style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-soft)', border: '1px solid var(--border)' }}>⌘K</kbd>
          </button>
          <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            <div>{t('schoolTagline')}</div>
          </div>
        </div>
      </aside>
      <div className="main" id="main-content" role="main">
        <div className="topbar" role="banner">
          <button className="icon-btn menu-btn" onClick={() => setMenuOpen(!menuOpen)} title={t('topbar.menu')} aria-label={t('topbar.menu')}>
            <Menu size={17} aria-hidden="true" />
          </button>
          <img className="brand-logo" src="/logo.jpg" alt={t('portal.schoolLogo')} style={{ width: 34, height: 34, flexShrink: 0 }} />
          <h1 style={{ fontSize: 16 }}>{t('brand')} · {t('portalTitle')}</h1>
          <div className="lang-wrap" style={{ position: 'relative' }}>
            <button className="icon-btn" onClick={() => { setLangOpen((o) => !o); setPwOpen(false); }} title={t('topbar.language')} aria-label={t('topbar.language')}>
              <Globe size={16} aria-hidden="true" />
            </button>
            {langOpen && (
              <div className="lang-pop">
                <div className="lang-pop-title">{t('topbar.language')}</div>
                <button className={`lang-opt ${i18n.language?.startsWith('fil') ? 'on' : ''}`} onClick={() => pickLang('fil')}>
                  Filipino {i18n.language?.startsWith('fil') && <Check size={14} />}
                </button>
                <button className={`lang-opt ${!i18n.language?.startsWith('fil') ? 'on' : ''}`} onClick={() => pickLang('en')}>
                  English {!i18n.language?.startsWith('fil') && <Check size={14} />}
                </button>
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={toggleTheme} title={t('topbar.changeTheme')} aria-label={t('topbar.changeTheme')}>
            {theme === 'light' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
          </button>
          <button className="icon-btn" onClick={() => { setPwMsg(null); setPwErr(null); setPwOpen(true); }} title={t('topbar.changePassword')} aria-label={t('topbar.changePassword')}>
            <KeyRound size={16} aria-hidden="true" />
          </button>
          <div className="avatar" title={user?.name}>{initials(user?.name)}</div>
          <button className="icon-btn" onClick={onLogout} title={t('topbar.signOut')} aria-label={t('topbar.signOut')}>
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
        {pwOpen && (
          <Modal title={t('pw.change')} sub={`${t('pw.subtitle')}, ${user?.name || ''}`} onClose={() => setPwOpen(false)}>
            <form onSubmit={onChangePassword}>
              <label htmlFor="pw-current">{t('pw.current')}</label>
              <input id="pw-current" className="input" type="password" autoComplete="current-password" value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
              <label htmlFor="pw-next">{t('pw.new')}</label>
              <input id="pw-next" className="input" type="password" autoComplete="new-password" value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
              <label htmlFor="pw-confirm">{t('pw.confirm')}</label>
              <input id="pw-confirm" className="input" type="password" autoComplete="new-password" value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
              <div className="sub" style={{ marginTop: 8 }}>{t('pw.minimum')}</div>
              {pwErr && <div className="err-banner" role="alert">{pwErr}</div>}
              {pwMsg && <div className="notice ok" role="status" aria-live="polite" style={{ marginTop: 10 }}>{pwMsg}</div>}
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setPwOpen(false)}>{t('pw.cancel')}</button>
                <button className="btn btn-primary" disabled={pwBusy}>{pwBusy ? t('pw.updating') : t('pw.update')}</button>
              </div>
            </form>
          </Modal>
        )}
        <div className="content">{children}</div>
        <div className="footer-note">{t('schoolName')} · {t('schoolAddress')} · {t('schoolTagline')}</div>
      </div>
    </div>
  );
}