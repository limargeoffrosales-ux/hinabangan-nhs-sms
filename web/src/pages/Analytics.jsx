import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import { BarChart3, TrendingUp, Users, GraduationCap, AlertTriangle, Download, Brain, Shield, Zap, Target } from 'lucide-react';
import { api, getApiBase } from '../lib/api';
import { PageHead, Spinner, Empty, Badge } from '../components/ui';

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
  const [strandComp, setStrandComp] = useState(null);
  const [compMastery, setCompMastery] = useState(null);
  const [studentRisk, setStudentRisk] = useState(null);
  const [aiInsights, setAiInsights] = useState(null);
  const [riskThreshold, setRiskThreshold] = useState(0);
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
        const [g, a, r, p, sc, cm, ri, ai] = await Promise.all([
          api(`/analytics/kpi/grade-distribution?${qs}`),
          api(`/analytics/kpi/attendance-kpi?${qs}`),
          api(`/analytics/kpi/enrollment-retention?school_year=${sy}`),
          api(`/analytics/kpi/pass-rate?${qs}`),
          api(`/department/strand-comparison?school_year=${sy}` + (quarter ? `&quarter=${quarter}` : '')).catch(() => ({ data: [] })),
          api(`/analytics/kpi/competency-mastery?school_year=${sy}` + (quarter ? `&quarter=${quarter}` : '')).catch(() => null),
          api(`/analytics/kpi/student-risk?school_year=${sy}`).catch(() => null),
          api(`/analytics/kpi/ai-insights?school_year=${sy}`).catch(() => null),
        ]);
        setGrades(g);
        setAttendance(a);
        setRetention(r);
        setPassRate(p);
        setStrandComp(sc);
        setCompMastery(cm);
        setStudentRisk(ri);
        setAiInsights(ai);
      } catch (e) { setError(e.message); }
      setLoading(false);
    })();
  }, [sy, quarter]);

  const handleExportCsv = async () => {
    const params = new URLSearchParams({ school_year: sy });
    if (quarter) params.set('quarter', quarter);
    const token = sessionStorage.getItem('meridianed_token');
    const url = `/analytics/kpi/report/csv?${params.toString()}`;
    try {
      const res = await fetch(`${getApiBase()}${url}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `meridianed-report-${sy}${quarter ? `-Q${quarter}` : ''}.csv`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error('CSV export failed:', e);
    }
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

  const riskData = studentRisk?.data || [];
  const filteredRisk = riskThreshold ? riskData.filter((r) => r.risk_score >= riskThreshold) : riskData;
  const riskSummary = studentRisk?.summary || {};

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
              ['strand', t('analytics.tabStrand')],
              ['advanced', t('analytics.tabAdvanced')],
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

          {/* ── Strand Comparison Tab ─────────────────── */}
          {tab === 'strand' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="card">
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.strandComparison')}</h3>
                {strandComp?.data?.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={strandComp.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="strand" tick={{ fontSize: 10, fill: 'var(--text-dim)' }} angle={-15} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-dim)' }} />
                      <Tooltip contentStyle={{ background: 'var(--card-solid)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                      <Legend />
                      <Bar dataKey="mean_grade" name={t('analytics.meanGrade')} fill="var(--accent)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pass_rate" name={t('analytics.passRate')} fill="var(--accent-2)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty text={t('analytics.noData')} />}
              </div>
              <div className="card">
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.strandBreakdown')}</h3>
                {strandComp?.data?.length ? (
                  <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                    <table className="table">
                      <thead><tr>
                        <th>{t('analytics.strand')}</th>
                        <th>{t('analytics.totalGrades')}</th>
                        <th>{t('analytics.meanGrade')}</th>
                        <th>{t('analytics.passing')}</th>
                        <th>{t('analytics.failing')}</th>
                        <th>{t('analytics.passRate')}</th>
                      </tr></thead>
                      <tbody>
                        {strandComp.data.map((s, i) => (
                          <tr key={i}>
                            <td style={{ fontSize: 13 }}>{s.strand}</td>
                            <td style={{ fontSize: 13 }}>{s.total_grades}</td>
                            <td style={{ fontSize: 13 }}><strong>{s.mean_grade}</strong></td>
                            <td style={{ fontSize: 13 }}>{s.passing}</td>
                            <td style={{ fontSize: 13 }}>{s.failing}</td>
                            <td style={{ fontSize: 13 }}><Badge status={s.pass_rate >= 75 ? 'ENROLLED' : 'FAILED'} /> {s.pass_rate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <Empty text={t('analytics.noData')} />}

                {strandComp?.data?.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.strandPie')}</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={strandComp.data.map((s) => ({ name: s.strand, value: Number(s.total_grades) }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                          {strandComp.data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Advanced Analytics Tab ────────────────── */}
          {tab === 'advanced' && (
            <div>
              {/* KPI Cards */}
              <div className="kpi-grid" style={{ marginBottom: 24 }}>
                <KPICard label={t('analytics.overallAvg')} value={compMastery?.overall?.overall_avg ?? '—'} icon={Target} color="var(--accent)" sub={`${compMastery?.overall?.total_competencies ?? 0} competencies`} />
                <KPICard label={t('analytics.masteryRate')} value={compMastery?.overall?.mastered != null && (compMastery.overall.mastered + compMastery.overall.developing + compMastery.overall.beginning) > 0 ? `${Math.round(compMastery.overall.mastered / (compMastery.overall.mastered + compMastery.overall.developing + compMastery.overall.beginning) * 100)}%` : '—'} icon={GraduationCap} color="var(--accent-2)" sub={`${compMastery?.overall?.mastered ?? 0} mastered`} />
                <KPICard label={t('analytics.riskStudents')} value={riskSummary.high ?? '—'} icon={AlertTriangle} color="var(--danger)" sub={`${riskSummary.medium ?? 0} medium · ${riskSummary.low ?? 0} low`} />
                <KPICard label={t('analytics.aiInsights')} value={aiInsights?.insights?.filter((i) => i.ai_ready).length ?? 0} icon={Brain} color="#A78BFA" sub={`${aiInsights?.insights?.filter((i) => !i.ai_ready).length ?? 0} coming soon`} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                {/* Competency Mastery Heatmap */}
                <div className="card">
                  <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.competencyMastery')}</h3>
                  {compMastery?.by_competency?.length ? (
                    <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                      <table className="table">
                        <thead><tr>
                          <th>{t('analytics.code')}</th>
                          <th>{t('analytics.title')}</th>
                          <th>{t('analytics.avgScore')}</th>
                          <th>{t('analytics.masteryRate')}</th>
                          <th>{t('analytics.levelDistribution')}</th>
                        </tr></thead>
                        <tbody>
                          {compMastery.by_competency.map((c) => (
                            <tr key={c.competency_id}>
                              <td style={{ fontSize: 12, fontWeight: 600 }}>{c.code}</td>
                              <td style={{ fontSize: 12 }}>{c.title}</td>
                              <td style={{ fontSize: 12, fontWeight: 700, color: c.avg_score >= 85 ? 'var(--accent-2)' : c.avg_score >= 75 ? 'var(--warn)' : 'var(--danger)' }}>{c.avg_score}</td>
                              <td style={{ fontSize: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <div style={{ width: 60, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ width: `${c.mastery_rate || 0}%`, height: '100%', background: (c.mastery_rate || 0) >= 70 ? 'var(--accent-2)' : (c.mastery_rate || 0) >= 40 ? 'var(--warn)' : 'var(--danger)', borderRadius: 3 }} />
                                  </div>
                                  <span style={{ fontSize: 11 }}>{c.mastery_rate ?? 0}%</span>
                                </div>
                              </td>
                              <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                                <span style={{ color: 'var(--accent)' }}>{c.advanced}A</span> ·{' '}
                                <span style={{ color: 'var(--accent-2)' }}>{c.proficient}P</span> ·{' '}
                                <span style={{ color: 'var(--warn)' }}>{c.approaching}AP</span> ·{' '}
                                <span style={{ color: '#F97316' }}>{c.developing}D</span> ·{' '}
                                <span style={{ color: 'var(--danger)' }}>{c.beginning}B</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <Empty text={t('analytics.noCompetencyData')} />}
                </div>

                {/* Subject Mastery Overview */}
                <div className="card">
                  <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.subjectMastery')}</h3>
                  {compMastery?.by_subject?.length ? (
                    <ResponsiveContainer width="100%" height={360}>
                      <BarChart data={compMastery.by_subject} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} domain={[0, 100]} />
                        <YAxis type="category" dataKey="subject_code" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} width={60} />
                        <Tooltip contentStyle={{ background: 'var(--card-solid)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                        <Legend />
                        <Bar dataKey="avg_score" name={t('analytics.avgScore')} fill="var(--accent)" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="mastery_rate" name={t('analytics.masteryRate')} fill="var(--accent-2)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <Empty text={t('analytics.noCompetencyData')} />}

                  {/* Weakest competencies */}
                  {compMastery?.weakest?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <h4 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--danger)' }}>{t('analytics.weakestCompetencies')}</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {compMastery.weakest.map((c, i) => (
                          <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>
                            {c.code}: {c.avg_score}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Student Risk Dashboard */}
              <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 15 }}>{t('analytics.studentRiskDashboard')}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('analytics.filterThreshold')}:</span>
                    <select className="input" value={riskThreshold} onChange={(e) => setRiskThreshold(Number(e.target.value))} style={{ width: 140 }} aria-label="Risk threshold">
                      <option value={0}>{t('analytics.allStudents')}</option>
                      <option value={30}>{t('analytics.mediumAndHigh')}</option>
                      <option value={60}>{t('analytics.highOnly')}</option>
                    </select>
                  </div>
                </div>

                {/* Risk summary badges */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 13, padding: '4px 10px', borderRadius: 8, background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>
                    <AlertTriangle size={13} /> {riskSummary.high ?? 0} {t('analytics.highRisk')}
                  </span>
                  <span style={{ fontSize: 13, padding: '4px 10px', borderRadius: 8, background: 'rgba(245,185,66,0.12)', color: 'var(--warn)' }}>
                    <Zap size={13} /> {riskSummary.medium ?? 0} {t('analytics.mediumRisk')}
                  </span>
                  <span style={{ fontSize: 13, padding: '4px 10px', borderRadius: 8, background: 'rgba(47,214,160,0.12)', color: 'var(--accent-2)' }}>
                    <Shield size={13} /> {riskSummary.low ?? 0} {t('analytics.lowRisk')}
                  </span>
                </div>

                {filteredRisk.length ? (
                  <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                    <table className="table">
                      <thead><tr>
                        <th>{t('analytics.student')}</th>
                        <th>{t('analytics.section')}</th>
                        <th>{t('analytics.riskScore')}</th>
                        <th>{t('analytics.riskLevel')}</th>
                        <th>{t('analytics.contributingFactors')}</th>
                      </tr></thead>
                      <tbody>
                        {filteredRisk.slice(0, 50).map((r) => (
                          <tr key={r.student_id}>
                            <td style={{ fontSize: 13 }}>
                              <div style={{ fontWeight: 600 }}>{r.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{r.lrn}</div>
                            </td>
                            <td style={{ fontSize: 13 }}>{r.section_name}</td>
                            <td style={{ fontSize: 13 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 80, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                                  <div style={{ width: `${r.risk_score}%`, height: '100%', background: r.risk_level === 'high' ? 'var(--danger)' : r.risk_level === 'medium' ? 'var(--warn)' : 'var(--accent-2)', borderRadius: 4 }} />
                                </div>
                                <span style={{ fontWeight: 700, color: r.risk_level === 'high' ? 'var(--danger)' : r.risk_level === 'medium' ? 'var(--warn)' : 'var(--accent-2)' }}>{r.risk_score}</span>
                              </div>
                            </td>
                            <td><Badge status={r.risk_level === 'high' ? 'FAILED' : r.risk_level === 'medium' ? 'PENDING' : 'ENROLLED'} /></td>
                            <td style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                              {r.factors?.length ? r.factors.map((f) => f.factor).join(', ') : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <Empty text={t('analytics.noRiskData')} />}
              </div>

              {/* AI Insights Section */}
              <div className="card">
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}><Brain size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />{t('analytics.aiInsightsTitle')}</h3>
                {aiInsights?.insights?.length ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {aiInsights.insights.map((ins) => (
                      <div key={ins.id} style={{ padding: 14, borderRadius: 10, border: '1px solid var(--border)', background: ins.ai_ready ? 'rgba(47,214,160,0.04)' : 'rgba(167,139,250,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{ins.title}</span>
                          {ins.ai_ready ? (
                            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: 'rgba(47,214,160,0.15)', color: 'var(--accent-2)' }}>LIVE</span>
                          ) : (
                            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: 'rgba(167,139,250,0.15)', color: '#A78BFA' }}>SOON</span>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>{ins.text}</p>
                      </div>
                    ))}
                  </div>
                ) : <Empty text={t('analytics.noInsights')} />}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
