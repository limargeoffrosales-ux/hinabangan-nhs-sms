import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import { BarChart3, TrendingUp, Users, GraduationCap, AlertTriangle, Download } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Spinner, Empty, Badge, Modal } from '../components/ui';

const PIE_COLORS = ['#4D96FF', '#2FD6A0', '#2DD4BF', '#F5B942', '#FB7185', '#A78BFA'];

function KPICard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="kpi-card" style={{ borderTopColor: color }}>
      <div className="kpi-icon" style={{ color }}><Icon size={22} /></div>
      <div className="kpi-value" style={{ color }}>{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export default function Analytics() {
  const { t } = useTranslation();
  const [schoolYears, setSchoolYears] = useState([]);
  const [sy, setSy] = useState('');
  const [quarter, setQuarter] = useState('');
  const [grades, setGrades] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [retention, setRetention] = useState(null);
  const [passRate, setPassRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    (async () => {
      try {
        const res = await api('/analytics/kpi/school-years');
        const years = res.data || [];
        setSchoolYears(years);
        if (years.length) setSy(years[0]);
      } catch (e) { setError(e.message); }
    })();
  }, []);

  useEffect(() => {
    if (!sy) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const params = new URLSearchParams({ school_year: sy });
        if (quarter) params.set('quarter', quarter);
        const qs = params.toString();
        const [g, a, r, p] = await Promise.all([
          api(`/analytics/kpi/grade-distribution?${qs}`),
          api(`/analytics/kpi/attendance-kpi?${qs}`),
          api(`/analytics/kpi/enrollment-retention?school_year=${sy}`),
          api(`/analytics/kpi/pass-rate?${qs}`),
        ]);
        setGrades(g);
        setAttendance(a);
        setRetention(r);
        setPassRate(p);
      } catch (e) { setError(e.message); }
      setLoading(false);
    })();
  }, [sy, quarter]);

  const handleExportCsv = async () => {
    const params = new URLSearchParams({ school_year: sy });
    if (quarter) params.set('quarter', quarter);
    window.open(`/api/v1/analytics/kpi/report/csv?${params.toString()}&token=${localStorage.getItem('meridianed_token') || ''}`, '_blank');
  };

  if (error && !grades) return <PageHead title={t('analytics.title')}><div className="err-banner">{error}</div></PageHead>;

  const gradeBuckets = grades?.buckets || [];
  const gradeSummary = grades?.summary || {};
  const attMonthly = attendance?.monthly || [];
  const attByGrade = attendance?.by_grade || [];
  const attOverall = attendance?.overall || {};
  const retByGrade = retention?.by_grade || [];
  const retYoy = retention?.year_over_year || [];
  const passByGrade = passRate?.by_grade || [];
  const passBySection = passRate?.by_section || [];
  const atRisk = passRate?.at_risk || [];

  const gradePieData = gradeBuckets.map((b) => ({ name: b.band, value: Number(b.n) }));
  const passPieData = passRate ? [
    { name: t('analytics.passing'), value: passRate.passing },
    { name: t('analytics.failing'), value: passRate.failing },
  ] : [];

  return (
    <div>
      <PageHead title={t('analytics.title')} sub={t('analytics.subtitle')}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <select className="input" value={sy} onChange={(e) => setSy(e.target.value)} aria-label={t('analytics.schoolYear')}>
            {schoolYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="input" value={quarter} onChange={(e) => setQuarter(e.target.value)} aria-label={t('analytics.quarter')}>
            <option value="">{t('analytics.allQuarters')}</option>
            <option value="1">Q1</option><option value="2">Q2</option>
            <option value="3">Q3</option><option value="4">Q4</option>
          </select>
          <button className="btn btn-primary" onClick={handleExportCsv} aria-label={t('analytics.exportCsv')}>
            <Download size={14} /> {t('analytics.exportCsv')}
          </button>
        </div>
      </PageHead>

      {loading ? <Spinner /> : (
        <>
          {/* ── Tab Navigation ─────────────────────────── */}
          <div className="tab-bar" role="tablist">
            {[
              ['overview', t('analytics.tabOverview')],
              ['grades', t('analytics.tabGrades')],
              ['attendance', t('analytics.tabAttendance')],
              ['retention', t('analytics.tabRetention')],
              ['atRisk', t('analytics.tabAtRisk')],
            ].map(([id, label]) => (
              <button key={id} className={`tab ${tab === id ? 'active' : ''}`}
                onClick={() => setTab(id)} role="tab" aria-selected={tab === id}>{label}</button>
            ))}
          </div>

          {/* ── Overview ─────────────────────────────── */}
          {tab === 'overview' && (
            <div className="kpi-grid" style={{ marginBottom: 24 }}>
              <KPICard label={t('analytics.meanGwa')} value={gradeSummary.mean ?? '—'} icon={BarChart3} color="var(--accent)" />
              <KPICard label={t('analytics.passRate')} value={passRate ? `${passRate.pass_rate}%` : '—'} icon={GraduationCap} color="var(--accent-2)" />
              <KPICard label={t('analytics.attendanceRate')} value={attOverall.overall_rate != null ? `${attOverall.overall_rate}%` : '—'} icon={TrendingUp} color="var(--accent-3)" />
              <KPICard label={t('analytics.retention')} value={retention ? `${retention.retention_rate}%` : '—'} icon={Users} color="var(--warn)" />
              <KPICard label={t('analytics.totalGrades')} value={gradeSummary.total ?? '—'} icon={BarChart3} color="var(--info)" />
              <KPICard label={t('analytics.atRiskStudents')} value={passRate?.failing ?? '—'} icon={AlertTriangle} color="var(--danger)" sub={t('analytics.needsIntervention')} />
            </div>
          )}

          {/* ── Grade Distribution Tab ────────────────── */}
          {tab === 'grades' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="card">
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.gradeDistribution')}</h3>
                {gradePieData.length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={gradePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>
                        {gradePieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <Empty text={t('analytics.noData')} />}
              </div>
              <div className="card">
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.gradeBands')}</h3>
                {gradeBuckets.length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={gradeBuckets}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="band" tick={{ fontSize: 12, fill: 'var(--text-dim)' }} />
                      <YAxis tick={{ fontSize: 12, fill: 'var(--text-dim)' }} />
                      <Tooltip contentStyle={{ background: 'var(--card-solid)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                      <Bar dataKey="n" name={t('analytics.students')} radius={[4, 4, 0, 0]}>
                        {gradeBuckets.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty text={t('analytics.noData')} />}

                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--accent-2)' }}>{gradeSummary.passing}</div><div className="kpi-mini-label">{t('analytics.passing')}</div></div>
                  <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--danger)' }}>{gradeSummary.failing}</div><div className="kpi-mini-label">{t('analytics.failing')}</div></div>
                </div>
              </div>
            </div>
          )}

          {/* ── Attendance Tab ───────────────────────── */}
          {tab === 'attendance' && (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
              <div className="card">
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.dailyTrend')}</h3>
                {attMonthly.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={attMonthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-dim)' }} domain={[0, 100]} />
                      <Tooltip contentStyle={{ background: 'var(--card-solid)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                      <Legend />
                      <Line type="monotone" dataKey="rate" name={t('analytics.rate')} stroke="var(--accent)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <Empty text={t('analytics.noData')} />}
              </div>
              <div className="card">
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.byGradeLevel')}</h3>
                {attByGrade.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={attByGrade} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} domain={[0, 100]} />
                      <YAxis type="category" dataKey="grade_level" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} width={70} />
                      <Tooltip contentStyle={{ background: 'var(--card-solid)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                      <Bar dataKey="rate" name={t('analytics.rate')} fill="var(--accent-3)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty text={t('analytics.noData')} />}

                <div className="kpi-mini" style={{ marginTop: 12 }}>
                  <div className="kpi-mini-value" style={{ color: 'var(--accent-3)' }}>{t('analytics.totalRecords')}: {attOverall.total_records}</div>
                </div>
              </div>
            </div>
          )}

          {/* ── Retention Tab ────────────────────────── */}
          {tab === 'retention' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="card">
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.enrollmentByGrade')}</h3>
                {retByGrade.length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={retByGrade}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="grade_level" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-dim)' }} />
                      <Tooltip contentStyle={{ background: 'var(--card-solid)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                      <Legend />
                      <Bar dataKey="enrolled" name={t('analytics.enrolled')} fill="var(--accent-2)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="total" name={t('analytics.total')} fill="var(--accent)" radius={[4, 4, 0, 0]} opacity={0.5} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty text={t('analytics.noData')} />}
              </div>
              <div className="card">
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.yearOverYear')}</h3>
                {retYoy.length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={retYoy}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="school_year" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-dim)' }} domain={[0, 100]} />
                      <Tooltip contentStyle={{ background: 'var(--card-solid)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                      <Bar dataKey="retention_rate" name={t('analytics.retention')} fill="var(--warn)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty text={t('analytics.noData')} />}

                <div className="kpi-mini" style={{ marginTop: 12 }}>
                  <div className="kpi-mini-value" style={{ color: 'var(--warn)' }}>
                    {retention?.withdrawn?.map((w) => `${w.status}: ${w.n}`).join(' · ') || '—'}
                  </div>
                  <div className="kpi-mini-label">{t('analytics.withdrawn')}</div>
                </div>
              </div>
            </div>
          )}

          {/* ── At-Risk / Pass Rate Tab ──────────────── */}
          {tab === 'atRisk' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="card">
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.passFailSplit')}</h3>
                {passPieData.length && passPieData.some((d) => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={passPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                        <Cell fill="var(--accent-2)" /><Cell fill="var(--danger)" />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <Empty text={t('analytics.noData')} />}

                <h3 style={{ margin: '16px 0 8px', fontSize: 14 }}>{t('analytics.byGradeLevel')}</h3>
                {passByGrade.length ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={passByGrade}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="grade_level" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-dim)' }} />
                      <Tooltip contentStyle={{ background: 'var(--card-solid)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                      <Legend />
                      <Bar dataKey="passing" name={t('analytics.passing')} fill="var(--accent-2)" stackId="a" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="failing" name={t('analytics.failing')} fill="var(--danger)" stackId="a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty text={t('analytics.noData')} />}
              </div>
              <div className="card">
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.atRiskStudents')}</h3>
                {atRisk.length ? (
                  <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                    <table className="table">
                      <thead><tr>
                        <th>{t('analytics.student')}</th>
                        <th>{t('analytics.grade')}</th>
                        <th>{t('analytics.gwa')}</th>
                      </tr></thead>
                      <tbody>
                        {atRisk.map((s) => (
                          <tr key={s.student_id}>
                            <td style={{ fontSize: 13 }}>{s.name}</td>
                            <td style={{ fontSize: 13 }}>{s.grade_level}</td>
                            <td><Badge status="FAILED" /> <span style={{ fontSize: 13, fontWeight: 700 }}>{s.gwa}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <Empty text={t('analytics.noAtRisk')} />}

                {passBySection.length > 0 && (
                  <>
                    <h3 style={{ margin: '16px 0 8px', fontSize: 14 }}>{t('analytics.bySection')}</h3>
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                      <table className="table">
                        <thead><tr>
                          <th>{t('analytics.section')}</th>
                          <th>{t('analytics.total')}</th>
                          <th>{t('analytics.avgGrade')}</th>
                        </tr></thead>
                        <tbody>
                          {passBySection.map((s, i) => (
                            <tr key={i}>
                              <td style={{ fontSize: 13 }}>{s.section_name}</td>
                              <td style={{ fontSize: 13 }}>{s.total}</td>
                              <td style={{ fontSize: 13 }}>{s.avg_grade}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
