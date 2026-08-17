import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, GraduationCap, CalendarCheck, CalendarRange, Megaphone, LogOut, KeyRound, NotebookPen, Globe } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Modal, initials } from './ui';
import { api } from '../lib/api';

const PORTAL_NAV = [
  { to: '/portal', labelKey: 'portal.home', icon: Home, end: true },
  { to: '/portal/grades', labelKey: 'portal.grades', icon: GraduationCap },
  { to: '/portal/attendance', labelKey: 'portal.attendance', icon: CalendarCheck },
  { to: '/portal/schedule', labelKey: 'portal.schedule', icon: CalendarRange },
  { to: '/portal/assignments', labelKey: 'portal.assignments', icon: NotebookPen },
  { to: '/portal/announcements', labelKey: 'portal.announcements', icon: Megaphone },
];

export default function PortalLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [pwOpen, setPwOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
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
    if (pw.next.length < 8) return setPwErr(t('pw.tooShort'));
    if (pw.next !== pw.confirm) return setPwErr(t('pw.noMatch'));
    setPwBusy(true);
    try {
      await api('/auth/change-password', { method: 'POST', body: { current: pw.current, password: pw.next } });
      setPwMsg(t('pw.updated'));
      setPw({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPwErr(err.message);
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
      <div className="main" style={{ marginLeft: 0 }}>
        <div className="topbar">
          <img className="brand-logo" src="/logo.jpg" alt="School logo" style={{ marginRight: 6 }} />
          <h1 style={{ fontSize: 16 }}>{t('brand')} · {t('portalTitle')}</h1>
          <nav className="portal-nav">
            {PORTAL_NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <n.icon size={15} /> {t(n.labelKey)}
              </NavLink>
            ))}
          </nav>
          <div className="lang-wrap" style={{ position: 'relative' }}>
            <button className="icon-btn" onClick={() => { setLangOpen((o) => !o); setPwOpen(false); }} title="Language">
              <Globe size={16} />
            </button>
            {langOpen && (
              <div className="theme-pop">
                <div className="theme-pop-title">Language</div>
                <button className={`theme-opt ${i18n.language?.startsWith('fil') ? 'on' : ''}`} onClick={() => pickLang('fil')}>
                  Filipino
                </button>
                <button className={`theme-opt ${!i18n.language?.startsWith('fil') ? 'on' : ''}`} onClick={() => pickLang('en')}>
                  English
                </button>
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={() => { setPwMsg(null); setPwErr(null); setPwOpen(true); }} title={t('topbar.changePassword')}>
            <KeyRound size={16} />
          </button>
          <div className="avatar" title={user?.name}>{initials(user?.name)}</div>
          <button className="icon-btn" onClick={onLogout} title={t('topbar.signOut')}>
            <LogOut size={16} />
          </button>
        </div>
        {pwOpen && (
          <Modal title={t('pw.change')} sub={`${t('pw.subtitle')}, ${user?.name || ''}`} onClose={() => setPwOpen(false)}>
            <form onSubmit={onChangePassword}>
              <label>{t('pw.current')}</label>
              <input className="input" type="password" autoComplete="current-password" value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
              <label>{t('pw.new')}</label>
              <input className="input" type="password" autoComplete="new-password" value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
              <label>{t('pw.confirm')}</label>
              <input className="input" type="password" autoComplete="new-password" value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
              <div className="sub" style={{ marginTop: 8 }}>{t('pw.minimum')}</div>
              {pwErr && <div className="err-banner">{pwErr}</div>}
              {pwMsg && <div className="notice ok" style={{ marginTop: 10 }}>{pwMsg}</div>}
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
