import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, Users, UserCog, BookOpen, Layers, ClipboardList,
  CalendarCheck, BarChart3, Megaphone, ShieldCheck, Search, Sun, Moon, LogOut, Menu, CalendarRange,
  FileText, Gauge, Sparkles, FileStack, FlaskConical, BookOpenCheck, HeartPulse, LifeBuoy, ClipboardPenLine,
  KeyRound, Briefcase,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { initials, Modal } from './ui';
import { api } from '../lib/api';
import AiAssistant from './AiAssistant';

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
  { to: '/grades', label: 'Class Records', icon: BarChart3 },
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

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem('meridianed_theme') || 'dark');
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [pwErr, setPwErr] = useState(null);

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

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('meridianed_theme', next);
    document.documentElement.dataset.theme = next;
  }

  async function onLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" style={menuOpen ? { display: 'block' } : undefined}>
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
        {NAV.slice(6).map((n) => (
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
          <button className="icon-btn" onClick={() => setMenuOpen(!menuOpen)} style={{ display: 'none' }}>
            <Menu size={17} />
          </button>
          <h1>Hinabangan National High School</h1>
          <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
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
