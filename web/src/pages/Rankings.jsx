import { useEffect, useState } from 'react';
import { RefreshCw, Settings2, UserSearch } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { PageHead, Badge, Modal, Empty, ErrorBanner, Spinner, SearchInput, SkeletonTable } from '../components/ui';
import { fmt } from '../lib/utils';

const DESIGNATION_LABELS = {
  with_highest_honors: 'With Highest Honors',
  with_high_honors: 'With High Honors',
  with_honors: 'With Honors',
};

const DESIGNATION_CLASSES = {
  with_highest_honors: 'badge-yellow',
  with_high_honors: 'badge-blue',
  with_honors: 'badge-green',
};

const TABS = [
  { id: 'honor', label: 'Honor Roll', read: ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'guidance'] },
  { id: 'rank', label: 'Class Rank', read: true },
  { id: 'student', label: 'Student Records', read: true },
];

function designationBadge(d) {
  if (!d) return null;
  return <span className={`badge ${DESIGNATION_CLASSES[d] || 'badge-gray'}`}>{DESIGNATION_LABELS[d] || d}</span>;
}

export default function Rankings() {
  const { user } = useAuth();
  const isAdmin = can(user?.role, 'super_admin', 'school_admin');
  const tabs = TABS.filter((t) => t.read === true || can(user?.role, ...t.read));

  const [tab, setTab] = useState('honor');
  const [sy, setSy] = useState('2026-2027');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);

  const [honor, setHonor] = useState(null); // { data, counts, settings }
  const [honorGrade, setHonorGrade] = useState('');
  const [honorSection, setHonorSection] = useState('');
  const [honorDesignation, setHonorDesignation] = useState('');

  const [rank, setRank] = useState(null);
  const [rankSection, setRankSection] = useState('');

  const [student, setStudent] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [studentQuery, setStudentQuery] = useState('');

  const [settings, setSettings] = useState(null);
  const [settingsModal, setSettingsModal] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    Promise.allSettled([api('/sections?limit=200'), api('/students?limit=1000')])
      .then(([sec, stu]) => {
        const secData = sec.status === 'fulfilled' ? sec.value.data : [];
        const stuData = stu.status === 'fulfilled' ? stu.value.data : [];
        setSections(secData);
        setStudents(stuData);
        const gl = [...new Set(stuData.map((s) => s.grade_level).filter(Boolean))].sort();
        if (gl.length) setHonorGrade(gl[0]);
        const first = secData[0];
        if (first) setRankSection(String(first.id));
        const errs = [sec, stu].filter((r) => r.status === 'rejected').map((r) => r.reason.message);
        if (errs.length) setError(errs.join('; '));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function loadHonor() {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ school_year: sy });
    if (honorGrade) qs.set('grade_level', honorGrade);
    if (honorSection) qs.set('section_id', honorSection);
    if (honorDesignation) qs.set('designation', honorDesignation);
    api(`/analytics/honor-roll?${qs}`)
      .then((r) => setHonor(r))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function loadRank() {
    if (!rankSection) return;
    setLoading(true);
    setError(null);
    api(`/analytics/rank?school_year=${encodeURIComponent(sy)}&section_id=${rankSection}`)
      .then((r) => setRank(r))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function loadStudent(id) {
    setLoading(true);
    setError(null);
    setAnalytics(null);
    api(`/analytics/students/${id}?school_year=${encodeURIComponent(sy)}`)
      .then((r) => setAnalytics(r))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function loadSettings() {
    api('/analytics/honor-roll/settings').then(setSettings).catch(() => {});
  }

  async function saveSettings(e) {
    e.preventDefault();
    setSavingSettings(true);
    setError(null);
    try {
      const value = await api('/analytics/honor-roll/settings', { method: 'PUT', body: settings });
      setSettings(value);
      setSettingsModal(false);
      if (tab === 'honor') loadHonor();
    } catch (err) { setError(err.message); } finally { setSavingSettings(false); }
  }

  const sySections = sections.filter((s) => s.school_year === sy);
  const filteredStudents = students.filter((s) => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return true;
    return [s.first_name, s.middle_name, s.last_name, s.lrn]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  }).sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''));

  return (
    <>
      <PageHead
        title="GPA, Class Rank & Honor Roll"
        sub="Annual averages, GPA (unweighted and unit-weighted), credits earned, class ranks and DepEd honor roll designations."
      >
        <button className="btn" onClick={() => { loadHonor(); loadRank(); }}><RefreshCw size={14} /> Reload</button>
      </PageHead>
      <ErrorBanner error={error} />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ margin: 0, alignItems: 'end' }}>
          <div>
            <label>School year</label>
            <input value={sy} onChange={(e) => setSy(e.target.value)} />
          </div>
          <div style={{ flex: 1, display: 'flex', gap: 4 }}>
            {tabs.map((t) => (
              <button key={t.id} className={tab === t.id ? 'btn btn-primary' : 'btn'} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <SkeletonTable rows={10} cols={5} /> : (
        <>
          {tab === 'honor' && (
            <div className="card table-wrap">
              <div className="form-row" style={{ margin: 0, paddingBottom: 12 }}>
                <div><label>Grade level</label>
                  <select value={honorGrade} onChange={(e) => setHonorGrade(e.target.value)}>
                    <option value="">All</option>
                    {[...new Set(students.map((s) => s.grade_level).filter(Boolean))].sort().map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div><label>Section</label>
                  <select value={honorSection} onChange={(e) => setHonorSection(e.target.value)}>
                    <option value="">All</option>
                    {sySections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div><label>Designation</label>
                  <select value={honorDesignation} onChange={(e) => setHonorDesignation(e.target.value)}>
                    <option value="">All students</option>
                    {Object.entries(DESIGNATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <button className="btn btn-primary" onClick={loadHonor}>Load</button>
                {isAdmin && (
                  <button className="btn" onClick={() => { loadSettings(); setSettingsModal(true); }}><Settings2 size={14} /> Thresholds</button>
                )}
              </div>

              {honor && honor.counts && (
                <div className="form-row" style={{ margin: 0, paddingBottom: 12, gap: 18 }}>
                  <span className="sub">Ranked students: <strong>{honor.data.length}</strong></span>
                  <span className="sub">🏆 Highest: <strong>{honor.counts.with_highest_honors}</strong></span>
                  <span className="sub">With High Honors: <strong>{honor.counts.with_high_honors}</strong></span>
                  <span className="sub">With Honors: <strong>{honor.counts.with_honors}</strong></span>
                </div>
              )}

              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center' }}>Rank</th><th>Student</th><th>LRN</th><th>Section</th>
                    <th style={{ textAlign: 'center' }}>GWA</th><th style={{ textAlign: 'center' }}>Min Grade</th>
                    <th style={{ textAlign: 'center' }}>Credits</th><th>Honor</th>
                  </tr>
                </thead>
                <tbody>
                  {honor && honor.data.map((r) => (
                    <tr key={r.student.id}>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.rank}</td>
                      <td>{r.student.last_name}, {r.student.first_name}{r.student.middle_name ? ` ${r.student.middle_name}` : ''}</td>
                      <td style={{ fontSize: 12.5 }}>{r.student.lrn}</td>
                      <td style={{ fontSize: 12.5 }}>{r.student.section_name}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{fmt(r.gwa)}</td>
                      <td style={{ textAlign: 'center' }}>{fmt(r.min_final)}</td>
                      <td style={{ textAlign: 'center' }}>{r.credits_total ? `${r.credits_earned}/${r.credits_total}` : '—'}</td>
                      <td>{designationBadge(r.honor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {honor && !honor.data.length && <Empty text="No students found for these filters." />}
              {!honor && <Empty text="Pick a school year and press Load." />}
            </div>
          )}

          {tab === 'rank' && (
            <div className="card table-wrap">
              <div className="form-row" style={{ margin: 0, paddingBottom: 12 }}>
                <div><label>Section</label>
                  <select value={rankSection} onChange={(e) => setRankSection(e.target.value)}>
                    {sySections.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.grade_level})</option>)}
                  </select>
                </div>
                <button className="btn btn-primary" onClick={loadRank}>Load</button>
              </div>
              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center' }}>Rank</th><th>Student</th><th>LRN</th>
                    <th style={{ textAlign: 'center' }}>GWA</th><th style={{ textAlign: 'center' }}>GPA</th>
                    <th style={{ textAlign: 'center' }}>Wtd GPA</th><th style={{ textAlign: 'center' }}>Credits</th><th>Honor</th>
                  </tr>
                </thead>
                <tbody>
                  {rank && rank.data.map((r) => (
                    <tr key={r.student.id}>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.rank}</td>
                      <td>{r.student.last_name}, {r.student.first_name}{r.student.middle_name ? ` ${r.student.middle_name}` : ''}</td>
                      <td style={{ fontSize: 12.5 }}>{r.student.lrn}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{fmt(r.gwa)}</td>
                      <td style={{ textAlign: 'center' }}>{fmt(r.gpa)}</td>
                      <td style={{ textAlign: 'center' }}>{fmt(r.weighted_gpa)}</td>
                      <td style={{ textAlign: 'center' }}>{r.credits_total ? `${r.credits_earned}/${r.credits_total}` : '—'}</td>
                      <td>{designationBadge(r.honor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rank && !rank.data.length && <Empty text="No students with grades in this section." />}
              {!rank && <Empty text="Pick a section and press Load." />}
            </div>
          )}

          {tab === 'student' && (
            <div className="two-col" style={{ alignItems: 'start' }}>
              <div className="card">
                <h3 style={{ marginTop: 0 }}><UserSearch size={15} style={{ verticalAlign: -2 }} /> Select student</h3>
                <div className="form-row" style={{ margin: 0 }}>
                  <SearchInput
                    value={studentQuery}
                    onChange={(v) => { setStudentQuery(v); setStudent(''); setAnalytics(null); }}
                    placeholder="Search name or LRN…"
                  />
                </div>
                <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
                  <table>
                    <tbody>
                      {filteredStudents.slice(0, 80).map((s) => (
                        <tr key={s.id} className={String(s.id) === String(student) ? 'row-active' : ''} style={{ cursor: 'pointer' }} onClick={() => { setStudent(String(s.id)); loadStudent(s.id); }}>
                          <td style={{ fontSize: 13.5 }}>
                            <strong>{s.last_name}, {s.first_name}</strong>
                            <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>{s.grade_level} · {s.lrn}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card" style={{ flex: 2 }}>
                {analytics ? (
                  <>
                    <h3 style={{ marginTop: 0 }}>{analytics.student.last_name}, {analytics.student.first_name}
                      {analytics.student.middle_name ? ` ${analytics.student.middle_name}` : ''}
                      <span style={{ fontWeight: 400, color: 'var(--text-dim)', fontSize: 13 }}> · {analytics.school_year}</span>
                    </h3>
                    {analytics.section && <p className="sub" style={{ marginTop: -6 }}>Section {analytics.section.section_name} · Rank {analytics.rank || '—'}/{analytics.rank_total || '—'}</p>}
                    {designationBadge(analytics.honor)}
                    <div className="form-row" style={{ margin: '10px 0' }}>
                      <div className="stat-card"><span className="sub">GWA</span><div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(analytics.general_average)}</div></div>
                      <div className="stat-card"><span className="sub">GPA</span><div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(analytics.gpa)}</div></div>
                      <div className="stat-card"><span className="sub">Weighted GPA</span><div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(analytics.weighted_gpa)}</div></div>
                      <div className="stat-card"><span className="sub">Credits earned</span><div style={{ fontSize: 20, fontWeight: 700 }}>{analytics.credits ? `${analytics.credits.earned}/${analytics.credits.total}` : '—'}</div></div>
                      <div className="stat-card"><span className="sub">Lowest final</span><div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(analytics.min_final)}</div></div>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Subject</th><th>Code</th><th style={{ textAlign: 'center' }}>Units</th>
                            <th style={{ textAlign: 'center' }}>Final</th><th style={{ textAlign: 'center' }}>Letter</th>
                            <th style={{ textAlign: 'center' }}>Points</th><th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.subjects.map((s) => (
                            <tr key={s.subject_id}>
                              <td>{s.title}</td><td style={{ fontSize: 12.5 }}>{s.code}</td>
                              <td style={{ textAlign: 'center' }}>{s.units || '—'}</td>
                              <td style={{ textAlign: 'center', fontWeight: 600 }}>{fmt(s.final)}</td>
                              <td style={{ textAlign: 'center' }}>{s.letter || '—'}</td>
                              <td style={{ textAlign: 'center' }}>{s.points ?? '—'}</td>
                              <td><Badge status={s.passed ? 'PASSED' : 'FAILED'} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!analytics.subjects.length && <Empty text="No graded subjects for this school year." />}
                    </div>
                  </>
                ) : (
                  <Empty text="Select a student to view GPA, credits, rank and subject finals." />
                )}
              </div>
            </div>
          )}
        </>
      )}

      {settingsModal && settings && (
        <Modal title="Honor roll thresholds" sub="DepEd DO 36, s. 2016 defaults: Highest 98, High 95, With Honors 90." onClose={() => setSettingsModal(false)}>
          <form onSubmit={saveSettings}>
            <div className="form-row">
              <div><label>With Highest Honors (GWA ≥)</label><input type="number" min="0" max="100" step="0.5" value={settings.highest} onChange={(e) => setSettings({ ...settings, highest: Number(e.target.value) })} /></div>
              <div><label>With High Honors (GWA ≥)</label><input type="number" min="0" max="100" step="0.5" value={settings.high} onChange={(e) => setSettings({ ...settings, high: Number(e.target.value) })} /></div>
              <div><label>With Honors (GWA ≥)</label><input type="number" min="0" max="100" step="0.5" value={settings.honors} onChange={(e) => setSettings({ ...settings, honors: Number(e.target.value) })} /></div>
            </div>
            <div className="form-row">
              <div><label>Highest: min grade per subject</label><input type="number" min="0" max="100" step="0.5" value={settings.floors.highest} onChange={(e) => setSettings({ ...settings, floors: { ...settings.floors, highest: Number(e.target.value) } })} /></div>
              <div><label>High: min grade per subject</label><input type="number" min="0" max="100" step="0.5" value={settings.floors.high} onChange={(e) => setSettings({ ...settings, floors: { ...settings.floors, high: Number(e.target.value) } })} /></div>
              <div><label>With Honors: min grade per subject</label><input type="number" min="0" max="100" step="0.5" value={settings.floors.honors} onChange={(e) => setSettings({ ...settings, floors: { ...settings.floors, honors: Number(e.target.value) } })} /></div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setSettingsModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={savingSettings}>{savingSettings ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
