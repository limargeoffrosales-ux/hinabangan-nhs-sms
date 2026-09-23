import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Target, BarChart3, Users } from 'lucide-react';
import { loadRecharts } from '../lib/lazy-recharts';
import { api } from '../lib/api';
import { PageHead, Spinner, Empty, ErrorBanner } from '../components/ui';
import { ChartTooltip } from '../design-system';

const LEVEL_COLORS = { Advanced: 'var(--success)', Proficient: 'var(--accent)', 'Approaching Proficiency': 'var(--warn)', Developing: 'var(--danger)', Beginning: 'var(--danger)' };
const LEVELS = ['Beginning', 'Developing', 'Approaching Proficiency', 'Proficient', 'Advanced'];

export default function CompetencyTracker() {
  const { t } = useTranslation();
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filter, setFilter] = useState({ section_id: '', subject_id: '', school_year: '2026-2027', quarter: '' });
  const [overview, setOverview] = useState(null);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [R, setR] = useState(null);
  useEffect(() => { loadRecharts().then(setR); }, []);

  useEffect(() => {
    Promise.all([api('/sections?limit=200'), api('/subjects?limit=300')])
      .then(([s, sub]) => { setSections(s.data); setSubjects(sub.data); })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!filter.section_id || !filter.subject_id || !filter.school_year) { setOverview(null); setScores([]); return; }
    setLoading(true);
    setError('');
    const qs = new URLSearchParams({
      section_id: filter.section_id, subject_id: filter.subject_id,
      school_year: filter.school_year, ...(filter.quarter ? { quarter: filter.quarter } : {}),
    });
    Promise.all([
      api(`/competency-tracker/class-overview?${qs}`),
      api(`/competency-tracker/scores?${qs}`),
    ]).then(([ov, sc]) => { setOverview(ov); setScores(sc.data || []); })
      .catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [filter]);

  const selectedSection = sections.find((s) => String(s.id) === filter.section_id);
  const selectedSubject = subjects.find((s) => String(s.id) === filter.subject_id);

  const chartData = overview?.summary?.map((c) => ({
    name: c.code,
    title: c.title,
    Average: c.avg_score || 0,
    scoreCount: c.scored_count,
  })) || [];

  const levelDistribution = overview?.summary?.reduce((acc, c) => {
    for (const [level, count] of Object.entries(c.levels || {})) {
      acc[level] = (acc[level] || 0) + count;
    }
    return acc;
  }, {}) || {};

  const levelPieData = Object.entries(levelDistribution).map(([name, value]) => ({ name, value })).filter((d) => d.value > 0);

  if (!R) return <Spinner />;

  const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } = R;

  return (
    <div>
      <PageHead title={t('compTracker.title', 'Competency Tracker')} sub={t('compTracker.subtitle', 'Monitor and assess student mastery of curriculum competencies')} />

      <div className="card">
        <div className="form-row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <label style={{ margin: 0 }}>
            School Year
            <select className="input" value={filter.school_year} onChange={(e) => setFilter((f) => ({ ...f, school_year: e.target.value }))} style={{ marginTop: 4, width: 140 }}>
              <option>2026-2027</option><option>2025-2026</option><option>2024-2025</option>
            </select>
          </label>
          <label style={{ margin: 0 }}>
            Section *
            <select className="input" value={filter.section_id} onChange={(e) => setFilter((f) => ({ ...f, section_id: e.target.value }))} style={{ marginTop: 4, width: 200 }}>
              <option value="">Select section…</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.grade_level} — {s.name}</option>)}
            </select>
          </label>
          <label style={{ margin: 0 }}>
            Subject *
            <select className="input" value={filter.subject_id} onChange={(e) => setFilter((f) => ({ ...f, subject_id: e.target.value }))} style={{ marginTop: 4, width: 220 }}>
              <option value="">Select subject…</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.title}</option>)}
            </select>
          </label>
          <label style={{ margin: 0 }}>
            Quarter
            <select className="input" value={filter.quarter} onChange={(e) => setFilter((f) => ({ ...f, quarter: e.target.value }))} style={{ marginTop: 4, width: 120 }}>
              <option value="">All</option>
              <option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option>
            </select>
          </label>
        </div>
        {selectedSection && selectedSubject && (
          <div className="sub" style={{ marginTop: 8 }}>{selectedSection.grade_level} — {selectedSection.name} · {selectedSubject.title}</div>
        )}
      </div>

      <ErrorBanner error={error} />
      {loading ? <Spinner /> : !overview ? (
        <Empty text={t('compTracker.selectFilters', 'Select a section and subject to view competency data.')} />
      ) : (
        <>
          <div className="tab-bar" role="tablist">
            {[['overview', t('compTracker.tabOverview', 'Overview')], ['matrix', t('compTracker.tabMatrix', 'Student Matrix')], ['levels', t('compTracker.tabLevels', 'Level Distribution')]].map(([id, label]) => (
              <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)} role="tab" aria-selected={tab === id}>{label}</button>
            ))}
          </div>

          {tab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: overview?.summary?.length > 0 ? '2fr 1fr' : '1fr', gap: 20 }}>
              <div className="card">
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}><BarChart3 size={15} /> Competency Average Scores</h3>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-dim)' }} domain={[0, 100]} />
                      <Tooltip content={<ChartTooltip />} formatter={(v) => [v, 'Average Score']} />
                      <Bar dataKey="Average" radius={[4, 4, 0, 0]}>
                        {chartData.map((d, i) => <Cell key={i} fill={d.Average >= 85 ? 'var(--success)' : d.Average >= 75 ? 'var(--warn)' : 'var(--danger)'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty text={t('compTracker.noData', 'No competency data yet.')} />}
              </div>
              <div className="card">
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}><Target size={15} /> Competency Summary</h3>
                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                  <table className="table">
                    <thead><tr><th>Code</th><th>Avg</th><th>Count</th></tr></thead>
                    <tbody>
                      {overview.summary.map((c, i) => (
                        <tr key={i}>
                          <td style={{ fontSize: 12 }}>{c.code}</td>
                          <td style={{ fontSize: 12 }}><strong>{c.avg_score ?? '—'}</strong></td>
                          <td style={{ fontSize: 12 }}>{c.scored_count}/{c.total_students}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === 'matrix' && (
            <div className="card">
              <h3 style={{ margin: '0 0 12px', fontSize: 15 }}><Users size={15} /> Student × Competency Matrix</h3>
              {overview.students?.length > 0 && overview.competencies?.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ position: 'sticky', left: 0, background: 'var(--card-solid)', zIndex: 1 }}>Student</th>
                        {overview.competencies.map((c) => <th key={c.id} style={{ textAlign: 'center', minWidth: 60 }}>{c.code}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {overview.students.map((st) => {
                        const scoreMap = {};
                        scores.filter((s) => s.student_id === st.student_id).forEach((s) => { scoreMap[s.competency_id] = s; });
                        return (
                          <tr key={st.student_id}>
                            <td style={{ position: 'sticky', left: 0, background: 'var(--card-solid)', zIndex: 1, whiteSpace: 'nowrap' }}>{st.name}</td>
                            {overview.competencies.map((c) => {
                              const sc = scoreMap[c.id];
                              return (
                                <td key={c.id} style={{ textAlign: 'center' }}>
                                  {sc ? (
                                    <span title={sc.level || ''} style={{ color: LEVEL_COLORS[sc.level] || 'var(--text)', fontWeight: 600 }}>
                                      {sc.score}
                                    </span>
                                  ) : <span className="sub">—</span>}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <Empty text={t('compTracker.noMatrix', 'No students or competencies to display.')} />}
            </div>
          )}

          {tab === 'levels' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="card">
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Proficiency Level Distribution</h3>
                {levelPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={levelPieData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-dim)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-dim)' }} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="value" name="Students" radius={[4, 4, 0, 0]}>
                        {levelPieData.map((d) => <Cell key={d.name} fill={LEVEL_COLORS[d.name] || 'var(--text-dim)'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty text="No level data yet." />}
              </div>
              <div className="card">
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Level Breakdown</h3>
                {LEVELS.map((level) => {
                  const count = levelDistribution[level] || 0;
                  const total = levelPieData.reduce((a, d) => a + d.value, 0);
                  const pct = total ? Math.round(count / total * 100) : 0;
                  return (
                    <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ width: 160, fontSize: 13 }}>{level}</span>
                      <div style={{ flex: 1, height: 20, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: LEVEL_COLORS[level], borderRadius: 4, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ width: 50, textAlign: 'right', fontSize: 12 }}>{count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
