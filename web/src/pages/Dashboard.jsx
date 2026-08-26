import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, UserCog, Layers, CalendarCheck, Megaphone, Activity, Wand2, ShieldAlert } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Spinner, Empty, Badge } from '../components/ui';
import DashboardSections from '../components/DashboardSections';
import { loadRecharts } from '../lib/lazy-recharts';

const PIE_COLORS = ['#4D96FF', '#2FD6A0', '#2DD4BF', '#F5B942'];

const CONDUCT_STATUS_BADGE = { open: 'badge-yellow', under_review: 'badge-blue', resolved: 'badge-green' };
const CONDUCT_SEVERITY_BADGE = { minor: 'badge-blue', moderate: 'badge-yellow', major: 'badge-red' };

export default function Dashboard() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [trend, setTrend] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [error, setError] = useState(null);
  const [conduct, setConduct] = useState(null);
  const [R, setR] = useState(null);

  useEffect(() => { loadRecharts().then(setR); }, []);

  const CONDUCT_TYPE_LABEL = {
    call_slip: t('conduct.callSlip'), bullying: t('conduct.bullying'), inappropriate_behavior: t('conduct.inappropriateBehavior'),
    fighting: t('conduct.fighting'), vandalism: t('conduct.vandalism'), tardiness: t('conduct.tardiness'), disrespect: t('conduct.disrespect'), other: t('conduct.other'),
  };

  useEffect(() => {
    (async () => {
      try {
        const [s, trendRes, a, c] = await Promise.allSettled([
          api('/dashboard/summary'),
          api('/dashboard/attendance-trend?days=7'),
          api('/announcements?limit=5'),
          api('/conduct/summary'),
        ]);
        if (s.status === 'fulfilled') setData(s.value);
        if (trendRes.status === 'fulfilled') setTrend(trendRes.value.data);
        if (a.status === 'fulfilled') setAnnouncements(a.value.data);
        if (c.status === 'fulfilled') setConduct(c.value);
        if (s.status !== 'fulfilled') setError(s.reason?.message || 'Failed to load dashboard');
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  if (error && !data) return <PageHead title={t('dashboard.title')}><div className="err-banner">{error}</div></PageHead>;
  if (!data) return <Spinner />;

  const kpis = [
    { label: t('dashboard.enrolledStudents'), value: data.students, icon: Users, color: 'var(--accent)' },
    { label: t('dashboard.activeTeachers'), value: data.teachers, icon: UserCog, color: 'var(--accent-2)' },
    { label: t('dashboard.sections'), value: data.sections, icon: Layers, color: 'var(--accent-3)' },
    { label: t('dashboard.attendanceToday'), value: `${data.attendance_rate}%`, icon: CalendarCheck, color: 'var(--success)' },
  ];

  const gradeData = Object.entries(data.by_grade_level || {}).map(([g, v]) => ({
    grade: g, Male: v.male, Female: v.female,
  }));
  const sexData = [
    { name: 'Male', value: data.by_sex?.male || 0 },
    { name: 'Female', value: data.by_sex?.female || 0 },
  ];
  const trendData = {};
  for (const r of trend) {
    trendData[r.date] = trendData[r.date] || { date: r.date, present: 0, absent: 0, late: 0 };
    trendData[r.date][r.status] = (trendData[r.date][r.status] || 0) + r.n;
  }
  const trendChart = Object.values(trendData).sort((a, b) => a.date.localeCompare(b.date));

  const quick = [
    { to: '/interventions', label: t('dashboard.reviewRisk', 'Review at-risk learners'), icon: ShieldAlert },
    { to: '/assessment', label: t('dashboard.buildExam', 'Build exam / TOS'), icon: Wand2 },
    { to: '/enroll', label: t('dashboard.enrollStudent', 'Enroll a student'), icon: Users },
    { to: '/grades', label: t('dashboard.enterGrades', 'Enter class grades'), icon: Activity },
    { to: '/attendance', label: t('dashboard.recordAttendance', 'Record attendance'), icon: CalendarCheck },
  ];

  return (
    <>
      <PageHead title={t('dashboard.title')} sub={`${t('dashboard.schoolYearSnapshot')} ${data.date}`} />
      <div className="grid grid-4">
        {kpis.map((k) => (
          <div className="card kpi" key={k.label}>
            <div className="icon" style={{ background: `${k.color}22`, color: k.color }}><k.icon size={20} /></div>
            <div className="value">{k.value}</div>
            <div className="label">{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ height: 18 }} />

      <DashboardSections />

      <div style={{ height: 18 }} />
      <div className="grid grid-3">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t('dashboard.studentsByGrade')}</h3>
          {R ? (
            <R.ResponsiveContainer width="100%" height={230}>
              <R.BarChart data={gradeData}>
                <R.CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
                <R.XAxis dataKey="grade" tick={{ fill: 'var(--text-dim)', fontSize: 12 }} />
                <R.YAxis tick={{ fill: 'var(--text-dim)', fontSize: 12 }} />
                <R.Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }} />
                <R.Bar dataKey="Male" fill="#4D96FF" radius={[4, 4, 0, 0]} />
                <R.Bar dataKey="Female" fill="#2FD6A0" radius={[4, 4, 0, 0]} />
              </R.BarChart>
            </R.ResponsiveContainer>
          ) : <div style={{ height: 230 }}><Spinner /></div>}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t('dashboard.attendanceTrend')}</h3>
          {R ? (
            <R.ResponsiveContainer width="100%" height={230}>
              <R.LineChart data={trendChart}>
                <R.CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
                <R.XAxis dataKey="date" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                <R.YAxis tick={{ fill: 'var(--text-dim)', fontSize: 12 }} />
                <R.Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }} />
                <R.Line type="monotone" dataKey="present" stroke="#34C77B" strokeWidth={2} dot={false} />
                <R.Line type="monotone" dataKey="late" stroke="#F5B942" strokeWidth={2} dot={false} />
                <R.Line type="monotone" dataKey="absent" stroke="#F2555A" strokeWidth={2} dot={false} />
              </R.LineChart>
            </R.ResponsiveContainer>
          ) : <div style={{ height: 230 }}><Spinner /></div>}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t('dashboard.genderDistribution')}</h3>
          {R ? (
            <R.ResponsiveContainer width="100%" height={230}>
              <R.PieChart>
                <R.Pie data={sexData} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {sexData.map((_, i) => <R.Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </R.Pie>
                <R.Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }} />
              </R.PieChart>
            </R.ResponsiveContainer>
          ) : <div style={{ height: 230 }}><Spinner /></div>}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 13 }}>
            {sexData.map((s, i) => (
              <span key={s.name} style={{ color: 'var(--text-dim)' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: PIE_COLORS[i], marginRight: 6 }} />
                {s.name}: <strong style={{ color: 'var(--text)' }}>{s.value}</strong>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ height: 18 }} />

      <div className="card">
        <div className="dashboard-block-head">
          <h3 style={{ margin: 0 }}><ShieldAlert size={16} /> {t('dashboard.conductMonitoring')}</h3>
          <Link to="/discipline" className="btn btn-sm">{t('dashboard.manageRecords')}</Link>
        </div>
        {!conduct ? <Spinner /> : (
          <>
            <div className="kpi-row">
              <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--warn)' }}>{conduct.by_status?.open ?? 0}</div><div className="kpi-mini-label">{t('dashboard.openCases')}</div></div>
              <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--accent)' }}>{conduct.by_status?.under_review ?? 0}</div><div className="kpi-mini-label">{t('dashboard.underReview')}</div></div>
              <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--accent-2)' }}>{conduct.by_status?.resolved ?? 0}</div><div className="kpi-mini-label">{t('dashboard.resolved')}</div></div>
              <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--purple)' }}>{conduct.cases_this_month ?? 0}</div><div className="kpi-mini-label">{t('dashboard.thisMonth')}</div></div>
              <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--danger)' }}>{conduct.by_severity?.major ?? 0}</div><div className="kpi-mini-label">{t('dashboard.majorIncidents')}</div></div>
            </div>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>{t('dashboard.student')}</th><th>{t('dashboard.incident')}</th><th style={{ textAlign: 'center' }}>{t('dashboard.severity')}</th>
                    <th style={{ textAlign: 'center' }}>{t('common.date')}</th><th style={{ textAlign: 'center' }}>{t('common.status')}</th>
                    <th style={{ textAlign: 'center' }}>{t('dashboard.openFor')}</th>
                  </tr>
                </thead>
                <tbody>
                  {conduct.recent?.length === 0 ? (
                    <tr><td colSpan={6} className="sub">{t('dashboard.noConductRecords')}</td></tr>
                  ) : conduct.recent?.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.student_name}</div>
                        <div className="sub" style={{ fontSize: 12 }}>{r.grade_level || ''} {r.section_name ? `· ${r.section_name}` : ''}</div>
                      </td>
                      <td>{CONDUCT_TYPE_LABEL[r.incident_type] || r.incident_type}</td>
                      <td style={{ textAlign: 'center' }}><span className={`badge ${CONDUCT_SEVERITY_BADGE[r.severity] || 'badge-gray'}`}>{r.severity}</span></td>
                      <td style={{ textAlign: 'center' }} className="sub">{r.incident_date?.slice(0, 10)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${CONDUCT_STATUS_BADGE[r.status] || 'badge-gray'}`}>{r.status.replace('_', ' ')}</span>
                      </td>
                      <td style={{ textAlign: 'center' }} className="sub">{r.status === 'resolved' ? '—' : `${r.days_open}d`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div style={{ height: 18 }} />

      <div className="grid grid-3">
        <div className="card">
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Megaphone size={16} /> {t('nav.announcements')}
          </h3>
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

        <div className="card">
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} /> {t('dashboard.quickActions')}
          </h3>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
            {quick.map((q) => (
              <Link className="btn btn-sm quick-link" to={q.to} key={q.to}><q.icon size={13} /> {q.label}</Link>
            ))}
          </div>
          <h3 style={{ marginTop: 22 }}>{t('dashboard.subjectsOffered')}</h3>
          <div style={{ fontSize: 14 }}>{data.subjects} {t('dashboard.activeSubjects')}</div>
        </div>
      </div>
    </>
  );
}
