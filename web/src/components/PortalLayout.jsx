import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Home, GraduationCap, CalendarCheck, CalendarRange, Megaphone, LogOut, KeyRound } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Modal, initials } from './ui';
import { api } from '../lib/api';

const PORTAL_NAV = [
  { to: '/portal', label: 'Home', icon: Home, end: true },
  { to: '/portal/grades', label: 'Grades', icon: GraduationCap },
  { to: '/portal/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/portal/schedule', label: 'Schedule', icon: CalendarRange },
  { to: '/portal/announcements', label: 'Announcements', icon: Megaphone },
];

export default function PortalLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pwOpen, setPwOpen] = useState(false);
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
    if (pw.next.length < 8) return setPwErr('New password must be at least 8 characters.');
    if (pw.next !== pw.confirm) return setPwErr('New passwords do not match.');
    setPwBusy(true);
    try {
      await api('/auth/change-password', { method: 'POST', body: { current: pw.current, password: pw.next } });
      setPwMsg('Password updated.');
      setPw({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPwErr(err.message);
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="main" style={{ marginLeft: 0 }}>
        <div className="topbar">
          <img className="brand-logo" src="/logo.jpg" alt="School logo" style={{ marginRight: 6 }} />
          <h1 style={{ fontSize: 16 }}>Hinabangan NHS · Student &amp; Parent Portal</h1>
          <nav className="portal-nav">
            {PORTAL_NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <n.icon size={15} /> {n.label}
              </NavLink>
            ))}
          </nav>
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
              {pwMsg && <div className="notice ok" style={{ marginTop: 10 }}>{pwMsg}</div>}
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setPwOpen(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={pwBusy}>{pwBusy ? 'Updating...' : 'Update password'}</button>
              </div>
            </form>
          </Modal>
        )}
        <div className="content">{children}</div>
        <div className="footer-note">Hinabangan National High School · Hinabangan, Samar</div>
      </div>
    </div>
  );
}
