import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Users, UserCog, BookOpen, Layers, ClipboardList,
  CalendarCheck, BarChart3, Megaphone, ShieldCheck, Search, LogOut, Menu, CalendarRange,
  FileText, Gauge, Sparkles, FileStack, FlaskConical, BookOpenCheck, HeartPulse, LifeBuoy, ClipboardPenLine,
  KeyRound, Briefcase, Palette, Check, ShieldAlert, GraduationCap, Scale, Trophy,
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
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/teachers', label: 'Teachers', icon: UserCog },
  { to: '/subjects', label: 'Subjects', icon: BookOpen },
  { to: '/sections', label: 'Sections', icon: Layers },
  { to: '/enroll', label: 'Enrollment', icon: ClipboardList },
  { to: '/programs', label: 'Teacher Programs', icon: CalendarRange },
  { to: '/submissions', label: 'Teacher Submissions', icon: FileText },
  { to: '/compliance', label: 'Compliance', icon: Gauge },
  { to: '/aral', label: 'ARAL Program', icon: GraduationCap },
  { to: '/discipline', label: 'Student Conduct', icon: ShieldAlert },
  { to: '/grades', label: 'Class Records', icon: BarChart3 },
  { to: '/grading-scales', label: 'Grading Scales', icon: Scale },
  { to: '/rankings', label: 'Rankings', icon: Trophy },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/users', label: 'Users & Roles', icon: ShieldCheck },
  { to: '/audit', label: 'Audit Logs', icon: Search },
  { to: '/immersion', label: 'Immersion & JDVP', icon: Briefcase },
];

const AI_NAV = [
  { to: '/ai-docs', label: 'AI Documents', icon: Sparkles },
  { to: '/research', label: 'Research', icon: FlaskConical },
  { to: '/reading-numeracy', label: 'Reading & Numeracy', icon: BookOpenCheck },
  { to: '/interventions', label: 'Interventions', icon: LifeBuoy },
  { to: '/assessment', label: 'Assessment', icon: ClipboardPenLine },
  { to: '/forms', label: 'DepEd Forms', icon: FileStack },
];

const STAFF_HIDDEN = ['/programs', '/compliance', '/announcements', '/users', '/audit', '/grading-scales'];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = can(user?.role, 'super_admin', 'school_admin');
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
    if (!pickerOpen) return;
    function onClick(e) {
      if (!e.target.closest('.theme-wrap')) setPickerOpen(false);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [pickerOpen]);

  function pickTheme(id) {
    setTheme(id);
    localStorage.setItem('meridianed_theme', id);
    setPickerOpen(false);
  }

  async function onChangePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    setPwErr(null);
    if (pw.next.length < 8) return setPwErr('New password must be at least 8 characters');
    if (pw.next !== pw.confirm) return setPwErr('New passwords do not match');
    setPwBusy(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: pw.current, newPassword: pw.next },
      });
      setPw({ current: '', next: '', confirm: '' });
      setPwMsg('Password updated successfully');
    } catch (err) {
      setPwErr(err.message || 'Failed to update password');
    } finally {
      setPwBusy(false);
    }
  }

  async function onLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <div className={`sidebar-overlay ${menuOpen ? 'show' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <img className="brand-logo" src="/logo.jpg" alt="School logo" />
          <span className="brand-text">Hinabangan NHS</span>
        </div>
        <div className="nav-label">Main</div>
        {NAV.slice(0, 6).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
            <n.icon size={17} /> <span>{n.label}</span>
          </NavLink>
        ))}
        <div className="nav-label">Operations</div>
        {NAV.slice(6).filter((n) => isAdmin || !STAFF_HIDDEN.includes(n.to)).map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
            <n.icon size={17} /> <span>{n.label}</span>
          </NavLink>
        ))}
        <div className="nav-label">AI & Intelligence</div>
        {AI_NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
            <n.icon size={17} /> <span>{n.label}</span>
          </NavLink>
        ))}
      </aside>
      <div className="main">
        <div className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMenuOpen(!menuOpen)} title="Menu">
            <Menu size={17} />
          </button>
          <h1>Hinabangan National High School</h1>
          <div className="theme-wrap">
            <button className="icon-btn" onClick={() => setPickerOpen((o) => !o)} title="Change theme">
              <Palette size={16} />
            </button>
            {pickerOpen && (
              <div className="theme-pop">
                <div className="theme-pop-title">Appearance</div>
                {THEMES.map((t) => (
                  <button key={t.id} className={`theme-opt ${theme === t.id ? 'on' : ''}`} onClick={() => pickTheme(t.id)}>
                    <span className="theme-swatch" style={{ background: t.preview }} />
                    {t.name}
                    {theme === t.id && <Check size={14} />}
                  </button>
                ))}
                <button className={`theme-opt ${theme === 'auto' ? 'on' : ''}`} onClick={() => pickTheme('auto')}>
                  <span className="theme-swatch auto" />
                  Auto (system)
                  {theme === 'auto' && <Check size={14} />}
                </button>
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={() => { setPwMsg(null); setPwErr(null); setPwOpen(true); }} title="Change password">
            <KeyRound size={16} />
          </button>
          <div className="avatar" title={user?.name}>{initials(user?.name)}</div>
          <button className="icon-btn" onClick={onLogout} title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
        {pwOpen && (
          <Modal title="Change password" sub={`Update your sign-in credentials, ${user?.name || ''}`} onClose={() => setPwOpen(false)}>
            <form onSubmit={onChangePassword}>
              <label>Current password</label>
              <input className="input" type="password" autoComplete="current-password" value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
              <label>New password</label>
              <input className="input" type="password" autoComplete="new-password" value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
              <label>Confirm new password</label>
              <input className="input" type="password" autoComplete="new-password" value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
              <div className="sub" style={{ marginTop: 8 }}>At least 8 characters.</div>
              {pwErr && <div className="err-banner">{pwErr}</div>}
              {pwMsg && <div className="notice" style={{ marginTop: 10 }}>{pwMsg}</div>}
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setPwOpen(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={pwBusy}>{pwBusy ? 'Updating...' : 'Update password'}</button>
              </div>
            </form>
          </Modal>
        )}
        <div className="content">{children}</div>
        <div className="footer-note">Hinabangan National High School · Hinabangan, Samar · AI-Powered School Management System</div>
      </div>
      <AiAssistant />
    </div>
  );
}
