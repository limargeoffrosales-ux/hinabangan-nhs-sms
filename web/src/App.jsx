import { lazy, Suspense, useEffect, Component } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, can } from './lib/auth';
import Layout from './components/Layout';
import PortalLayout from './components/PortalLayout';
import AIChatbot from './components/AIChatbot';
import { Spinner } from './components/ui';
import { isNative, registerForPushNotifications } from './lib/capacitor';
import './i18n';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('ErrorBoundary caught:', error, info?.componentStack); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: 20, textAlign: 'center' }}>
          <div>
            <h1 style={{ fontSize: 24, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ color: '#6b7280', marginBottom: 16 }}>{this.state.error.message || 'An unexpected error occurred.'}</p>
            <button onClick={() => { this.setState({ error: null }); window.location.reload(); }} style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: '#1e3a5f', color: '#fff', cursor: 'pointer', fontSize: 14 }}>
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Students = lazy(() => import('./pages/Students'));
const Teachers = lazy(() => import('./pages/Teachers'));
const Subjects = lazy(() => import('./pages/Subjects'));
const Sections = lazy(() => import('./pages/Sections'));
const Enroll = lazy(() => import('./pages/Enroll'));
const Grades = lazy(() => import('./pages/Grades'));
const GradingScales = lazy(() => import('./pages/GradingScales'));
const Rankings = lazy(() => import('./pages/Rankings'));
const Portal = lazy(() => import('./pages/Portal'));
const PortalGrades = lazy(() => import('./pages/PortalGrades'));
const PortalAttendance = lazy(() => import('./pages/PortalAttendance'));
const PortalSchedule = lazy(() => import('./pages/PortalSchedule'));
const PortalAssignments = lazy(() => import('./pages/PortalAssignments'));
const PortalAnnouncements = lazy(() => import('./pages/PortalAnnouncements'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Announcements = lazy(() => import('./pages/Announcements'));
const Assignments = lazy(() => import('./pages/Assignments'));
const Users = lazy(() => import('./pages/Users'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const Programs = lazy(() => import('./pages/Programs'));
const Submissions = lazy(() => import('./pages/Submissions'));
const Compliance = lazy(() => import('./pages/Compliance'));
const Aral = lazy(() => import('./pages/Aral'));
const Interventions = lazy(() => import('./pages/Interventions'));
const Assessment = lazy(() => import('./pages/Assessment'));
const Immersion = lazy(() => import('./pages/Immersion'));
const Discipline = lazy(() => import('./pages/Discipline'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Privacy = lazy(() => import('./pages/Privacy'));
const MFASetup = lazy(() => import('./pages/MFASetup'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Curriculum = lazy(() => import('./pages/Curriculum'));
const Rooms = lazy(() => import('./pages/Rooms'));
const Lessons = lazy(() => import('./pages/Lessons'));
const CompetencyTracker = lazy(() => import('./pages/CompetencyTracker'));
const Certifications = lazy(() => import('./pages/Certifications'));
const Library = lazy(() => import('./pages/Library'));
const Clinic = lazy(() => import('./pages/Clinic'));
const Guidance = lazy(() => import('./pages/Guidance'));
const PortalPortfolio = lazy(() => import('./pages/PortalPortfolio'));
const PortalImmersion = lazy(() => import('./pages/PortalImmersion'));
const PortalAnalytics = lazy(() => import('./pages/PortalAnalytics'));
const PortalCertifications = lazy(() => import('./pages/PortalCertifications'));
const DepedForms = lazy(() => import('./pages/DepedForms'));
const AIPage = lazy(() => import('./pages/AIPage'));

function Protected({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'student' || user.role === 'parent') return <Navigate to="/portal" replace />;
  return <Layout>{children}</Layout>;
}

function PortalProtected({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'student' && user.role !== 'parent') return <Navigate to="/" replace />;
  return <PortalLayout>{children}</PortalLayout>;
}

function AdminOnly({ children }) {
  const { user } = useAuth();
  if (!can(user?.role, 'super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar')) return <Navigate to="/" replace />;
  return children;
}

function Page({ children }) {
  return <Suspense fallback={<Spinner />}>{children}</Suspense>;
}

export default function App() {
  const { user } = useAuth();

  useEffect(() => {
    if (isNative()) {
      import('@capacitor/status-bar').then(({ StatusBar }) => {
        StatusBar.setStyle({ style: 1 }).catch(() => {});
        StatusBar.setBackgroundColor({ color: '#1e3a5f' }).catch(() => {});
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (isNative() && user) {
      registerForPushNotifications().catch(() => {});
    }
  }, [user]);

  return (
    <ErrorBoundary>
    <Routes>
      <Route path="/login" element={<Page><Login /></Page>} />
      <Route path="/" element={<Protected><Page><Dashboard /></Page></Protected>} />
      <Route path="/students" element={<Protected><Page><Students /></Page></Protected>} />
      <Route path="/teachers" element={<Protected><Page><Teachers /></Page></Protected>} />
      <Route path="/subjects" element={<Protected><Page><Subjects /></Page></Protected>} />
      <Route path="/sections" element={<Protected><Page><Sections /></Page></Protected>} />
      <Route path="/enroll" element={<Protected><Page><Enroll /></Page></Protected>} />
      <Route path="/programs" element={<Protected><AdminOnly><Page><Programs /></Page></AdminOnly></Protected>} />
      <Route path="/submissions" element={<Protected><Page><Submissions /></Page></Protected>} />
      <Route path="/compliance" element={<Protected><AdminOnly><Page><Compliance /></Page></AdminOnly></Protected>} />
      <Route path="/aral" element={<Protected><Page><Aral /></Page></Protected>} />
      <Route path="/grades" element={<Protected><Page><Grades /></Page></Protected>} />
      <Route path="/grading-scales" element={<Protected><AdminOnly><Page><GradingScales /></Page></AdminOnly></Protected>} />
      <Route path="/rankings" element={<Protected><Page><Rankings /></Page></Protected>} />
      <Route path="/portal" element={<PortalProtected><Page><Portal /></Page></PortalProtected>} />
      <Route path="/portal/grades" element={<PortalProtected><Page><PortalGrades /></Page></PortalProtected>} />
      <Route path="/portal/attendance" element={<PortalProtected><Page><PortalAttendance /></Page></PortalProtected>} />
      <Route path="/portal/schedule" element={<PortalProtected><Page><PortalSchedule /></Page></PortalProtected>} />
      <Route path="/portal/assignments" element={<PortalProtected><Page><PortalAssignments /></Page></PortalProtected>} />
      <Route path="/portal/announcements" element={<PortalProtected><Page><PortalAnnouncements /></Page></PortalProtected>} />
      <Route path="/attendance" element={<Protected><Page><Attendance /></Page></Protected>} />
      <Route path="/assignments" element={<Protected><Page><Assignments /></Page></Protected>} />
      <Route path="/announcements" element={<Protected><AdminOnly><Page><Announcements /></Page></AdminOnly></Protected>} />
      <Route path="/users" element={<Protected><AdminOnly><Page><Users /></Page></AdminOnly></Protected>} />
      <Route path="/audit" element={<Protected><AdminOnly><Page><AuditLogs /></Page></AdminOnly></Protected>} />
      <Route path="/interventions" element={<Protected><Page><Interventions /></Page></Protected>} />
      <Route path="/assessment" element={<Protected><Page><Assessment /></Page></Protected>} />
      <Route path="/immersion" element={<Protected><Page><Immersion /></Page></Protected>} />
      <Route path="/discipline" element={<Protected><Page><Discipline /></Page></Protected>} />
      <Route path="/notifications" element={<Protected><AdminOnly><Page><Notifications /></Page></AdminOnly></Protected>} />
      <Route path="/portal/portfolio" element={<PortalProtected><Page><PortalPortfolio /></Page></PortalProtected>} />
      <Route path="/portal/immersion" element={<PortalProtected><Page><PortalImmersion /></Page></PortalProtected>} />
      <Route path="/portal/analytics" element={<PortalProtected><Page><PortalAnalytics /></Page></PortalProtected>} />
      <Route path="/portal/certifications" element={<PortalProtected><Page><PortalCertifications /></Page></PortalProtected>} />
      <Route path="/privacy" element={<Protected><AdminOnly><Page><Privacy /></Page></AdminOnly></Protected>} />
      <Route path="/mfa" element={<Protected><Page><MFASetup /></Page></Protected>} />
      <Route path="/analytics" element={<Protected><AdminOnly><Page><Analytics /></Page></AdminOnly></Protected>} />
      <Route path="/curriculum" element={<Protected><AdminOnly><Page><Curriculum /></Page></AdminOnly></Protected>} />
      <Route path="/rooms" element={<Protected><AdminOnly><Page><Rooms /></Page></AdminOnly></Protected>} />
      <Route path="/lessons" element={<Protected><Page><Lessons /></Page></Protected>} />
      <Route path="/competency-tracker" element={<Protected><Page><CompetencyTracker /></Page></Protected>} />
      <Route path="/certifications" element={<Protected><Page><Certifications /></Page></Protected>} />
      <Route path="/library" element={<Protected><Page><Library /></Page></Protected>} />
      <Route path="/clinic" element={<Protected><Page><Clinic /></Page></Protected>} />
      <Route path="/guidance" element={<Protected><Page><Guidance /></Page></Protected>} />
      <Route path="/deped-forms" element={<Protected><AdminOnly><Page><DepedForms /></Page></AdminOnly></Protected>} />
      <Route path="/ai" element={<Protected><Page><AIPage /></Page></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <AIChatbot />
    </ErrorBoundary>
  );
}
