import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, UserCog, BookOpen, Layers, ClipboardList,
  CalendarCheck, BarChart3, Megaphone, ShieldCheck, Search, LogOut, Menu, CalendarRange,
  FileText, Gauge, Sparkles, FlaskConical, BookOpenCheck, HeartPulse, LifeBuoy, ClipboardPenLine,
  KeyRound, Briefcase, Palette, Check, ShieldAlert, GraduationCap, Scale, Trophy, NotebookPen, Bell,
  Globe, Shield, FileSpreadsheet, TrendingUp, DoorOpen, Target,
} from 'lucide-react';
import { useAuth, can } from '../lib/auth';
import { initials, Modal } from './ui';
import { api } from '../lib/api';
import AiAssistant from './AiAssistant';

const THEMES = [
  { id: 'midnight', name: 'Midnight', preview: 'linear-gradient(135deg, #4D96FF, #2FD6A0)' },
  { id: 'ocean', name: 'Ocean', preview: 'linear-gradient(135deg, #22D3EE, #34D399)' },
  { id: 'forest', name: 'Forest', preview: 'linear-gradient(135deg, #34D399, #A3E635)' },
  { id: 'amethyst', name: 'Amethyst', preview: 'linear-gradient(135deg, #A78BFA, #34D399)' },
  { id: 'light', name: 'Daylight', preview: 'linear-gradient(135deg, #2F7DF4, #12A97C)' },
  { id: 'solar', name: 'Solar', preview: 'linear-gradient(135deg, #E8850C, #0FA968)' },
  { id: 'rose', name: 'Rose', preview: 'linear-gradient(135deg, #E11D5F, #12A97C)' },
];

const LEGACY_MAP = { dark: 'midnight', light: 'light' };

function resolveTheme(theme) {
  if (theme === 'auto') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'midnight';
  }
  return LEGACY_MAP[theme] || theme;
}

const NAV = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/students', labelKey: 'nav.students', icon: Users },
  { to: '/teachers', labelKey: 'nav.teachers', icon: UserCog },
  { to: '/subjects', labelKey: 'nav.subjects', icon: BookOpen },
  { to: '/sections', labelKey: 'nav.sections', icon: Layers },
  { to: '/enroll', labelKey: 'nav.enrollment', icon: ClipboardList },
  { to: '/programs', labelKey: 'nav.programs', icon: CalendarRange },
  { to: '/submissions', labelKey: 'nav.submissions', icon: FileText },
  { to: '/compliance', labelKey: 'nav.compliance', icon: Gauge },
  { to: '/aral', labelKey: 'nav.aral', icon: GraduationCap },
  { to: '/discipline', labelKey: 'nav.conduct', icon: ShieldAlert },
  { to: '/grades', labelKey: 'nav.classRecords', icon: BarChart3 },
  { to: '/assignments', labelKey: 'nav.assignments', icon: NotebookPen },
  { to: '/grading-scales', labelKey: 'nav.gradingScales', icon: Scale },
  { to: '/rankings', labelKey: 'nav.rankings', icon: Trophy },
  { to: '/attendance', labelKey: 'nav.attendance', icon: CalendarCheck },
  { to: '/announcements', labelKey: 'nav.announcements', icon: Megaphone },
  { to: '/notifications', labelKey: 'nav.notifications', icon: Bell },
  { to: '/consent', labelKey: 'nav.consent', icon: Shield },
  { to: '/mfa', labelKey: 'nav.mfa', icon: Shield, adminOnly: true },
  { to: '/privacy', labelKey: 'nav.privacy', icon: ShieldCheck },
  { to: '/security-incidents', labelKey: 'nav.securityIncidents', icon: ShieldAlert },
  { to: '/users', labelKey: 'nav.users', icon: ShieldCheck },
  { to: '/audit', labelKey: 'nav.auditLogs', icon: Search },
  { to: '/immersion', labelKey: 'nav.immersion', icon: Briefcase },
  { to: '/import-export', labelKey: 'nav.importExport', icon: FileSpreadsheet },
  { to: '/analytics', labelKey: 'nav.analytics', icon: TrendingUp },
  { to: '/curriculum', labelKey: 'nav.curriculum', icon: BookOpenCheck },
  { to: '/rooms', labelKey: 'nav.rooms', icon: DoorOpen },
  { to: '/lessons', labelKey: 'nav.lessons', icon: BookOpen },
  { to: '/competency-tracker', labelKey: 'nav.competencyTracker', icon: Target },
  { to: '/deped-forms', labelKey: 'nav.depedForms', icon: FileSpreadsheet },
];

const AI_NAV = [
  { to: '/ai-docs', labelKey: 'nav.aiDocs', icon: Sparkles },
  { to: '/research', labelKey: 'nav.research', icon: FlaskConical },
  { to: '/reading-numeracy', labelKey: 'nav.readingNumeracy', icon: BookOpenCheck },
  { to: '/interventions', labelKey: 'nav.interventions', icon: LifeBuoy },
  { to: '/assessment', labelKey: 'nav.assessment', icon: ClipboardPenLine },
];

const STAFF_HIDDEN = ['/programs', '/compliance', '/announcements', '/users', '/audit', '/grading-scales', '/notifications', '/consent', '/privacy', '/security-incidents', '/import-export', '/analytics', '/curriculum', '/rooms', '/deped-forms'];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isAdmin = can(user?.role, 'super_admin', 'school_admin');
  const isSuperAdmin = can(user?.role, 'super_admin');
  const [theme, setTheme] = useState(() => {
    const s = localStorage.getItem('meridianed_theme') || 'midnight';
    return LEGACY_MAP[s] || s;
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [pwErr, setPwErr] = useState(null);
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => {
    function apply() {
      document.documentElement.dataset.theme = resolveTheme(theme);
    }
    apply();
    let mq = null;
    if (theme === 'auto') {
      mq = window.matchMedia('(prefers-color-scheme: light)');
      mq.addEventListener('change', apply);
    }
    return () => mq && mq.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    if (!pickerOpen && !langOpen) return;
    function onClick(e) {
      if (!e.target.closest('.theme-wrap') && !e.target.closest('.lang-wrap')) {
        setPickerOpen(false);
        setLangOpen(false);
      }
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [pickerOpen, langOpen]);

  function pickTheme(id) {
    setTheme(id);
    localStorage.setItem('meridianed_theme', id);
    setPickerOpen(false);
  }

  async function onChangePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    setPwErr(null);
    if (pw.next.length < 12) return setPwErr(t('pw.tooShort'));
    if (pw.next !== pw.confirm) return setPwErr(t('pw.noMatch'));
    setPwBusy(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: pw.current, newPassword: pw.next },
      });
      setPw({ current: '', next: '', confirm: '' });
      setPwMsg(t('pw.updated'));
    } catch (err) {
      setPwErr(err.message || t('pw.failed'));
    } finally {
      setPwBusy(false);
    }
  }

  async function onLogout() {
    await logout();
    navigate('/login');
  }

  function pickLang(lng) {
    i18n.changeLanguage(lng);
    localStorage.setItem('meridianed_lang', lng);
    setLangOpen(false);
  }

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div className={`sidebar-overlay ${menuOpen ? 'show' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`} role="navigation" aria-label={t('nav.main')}>
        <div className="brand">
          <img className="brand-logo" src="/logo.jpg" alt="" />
          <span className="brand-text">{t('brand')}</span>
        </div>
        <div className="nav-label">{t('nav.main')}</div>
        {NAV.slice(0, 6).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
            <n.icon size={17} /> <span>{t(n.labelKey)}</span>
          </NavLink>
        ))}
        <div className="nav-label">{t('nav.operations')}</div>
        {NAV.slice(6).filter((n) => (isAdmin || !STAFF_HIDDEN.includes(n.to)) && (!n.adminOnly || isSuperAdmin)).map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
            <n.icon size={17} /> <span>{t(n.labelKey)}</span>
          </NavLink>
        ))}
        <div className="nav-label">{t('nav.ai')}</div>
        {AI_NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
            <n.icon size={17} /> <span>{t(n.labelKey)}</span>
          </NavLink>
        ))}
      </aside>
      <div className="main" id="main-content" role="main">
        <div className="topbar" role="banner">
          <button className="icon-btn menu-btn" onClick={() => setMenuOpen(!menuOpen)} title={t('topbar.menu')} aria-label={t('topbar.menu')}>
            <Menu size={17} aria-hidden="true" />
          </button>
          <h1>{t('schoolName')}</h1>
          <div className="lang-wrap" style={{ position: 'relative' }}>
            <button className="icon-btn" onClick={() => { setLangOpen((o) => !o); setPickerOpen(false); }} title="Language" aria-label="Language">
              <Globe size={16} aria-hidden="true" />
            </button>
            {langOpen && (
              <div className="theme-pop">
                <div className="theme-pop-title">Language</div>
                <button className={`theme-opt ${i18n.language?.startsWith('fil') ? 'on' : ''}`} onClick={() => pickLang('fil')}>
                  Filipino
                  {i18n.language?.startsWith('fil') && <Check size={14} />}
                </button>
                <button className={`theme-opt ${!i18n.language?.startsWith('fil') ? 'on' : ''}`} onClick={() => pickLang('en')}>
                  English
                  {!i18n.language?.startsWith('fil') && <Check size={14} />}
                </button>
              </div>
            )}
          </div>
          <div className="theme-wrap">
            <button className="icon-btn" onClick={() => setPickerOpen((o) => !o)} title={t('topbar.changeTheme')} aria-label={t('topbar.changeTheme')}>
              <Palette size={16} aria-hidden="true" />
            </button>
            {pickerOpen && (
              <div className="theme-pop">
                <div className="theme-pop-title">{t('topbar.appearance')}</div>
                {THEMES.map((th) => (
                  <button key={th.id} className={`theme-opt ${theme === th.id ? 'on' : ''}`} onClick={() => pickTheme(th.id)}>
                    <span className="theme-swatch" style={{ background: th.preview }} />
                    {th.name}
                    {theme === th.id && <Check size={14} />}
                  </button>
                ))}
                <button className={`theme-opt ${theme === 'auto' ? 'on' : ''}`} onClick={() => pickTheme('auto')}>
                  <span className="theme-swatch auto" />
                  {t('topbar.autoTheme')}
                  {theme === 'auto' && <Check size={14} />}
                </button>
              </div>
            )}
          </div>
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
              {pwMsg && <div className="notice" role="status" aria-live="polite" style={{ marginTop: 10 }}>{pwMsg}</div>}
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
      <AiAssistant />
    </div>
  );
}
