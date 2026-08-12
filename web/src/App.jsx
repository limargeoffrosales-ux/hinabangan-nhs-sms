import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Teachers from './pages/Teachers';
import Subjects from './pages/Subjects';
import Sections from './pages/Sections';
import Enroll from './pages/Enroll';
import Grades from './pages/Grades';
import Attendance from './pages/Attendance';
import Announcements from './pages/Announcements';
import Users from './pages/Users';
import AuditLogs from './pages/AuditLogs';
import Programs from './pages/Programs';
import Submissions from './pages/Submissions';
import Compliance from './pages/Compliance';
import AiDocs from './pages/AiDocs';
import Research from './pages/Research';
import ReadingNumeracy from './pages/ReadingNumeracy';
import Interventions from './pages/Interventions';
import Assessment from './pages/Assessment';
import DepedForms from './pages/DepedForms';
import Immersion from './pages/Immersion';

function Protected({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/students" element={<Protected><Students /></Protected>} />
      <Route path="/teachers" element={<Protected><Teachers /></Protected>} />
      <Route path="/subjects" element={<Protected><Subjects /></Protected>} />
      <Route path="/sections" element={<Protected><Sections /></Protected>} />
      <Route path="/enroll" element={<Protected><Enroll /></Protected>} />
      <Route path="/programs" element={<Protected><Programs /></Protected>} />
      <Route path="/submissions" element={<Protected><Submissions /></Protected>} />
      <Route path="/compliance" element={<Protected><Compliance /></Protected>} />
      <Route path="/grades" element={<Protected><Grades /></Protected>} />
      <Route path="/attendance" element={<Protected><Attendance /></Protected>} />
      <Route path="/announcements" element={<Protected><Announcements /></Protected>} />
      <Route path="/users" element={<Protected><Users /></Protected>} />
      <Route path="/audit" element={<Protected><AuditLogs /></Protected>} />
      <Route path="/ai-docs" element={<Protected><AiDocs /></Protected>} />
      <Route path="/research" element={<Protected><Research /></Protected>} />
      <Route path="/reading-numeracy" element={<Protected><ReadingNumeracy /></Protected>} />
      <Route path="/interventions" element={<Protected><Interventions /></Protected>} />
      <Route path="/assessment" element={<Protected><Assessment /></Protected>} />
      <Route path="/forms" element={<Protected><DepedForms /></Protected>} />
      <Route path="/immersion" element={<Protected><Immersion /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
