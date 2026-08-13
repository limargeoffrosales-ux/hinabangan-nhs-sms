import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from 'recharts';
import { Users, UserCog, Layers, BookOpen, CalendarCheck, Megaphone, Activity, Sparkles, AlertTriangle, FileStack, CheckCircle2, Wand2, BadgeCheck, ShieldAlert } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Spinner, Empty, Badge } from '../components/ui';
import DashboardSections from '../components/DashboardSections';

const PIE_COLORS = ['#4D96FF', '#2FD6A0', '#2DD4BF', '#F5B942'];

const RISK_CLASS = { 'High risk': 'badge-red', 'Moderate risk': 'badge-yellow', 'Low risk': 'badge-blue' };

const CONDUCT_TYPE_LABEL = {
  call_slip: 'Call Slip', bullying: 'Bullying', inappropriate_behavior: 'Inappropriate Behavior',
  fighting: 'Fighting', vandalism: 'Vandalism', tardiness: 'Tardiness', disrespect: 'Disrespect', other: 'Other',
};
const CONDUCT_STATUS_BADGE = { open: 'badge-yellow', under_review: 'badge-blue', resolved: 'badge-green' };
const CONDUCT_SEVERITY_BADGE = { minor: 'badge-blue', moderate: 'badge-yellow', major: 'badge-red' };

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [trend, setTrend] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState(null);
  const [conduct, setConduct] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, t, a, i, c] = await Promise.all([
          api('/dashboard/summary'),
          api('/dashboard/attendance-trend?days=7'),
          api('/announcements?limit=5'),
          api('/ai/insights'),
          api('/conduct/summary'),
        ]);
        setData(s);
        setTrend(t.data);
        setAnnouncements(a.data);
        setInsights(i);
        setConduct(c);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  if (error) return <PageHead title="Dashboard"><div className="err-banner">{error}</div></PageHead>;
  if (!data) return <Spinner />;

  const kpis = [
    { label: 'Enrolled Students', value: data.students, icon: Users, color: '#4D96FF' },
    { label: 'Active Teachers', value: data.teachers, icon: UserCog, color: '#2FD6A0' },
    { label: 'Sections', value: data.sections, icon: Layers, color: '#2DD4BF' },
    { label: 'Attendance Today', value: `${data.attendance_rate}%`, icon: CalendarCheck, color: '#34C77B' },
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

  const riskSection = insights?.sections?.find((s) => s.id === 'risk');
  const readingSection = insights?.sections?.find((s) => s.id === 'reading');
  const complianceSection = insights?.sections?.find((s) => s.id === 'compliance');
  const approvalsSection = insights?.sections?.find((s) => s.id === 'approvals');
  const recsSection = insights?.sections?.find((s) => s.id === 'recommendations');

  const quick = [
    { to: '/ai-docs', label: 'Generate a document', icon: Sparkles },
    { to: '/reading-numeracy', label: 'Encoded reading results', icon: BookOpen },
    { to: '/interventions', label: 'Review at-risk learners', icon: AlertTriangle },
    { to: '/assessment', label: 'Build exam / TOS', icon: Wand2 },
    { to: '/enroll', label: 'Enroll a student', icon: Users },
    { to: '/grades', label: 'Enter class grades', icon: Activity },
    { to: '/attendance', label: 'Record attendance', icon: CalendarCheck },
    { to: '/forms', label: 'Print SF forms', icon: FileStack },
  ];

  return (
    <>
      <PageHead title="Dashboard" sub={`School Year snapshot — data as of ${data.date}`} />
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

      <div className="ai-strip">
        <div className="ai-strip-head"><Sparkles size={15} /> AI Insights & Intelligence</div>
        <div className="grid grid-4">
          <div className="card kpi ai-kpi">
            <div className="kpi-num danger">{riskSection?.data?.filter((r) => r.risk === 'High risk').length ?? '—'}</div>
            <div className="kpi-lbl">High-risk learners</div>
          </div>
          <div className="card kpi ai-kpi">
            <div className="kpi-num accent">{readingSection?.data?.find((d) => d.name === 'frustration')?.value ?? 0}</div>
            <div className="kpi-lbl">Reading: Frustration level</div>
          </div>
          <div className="card kpi ai-kpi">
            <div className="kpi-num" style={{ color: complianceSection?.data?.percent >= 80 ? 'var(--success)' : 'var(--warn)' }}>
              {complianceSection?.data?.percent ?? 0}%
            </div>
            <div className="kpi-lbl">Staff compliance meter</div>
          </div>
          <div className="card kpi ai-kpi">
            <div className="kpi-num">
              {(approvalsSection?.data?.pending_reviews?.length ?? 0) + (approvalsSection?.data?.pending_approvals?.length ?? 0)}
            </div>
            <div className="kpi-lbl">Awaiting approval</div>
          </div>
        </div>
      </div>

      <div style={{ height: 18 }} />
      <div className="grid grid-3">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Students by Grade Level</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={gradeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
              <XAxis dataKey="grade" tick={{ fill: 'var(--text-dim)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 12 }} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }} />
              <Bar dataKey="Male" fill="#4D96FF" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Female" fill="#2FD6A0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Attendance Trend (7 days)</h3>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={trendChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 12 }} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }} />
              <Line type="monotone" dataKey="present" stroke="#34C77B" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="late" stroke="#F5B942" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="absent" stroke="#F2555A" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Gender Distribution</h3>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={sexData} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {sexData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }} />
            </PieChart>
          </ResponsiveContainer>
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

      <div className="two-col">
        <div className="card">
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} /> Learner Risk Prediction
          </h3>
          {!insights ? <Spinner /> : !riskSection?.data?.length ? <Empty text="No learners flagged." /> : (
            <div className="risk-list">
              {riskSection.data.map((r) => (
                <div className="risk-row" key={r.student_id}>
                  <div>
                    <Link className="risk-name" to={`/students?q=${encodeURIComponent(r.name.split(' ')[0])}`}>{r.name}</Link>
                    <div className="sub">{r.section || r.grade_level} · avg {r.avg_grade} · attendance {r.attendance_rate}%{r.reading_level ? ` · ${r.reading_level}` : ''}</div>
                  </div>
                  <span className={`badge ${RISK_CLASS[r.risk]}`}>{r.risk}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BadgeCheck size={16} /> Approval Center
          </h3>
          {!insights ? <Spinner /> : !approvalsSection?.data?.pending_reviews?.length && !approvalsSection?.data?.pending_approvals?.length ? (
            <Empty text="Approval queue is clear." />
          ) : (
            <>
              {approvalsSection.data.pending_reviews.map((p) => (
                <div className="risk-row" key={`rv-${p.id}`}>
                  <div><div className="risk-name">{p.report_name}</div><div className="sub">{p.user_name} · {p.period}</div></div>
                  <span className="badge badge-yellow">Review</span>
                </div>
              ))}
              {approvalsSection.data.pending_approvals.map((p) => (
                <div className="risk-row" key={`ap-${p.id}`}>
                  <div><div className="risk-name">{p.report_name}</div><div className="sub">{p.user_name} · {p.period}</div></div>
                  <span className="badge badge-blue">Approve</span>
                </div>
              ))}
              <Link className="btn btn-sm" style={{ marginTop: 10 }} to="/submissions">Open submissions</Link>
            </>
          )}
        </div>
      </div>

      <div style={{ height: 18 }} />

      <div className="card">
        <div className="dashboard-block-head">
          <h3 style={{ margin: 0 }}><ShieldAlert size={16} /> Student Conduct Monitoring</h3>
          <Link to="/discipline" className="btn btn-sm">Manage records</Link>
        </div>
        {!conduct ? <Spinner /> : (
          <>
            <div className="kpi-row">
              <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: '#FBBF24' }}>{conduct.by_status?.open ?? 0}</div><div className="kpi-mini-label">Open cases</div></div>
              <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: '#4D96FF' }}>{conduct.by_status?.under_review ?? 0}</div><div className="kpi-mini-label">Under review</div></div>
              <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: '#2FD6A0' }}>{conduct.by_status?.resolved ?? 0}</div><div className="kpi-mini-label">Resolved</div></div>
              <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: '#A78BFA' }}>{conduct.cases_this_month ?? 0}</div><div className="kpi-mini-label">This month</div></div>
              <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: '#F2555A' }}>{conduct.by_severity?.major ?? 0}</div><div className="kpi-mini-label">Major incidents</div></div>
            </div>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Student</th><th>Incident</th><th style={{ textAlign: 'center' }}>Severity</th>
                    <th style={{ textAlign: 'center' }}>Date</th><th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'center' }}>Open for</th>
                  </tr>
                </thead>
                <tbody>
                  {conduct.recent?.length === 0 ? (
                    <tr><td colSpan={6} className="sub">No conduct records yet — log the first one under Student Conduct.</td></tr>
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
            <Megaphone size={16} /> Announcements
          </h3>
          {announcements.length === 0 ? <Empty text="No announcements yet." /> : (
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
            <Sparkles size={16} /> AI Recommendations
          </h3>
          {!insights ? <Spinner /> : recsSection?.data?.map((r, i) => (
            <div className="rec-item" key={i}><span className="rec-dot">{i + 1}</span>{r}</div>
          ))}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} /> Quick Actions
          </h3>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
            {quick.map((q) => (
              <Link className="btn btn-sm quick-link" to={q.to} key={q.to}><q.icon size={13} /> {q.label}</Link>
            ))}
          </div>
          <h3 style={{ marginTop: 22 }}>Subjects Offered</h3>
          <div style={{ fontSize: 14 }}>{data.subjects} active subjects in the curriculum</div>
        </div>
      </div>
    </>
  );
}