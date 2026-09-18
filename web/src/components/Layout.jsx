import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, UserCog, BookOpen, Layers, ClipboardList,
  CalendarCheck, BarChart3, Megaphone, ShieldCheck, Search, LogOut, Menu, CalendarRange,
  FileText, Gauge, LifeBuoy, ClipboardPenLine,
  KeyRound, Briefcase, Check, ShieldAlert, GraduationCap, Scale, Trophy, Bell,
  FileCheck2,
  Globe, Shield, TrendingUp, DoorOpen, Target, Sun, Moon, Award, BookMarked, Stethoscope,
  Brain,
  Map,
} from 'lucide-react';
import { useAuth, can } from '../lib/auth';
import { initials, Modal } from './ui';
import { api } from '../lib/api';

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
  { to: '/assignments', labelKey: 'nav.assignments', icon: ClipboardPenLine },
  { to: '/grading-scales', labelKey: 'nav.gradingScales', icon: Scale },
  { to: '/rankings', labelKey: 'nav.rankings', icon: Trophy },
  { to: '/attendance', labelKey: 'nav.attendance', icon: CalendarCheck },
  { to: '/announcements', labelKey: 'nav.announcements', icon: Megaphone },
  { to: '/notifications', labelKey: 'nav.notifications', icon: Bell },
  { to: '/consent', labelKey: 'nav.consent', icon: FileCheck2 },
  { to: '/mfa', labelKey: 'nav.mfa', icon: Shield, adminOnly: true },
  { to: '/privacy', labelKey: 'nav.privacy', icon: ShieldCheck },
  { to: '/users', labelKey: 'nav.users', icon: ShieldCheck },
  { to: '/audit', labelKey: 'nav.auditLogs', icon: Search },
  { to: '/immersion', labelKey: 'nav.immersion', icon: Briefcase },
  { to: '/career-tvl', labelKey: 'nav.careerTvl', icon: Map },
  { to: '/analytics', labelKey: 'nav.analytics', icon: TrendingUp },
  { to: '/curriculum', labelKey: 'nav.curriculum', icon: BookOpen },
  { to: '/rooms', labelKey: 'nav.rooms', icon: DoorOpen },
  { to: '/lessons', labelKey: 'nav.lessons', icon: BookOpen },
  { to: '/competency-tracker', labelKey: 'nav.competencyTracker', icon: Target },
  { to: '/certifications', labelKey: 'nav.certifications', icon: Award },
  { to: '/deped-forms', labelKey: 'nav.depedForms', icon: FileSpreadsheet },
  { to: '/ai', labelKey: 'AI Tools', icon: Brain, adminOnly: true },
];

const TOOL_NAV = [
  { to: '/interventions', labelKey: 'nav.interventions', icon: LifeBuoy },
  { to: '/assessment', labelKey: 'nav.assessment', icon: ClipboardPenLine },
  { to: '/library', labelKey: 'nav.library', icon: BookMarked },
  { to: '/clinic', labelKey: 'nav.clinic', icon: Stethoscope },
  { to: '/guidance', labelKey: 'nav.guidance', icon: LifeBuoy },
];

const STAFF_HIDDEN = ['/compliance', '/announcements', '/users', '/audit', '/grading-scales', '/notifications', '/privacy', '/analytics', '/curriculum', '/rooms', '/deped-forms'];

const AI_STAFF = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'teacher', 'guidance'];

function FileSpreadsheet(props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h2"/><path d="M8 17h2"/><path d="M14 13h2"/><path d="M14 17h2"/></svg>;
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isAdmin = can(user?.role, 'super_admin', 'school_admin');
  const isSuperAdmin = can(user?.role, 'super_admin');
  const isAIStaff = can(user?.role, ...AI_STAFF);
  const [theme, setTheme] = useState(() => {
    const s = localStorage.getItem('meridianed_theme') || 'midnight';
    return LEGACY_MAP[s] || s;
  });
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
    if (!langOpen) return;
    function onClick(e) {
      if (!e.target.closest('.lang-wrap')) setLangOpen(false);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [langOpen]);

  function toggleTheme() {
    const next = theme === 'midnight' ? 'light' : 'midnight';
    setTheme(next);
    localStorage.setItem('meridianed_theme', next);
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
        {NAV.slice(6).filter((n) => (isAdmin || !STAFF_HIDDEN.includes(n.to)) && (!n.adminOnly || (n.to === '/ai' ? isAIStaff : isSuperAdmin))).map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
            <n.icon size={17} /> <span>{t(n.labelKey)}</span>
          </NavLink>
        ))}
        <div className="nav-label">{t('nav.teaching')}</div>
        {TOOL_NAV.map((n) => (
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
            <button className="icon-btn" onClick={() => setLangOpen((o) => !o)} title="Language" aria-label="Language">
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
    </div>
  );
}
