import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, can } from './lib/auth';
import Layout from './components/Layout';
import PortalLayout from './components/PortalLayout';
import { Spinner } from './components/ui';
import './i18n';

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
const AiDocs = lazy(() => import('./pages/AiDocs'));
const Research = lazy(() => import('./pages/Research'));
const ReadingNumeracy = lazy(() => import('./pages/ReadingNumeracy'));
const Interventions = lazy(() => import('./pages/Interventions'));
const Assessment = lazy(() => import('./pages/Assessment'));
const DepedForms = lazy(() => import('./pages/DepedForms'));
const Immersion = lazy(() => import('./pages/Immersion'));
const Discipline = lazy(() => import('./pages/Discipline'));
const Notifications = lazy(() => import('./pages/Notifications'));
const ConsentForms = lazy(() => import('./pages/ConsentForms'));
const PortalConsent = lazy(() => import('./pages/PortalConsent'));
const Privacy = lazy(() => import('./pages/Privacy'));
const MFASetup = lazy(() => import('./pages/MFASetup'));
const SecurityIncidents = lazy(() => import('./pages/SecurityIncidents'));
const DataImportExport = lazy(() => import('./pages/DataImportExport'));
const Analytics = lazy(() => import('./pages/Analytics'));

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
  if (!can(user?.role, 'super_admin', 'school_admin')) return <Navigate to="/" replace />;
  return children;
}

function Page({ children }) {
  return <Suspense fallback={<Spinner />}>{children}</Suspense>;
}

export default function App() {
  return (
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
      <Route path="/ai-docs" element={<Protected><Page><AiDocs /></Page></Protected>} />
      <Route path="/research" element={<Protected><Page><Research /></Page></Protected>} />
      <Route path="/reading-numeracy" element={<Protected><Page><ReadingNumeracy /></Page></Protected>} />
      <Route path="/interventions" element={<Protected><Page><Interventions /></Page></Protected>} />
      <Route path="/assessment" element={<Protected><Page><Assessment /></Page></Protected>} />
      <Route path="/forms" element={<Protected><Page><DepedForms /></Page></Protected>} />
      <Route path="/immersion" element={<Protected><Page><Immersion /></Page></Protected>} />
      <Route path="/discipline" element={<Protected><Page><Discipline /></Page></Protected>} />
      <Route path="/notifications" element={<Protected><AdminOnly><Page><Notifications /></Page></AdminOnly></Protected>} />
      <Route path="/consent" element={<Protected><AdminOnly><Page><ConsentForms /></Page></AdminOnly></Protected>} />
      <Route path="/portal/consent" element={<PortalProtected><Page><PortalConsent /></Page></PortalProtected>} />
      <Route path="/privacy" element={<Protected><AdminOnly><Page><Privacy /></Page></AdminOnly></Protected>} />
      <Route path="/mfa" element={<Protected><Page><MFASetup /></Page></Protected>} />
      <Route path="/security-incidents" element={<Protected><AdminOnly><Page><SecurityIncidents /></Page></AdminOnly></Protected>} />
      <Route path="/import-export" element={<Protected><AdminOnly><Page><DataImportExport /></Page></AdminOnly></Protected>} />
      <Route path="/analytics" element={<Protected><AdminOnly><Page><Analytics /></Page></AdminOnly></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
