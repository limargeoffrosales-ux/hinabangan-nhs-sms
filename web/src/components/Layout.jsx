import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, UserCog, BookOpen, Layers, ClipboardList,
  CalendarCheck, BarChart3, Megaphone, ShieldCheck, Search, LogOut, Menu, CalendarRange,
  FileText, Gauge, LifeBuoy, ClipboardPenLine,
  KeyRound, Briefcase, ShieldAlert, GraduationCap, Scale, Trophy, Bell,
  FileCheck2, Sparkles, Calendar,
  Shield, TrendingUp, DoorOpen, Target, Sun, Moon, Award,
  Brain,
  Map,
  Palette,
} from 'lucide-react';
import { useAuth, can } from '../lib/auth';
import { initials, Modal, CommandPalette } from './ui';
import { api } from '../lib/api';
import { subscribeLive } from '../lib/realtime';
import { useTheme, GroupedNav, LanguageSwitch } from '../design-system';
import TarikMascot from './TarikMascot';
import TarikCrestLogo from './TarikCrestLogo';
import SyncStatusPill from './SyncStatusPill';
import { FEATURE_ICONS } from './UgopFeatureIcons';

const NAV_GROUPS = [
  {
    label: 'nav.main',
    items: [
      { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
      { to: '/parent-portal', labelKey: 'nav.parentPortal', icon: Users, parentOnly: true },
    ],
  },
  {
    label: 'nav.people',
    items: [
      { to: '/students', labelKey: 'nav.students', icon: Users },
      { to: '/teachers', labelKey: 'nav.teachers', icon: UserCog },
      { to: '/users', labelKey: 'nav.users', icon: ShieldCheck },
    ],
  },
  {
    label: 'nav.academics',
    items: [
      { to: '/curriculum', labelKey: 'nav.curriculum', icon: BookOpen },
      { to: '/subjects', labelKey: 'nav.subjects', icon: BookOpen },
      { to: '/sections', labelKey: 'nav.sections', icon: Layers },
      { to: '/enroll', labelKey: 'nav.enrollment', icon: ClipboardList },
      { to: '/lessons', labelKey: 'nav.lessons', icon: BookOpen },
      { to: '/learning', labelKey: 'nav.learning', icon: BookOpen, teacherOnly: true },
      { to: '/competency-tracker', labelKey: 'nav.competencyTracker', icon: Target },
      { to: '/grades', labelKey: 'nav.classRecords', icon: BarChart3 },
      { to: '/assignments', labelKey: 'nav.assignments', icon: ClipboardPenLine },
      { to: '/grading-scales', labelKey: 'nav.gradingScales', icon: Scale },
      { to: '/rankings', labelKey: 'nav.rankings', icon: Trophy },
      { to: '/attendance', labelKey: 'nav.attendance', icon: CalendarCheck },
    ],
  },
  {
    label: 'nav.programs',
    items: [
      { to: '/aral', labelKey: 'nav.aral', icon: GraduationCap },
      { to: '/immersion', labelKey: 'nav.immersion', icon: Briefcase },
      { to: '/career-tvl', labelKey: 'nav.careerTvl', icon: Map },
      { to: '/certifications', labelKey: 'nav.certifications', icon: Award },
      { to: '/programs', labelKey: 'nav.programs', icon: CalendarRange },
      { to: '/submissions', labelKey: 'nav.submissions', icon: FileText },
      { to: '/compliance', labelKey: 'nav.compliance', icon: Gauge },
      { to: '/interventions', labelKey: 'nav.interventions', icon: LifeBuoy },
      { to: '/guidance', labelKey: 'nav.guidance', icon: LifeBuoy },
      { to: '/discipline', labelKey: 'nav.conduct', icon: ShieldAlert },
    ],
  },
  {
    label: 'nav.resources',
    items: [
      { to: '/rooms', labelKey: 'nav.rooms', icon: DoorOpen },
      { to: '/announcements', labelKey: 'nav.announcements', icon: Megaphone },
      { to: '/sports-news', labelKey: 'nav.sportsNews', icon: Trophy },
      { to: '/achievements', labelKey: 'nav.achievements', icon: Award },
      { to: '/notifications', labelKey: 'nav.notifications', icon: Bell },
      { to: '/consent', labelKey: 'nav.consent', icon: FileCheck2 },
      { to: '/analytics', labelKey: 'nav.analytics', icon: TrendingUp },
      { to: '/deped-forms', labelKey: 'nav.depedForms', icon: FileSpreadsheet },
    ],
  },
  {
    label: 'nav.system',
    items: [
      { to: '/ai', labelKey: 'nav.aiTools', icon: Brain, adminOnly: true, aiStaff: true },
      { to: '/design-system', labelKey: 'nav.designSystem', icon: Palette, adminOnly: true },
      { to: '/privacy', labelKey: 'nav.privacy', icon: ShieldCheck },
      { to: '/mfa', labelKey: 'nav.mfa', icon: Shield, adminOnly: true },
      { to: '/audit', labelKey: 'nav.auditLogs', icon: Search },
    ],
  },
];

const STAFF_HIDDEN = ['/compliance', '/announcements', '/users', '/audit', '/grading-scales', '/notifications', '/privacy', '/analytics', '/curriculum', '/rooms', '/deped-forms'];
const AI_STAFF = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'teacher', 'guidance'];

function FileSpreadsheet(props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h2"/><path d="M8 17h2"/><path d="M14 13h2"/><path d="M14 17h2"/></svg>;
}

function TarikNavIcon({ pose = 'happy', emoji = '✨', size = 30 }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        background: '#E6F2EC',
        borderRadius: 10,
        border: '1.5px solid #DCE7E0',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        flexShrink: 0,
        boxShadow: '0 2px 6px rgba(18,38,28,0.06)',
      }}
    >
      <TarikMascot pose={pose} size={size * 0.78} />
      <span style={{ position: 'absolute', bottom: -3, right: -3, fontSize: size * 0.42, lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}>{emoji}</span>
    </span>
  );
}

function NotifDropdown({ onClose }) {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/notifications?limit=10')
      .then(r => setNotifs(r?.data || []))
      .catch(() => setNotifs([]))
      .finally(() => setLoading(false));

    const unsub = subscribeLive((msg) => {
      if (msg.type === 'notification') {
        api('/notifications?limit=10').then(r => setNotifs(r?.data || [])).catch(() => {});
      }
    });
    return unsub;
  }, []);

  return (
    <div style={{
      position: 'absolute', top: 50, right: 0, width: 340, maxHeight: 420,
      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16,
      boxShadow: '0 12px 40px rgba(0,0,0,0.25)', zIndex: 9999, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '12px 16px', background: 'var(--primary)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 13.5 }}>🔔 Live Notifications (SSE)</strong>
        <Link to="/notifications" onClick={onClose} style={{ fontSize: 11.5, color: '#fff', textDecoration: 'underline' }}>View all</Link>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {loading ? (
          <div className="sub" style={{ textAlign: 'center', padding: 20 }}>Loading notifications...</div>
        ) : notifs.length === 0 ? (
          <div className="sub" style={{ textAlign: 'center', padding: 20 }}>No notifications yet.</div>
        ) : (
          notifs.map(n => (
            <div key={n.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--primary)' }}>
                <span>{n.event}</span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{n.created_at?.slice(0, 10)}</span>
              </div>
              <div style={{ marginTop: 3, color: 'var(--text)' }}>{n.body}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isAdmin = can(user?.role, 'super_admin', 'school_admin');
  const isSuperAdmin = can(user?.role, 'super_admin');
  const isAIStaff = can(user?.role, ...AI_STAFF);
  const isParent = can(user?.role, 'parent', 'guardian');
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [pwErr, setPwErr] = useState(null);

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

  const location = useLocation();
  const activeId = location.pathname;

  const groups = NAV_GROUPS
    .map((group) => {
      const items = group.items
        .filter((n) => {
          if (!isAdmin && STAFF_HIDDEN.includes(n.to)) return false;
          if (n.adminOnly && !(n.aiStaff ? isAIStaff : isSuperAdmin)) return false;
          if (n.teacherOnly && user?.role !== 'teacher') return false;
          if (n.parentOnly && !isParent) return false;
          if (isParent && !n.parentOnly) return false;
          return true;
        })
        .map((n) => {
          const matchIcon = FEATURE_ICONS.find((f) => f.to === n.to) || { pose: 'happy', icon: '📌' };
          return {
            id: n.to,
            label: t(n.labelKey),
            icon: <TarikNavIcon pose={matchIcon.pose} emoji={matchIcon.icon} size={30} />,
          };
        });
      if (!items.length) return null;
      return { id: group.label, label: t(group.label), items };
    })
    .filter(Boolean);

  return (
    <div className="app-shell">
      <CommandPalette />
      <a href="#main-content" className="skip-link">{t('layout.skipToContent')}</a>
      <div className={`sidebar-overlay ${menuOpen ? 'show' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`} role="navigation" aria-label={t('nav.main')}>
        <div className="brand" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
          <TarikCrestLogo size={96} />
          <div className="brand-text-group">
            <span className="brand-name" style={{ fontFamily: 'var(--font-logo)', fontSize: 32, fontWeight: 800, color: 'var(--primary)', letterSpacing: 0.5, lineHeight: 1 }}>TARIK</span>
            <span className="brand-sub" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginTop: 4 }}>Hinabangan NHS · Samar</span>
          </div>
        </div>
        <div className="brand-divider"></div>
        <GroupedNav
          groups={groups}
          activeId={activeId}
          collapsible
          openGroupCount={0}
          onNavigate={(itemId) => { navigate(itemId); setMenuOpen(false); }}
          aria-label={t('nav.main')}
        />
        <div style={{ marginTop: 'auto', padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
          {/* AI Credits Meter */}
          <div style={{ padding: '10px 12px', background: 'var(--primary-tint)', borderRadius: 12, marginBottom: 8, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--primary)' }}>
              <span>Ask TARIK AI</span>
              <span>150/150</span>
            </div>
            <div style={{ height: 5, background: 'rgba(27,107,74,0.2)', borderRadius: 3, marginTop: 5, overflow: 'hidden' }}>
              <div style={{ width: '100%', height: '100%', background: 'var(--primary)' }} />
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 4 }}>Refills daily</div>
          </div>

          {/* Search Shortcut */}
          <button className="sidebar-link" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-dim)', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', cursor: 'pointer' }}
            onClick={() => window.dispatchEvent(new Event('command-palette-toggle'))}>
            <span>{t('layout.quickSearch')}</span>
            <kbd style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-soft)', border: '1px solid var(--border)' }}>⌘K</kbd>
          </button>

          {/* User Card */}
          <div style={{ marginTop: 10, padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-soft)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div className="avatar" style={{ width: 30, height: 30, fontSize: 12, background: 'var(--primary)', color: '#fff' }}>{initials(user?.name)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</div>
              </div>
            </div>
            <button className="icon-btn" onClick={onLogout} title={t('topbar.signOut')} style={{ padding: 4 }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main" id="main-content" role="main">
        <div className="topbar" role="banner" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px', background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
          <button className="icon-btn menu-btn" onClick={() => setMenuOpen(!menuOpen)} title={t('topbar.menu')} aria-label={t('topbar.menu')}>
            <Menu size={17} aria-hidden="true" />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--primary)' }}>TARIK</span>
            <span style={{ color: 'var(--border)' }}>/</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Hinabangan NHS</span>
          </div>

          {/* SY + Term Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: 'var(--primary-tint)', borderRadius: 99, fontSize: 12.5, fontWeight: 600, color: 'var(--primary)' }}>
            <Calendar size={13} />
            <span>2026-2027 · First Term</span>
          </div>

          <SyncStatusPill />

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Ask TARIK AI Trigger Button */}
            <Link to="/ai" className="btn btn-sm" style={{ background: 'var(--grad-amber)', color: '#12261C', fontWeight: 700, border: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px' }}>
              <Sparkles size={14} /> Ask TARIK AI
            </Link>

            {/* Notification Bell with Real-Time SSE Live Drawer */}
            <div style={{ position: 'relative' }}>
              <button
                className="icon-btn"
                onClick={() => setNotifOpen(!notifOpen)}
                title="Notifications"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', position: 'relative' }}
              >
                <TarikNavIcon pose="surprised" emoji="🔔" size={32} />
                <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, background: 'var(--danger)', borderRadius: '50%' }} />
              </button>
              {notifOpen && <NotifDropdown onClose={() => setNotifOpen(false)} />}
            </div>

            <LanguageSwitch
              storageKey="meridianed_lang"
              title={t('topbar.language')}
              triggerLabel={t('topbar.language')}
            />
            <button className="icon-btn" onClick={toggleTheme} title={t('topbar.changeTheme')} aria-label={t('topbar.changeTheme')} style={{ background: 'none', border: 'none', padding: 0 }}>
              <TarikNavIcon pose="thinking" emoji={theme === 'light' ? '🌙' : '☀️'} size={32} />
            </button>
            <button className="icon-btn" onClick={() => { setPwMsg(null); setPwErr(null); setPwOpen(true); }} title={t('topbar.changePassword')} aria-label={t('topbar.changePassword')} style={{ background: 'none', border: 'none', padding: 0 }}>
              <TarikNavIcon pose="clipboard" emoji="🔑" size={32} />
            </button>
          </div>
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
