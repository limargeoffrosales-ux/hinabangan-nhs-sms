import { lazy, Suspense, useEffect, Component } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth, can } from './lib/auth';
import Layout from './components/Layout';
import PortalLayout from './components/PortalLayout';
import { Spinner } from './components/ui';
import { isNative, registerForPushNotifications } from './lib/capacitor';
import { Sentry } from './sentry';
import { warmServer } from './lib/api';
import './i18n';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info?.componentStack);
    if (typeof Sentry !== 'undefined') {
      Sentry.captureException(error, { extra: { componentStack: info?.componentStack } });
    }
  }
  render() {
    if (this.state.error) {
      // Deliberately generic: error.message may carry component internals,
      // server responses, or stack fragments. Details go to console + Sentry.
      return (
        <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: 20, textAlign: 'center' }}>
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>An unexpected error occurred</h2>
            <p style={{ color: '#6b7280', marginBottom: 16, fontSize: 14 }}>Please reload the page. If the problem persists, contact support.</p>
            <button onClick={() => { this.setState({ error: null }); window.location.reload(); }} style={{ padding: '6px 20px', borderRadius: 8, border: 'none', background: '#1e3a5f', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const CHUNK_RELOAD_KEY = 'meridianed_chunk_reload_at';

// React.lazy with stale-chunk recovery. After a deploy, an already-open tab can
// request a chunk whose hash no longer exists. Instead of immediately reloading
// (which races with the vite:preloadError handler in main.jsx and causes the
// ErrorBoundary to flash), we return a hanging promise that keeps the Suspense
// spinner visible while vite:preloadError handles the reload. As a safety net,
// if neither mechanism resolves within 5s, we reload ourselves.
function lazyWithRetry(factory) {
  return lazy(() =>
    factory().catch((err) => {
      let last = 0;
      try { last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0); } catch { /* ignore */ }
      if (Date.now() - last > 10000) {
        try { sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now())); } catch { /* ignore */ }
        // Safety net: reload after 5s if vite:preloadError hasn't already.
        setTimeout(() => {
          let ts = 0;
          try { ts = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0); } catch { /* ignore */ }
          if (Date.now() - ts > 4500) window.location.reload();
        }, 5000);
        return new Promise(() => {});
      }
      throw err;
    })
  );
}

const Login = lazyWithRetry(() => import('./pages/Login'));
const Register = lazyWithRetry(() => import('./pages/Register'));
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'));
const Consent = lazyWithRetry(() => import('./pages/Consent'));
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const Students = lazyWithRetry(() => import('./pages/Students'));
const StudentProfile = lazyWithRetry(() => import('./pages/StudentProfile'));
const Teachers = lazyWithRetry(() => import('./pages/Teachers'));
const Subjects = lazyWithRetry(() => import('./pages/Subjects'));
const Sections = lazyWithRetry(() => import('./pages/Sections'));
const Enroll = lazyWithRetry(() => import('./pages/Enroll'));
const Grades = lazyWithRetry(() => import('./pages/Grades'));
const GradingScales = lazyWithRetry(() => import('./pages/GradingScales'));
const Rankings = lazyWithRetry(() => import('./pages/Rankings'));
const Portal = lazyWithRetry(() => import('./pages/Portal'));
const PortalGrades = lazyWithRetry(() => import('./pages/PortalGrades'));
const PortalEnroll = lazyWithRetry(() => import('./pages/PortalEnroll'));
const PortalAttendance = lazyWithRetry(() => import('./pages/PortalAttendance'));
const PortalSchedule = lazyWithRetry(() => import('./pages/PortalSchedule'));
const PortalAssignments = lazyWithRetry(() => import('./pages/PortalAssignments'));
const PortalAnnouncements = lazyWithRetry(() => import('./pages/PortalAnnouncements'));
const PortalSportsNews = lazyWithRetry(() => import('./pages/PortalSportsNews'));
const Attendance = lazyWithRetry(() => import('./pages/Attendance'));
const Announcements = lazyWithRetry(() => import('./pages/Announcements'));
const SportsNews = lazyWithRetry(() => import('./pages/SportsNews'));
const Assignments = lazyWithRetry(() => import('./pages/Assignments'));
const Users = lazyWithRetry(() => import('./pages/Users'));
const AuditLogs = lazyWithRetry(() => import('./pages/AuditLogs'));
const Programs = lazyWithRetry(() => import('./pages/Programs'));
const Submissions = lazyWithRetry(() => import('./pages/Submissions'));
const Compliance = lazyWithRetry(() => import('./pages/Compliance'));
const Aral = lazyWithRetry(() => import('./pages/Aral'));
const Interventions = lazyWithRetry(() => import('./pages/Interventions'));
const Assessment = lazyWithRetry(() => import('./pages/Assessment'));
const Immersion = lazyWithRetry(() => import('./pages/Immersion'));
const CareerTVL = lazyWithRetry(() => import('./pages/CareerTVL'));
const ImmersionMap = lazyWithRetry(() => import('./pages/ImmersionMap'));
const Discipline = lazyWithRetry(() => import('./pages/Discipline'));
const Notifications = lazyWithRetry(() => import('./pages/Notifications'));
const Privacy = lazyWithRetry(() => import('./pages/Privacy'));
const MFASetup = lazyWithRetry(() => import('./pages/MFASetup'));
const Analytics = lazyWithRetry(() => import('./pages/Analytics'));
const Curriculum = lazyWithRetry(() => import('./pages/Curriculum'));
const Rooms = lazyWithRetry(() => import('./pages/Rooms'));
const Lessons = lazyWithRetry(() => import('./pages/Lessons'));
const CompetencyTracker = lazyWithRetry(() => import('./pages/CompetencyTracker'));
const Certifications = lazyWithRetry(() => import('./pages/Certifications'));
const Guidance = lazyWithRetry(() => import('./pages/Guidance'));
const PortalPortfolio = lazyWithRetry(() => import('./pages/PortalPortfolio'));
const PortalImmersion = lazyWithRetry(() => import('./pages/PortalImmersion'));
const PortalAnalytics = lazyWithRetry(() => import('./pages/PortalAnalytics'));
const PortalCertifications = lazyWithRetry(() => import('./pages/PortalCertifications'));
const PortalProfile = lazyWithRetry(() => import('./pages/PortalProfile'));
const DepedForms = lazyWithRetry(() => import('./pages/DepedForms'));
const AIPage = lazyWithRetry(() => import('./pages/AIPage'));
const Achievements = lazyWithRetry(() => import('./pages/Achievements'));
const ParentPortal = lazyWithRetry(() => import('./pages/ParentPortal'));;
const DesignSystem = lazyWithRetry(() => import('./pages/DesignSystem'));

function Protected({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'student') return <Navigate to="/portal" replace />;
  if (user.role === 'parent' || user.role === 'guardian') return <Navigate to="/parent-portal" replace />;
  return <Layout>{children}</Layout>;
}

function PortalProtected({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'student' && user.role !== 'parent') return <Navigate to="/" replace />;
  return <PortalLayout>{children}</PortalLayout>;
}

function ParentProtected({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'parent' && user.role !== 'guardian') return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

const WRITE_ROLES = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
function AdminOnly({ children }) {
  const { user } = useAuth();
  if (!can(user?.role, 'super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar')) return <Navigate to="/" replace />;
  return children;
}
function StaffAndTeacher({ children }) {
  const { user } = useAuth();
  if (user?.role === 'student') return <Navigate to="/portal" replace />;
  if (user?.role === 'parent' || user?.role === 'guardian') return <Navigate to="/parent-portal" replace />;
  if (!can(user?.role, ...WRITE_ROLES, 'teacher')) return <Navigate to="/" replace />;
  return children;
}

const AI_STAFF = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'teacher', 'guidance'];

function AIWorkbenchOnly({ children }) {
  const { user } = useAuth();
  if (!can(user?.role, ...AI_STAFF)) return <Navigate to="/" replace />;
  return children;
}

const LazyAIChatbot = lazy(() => import('./components/AIChatbot'));

function AIChatbotGate() {
  const { user } = useAuth();
  if (!user || !can(user?.role, ...AI_STAFF, 'student', 'parent')) return null;
  return (
    <Suspense fallback={null}>
      <LazyAIChatbot />
    </Suspense>
  );
}

function Page({ children }) {
  const { pathname } = useLocation();
  return <ErrorBoundary key={pathname}><Suspense fallback={<Spinner />}>{children}</Suspense></ErrorBoundary>;
}

export default function App() {
  const { user } = useAuth();

  useEffect(() => {
    if (isNative()) {
      registerForPushNotifications().catch(() => {});
    }
  }, [user]);

  // Keep the free-tier instance awake while a logged-in tab is open, so staff
  // never hit a cold-start gateway error (520/504) mid-session. warmServer() has
  // its own 60s cooldown, so the 4-minute tick is never a spam source.
  useEffect(() => {
    if (!user) return undefined;
    warmServer();
    const t = setInterval(warmServer, 4 * 60 * 1000);
    return () => clearInterval(t);
  }, [user]);

  return (
    <ErrorBoundary>
    <Routes>
      <Route path="/login" element={<Page><Login /></Page>} />
      <Route path="/register" element={<Page><Register /></Page>} />
      <Route path="/reset-password" element={<Page><ResetPassword /></Page>} />
      <Route path="/" element={<Protected><Page><Dashboard /></Page></Protected>} />
      <Route path="/students" element={<Protected><Page><Students /></Page></Protected>} />
      <Route path="/students/:id" element={<Protected><Page><StudentProfile /></Page></Protected>} />
      <Route path="/teachers" element={<Protected><Page><Teachers /></Page></Protected>} />
      <Route path="/subjects" element={<Protected><Page><Subjects /></Page></Protected>} />
      <Route path="/sections" element={<Protected><Page><Sections /></Page></Protected>} />
      <Route path="/enroll" element={<Protected><Page><Enroll /></Page></Protected>} />
      <Route path="/programs" element={<Protected><StaffAndTeacher><Page><Programs /></Page></StaffAndTeacher></Protected>} />
      <Route path="/submissions" element={<Protected><Page><Submissions /></Page></Protected>} />
      <Route path="/compliance" element={<Protected><AdminOnly><Page><Compliance /></Page></AdminOnly></Protected>} />
      <Route path="/aral" element={<Protected><Page><Aral /></Page></Protected>} />
      <Route path="/grades" element={<Protected><Page><Grades /></Page></Protected>} />
      <Route path="/grading-scales" element={<Protected><AdminOnly><Page><GradingScales /></Page></AdminOnly></Protected>} />
      <Route path="/rankings" element={<Protected><Page><Rankings /></Page></Protected>} />
      <Route path="/portal" element={<PortalProtected><Page><Portal /></Page></PortalProtected>} />
      <Route path="/portal/grades" element={<PortalProtected><Page><PortalGrades /></Page></PortalProtected>} />
      <Route path="/portal/enroll" element={<PortalProtected><Page><PortalEnroll /></Page></PortalProtected>} />
      <Route path="/portal/attendance" element={<PortalProtected><Page><PortalAttendance /></Page></PortalProtected>} />
      <Route path="/portal/schedule" element={<PortalProtected><Page><PortalSchedule /></Page></PortalProtected>} />
      <Route path="/portal/assignments" element={<PortalProtected><Page><PortalAssignments /></Page></PortalProtected>} />
      <Route path="/portal/announcements" element={<PortalProtected><Page><PortalAnnouncements /></Page></PortalProtected>} />
      <Route path="/portal/sports-news" element={<PortalProtected><Page><PortalSportsNews /></Page></PortalProtected>} />
      <Route path="/attendance" element={<Protected><Page><Attendance /></Page></Protected>} />
      <Route path="/assignments" element={<Protected><Page><Assignments /></Page></Protected>} />
      <Route path="/announcements" element={<Protected><AdminOnly><Page><Announcements /></Page></AdminOnly></Protected>} />
      <Route path="/sports-news" element={<Protected><AdminOnly><Page><SportsNews /></Page></AdminOnly></Protected>} />
      <Route path="/achievements" element={<Protected><Page><Achievements /></Page></Protected>} />
      <Route path="/users" element={<Protected><AdminOnly><Page><Users /></Page></AdminOnly></Protected>} />
      <Route path="/audit" element={<Protected><AdminOnly><Page><AuditLogs /></Page></AdminOnly></Protected>} />
      <Route path="/interventions" element={<Protected><Page><Interventions /></Page></Protected>} />
      <Route path="/assessment" element={<Protected><Page><Assessment /></Page></Protected>} />
      <Route path="/immersion" element={<Protected><Page><Immersion /></Page></Protected>} />
      <Route path="/career-tvl" element={<Protected><Page><CareerTVL /></Page></Protected>} />
      <Route path="/immersion-map" element={<Protected><Page><ImmersionMap /></Page></Protected>} />
      <Route path="/discipline" element={<Protected><Page><Discipline /></Page></Protected>} />
      <Route path="/notifications" element={<Protected><AdminOnly><Page><Notifications /></Page></AdminOnly></Protected>} />
      <Route path="/portal/portfolio" element={<PortalProtected><Page><PortalPortfolio /></Page></PortalProtected>} />
      <Route path="/portal/immersion" element={<PortalProtected><Page><PortalImmersion /></Page></PortalProtected>} />
      <Route path="/portal/analytics" element={<PortalProtected><Page><PortalAnalytics /></Page></PortalProtected>} />
      <Route path="/portal/certifications" element={<PortalProtected><Page><PortalCertifications /></Page></PortalProtected>} />
      <Route path="/portal/profile" element={<PortalProtected><Page><PortalProfile /></Page></PortalProtected>} />
      <Route path="/parent-portal" element={<ParentProtected><Page><ParentPortal /></Page></ParentProtected>} />
      <Route path="/privacy" element={<Protected><AdminOnly><Page><Privacy /></Page></AdminOnly></Protected>} />
      <Route path="/consent" element={<Protected><Page><Consent /></Page></Protected>} />
      <Route path="/mfa" element={<Protected><Page><MFASetup /></Page></Protected>} />
      <Route path="/analytics" element={<Protected><AdminOnly><Page><Analytics /></Page></AdminOnly></Protected>} />
      <Route path="/curriculum" element={<Protected><AdminOnly><Page><Curriculum /></Page></AdminOnly></Protected>} />
      <Route path="/rooms" element={<Protected><AdminOnly><Page><Rooms /></Page></AdminOnly></Protected>} />
      <Route path="/lessons" element={<Protected><Page><Lessons /></Page></Protected>} />
      <Route path="/competency-tracker" element={<Protected><Page><CompetencyTracker /></Page></Protected>} />
      <Route path="/certifications" element={<Protected><Page><Certifications /></Page></Protected>} />
      <Route path="/guidance" element={<Protected><Page><Guidance /></Page></Protected>} />
      <Route path="/deped-forms" element={<Protected><AdminOnly><Page><DepedForms /></Page></AdminOnly></Protected>} />
      <Route path="/ai" element={<Protected><AIWorkbenchOnly><Page><AIPage /></Page></AIWorkbenchOnly></Protected>} />
      <Route path="/design-system" element={<Protected><AdminOnly><Page><DesignSystem /></Page></AdminOnly></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <AIChatbotGate />
    </ErrorBoundary>
  );
}
