import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, TrendingUp, Users, GraduationCap, AlertTriangle, Download, Brain, Shield, Zap, Target } from 'lucide-react';
import { api, getApiBase, friendlyAbortMessage } from '../lib/api';
import { CHART_PALETTE } from '../lib/constants';
import { PageHead, Spinner, Empty, Badge } from '../components/ui';
import ChartExportButton from '../components/ChartExportButton';
import { DonutChart, ModernBarChart, ModernLineChart, ProgressRing, StatCard } from '../design-system';

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

  const refGradePie = useRef(null);
  const refGradeBars = useRef(null);
  const refAttTrend = useRef(null);
  const refAttGrade = useRef(null);
  const refRetByGrade = useRef(null);
  const refRetYoy = useRef(null);
  const refPassPie = useRef(null);
  const refPassByGrade = useRef(null);
  const refStrandBars = useRef(null);
  const refStrandPie = useRef(null);
  const refSubjectBars = useRef(null);

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
        const results = await Promise.allSettled([
          api(`/analytics/kpi/grade-distribution?${qs}`),
          api(`/analytics/kpi/attendance-kpi?${qs}`),
          api(`/analytics/kpi/enrollment-retention?school_year=${sy}`),
          api(`/analytics/kpi/pass-rate?${qs}`),
          api(`/department/strand-comparison?school_year=${sy}` + (quarter ? `&quarter=${quarter}` : '')),
          api(`/analytics/kpi/competency-mastery?school_year=${sy}` + (quarter ? `&quarter=${quarter}` : '')),
          api(`/analytics/kpi/student-risk?school_year=${sy}`),
          api(`/analytics/kpi/ai-insights?school_year=${sy}`),
        ]);
        const settle = (r, fallback) => r.status === 'fulfilled' ? r.value : fallback;
        setGrades(settle(results[0], null));
        setAttendance(settle(results[1], null));
        setRetention(settle(results[2], null));
        setPassRate(settle(results[3], null));
        setStrandComp(settle(results[4], { data: [] }));
        setCompMastery(settle(results[5], null));
        setStudentRisk(settle(results[6], null));
        setAiInsights(settle(results[7], null));
      } catch (e) { setError(e.message); }
      setLoading(false);
    })();
  }, [sy, quarter]);

  const handleExportCsv = async () => {
    const params = new URLSearchParams({ school_year: sy });
    if (quarter) params.set('quarter', quarter);
    const token = sessionStorage.getItem('meridianed_token');
    const url = `/analytics/kpi/report/csv?${params.toString()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 75000);
    try {
      const res = await fetch(`${getApiBase()}${url}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
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
      console.error('CSV export failed:', friendlyAbortMessage(e) || e);
    } finally {
      clearTimeout(timer);
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
            <option value="3">Q3</option>
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
              <StatCard label={t('analytics.meanGwa')} value={gradeSummary.mean ?? '—'} icon={<BarChart3 size={22} />} iconBg="var(--accent)" />
              <StatCard label={t('analytics.passRate')} value={passRate ? `${passRate.pass_rate}%` : '—'} icon={<GraduationCap size={22} />} iconBg="var(--accent-2)" />
              <StatCard label={t('analytics.attendanceRate')} value={attOverall.overall_rate != null ? `${attOverall.overall_rate}%` : '—'} icon={<TrendingUp size={22} />} iconBg="var(--accent-3)" />
              <StatCard label={t('analytics.retention')} value={retention ? `${retention.retention_rate}%` : '—'} icon={<Users size={22} />} iconBg="var(--warn)" />
              <StatCard label={t('analytics.totalGrades')} value={gradeSummary.total ?? '—'} icon={<BarChart3 size={22} />} iconBg="var(--info)" />
              <StatCard label={t('analytics.atRiskStudents')} value={passRate?.failing ?? '—'} sub={t('analytics.needsIntervention')} icon={<AlertTriangle size={22} />} iconBg="var(--danger)" />
            </div>
          )}

          {/* ── Grade Distribution Tab ────────────────── */}
          {tab === 'grades' && (
            <div className="ds-chart-grid cols-2">
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.gradeDistribution')}</h3>
                  <ChartExportButton targetRef={refGradePie} filename="grade-distribution.png" label={t('analytics.exportChart')} />
                </div>
                <div ref={refGradePie} style={{ minWidth: 0 }}>
                  {gradePieData.length ? (
                    <DonutChart
                      data={gradePieData.map((d, i) => ({ name: d.name, value: d.value, color: CHART_PALETTE[i % CHART_PALETTE.length] }))}
                      centerValue={gradeSummary.total ?? '—'}
                      centerLabel={t('analytics.totalGrades')}
                      size={180}
                    />
                  ) : <Empty text={t('analytics.noData')} />}
                </div>
              </div>
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.gradeBands')}</h3>
                  <ChartExportButton targetRef={refGradeBars} filename="grade-bands.png" label={t('analytics.exportChart')} />
                </div>
                <div ref={refGradeBars} style={{ minWidth: 0 }}>
                  {gradeBuckets.length ? (
                    <ModernBarChart
                      
                      data={gradeBuckets}
                      categoryKey="band"
                      perBarColors={CHART_PALETTE}
                      height={280}
                      showLabels={false}
                    >
                      
                    </ModernBarChart>
                  ) : <Empty text={t('analytics.noData')} />}
                </div>

                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--accent-2)' }}>{gradeSummary.passing}</div><div className="kpi-mini-label">{t('analytics.passing')}</div></div>
                  <div className="kpi-mini"><div className="kpi-mini-value" style={{ color: 'var(--danger)' }}>{gradeSummary.failing}</div><div className="kpi-mini-label">{t('analytics.failing')}</div></div>
                </div>
              </div>
            </div>
          )}

          {/* ── Attendance Tab ───────────────────────── */}
          {tab === 'attendance' && (
            <div className="ds-chart-grid cols-21">
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.dailyTrend')}</h3>
                  <ChartExportButton targetRef={refAttTrend} filename="attendance-trend.png" label={t('analytics.exportChart')} />
                </div>
                <div ref={refAttTrend} style={{ minWidth: 0 }}>
                  {attMonthly.length ? (
                    <ModernLineChart
                      
                      data={attMonthly}
                      legend
                      categoryKey="month"
                      series={[{ key: 'rate', name: t('analytics.rate'), color: 'var(--accent)' }]}
                      area
                      yDomain={[0, 100]}
                      height={300}
                    >
                      
                      
                    </ModernLineChart>
                  ) : <Empty text={t('analytics.noData')} />}
                </div>
              </div>
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.byGradeLevel')}</h3>
                  <ChartExportButton targetRef={refAttGrade} filename="attendance-by-grade.png" label={t('analytics.exportChart')} />
                </div>
                <div ref={refAttGrade} style={{ minWidth: 0 }}>
                  {attByGrade.length ? (
                    <ModernBarChart
                      
                      data={attByGrade}
                      categoryKey="grade_level"
                      layout="vertical"
                      series={[{ key: 'rate', name: t('analytics.rate'), color: 'var(--accent-3)' }]}
                      yDomain={[0, 100]}
                      height={300}
                    >
                      
                    </ModernBarChart>
                  ) : <Empty text={t('analytics.noData')} />}
                </div>

                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <ProgressRing value={attOverall.overall_rate ?? 0} size={68} stroke={7} tone="primary" />
                  <div className="kpi-mini" style={{ border: 'none', padding: 0 }}>
                    <div className="kpi-mini-value" style={{ color: 'var(--accent-3)' }}>{t('analytics.totalRecords')}: {attOverall.total_records}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Retention Tab ────────────────────────── */}
          {tab === 'retention' && (
            <div className="ds-chart-grid cols-2">
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.enrollmentByGrade')}</h3>
                  <ChartExportButton targetRef={refRetByGrade} filename="retention-by-grade.png" label={t('analytics.exportChart')} />
                </div>
                <div ref={refRetByGrade} style={{ minWidth: 0 }}>
                  {retByGrade.length ? (
                    <ModernBarChart
                      
                      data={retByGrade}
                      legend
                      categoryKey="grade_level"
                      series={[
                        { key: 'total', name: t('analytics.total'), color: 'var(--accent)' },
                        { key: 'enrolled', name: t('analytics.enrolled'), color: 'var(--accent-2)' },
                      ]}
                      height={280}
                    >
                      
                      
                    </ModernBarChart>
                  ) : <Empty text={t('analytics.noData')} />}
                </div>
              </div>
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.yearOverYear')}</h3>
                  <ChartExportButton targetRef={refRetYoy} filename="retention-yoy.png" label={t('analytics.exportChart')} />
                </div>
                <div ref={refRetYoy} style={{ minWidth: 0 }}>
                  {retYoy.length ? (
                    <ModernBarChart
                      
                      data={retYoy}
                      categoryKey="school_year"
                      series={[{ key: 'retention_rate', name: t('analytics.retention'), color: 'var(--warn)' }]}
                      yDomain={[0, 100]}
                      height={280}
                    >
                      
                    </ModernBarChart>
                  ) : <Empty text={t('analytics.noData')} />}
                </div>

                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <ProgressRing value={retention?.retention_rate ?? 0} size={68} stroke={7} tone="success" />
                  <div className="kpi-mini" style={{ border: 'none', padding: 0 }}>
                    <div className="kpi-mini-value" style={{ color: 'var(--warn)' }}>
                      {retention?.withdrawn?.map((w) => `${w.status}: ${w.n}`).join(' · ') || '—'}
                    </div>
                    <div className="kpi-mini-label">{t('analytics.withdrawn')}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── At-Risk / Pass Rate Tab ──────────────── */}
          {tab === 'atRisk' && (
            <div className="ds-chart-grid cols-2">
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.passFailSplit')}</h3>
                  <ChartExportButton targetRef={refPassPie} filename="pass-fail-split.png" label={t('analytics.exportChart')} />
                </div>
                <div ref={refPassPie} style={{ minWidth: 0 }}>
                  {passPieData.length && passPieData.some((d) => d.value > 0) ? (
                    <DonutChart
                      data={[
                        { name: t('analytics.passing'), value: passPieData[0]?.value || 0, color: 'var(--accent-2)' },
                        { name: t('analytics.failing'), value: passPieData[1]?.value || 0, color: 'var(--danger)' },
                      ]}
                      centerValue={passRate?.pass_rate != null ? `${passRate.pass_rate}%` : '—'}
                      centerLabel={t('analytics.passRate')}
                      size={170}
                    />
                  ) : <Empty text={t('analytics.noData')} />}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <h3 style={{ margin: '16px 0 8px', fontSize: 14 }}>{t('analytics.byGradeLevel')}</h3>
                  <ChartExportButton targetRef={refPassByGrade} filename="pass-fail-by-grade.png" label={t('analytics.exportChart')} />
                </div>
                <div ref={refPassByGrade} style={{ minWidth: 0 }}>
                  {passByGrade.length ? (
                    <ModernBarChart
                      
                      data={passByGrade}
                      legend
                      categoryKey="grade_level"
                      stacked
                      series={[
                        { key: 'failing', name: t('analytics.failing'), color: 'var(--danger)' },
                        { key: 'passing', name: t('analytics.passing'), color: 'var(--accent-2)' },
                      ]}
                      height={200}
                      showLabels={false}
                    >
                      
                      
                    </ModernBarChart>
                  ) : <Empty text={t('analytics.noData')} />}
                </div>
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
            <div className="ds-chart-grid cols-2">
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.strandComparison')}</h3>
                  <ChartExportButton targetRef={refStrandBars} filename="strand-comparison.png" label={t('analytics.exportChart')} />
                </div>
                <div ref={refStrandBars} style={{ minWidth: 0 }}>
                  {strandComp?.data?.length ? (
                    <ModernBarChart
                      
                      data={strandComp.data}
                      legend
                      categoryKey="strand"
                      series={[
                        { key: 'mean_grade', name: t('analytics.meanGrade'), color: 'var(--accent)' },
                        { key: 'pass_rate', name: t('analytics.passRate'), color: 'var(--accent-2)' },
                      ]}
                      height={300}
                      xAngle={-15}
                      xHeight={60}
                      showLabels={false}
                    >
                      
                      
                    </ModernBarChart>
                  ) : <Empty text={t('analytics.noData')} />}
                </div>
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.strandPie')}</h3>
                      <ChartExportButton targetRef={refStrandPie} filename="strand-total.png" label={t('analytics.exportChart')} />
                    </div>
                    <div ref={refStrandPie} style={{ minWidth: 0 }}>
                      <DonutChart
                        data={strandComp.data.map((s, i) => ({ name: s.strand, value: Number(s.total_grades), color: CHART_PALETTE[i % CHART_PALETTE.length] }))}
                        centerValue={strandComp.data.reduce((a, s) => a + Number(s.total_grades), 0) || '—'}
                        centerLabel={t('analytics.totalGrades')}
                        size={170}
                      />
                    </div>
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
                <StatCard label={t('analytics.overallAvg')} value={compMastery?.overall?.overall_avg ?? '—'} sub={`${compMastery?.overall?.total_competencies ?? 0} competencies`} icon={<Target size={22} />} iconBg="var(--accent)" />
                <StatCard label={t('analytics.masteryRate')} value={compMastery?.overall?.mastered != null && (compMastery.overall.mastered + compMastery.overall.developing + compMastery.overall.beginning) > 0 ? `${Math.round(compMastery.overall.mastered / (compMastery.overall.mastered + compMastery.overall.developing + compMastery.overall.beginning) * 100)}%` : '—'} sub={`${compMastery?.overall?.mastered ?? 0} mastered`} icon={<GraduationCap size={22} />} iconBg="var(--accent-2)" />
                <StatCard label={t('analytics.riskStudents')} value={riskSummary.high ?? '—'} sub={`${riskSummary.medium ?? 0} medium · ${riskSummary.low ?? 0} low`} icon={<AlertTriangle size={22} />} iconBg="var(--danger)" />
                <StatCard label={t('analytics.aiInsights')} value={aiInsights?.insights?.filter((i) => i.ai_ready).length ?? 0} sub={`${aiInsights?.insights?.filter((i) => !i.ai_ready).length ?? 0} coming soon`} icon={<Brain size={22} />} iconBg="#A78BFA" />
              </div>

              <div className="ds-chart-grid cols-2" style={{ marginBottom: 24 }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{t('analytics.subjectMastery')}</h3>
                    <ChartExportButton targetRef={refSubjectBars} filename="subject-mastery.png" label={t('analytics.exportChart')} />
                  </div>
                  <div ref={refSubjectBars} style={{ minWidth: 0 }}>
                    {compMastery?.by_subject?.length ? (
                      <ModernBarChart
                        
                        data={compMastery.by_subject}
                      legend
                        categoryKey="subject_code"
                        layout="vertical"
                        series={[
                          { key: 'avg_score', name: t('analytics.avgScore'), color: 'var(--accent)' },
                          { key: 'mastery_rate', name: t('analytics.masteryRate'), color: 'var(--accent-2)' },
                        ]}
                        yDomain={[0, 100]}
                        height={360}
                        showLabels={false}
                      >
                        
                        
                      </ModernBarChart>
                    ) : <Empty text={t('analytics.noCompetencyData')} />}
                  </div>

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
