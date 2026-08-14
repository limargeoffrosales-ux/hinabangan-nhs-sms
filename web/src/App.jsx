import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, can } from './lib/auth';
import Layout from './components/Layout';
import { Spinner } from './components/ui';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Students = lazy(() => import('./pages/Students'));
const Teachers = lazy(() => import('./pages/Teachers'));
const Subjects = lazy(() => import('./pages/Subjects'));
const Sections = lazy(() => import('./pages/Sections'));
const Enroll = lazy(() => import('./pages/Enroll'));
const Grades = lazy(() => import('./pages/Grades'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Announcements = lazy(() => import('./pages/Announcements'));
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

function Protected({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
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
      <Route path="/attendance" element={<Protected><Page><Attendance /></Page></Protected>} />
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
