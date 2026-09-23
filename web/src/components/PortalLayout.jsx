import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Home, GraduationCap, CalendarCheck, CalendarRange, Megaphone, LogOut, KeyRound,
  NotebookPen, Globe, Briefcase, BookOpen, BarChart3, Award, ClipboardList, UserRound,
  Menu, Moon, Sun, Check,
} from 'lucide-react';
import { useAuth, can } from '../lib/auth';
import { useTheme } from '../design-system';
import { Modal, initials } from './ui';
import { api } from '../lib/api';

const PORTAL_NAV_GROUPS = [
  {
    label: 'portal.group.overview',
    items: [
      { to: '/portal', labelKey: 'portal.home', icon: Home, end: true },
    ],
  },
  {
    label: 'portal.group.learning',
    items: [
      { to: '/portal/grades', labelKey: 'portal.grades', icon: GraduationCap },
      { to: '/portal/analytics', labelKey: 'portal.analytics', icon: BarChart3 },
      { to: '/portal/schedule', labelKey: 'portal.schedule', icon: CalendarRange },
      { to: '/portal/assignments', labelKey: 'portal.assignments', icon: NotebookPen },
      { to: '/portal/attendance', labelKey: 'portal.attendance', icon: CalendarCheck },
    ],
  },
  {
    label: 'portal.group.career',
    items: [
      { to: '/portal/portfolio', labelKey: 'portal.portfolio', icon: BookOpen },
      { to: '/portal/immersion', labelKey: 'portal.immersion', icon: Briefcase },
      { to: '/portal/certifications', labelKey: 'portal.certifications', icon: Award },
      { to: '/portal/enroll', labelKey: 'portal.enroll', icon: ClipboardList },
    ],
  },
  {
    label: 'portal.group.news',
    items: [
      { to: '/portal/announcements', labelKey: 'portal.announcements', icon: Megaphone },
    ],
  },
  {
    label: 'portal.group.account',
    items: [
      { to: '/portal/profile', labelKey: 'portal.profile', icon: UserRound },
    ],
  },
];

export default function PortalLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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

  return (
    <div className="app-shell">
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
        {PORTAL_NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="nav-label">{t(group.label)}</div>
            {group.items.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
                <n.icon size={17} /> <span>{t(n.labelKey)}</span>
              </NavLink>
            ))}
          </div>
        ))}
        <div style={{ marginTop: 'auto', padding: '12px 4px 4px', borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          <div>{t('schoolName')}</div>
          <div>{t('schoolAddress')}</div>
        </div>
      </aside>
      <div className="main">
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
              <div className="theme-pop">
                <div className="theme-pop-title">{t('topbar.language')}</div>
                <button className={`theme-opt ${i18n.language?.startsWith('fil') ? 'on' : ''}`} onClick={() => pickLang('fil')}>
                  Filipino {i18n.language?.startsWith('fil') && <Check size={14} />}
                </button>
                <button className={`theme-opt ${!i18n.language?.startsWith('fil') ? 'on' : ''}`} onClick={() => pickLang('en')}>
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
        <div className="footer-note">{t('schoolName')} · {t('schoolAddress')}</div>
      </div>
    </div>
  );
}