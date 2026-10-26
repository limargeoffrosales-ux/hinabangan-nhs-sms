import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import {
  Users, UserCog, Layers, CalendarCheck, Megaphone, Activity,
  BookOpenCheck, ShieldAlert, GraduationCap, Target, Briefcase,
  BadgeCheck, UserCheck, History, ArrowRight, Calendar, Pencil, Plus, Trash2,
} from 'lucide-react';
import { api } from '../lib/api';
import { subscribeLive } from '../lib/realtime';
import { SEX_COLORS } from '../lib/constants';
import { PageHead, Spinner, Empty, Badge, KPICard, SectionCard, FunnelBar, FeedItem, QuickActions, Modal } from '../components/ui';
import DashboardSections from '../components/DashboardSections';
import TarikMascot from '../components/TarikMascot';
import TarikCrestLogo from '../components/TarikCrestLogo';
import UgopTeacherCorner from '../components/UgopTeacherCorner';
import { UgopTileIcon, TarikIcon } from '../components/UgopFeatureIcons';
import { LiveActivityFeed, LiveStatusPill, ModernBarChart, Sparkline } from '../design-system';

const READINESS_STATUS = {
  done: { badge: 'badge-green', tri: 'dashboard.readinessDone' },
  started: { badge: 'badge-blue', tri: 'dashboard.readinessStarted' },
  pending: { badge: 'badge-yellow', tri: 'dashboard.readinessPending' },
  note: { badge: 'badge-gray', tri: 'dashboard.readinessNote' },
};

function AnimatedCounter({ value, durationMs = 800 }) {
  const [count, setCount] = useState(0);
  const target = typeof value === 'number' ? value : (parseInt(value, 10) || 0);

  useEffect(() => {
    if (target <= 0) { setCount(0); return; }
    let start = 0;
    const step = Math.max(1, Math.ceil(target / (durationMs / 16)));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, durationMs]);

  return <span>{count.toLocaleString()}</span>;
}

function DepedCalendarWidget() {
  const { user } = useAuth();
  const canWrite = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'].includes(user?.role);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingEvents, setEditingEvents] = useState([]);

  const loadCalendar = useCallback(() => {
    setLoading(true);
    api('/dashboard/calendar')
      .then((res) => setEvents(res?.events || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  function openEditModal() {
    setEditingEvents(JSON.parse(JSON.stringify(events)));
    setModalOpen(true);
  }

  function updateEvent(idx, field, val) {
    setEditingEvents((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  }

  function addEvent() {
    setEditingEvents((prev) => [
      ...prev,
      { id: Date.now(), date: 'Oct 25, 2026', title: 'New School Event', type: 'General', badge: 'badge-blue' },
    ]);
  }

  function removeEvent(idx) {
    setEditingEvents((prev) => prev.filter((_, i) => i !== idx));
  }

  async function saveCalendar() {
    setBusy(true);
    try {
      await api('/dashboard/calendar', { method: 'PUT', body: { events: editingEvents } });
      setEvents(editingEvents);
      setModalOpen(false);
    } catch (e) {
      alert(e.message || 'Failed to update calendar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title="DepEd School Calendar & Key Deadlines" icon={Calendar}>
      {canWrite && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button className="btn btn-sm" onClick={openEditModal} style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Pencil size={12} /> Edit Deadlines
          </button>
        </div>
      )}
      {loading ? (
        <Spinner />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {events.map((ev, idx) => (
            <div key={ev.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-soft)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: '4px 8px', background: 'var(--primary-tint)', borderRadius: 8, fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>
                  {ev.date}
                </div>
                <strong style={{ fontSize: 13, color: 'var(--text)' }}>{ev.title}</strong>
              </div>
              <span className={`badge ${ev.badge || 'badge-blue'}`}>{ev.type}</span>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal title="Edit DepEd Calendar & Key Deadlines" onClose={() => setModalOpen(false)}>
          <div style={{ display: 'grid', gap: 12, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
            {editingEvents.map((ev, idx) => (
              <div key={idx} style={{ padding: 10, background: 'var(--bg-soft)', borderRadius: 10, border: '1px solid var(--border)', display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    value={ev.date}
                    onChange={(e) => updateEvent(idx, 'date', e.target.value)}
                    placeholder="Date (e.g. Oct 20, 2026)"
                    style={{ flex: 1, fontSize: 12 }}
                  />
                  <input
                    className="input"
                    value={ev.type}
                    onChange={(e) => updateEvent(idx, 'type', e.target.value)}
                    placeholder="Type (e.g. Exams, Grading)"
                    style={{ width: 110, fontSize: 12 }}
                  />
                  <select
                    className="input"
                    value={ev.badge}
                    onChange={(e) => updateEvent(idx, 'badge', e.target.value)}
                    style={{ width: 110, fontSize: 12 }}
                  >
                    <option value="badge-red">Red Badge</option>
                    <option value="badge-yellow">Yellow Badge</option>
                    <option value="badge-blue">Blue Badge</option>
                    <option value="badge-green">Green Badge</option>
                  </select>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => removeEvent(idx)}>
                    <Trash2 size={13} />
                  </button>
                </div>
                <input
                  className="input"
                  value={ev.title}
                  onChange={(e) => updateEvent(idx, 'title', e.target.value)}
                  placeholder="Event Title / Deadline"
                  style={{ fontSize: 13 }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <button type="button" className="btn btn-sm" onClick={addEvent} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={13} /> Add Deadline Event
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-sm" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-sm btn-primary" onClick={saveCalendar} disabled={busy}>
                {busy ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </SectionCard>
  );
}
}

function fmtWhen(iso) {
  if (!iso) return '';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const diff = Math.max(0, Date.now() - then.getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function actionLabel(action, t) {
  if (!action) return '';
  const key = `dashboard.act.${action}`;
  if (t && t(key) !== key) return t(key);
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isTeacher = user?.role === 'teacher';
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [activity, setActivity] = useState(null);
  const [lastLive, setLastLive] = useState(null);
  const [error, setError] = useState(null);

  const loadActivity = useCallback(() => api('/dashboard/latest-activity?limit=8', { timeoutMs: 30000, retryNetwork: false })
    .then((r) => setActivity(r?.data || []))
    .catch(() => setActivity([])), []);

  useEffect(() => {
    let unmounted = false;
    api('/dashboard/summary', { timeoutMs: 30000 })
      .then((res) => { if (!unmounted) setData(res); })
      .catch((e) => { if (!unmounted) setError(e.message); });
    api('/announcements?limit=5', { timeoutMs: 30000 })
      .then((res) => { if (!unmounted) setAnnouncements(res?.data || []); })
      .catch(() => {});
    loadActivity();
    return () => { unmounted = true; };
  }, [loadActivity]);

  useEffect(() => {
    return subscribeLive(() => {
      setLastLive(new Date());
      loadActivity();
    });
  }, [loadActivity]);

  if (error && !data) return <PageHead title={t('dashboard.title')}><div className="err-banner">{error}</div></PageHead>;
  if (!data) return <Spinner />;

  const kpis = [
    { to: '/students', label: t('dashboard.enrolledLearners'), value: <AnimatedCounter value={data.enrolled ?? 0} />, sub: t('dashboard.enrolledSub', { total: data.students ?? 0 }), icon: Users, color: 'var(--accent)' },
    { to: '/enroll', label: t('dashboard.waitlisted'), value: <AnimatedCounter value={data.waitlisted ?? 0} />, sub: t('dashboard.waitlistedSub'), icon: Users, color: 'var(--warn)' },
    { to: '/teachers', label: t('dashboard.activeTeachers'), value: <AnimatedCounter value={data.teachers ?? 0} />, sub: t('dashboard.activeTeachersSub'), icon: UserCog, color: 'var(--accent-2)' },
    { to: '/sections', label: t('dashboard.sections'), value: <AnimatedCounter value={data.sections ?? 0} />, sub: t('dashboard.activeSectionsSub'), icon: Layers, color: 'var(--accent-3)' },
    { to: '/subjects', label: t('dashboard.subjectsOffered'), value: <AnimatedCounter value={data.subjects ?? 0} />, sub: t('dashboard.offeredSub'), icon: BookOpenCheck, color: 'var(--purple)' },
    { to: '/attendance', label: t('dashboard.attendanceLogged'), value: <AnimatedCounter value={data.attendance_logged_today ?? 0} />, sub: t('dashboard.attendanceLoggedSub'), icon: CalendarCheck, color: 'var(--success)' },
  ];

  const r = data.readiness || {};
  const readinessItems = [
    { key: 'grades', label: t('dashboard.gradesEntry'), to: '/grades', icon: BookOpenCheck,
      detail: `${r.grades?.learners ?? 0} ${t('dashboard.ofEligible')} ${r.grades?.expected ?? 0} ${t('dashboard.enrolledLearners')}`,
      status: (r.grades?.expected ?? 0) > 0 ? ((r.grades?.learners ?? 0) >= (r.grades?.expected ?? 0) ? 'done' : 'pending') : 'note' },
    { key: 'attendance', label: t('dashboard.studentAttendanceLogging'), to: '/attendance', icon: CalendarCheck,
      detail: `${r.attendance?.days ?? 0} ${t('dashboard.dayLogged')} · ${r.attendance?.records ?? 0} ${t('dashboard.records')}`,
      status: (r.attendance?.days ?? 0) > 0 ? 'started' : 'pending' },
    { key: 'teacherAttendance', label: t('dashboard.teacherAttendanceMarking'), to: '/attendance', icon: UserCheck,
      detail: `${r.teacher_attendance?.marked ?? 0} ${t('dashboard.ofEligible')} ${r.teacher_attendance?.total ?? 0} ${t('dashboard.markedToday')}`,
      status: (r.teacher_attendance?.total ?? 0) > 0 ? ((r.teacher_attendance?.marked ?? 0) >= (r.teacher_attendance?.total ?? 0) ? 'done' : 'pending') : 'note' },
    { key: 'conduct', label: t('dashboard.conductDiscipline'), to: '/discipline', icon: ShieldAlert,
      detail: `${r.conduct?.records ?? 0} ${t('dashboard.recordPlural')}`,
      status: (r.conduct?.records ?? 0) > 0 ? 'started' : 'pending' },
    { key: 'aral', label: t('dashboard.aralProgram'), to: '/aral', icon: GraduationCap,
      detail: `${r.aral?.tagged ?? 0} ${t('dashboard.taggedLearners')} · ${r.aral?.sessions ?? 0} ${t('dashboard.sessionPlural')}`,
      status: (r.aral?.sessions ?? 0) > 0 ? 'started' : ((r.aral?.tagged ?? 0) > 0 ? 'pending' : 'note') },
    { key: 'assessments', label: t('dashboard.assessmentsEntry'), to: '/assessment', icon: Target,
      detail: `${r.assessments?.records ?? 0} ${t('dashboard.recordPlural')}`,
      status: (r.assessments?.records ?? 0) > 0 ? 'started' : 'pending' },
    { key: 'immersion', label: t('dashboard.workImmersion'), to: '/immersion', icon: Briefcase,
      detail: `${r.immersion?.total ?? 0} ${t('dashboard.immersionLearners')} · ${r.immersion?.pending ?? 0} ${t('dashboard.immersionPending')}`,
      status: (r.immersion?.total ?? 0) > 0 ? ((r.immersion?.pending ?? 0) > 0 ? 'pending' : 'done') : 'note' },
    { key: 'jdvp', label: t('dashboard.jdvp'), to: '/immersion', icon: BadgeCheck,
      detail: `${r.jdvp?.total ?? 0} ${t('dashboard.recipientPlural')}`,
      status: (r.jdvp?.total ?? 0) > 0 ? 'started' : 'note' },
  ];

  const funnel = [
    { label: t('dashboard.learnersOnRecord'), value: data.students ?? 0, color: 'var(--accent)' },
    { label: t('dashboard.enrolledToSection'), value: data.enrolled ?? 0, color: 'var(--accent-2)' },
    { label: t('dashboard.enrolledWithSubjects'), value: data.with_subjects ?? 0, color: 'var(--accent-3)' },
  ];

  const gradeData = Object.entries(data.enrolled_by_grade_level || {}).map(([g, v]) => ({
    grade: g, Male: v.male, Female: v.female,
  }));

  const gradeSpark = Object.values(data.enrolled_by_grade_level || {})
    .map((v) => (v.male || 0) + (v.female || 0));

  const quick = [
    { to: '/enroll', label: t('dashboard.enrollStudent', 'Enroll a student'), icon: Users },
    { to: '/attendance', label: t('dashboard.recordAttendance', 'Record attendance'), icon: CalendarCheck },
    { to: '/grades', label: t('dashboard.enterGrades', 'Enter class grades'), icon: Activity },
    { to: '/aral', label: t('dashboard.aralProgram'), icon: GraduationCap },
    { to: '/immersion', label: t('dashboard.workImmersion'), icon: Briefcase },
    { to: '/discipline', label: t('dashboard.manageRecords'), icon: ShieldAlert },
  ];

  const maxFunnel = Math.max(1, ...funnel.map((f) => f.value));

  return (
    <>
      <PageHead
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span>{t('dashboard.title')}</span>
            {!isTeacher && ((data?.pending_users ?? 0) > 0 || (data?.pending_enrollments ?? 0) > 0) && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {(data.pending_users ?? 0) > 0 && (
                  <Link to="/users" className="btn btn-sm btn-warn" style={{ gap: 6, textDecoration: 'none' }}>
                    <ShieldAlert size={14} /> Action Required: Sign-Ups ({data.pending_users})
                  </Link>
                )}
                {(data.pending_enrollments ?? 0) > 0 && (
                  <Link to="/enroll" className="btn btn-sm btn-primary" style={{ gap: 6, textDecoration: 'none' }}>
                    <ShieldAlert size={14} /> Action Required: Enrollments ({data.pending_enrollments})
                  </Link>
                )}
              </div>
            )}
          </div>
        }
        sub={`${t('dashboard.schoolYearSnapshot')} ${data.school_year || '—'} · ${data.date}`}
      />

      {/* TARIK Hero Welcome Banner */}
      <div className="card" style={{ background: 'var(--grad)', color: '#fff', marginBottom: 20, borderRadius: 'var(--radius)', padding: '24px 28px', position: 'relative', overflow: 'hidden', boxShadow: '0 12px 35px rgba(27,107,74,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <TarikCrestLogo size={76} style={{ border: '3px solid #F5A623' }} />
            <div>
              <span className="badge badge-amber" style={{ marginBottom: 6, background: '#F5A623', color: '#12261C', fontWeight: 700 }}>TARIK Platform · DepEd Samar</span>
              <h2 style={{ fontSize: 24, margin: '4px 0 2px 0', color: '#fff', fontFamily: 'var(--font-display)' }}>Maupay nga adlaw, {user?.name || 'Admin'}!</h2>
              <p style={{ margin: 0, opacity: 0.9, fontSize: 13.5 }}>Hinabangan National High School Management System · 5-Year Data Retention Active</p>
            </div>
          </div>
          <TarikMascot pose="cheering" size={100} />
        </div>
      </div>

      {/* Pending Approvals Alert Banner for Admins */}
      {!isTeacher && ((data.pending_users ?? 0) > 0 || (data.pending_enrollments ?? 0) > 0) && (
        <div className="card" style={{ marginBottom: 20, border: '1px solid rgba(var(--rgb-warn), 0.5)', background: 'rgba(var(--rgb-warn), 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ShieldAlert size={22} style={{ color: 'var(--warn)', flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: 15, color: 'var(--text)' }}>Action Required: Pending Approvals Queue</strong>
                <p className="sub" style={{ margin: '2px 0 0 0', fontSize: 13 }}>
                  {(data.pending_users ?? 0) > 0 && `${data.pending_users} new sign-up request(s) awaiting user approval. `}
                  {(data.pending_enrollments ?? 0) > 0 && `${data.pending_enrollments} student enrollment application(s) awaiting section placement.`}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(data.pending_users ?? 0) > 0 && (
                <Link to="/users" className="btn btn-sm btn-warn">
                  Review Sign-Ups ({data.pending_users})
                </Link>
              )}
              {(data.pending_enrollments ?? 0) > 0 && (
                <Link to="/enroll" className="btn btn-sm btn-primary">
                  Review Enrollments ({data.pending_enrollments})
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {user?.role === 'super_admin' && (
        <div className="card" style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B, #0F172A)', border: '1px solid rgba(var(--rgb-accent), 0.4)', color: '#fff', marginBottom: 20, borderRadius: 'var(--radius)', padding: '24px 28px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <div>
              <span className="badge badge-blue" style={{ marginBottom: 6 }}>Superadmin Executive Command Center</span>
              <h2 style={{ fontSize: 22, margin: '4px 0 2px 0', color: '#fff' }}>Hinabangan NHS Core Infrastructure</h2>
              <p style={{ margin: 0, opacity: 0.8, fontSize: 13.5 }}>System status: All services operational · 5-Year Data Retention Active · Secure SSL Encrypted</p>
            </div>
            <div className="status-online-badge">
              <span className="status-online-dot" /> Secure Live
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
            <Link to="/users" className="btn" style={{ background: 'rgba(77,150,255,0.2)', color: '#fff', border: '1px solid rgba(77,150,255,0.4)', display: 'inline-flex', alignItems: 'center' }}>
              <TarikIcon pose="happy" emoji="👥" size={16} /> User Accounts &amp; Access Codes
            </Link>
            <Link to="/audit" className="btn" style={{ background: 'rgba(47,214,160,0.2)', color: '#fff', border: '1px solid rgba(47,214,160,0.4)', display: 'inline-flex', alignItems: 'center' }}>
              <TarikIcon pose="thinking" emoji="🛡️" size={16} /> Security Audit Logs
            </Link>
            <Link to="/compliance" className="btn" style={{ background: 'rgba(167,139,250,0.2)', color: '#fff', border: '1px solid rgba(167,139,250,0.4)', display: 'inline-flex', alignItems: 'center' }}>
              <TarikIcon pose="happy" emoji="🔒" size={16} /> Compliance &amp; Privacy (RA 10173)
            </Link>
            <Link to="/grading-scales" className="btn" style={{ background: 'rgba(56,189,248,0.2)', color: '#fff', border: '1px solid rgba(56,189,248,0.4)', display: 'inline-flex', alignItems: 'center' }}>
              <TarikIcon pose="clipboard" emoji="📊" size={16} /> Grading Scales
            </Link>
          </div>
        </div>
      )}

      {isTeacher && (
        <div className="card" style={{ background: 'var(--grad)', color: '#fff', marginBottom: 20, borderRadius: 'var(--radius)', padding: '24px 28px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 22, margin: '0 0 6px 0', color: '#fff' }}>Maupay nga adlaw, {user?.name || 'Teacher'}!</h2>
              <p style={{ margin: '0 0 16px 0', opacity: 0.9, fontSize: 14 }}>
                Access your dedicated TARIK teacher tools: view your weekly class program, enter class grades, record attendance, and post assignments.
              </p>
            </div>
            <TarikMascot pose="happy" size={130} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Link to="/programs" className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)' }}>
              <CalendarCheck size={16} /> My Class Program
            </Link>
            <Link to="/grades" className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)' }}>
              <BookOpenCheck size={16} /> Enter Class Grades
            </Link>
            <Link to="/attendance" className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)' }}>
              <UserCheck size={16} /> Record Attendance
            </Link>
            <Link to="/assignments" className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)' }}>
              <Briefcase size={16} /> LMS Assignments
            </Link>
            <Link to="/learning" className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)' }}>
              <GraduationCap size={16} /> Learning Hub
            </Link>
          </div>
        </div>
      )}

      <div className="kpi-strip">
        {kpis.map((k) => (
          <KPICard key={k.label} to={k.to} icon={k.icon} value={k.value} label={k.label} sub={k.sub} color={k.color} />
        ))}
      </div>

      <div style={{ height: 18 }} />

      <DepedCalendarWidget />

      <div style={{ height: 18 }} />

      <UgopTeacherCorner />

      <div style={{ height: 18 }} />

      <DashboardSections />

      <div style={{ height: 18 }} />

      {isTeacher ? (
        <div className="card" style={{ marginTop: 18 }}>
          <h3 style={{ marginTop: 0 }}><Megaphone size={16} style={{ verticalAlign: -2 }} /> {t('nav.announcements')}</h3>
          {announcements.length === 0 ? <Empty text={t('dashboard.noAnnouncements')} /> : (
            announcements.map((a) => (
              <div key={a.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>{a.title}</strong>
                  <Badge status={a.priority} />
                  <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: 12 }}>{a.created_at?.slice(0, 10)}</span>
                </div>
                <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', fontSize: 13.5, lineHeight: 1.6 }}>{a.body}</p>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-3">
          <SectionCard title={t('nav.announcements')} icon={Megaphone}>
            {announcements.length === 0 ? <Empty text={t('dashboard.noAnnouncements')} /> : (
              announcements.map((a) => (
                <div key={a.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>{a.title}</strong>
                    <Badge status={a.priority} />
                    <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: 12 }}>{a.created_at?.slice(0, 10)}</span>
                  </div>
                  <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', fontSize: 13.5, lineHeight: 1.6 }}>{a.body}</p>
                </div>
              ))
            )}
          </SectionCard>

          <SectionCard title={t('dashboard.recentActivity')} icon={History}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <LiveStatusPill
                label=""
                lastUpdated={lastLive}
                staleAfterMs={90000}
                ageFormatter={(ms) => fmtWhen(new Date(Date.now() - ms))}
              />
            </div>
            {activity === null ? (
              <div style={{ padding: '12px 0' }}><Spinner /></div>
            ) : activity.length === 0 ? (
              <Empty text={t('dashboard.noRecentActivity')} />
            ) : (
              <div>
                {activity.slice(0, 6).map((item) => (
                  <FeedItem key={item.id}>
                    <div style={{ fontSize: 13 }}>
                      <strong>{item.user_name || item.user_role || t('dashboard.system')}</strong>{' '}
                      <span style={{ color: 'var(--text-dim)' }}>{actionLabel(item.action, t)}</span>
                      {item.target_type && (
                        <span style={{ color: 'var(--text-dim)' }}>
                          {' '}
                          · {item.target_type}
                        </span>
                      )}
                    </div>
                    <div className="sub" style={{ fontSize: 11.5, marginTop: 2 }}>{fmtWhen(item.created_at)}</div>
                  </FeedItem>
                ))}
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                  <Link to="/audit" style={{ fontSize: 12.5, fontWeight: 600 }}>{t('dashboard.viewAuditLogs')}</Link>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title={t('dashboard.quickActions')} icon={Activity}>
            <QuickActions items={quick} />
            <div className="sub" style={{ marginTop: 14, fontSize: 12, color: 'var(--text-dim)' }}>
              {data.audit_count ?? 0} {t('dashboard.systemActionsRecorded')}
            </div>
          </SectionCard>
        </div>
      )}
    </>
  );
}
