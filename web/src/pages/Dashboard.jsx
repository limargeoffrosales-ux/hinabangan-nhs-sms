import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import {
  Users, UserCog, Layers, CalendarCheck, Megaphone, Activity,
  BookOpenCheck, ShieldAlert, GraduationCap, Target, Briefcase,
  BadgeCheck, UserCheck, History, ArrowRight,
} from 'lucide-react';
import { api } from '../lib/api';
import { subscribeLive } from '../lib/realtime';
import { SEX_COLORS } from '../lib/constants';
import { PageHead, Spinner, Empty, Badge, KPICard, SectionCard, FunnelBar, FeedItem, QuickActions } from '../components/ui';
import DashboardSections from '../components/DashboardSections';
import TarikMascot from '../components/TarikMascot';
import { LiveActivityFeed, LiveStatusPill, ModernBarChart, Sparkline } from '../design-system';

const READINESS_STATUS = {
  done: { badge: 'badge-green', tri: 'dashboard.readinessDone' },
  started: { badge: 'badge-blue', tri: 'dashboard.readinessStarted' },
  pending: { badge: 'badge-yellow', tri: 'dashboard.readinessPending' },
  note: { badge: 'badge-gray', tri: 'dashboard.readinessNote' },
};

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
    api('/dashboard/summary')
      .then(setData)
      .catch((e) => setError(e.message));
    api('/announcements?limit=4', { timeoutMs: 30000, retryNetwork: false })
      .then((r) => setAnnouncements(r?.data || []))
      .catch(() => {});
    loadActivity();
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
    { to: '/students', label: t('dashboard.enrolledLearners'), value: data.enrolled ?? 0, sub: t('dashboard.enrolledSub', { total: data.students ?? 0 }), icon: Users, color: 'var(--accent)' },
    { to: '/enroll', label: t('dashboard.waitlisted'), value: data.waitlisted ?? 0, sub: t('dashboard.waitlistedSub'), icon: Users, color: 'var(--warn)' },
    { to: '/teachers', label: t('dashboard.activeTeachers'), value: data.teachers ?? 0, sub: t('dashboard.activeTeachersSub'), icon: UserCog, color: 'var(--accent-2)' },
    { to: '/sections', label: t('dashboard.sections'), value: data.sections ?? 0, sub: t('dashboard.activeSectionsSub'), icon: Layers, color: 'var(--accent-3)' },
    { to: '/subjects', label: t('dashboard.subjectsOffered'), value: data.subjects ?? 0, sub: t('dashboard.offeredSub'), icon: BookOpenCheck, color: 'var(--purple)' },
    { to: '/attendance', label: t('dashboard.attendanceLogged'), value: data.attendance_logged_today ?? 0, sub: t('dashboard.attendanceLoggedSub'), icon: CalendarCheck, color: 'var(--success)' },
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
            <Link to="/users" className="btn" style={{ background: 'rgba(77,150,255,0.2)', color: '#fff', border: '1px solid rgba(77,150,255,0.4)' }}>
              <Users size={15} /> User Accounts &amp; Access Codes
            </Link>
            <Link to="/audit" className="btn" style={{ background: 'rgba(47,214,160,0.2)', color: '#fff', border: '1px solid rgba(47,214,160,0.4)' }}>
              <History size={15} /> Security Audit Logs
            </Link>
            <Link to="/compliance" className="btn" style={{ background: 'rgba(167,139,250,0.2)', color: '#fff', border: '1px solid rgba(167,139,250,0.4)' }}>
              <ShieldAlert size={15} /> Compliance &amp; Privacy (RA 10173)
            </Link>
            <Link to="/grading-scales" className="btn" style={{ background: 'rgba(56,189,248,0.2)', color: '#fff', border: '1px solid rgba(56,189,248,0.4)' }}>
              <GraduationCap size={15} /> Grading Scales
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
                Access your dedicated UGOP teacher tools: view your weekly class program, enter class grades, record attendance, and post assignments.
              </p>
            </div>
            <TarikMascot pose="happy" size={72} />
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

      <Link to="/career-tvl" className="info-card" style={{ marginTop: 18, textDecoration: 'none' }}>
        <div className="kpi-icon" style={{ background: 'color-mix(in srgb, var(--accent-2) 14%, transparent)', color: 'var(--accent-2)' }}>
          <Briefcase size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{t('dashboard.careerTvl')}</div>
          <div className="sub" style={{ fontSize: 12.5, marginTop: 2 }}>{t('dashboard.careerTvlSub')}</div>
        </div>
        <ArrowRight size={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
      </Link>

      <div style={{ height: 18 }} />

      <div className="grid grid-2">
        <SectionCard title={t('dashboard.enrollmentPipeline')} icon={Activity}>
          <div style={{ display: 'grid', gap: 14 }}>
            {funnel.map((f) => (
              <FunnelBar key={f.label} label={f.label} value={f.value} max={maxFunnel} color={f.color} />
            ))}
          </div>
          <div className="sub" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <History size={13} />
            {t('dashboard.pipelineHint')}
          </div>
        </SectionCard>

        <SectionCard title={t('dashboard.enrolledByGrade')} icon={Layers}>
          {gradeData.length > 0 ? (
            <ModernBarChart
              data={gradeData}
              categoryKey="grade"
              series={[
                { key: 'Male', color: SEX_COLORS.Male },
                { key: 'Female', color: SEX_COLORS.Female },
              ]}
              height={190}
              showLabels={false}
              barCategoryGap="24%"
              unavailable={t('dashboard.chartUnavailable', 'Chart could not be loaded.')}
            />
          ) : (
            <Empty text={t('dashboard.noEnrolledGrade', 'No enrolled learners for the current school year yet.')} />
          )}
          <div className="sub" style={{ display: 'flex', gap: 16, justifyContent: 'center', alignItems: 'center', fontSize: 13, marginTop: 8 }}>
            {Object.entries(SEX_COLORS).map(([sex, color]) => (
              <span key={sex} style={{ color: 'var(--text-dim)' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: color, marginRight: 6 }} />
                {sex}: <strong style={{ color: 'var(--text)' }}>{data.enrolled_by_grade_level ? Object.values(data.enrolled_by_grade_level).reduce((a, v) => a + (sex === 'Male' ? v.male : v.female), 0) : 0}</strong>
              </span>
            ))}
            {gradeSpark.length > 1 && <Sparkline data={gradeSpark} ariaLabel={t('dashboard.enrolledByGrade')} />}
          </div>
        </SectionCard>
      </div>

      <div style={{ height: 18 }} />

      <SectionCard title={t('dashboard.dataReadiness')} icon={Activity}>
        <div className="split-2">
          {readinessItems.map((item) => {
            const st = READINESS_STATUS[item.status] || READINESS_STATUS.note;
            return (
              <div key={item.key} className="readiness-item">
                <div className="kpi-icon" style={{ background: 'var(--card)', color: 'var(--text-dim)', flexShrink: 0 }}>
                  <item.icon size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Link to={item.to} style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>{item.label}</Link>
                    <span className={`badge ${st.badge}`}>{t(st.tri)}</span>
                  </div>
                  <div className="sub" style={{ fontSize: 12.5, marginTop: 2 }}>{item.detail}</div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

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
                aria-label={t('dashboard.recentActivity')}
              />
            </div>
            <LiveActivityFeed
              items={activity ?? []}
              loading={activity === null}
              itemKey={(a) => String(a.id)}
              renderItem={(a) => {
                const detail = (() => {
                  try {
                    const raw = a.details;
                    const d = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});
                    return d?.name || d?.title || d?.username || d?.lrn || '';
                  } catch { return ''; }
                })();
                return (
                  <FeedItem icon={Activity}>
                    <div style={{ fontSize: 13.5 }}><strong>{a.username || 'system'}</strong> {actionLabel(a.action, t)}{detail ? ` — ${detail}` : ''}</div>
                    <div className="sub" style={{ fontSize: 12, marginTop: 2 }}>{fmtWhen(a.created_at)}</div>
                  </FeedItem>
                );
              }}
              emptyState={<Empty text={t('dashboard.noActivity')} />}
            />
            <Link to="/audit" className="btn btn-sm" style={{ marginTop: 14 }}>{t('dashboard.auditLogs')}</Link>
          </SectionCard>

          <SectionCard title={t('dashboard.quickActions')} icon={Activity}>
            <QuickActions items={quick} />
            <div className="sub" style={{ marginTop: 16 }}>
              {t('dashboard.auditLast7', { n: r.audit?.last7 ?? 0 })}
            </div>
          </SectionCard>
        </div>
      )}
    </>
  );
}
