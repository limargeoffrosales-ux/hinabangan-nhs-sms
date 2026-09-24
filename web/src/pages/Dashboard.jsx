import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users, UserCog, Layers, CalendarCheck, Megaphone, Activity,
  BookOpenCheck, ShieldAlert, GraduationCap, Target, Briefcase,
  BadgeCheck, UserCheck, History, ArrowRight,
} from 'lucide-react';
import { api } from '../lib/api';
import { subscribeLive } from '../lib/realtime';
import { PageHead, Spinner, Empty, Badge, KPICard, SectionCard, StatChip, FunnelBar, FeedItem, QuickActions, EmptyState, Skeleton, SkeletonCards } from '../components/ui';
import DashboardSections from '../components/DashboardSections';
import { LiveActivityFeed, LiveStatusPill, ChartTooltip, ModernBarChart, Sparkline } from '../design-system';
import { loadRecharts } from '../lib/lazy-recharts';

const READINESS_STATUS = {
  done: { badge: 'badge-green', tri: 'dashboard.readinessDone' },
  started: { badge: 'badge-blue', tri: 'dashboard.readinessStarted' },
  pending: { badge: 'badge-yellow', tri: 'dashboard.readinessPending' },
  note: { badge: 'badge-gray', tri: 'dashboard.readinessNote' },
};

const SEX_COLORS = { Male: '#4D96FF', Female: '#F5B942' };

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
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [activity, setActivity] = useState(null);
  const [lastLive, setLastLive] = useState(null);
  const [error, setError] = useState(null);
  const [R, setR] = useState(null);

  useEffect(() => { loadRecharts().then(setR); }, []);

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
        title={t('dashboard.title')}
        sub={`${t('dashboard.schoolYearSnapshot')} ${data.school_year || '—'} · ${data.date}`}
      />

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
          {gradeData.length > 0 ? (R ? (
            <ModernBarChart
              R={R}
              data={gradeData}
              categoryKey="grade"
              series={[
                { key: 'Male', color: SEX_COLORS.Male },
                { key: 'Female', color: SEX_COLORS.Female },
              ]}
              height={190}
              showLabels={false}
              barCategoryGap="24%"
            />
          ) : R === null ? (
            <div className="empty-state" style={{ height: 190 }}>
              <div className="empty-state-text">{t('dashboard.chartUnavailable', 'Chart could not be loaded.')}</div>
            </div>
          ) : <div style={{ height: 190 }}><Spinner /></div>) : (
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
    </>
  );
}
