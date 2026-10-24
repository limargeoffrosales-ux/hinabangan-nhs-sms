import { useEffect, useMemo, useState } from 'react';
import { Users, CalendarCheck, UserCheck, BookOpen, Briefcase, BadgeCheck, GraduationCap, TrendingUp, ClipboardList, Target, GitBranch, Clock, BarChart3 } from 'lucide-react';
import { api, getCurrentSchoolYear } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { SCHOOL_YEARS, CHART_PALETTE } from '../lib/constants';
import { Spinner, Modal } from './ui';
import { ModernBarChart } from '../design-system';

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
const STATUS_COLORS = { present: 'badge-green', absent: 'badge-red', late: 'badge-yellow', on_leave: 'badge-blue' };
const TEACHER_STATUSES = ['present', 'absent', 'on_leave'];

function StatChip({ label, value, color }) {
  return (
    <div className="kpi-mini">
      <div className="kpi-mini-value" style={{ color }}>{value}</div>
      <div className="kpi-mini-label">{label}</div>
    </div>
  );
}

function fmtDate(d) {
  try { return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

export default function DashboardSections() {
  const { user } = useAuth();
  const canWrite = can(user?.role, ...WRITE);
  const [sy, setSy] = useState('2026-2027');
  const [term, setTerm] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentSchoolYear().then((y) => { if (y) setSy((prev) => (prev === '2026-2027' ? y : prev)); });
  }, []);
  const [error, setError] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [attGroups, setAttGroups] = useState(null);
  const [teacherStatus, setTeacherStatus] = useState(null);
  const [subjectEnr, setSubjectEnr] = useState(null);
  const [immersion, setImmersion] = useState(null);
  const [jdvp, setJdvp] = useState(null);
  const [aral, setAral] = useState(null);
  const [progress, setProgress] = useState(null);
  const [quarter, setQuarter] = useState(1);
  const [tab, setTab] = useState('enrollment');
  const [qSection, setQSection] = useState('');
  const [qReport, setQReport] = useState(null);
  const [aralAtt, setAralAtt] = useState(null);
  const [aralProg, setAralProg] = useState(null);
  const [strandDist, setStrandDist] = useState(null);
  const [teacherWorkload, setTeacherWorkload] = useState(null);
  const [marking, setMarking] = useState({});
  const [sections, setSections] = useState([]);
  const [aralFilter, setAralFilter] = useState({ grade: '', section: '', area: '' });
  const [reloadTick, setReloadTick] = useState(0);
  const [showAralModal, setShowAralModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aralForm, setAralForm] = useState({ session_date: '', subject_area: 'reading', session_no: '', tutor: '', section_id: '', remarks: '' });
  const [aralRoll, setAralRoll] = useState([]);
  const [rollLoading, setRollLoading] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Restore the last dashboard view (school year / term / date) from the server.
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const p = await api('/dashboard/preferences');
        if (dead || !p) return;
        if (p.dashboard_school_year) setSy(p.dashboard_school_year);
        if (p.dashboard_term) setTerm(p.dashboard_term);
        if (p.dashboard_date) setDate(p.dashboard_date);
      } catch { /* preferences are optional */ } finally {
        if (!dead) setPrefsLoaded(true);
      }
    })();
    return () => { dead = true; };
  }, []);

  // Persist the dashboard view on the server whenever it changes.
  useEffect(() => {
    if (!prefsLoaded) return;
    api('/dashboard/preferences', {
      method: 'PUT',
      body: { dashboard_school_year: sy, dashboard_term: term, dashboard_date: date },
    }).catch(() => {});
  }, [sy, term, date, prefsLoaded]);

  useEffect(() => {
    let dead = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [en, at, ts, se, im, jv, ar, pr, sd, tw] = await Promise.allSettled([
          api(`/dashboard/enrollment?school_year=${encodeURIComponent(sy)}&term=${encodeURIComponent(term)}`),
          api(`/dashboard/attendance-groups?date=${encodeURIComponent(date)}`),
          api(`/dashboard/teacher-status?date=${encodeURIComponent(date)}`),
          api(`/dashboard/subject-enrollment?school_year=${encodeURIComponent(sy)}`),
          api('/dashboard/immersion-summary'),
          api('/dashboard/jdvp-summary'),
          api(`/dashboard/aral-summary?school_year=${encodeURIComponent(sy)}&term=${encodeURIComponent(term)}`),
          api(`/dashboard/student-progress?school_year=${encodeURIComponent(sy)}&term=${encodeURIComponent(term)}`),
          api(`/department/strand-distribution?school_year=${encodeURIComponent(sy)}`).catch(() => ({ data: [] })),
          api(`/department/teacher-workload?school_year=${encodeURIComponent(sy)}`).catch(() => ({ data: [] })),
        ]);
        if (dead) return;
        const ok = (r) => r.status === 'fulfilled' ? r.value : null;
        setEnrollment(ok(en)); setAttGroups(ok(at)); setTeacherStatus(ok(ts));
        setSubjectEnr(ok(se)); setImmersion(ok(im)); setJdvp(ok(jv));
        setAral(ok(ar)); setProgress(ok(pr));
        setStrandDist(ok(sd)); setTeacherWorkload(ok(tw));
      } catch (e) {
        if (!dead) setError(e.message);
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => { dead = true; };
  }, [sy, term, date]);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const qs = `school_year=${encodeURIComponent(sy)}&quarter=${quarter}`
          + (qSection ? `&section_id=${encodeURIComponent(qSection)}` : '');
        const r = await api(`/dashboard/quarterly-report?${qs}`);
        if (!dead) setQReport(r);
      } catch (e) {
        if (!dead) setError(e.message);
      }
    })();
    return () => { dead = true; };
  }, [sy, quarter, qSection, reloadTick]);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const qs = `school_year=${encodeURIComponent(sy)}`
          + (aralFilter.grade ? `&grade_level=${encodeURIComponent(aralFilter.grade)}` : '')
          + (aralFilter.section ? `&section_id=${encodeURIComponent(aralFilter.section)}` : '')
          + (aralFilter.area ? `&subject_area=${encodeURIComponent(aralFilter.area)}` : '');
        const [secs, att, prog] = await Promise.allSettled([
          api(`/sections?school_year=${encodeURIComponent(sy)}`),
          api(`/dashboard/aral-attendance?${qs}`),
          api(`/dashboard/aral-progress?${qs}`),
        ]);
        if (dead) return;
        const ok = (r) => r.status === 'fulfilled' ? r.value : null;
        setSections(ok(secs)?.data || []);
        setAralAtt(ok(att));
        setAralProg(ok(prog));
      } catch (e) {
        if (!dead) setError(e.message);
      }
    })();
    return () => { dead = true; };
  }, [sy, aralFilter, reloadTick]);

  async function markTeacher(id, status) {
    setMarking((m) => ({ ...m, [id]: 'busy' }));
    try {
      await api('/dashboard/teacher-status', { method: 'POST', body: { teacher_id: id, status, date } });
      const ts = await api(`/dashboard/teacher-status?date=${encodeURIComponent(date)}`);
      setTeacherStatus(ts);
    } catch (e) {
      setError(e.message);
    } finally {
      setMarking((m) => ({ ...m, [id]: false }));
    }
  }

  const canRecordAral = canWrite || user?.role === 'teacher' || user?.role === 'guidance';

  async function openAralModal() {
    const first = sections[0]?.id || '';
    setAralForm({
      session_date: new Date().toISOString().slice(0, 10),
      subject_area: 'reading',
      session_no: '',
      tutor: user?.name || '',
      section_id: first,
      remarks: '',
    });
    setShowAralModal(true);
    if (first) await loadAralRoll(first);
  }

  async function loadAralRoll(sectionId) {
    if (!sectionId) { setAralRoll([]); return; }
    setRollLoading(true);
    try {
      const r = await api(`/sections/${sectionId}/students`);
      setAralRoll(r.data.map((s) => ({ student_id: s.id, name: `${s.last_name}, ${s.first_name}`, status: 'present' })));
    } catch (e) {
      setError(e.message);
    } finally {
      setRollLoading(false);
    }
  }

  function setRollStatus(id, status) {
    setAralRoll((list) => list.map((r) => (r.student_id === id ? { ...r, status } : r)));
  }

  async function saveAralSession(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/dashboard/aral-sessions', {
        method: 'POST',
        body: {
          school_year: sy,
          section_id: aralForm.section_id,
          session_date: aralForm.session_date,
          subject_area: aralForm.subject_area,
          session_no: aralForm.session_no || null,
          tutor: aralForm.tutor || null,
          remarks: aralForm.remarks || null,
          attendance: aralRoll.map((r) => ({ student_id: r.student_id, status: r.status })),
        },
      });
      setShowAralModal(false);
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const chartData = useMemo(() => {
    if (!enrollment) return [];
    return enrollment.by_section.map((r) => ({ section: r.section_name, Male: Number(r.male), Female: Number(r.female) }));
  }, [enrollment]);

  if (error) return <div className="err-banner">{error}</div>;
  if (loading) return <Spinner />;

  const totalEnrolled = enrollment?.totals?.total || 0;
  const attRate = attGroups
    ? attGroups.by_grade.reduce((a, g) => a + g.present, 0)
    : 0;
  const attLogged = attGroups ? attGroups.by_grade.reduce((a, g) => a + g.logged, 0) : 0;

  return (
    <>
      <div className="card-top" style={{ alignItems: 'flex-end' }}>
        <h2 className="section-title" style={{ margin: 0 }}>School Data Overview</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label className="input-label" style={{ margin: 0 }}>
            School Year
            <select className="input" value={sy} onChange={(e) => setSy(e.target.value)} style={{ marginTop: 4, width: 130 }}>
              {SCHOOL_YEARS.map((y) => <option key={y}>{y}</option>)}
            </select>
          </label>
          <label className="input-label" style={{ margin: 0 }}>
            Term
            <select className="input" value={term} onChange={(e) => setTerm(e.target.value)} style={{ marginTop: 4, width: 130 }}>
              <option value="">Whole year</option>
              <option value="first">First</option>
              <option value="second">Second</option>
              <option value="third">Third</option>
            </select>
          </label>
          <label className="input-label" style={{ margin: 0 }}>
            Date
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} style={{ marginTop: 4, width: 150 }} />
          </label>
        </div>
      </div>

      <div className="dash-tabs" role="tablist" aria-label="Dashboard sections">
        {[
          { id: 'enrollment', label: 'Enrollment', icon: Users },
          { id: 'staff', label: 'Attendance & Staff', icon: CalendarCheck },
          { id: 'career', label: 'Career & TVL', icon: Briefcase },
          { id: 'outcomes', label: 'Outcomes & ARAL', icon: GraduationCap },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`section-chip ${tab === t.id ? 'on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab !== 'enrollment' && (
        <p className="dash-tab-hint">
          Showing the <strong>{tab === 'staff' ? 'Attendance & Staff' : tab === 'career' ? 'Career & TVL' : 'Outcomes & ARAL'}</strong> view. Use the tabs above to switch sections.
        </p>
      )}

      {tab === 'enrollment' && (
      <>
      {/* 1 — Enrollment data */}
      <div className="card">
        <div className="dashboard-block-head">
          <h3 style={{ margin: 0 }}><Users size={16} /> Enrollment Data — {sy}{term ? ` (${term[0].toUpperCase() + term.slice(1)} Term)` : ''}</h3>
          <div className="kpi-row">
            <StatChip label="Grade 11" value={enrollment?.by_grade?.['Grade 11']?.total ?? 0} color="#4D96FF" />
            <StatChip label="Grade 12" value={enrollment?.by_grade?.['Grade 12']?.total ?? 0} color="#2FD6A0" />
            <StatChip label="Male" value={enrollment?.totals?.male ?? 0} color="#4D96FF" />
            <StatChip label="Female" value={enrollment?.totals?.female ?? 0} color="#F5B942" />
            <StatChip label="Total" value={totalEnrolled} color="#A78BFA" />
          </div>
        </div>
        {chartData.length > 0 && (
          <div style={{ margin: '14px 0' }}>
            <ModernBarChart
              data={chartData}
              categoryKey="section"
              series={[
                { key: 'Male', color: '#4D96FF' },
                { key: 'Female', color: '#F5B942' },
              ]}
              height={180}
              showLabels={false}
              barCategoryGap="24%"
            />
          </div>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Grade Level</th><th>Section</th><th>Strand</th><th style={{ textAlign: 'center' }}>Male</th><th style={{ textAlign: 'center' }}>Female</th><th style={{ textAlign: 'center' }}>Total</th></tr>
            </thead>
            <tbody>
              {enrollment?.grades?.map((g) => {
                const bg = enrollment.by_grade?.[g];
                if (!bg || bg.sections.length === 0) {
                  return (
                    <tr key={g}><td colSpan={6} className="sub">No {g} sections enrolled for {sy}.</td></tr>
                  );
                }
                return [
                  bg.sections.map((s) => (
                    <tr key={`${g}-${s.name}`}>
                      <td>{g}</td><td>{s.name}</td><td className="sub">{s.strand || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{s.male}</td>
                      <td style={{ textAlign: 'center' }}>{s.female}</td>
                      <td style={{ textAlign: 'center' }}><strong>{s.total}</strong></td>
                    </tr>
                  )),
                  <tr key={`${g}-subtotal`} className="subtotal-row">
                    <td colSpan={2}><strong>{g} Subtotal</strong></td><td></td>
                    <td style={{ textAlign: 'center' }}><strong>{bg.male}</strong></td>
                    <td style={{ textAlign: 'center' }}><strong>{bg.female}</strong></td>
                    <td style={{ textAlign: 'center' }}><strong>{bg.total}</strong></td>
                  </tr>,
                ];
              })}
              {totalEnrolled > 0 && (
                <tr className="subtotal-row">
                  <td colSpan={2}><strong>Total Enrollment</strong></td><td></td>
                  <td style={{ textAlign: 'center' }}><strong>{enrollment?.totals?.male ?? 0}</strong></td>
                  <td style={{ textAlign: 'center' }}><strong>{enrollment?.totals?.female ?? 0}</strong></td>
                  <td style={{ textAlign: 'center' }}><strong>{totalEnrolled}</strong></td>
                </tr>
              )}
              {totalEnrolled === 0 && (
                <tr><td colSpan={6} className="sub">No enrollments recorded for {sy} yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4 — Subject enrollment */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}><BookOpen size={16} /> Students Enrolled per Subject — {sy}</h3>
        <div className="split-2">
          <div>
            <h4 style={{ margin: '0 0 8px', color: 'var(--text-dim)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>Core Subjects</h4>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Subject</th><th style={{ textAlign: 'center' }}>Enrolled</th></tr></thead>
                <tbody>
                  {subjectEnr?.core.length === 0 && <tr><td colSpan={2} className="sub">No core subjects with enrolled students for {sy}.</td></tr>}
                  {subjectEnr?.core.map((s) => (
                    <tr key={s.id}><td>{s.code} — {s.title}</td><td style={{ textAlign: 'center' }}><strong>{s.enrolled}</strong></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h4 style={{ margin: '0 0 8px', color: 'var(--text-dim)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>Elective Subjects</h4>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Subject</th><th style={{ textAlign: 'center' }}>Enrolled</th></tr></thead>
                <tbody>
                  {subjectEnr?.electives.length === 0 && <tr><td colSpan={2} className="sub">No elective subjects with enrolled students for {sy}.</td></tr>}
                  {subjectEnr?.electives.map((s) => (
                    <tr key={s.id}><td>{s.code} — {s.title}</td><td style={{ textAlign: 'center' }}><strong>{s.enrolled}</strong></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="sub" style={{ marginTop: 10 }}>
          Counts reflect learners whose enrollment records include each subject for {sy}. Only school-offered subjects are shown — manage offerings under Subjects.
        </div>
      </div>

      {/* 7 — Strand Distribution */}
      <div className="card">
        <div className="dashboard-block-head">
          <h3 style={{ margin: 0 }}><GitBranch size={16} /> Enrollment by Strand — {sy}</h3>
          <div className="kpi-row">
            {strandDist?.data?.slice(0, 4).map((s, i) => (
              <StatChip key={i} label={s.strand?.length > 20 ? s.strand.slice(0, 18) + '...' : s.strand} value={s.students} color={CHART_PALETTE[i % CHART_PALETTE.length]} />
            ))}
          </div>
        </div>
{strandDist?.data?.length > 0 ? (
          <div style={{ height: 180, margin: '14px 0' }}>
            <ModernBarChart
              data={strandDist.data}
              categoryKey="strand"
              series={[
                { key: 'grade_11', name: 'Grade 11', color: 'var(--accent-2)' },
                { key: 'grade_12', name: 'Grade 12', color: 'var(--accent)' },
              ]}
              height={180}
              showLabels={false}
              xAngle={-15}
              xHeight={60}
            />
          </div>
        ) : null}
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table>
            <thead><tr><th>Strand</th><th style={{ textAlign: 'center' }}>Students</th><th style={{ textAlign: 'center' }}>Sections</th></tr></thead>
            <tbody>
              {strandDist?.data?.length === 0 && <tr><td colSpan={3} className="sub">No strand data for {sy}.</td></tr>}
              {strandDist?.data?.map((r, i) => (
                <tr key={i}><td>{r.strand}</td><td style={{ textAlign: 'center' }}>{r.students}</td><td style={{ textAlign: 'center' }}>{r.sections}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      </>
      )}
      {tab === 'staff' && (
      <>
      {/* 2 — Student attendance by grade + section */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}><CalendarCheck size={16} /> Student Attendance — {fmtDate(date)}</h3>
        <div className="kpi-row">
          <StatChip label="Present" value={attGroups?.by_grade.reduce((a, g) => a + g.present, 0) ?? 0} color="#2FD6A0" />
          <StatChip label="Late" value={attGroups?.by_grade.reduce((a, g) => a + g.late, 0) ?? 0} color="#F5B942" />
          <StatChip label="Absent" value={attGroups?.by_grade.reduce((a, g) => a + g.absent, 0) ?? 0} color="#F2555A" />
          <StatChip label="Attendance rate" value={attLogged ? Math.round(attRate / attLogged * 100) + '%' : '—'} color="#A78BFA" />
        </div>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr><th>Grade Level</th><th>Section</th><th style={{ textAlign: 'center' }}>Present</th><th style={{ textAlign: 'center' }}>Late</th><th style={{ textAlign: 'center' }}>Absent</th><th style={{ textAlign: 'center' }}>Logged</th></tr>
            </thead>
            <tbody>
              {attGroups?.by_section.length === 0 && (
                <tr><td colSpan={6} className="sub">No attendance recorded for {fmtDate(date)}.</td></tr>
              )}
              {attGroups?.by_section.map((r) => (
                <tr key={r.section_name}>
                  <td>{r.grade_level}</td><td>{r.section_name}</td>
                  <td style={{ textAlign: 'center' }}>{r.present}</td>
                  <td style={{ textAlign: 'center' }}>{r.late}</td>
                  <td style={{ textAlign: 'center' }}>{r.absent}</td>
                  <td style={{ textAlign: 'center' }}>{r.logged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3 — Teacher status for the day */}
      <div className="card">
        <div className="dashboard-block-head">
          <h3 style={{ margin: 0 }}><UserCheck size={16} /> Teacher Status — {fmtDate(date)}</h3>
          <div className="kpi-row">
            <StatChip label="Present" value={teacherStatus?.counts.present ?? 0} color="#2FD6A0" />
            <StatChip label="Absent" value={teacherStatus?.counts.absent ?? 0} color="#F2555A" />
            <StatChip label="On leave" value={teacherStatus?.counts.on_leave ?? 0} color="#4D96FF" />
            <StatChip label="Unmarked" value={teacherStatus?.counts.unmarked ?? 0} color="#8A94A6" />
            <StatChip label="Total" value={teacherStatus?.teachers?.length ?? 0} color="#A78BFA" />
            <StatChip label="Attendance" value={(() => { const p = teacherStatus?.counts.present ?? 0; const a = teacherStatus?.counts.absent ?? 0; const l = teacherStatus?.counts.on_leave ?? 0; const t = p + a + l; return t > 0 ? Math.round(p / t * 100) + '%' : '—'; })()} color="#F5B942" />
          </div>
        </div>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr><th>Teacher</th><th>Position</th><th style={{ textAlign: 'center' }}>Status</th>{canWrite && <th style={{ width: 180 }}></th>}</tr>
            </thead>
            <tbody>
              {teacherStatus?.teachers.length === 0 && (
                <tr><td colSpan={canWrite ? 4 : 3} className="sub">No active teachers recorded.</td></tr>
              )}
              {teacherStatus?.teachers.map((t) => (
                <tr key={t.id}>
                  <td>{t.last_name}, {t.first_name}</td>
                  <td className="sub">{t.position || '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    {t.status_today
                      ? <span className={`badge ${STATUS_COLORS[t.status_today] || 'badge-blue'}`}>{t.status_today.replace('_', ' ')}</span>
                      : <span className="badge badge-gray">unmarked</span>}
                  </td>
                  {canWrite && (
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select
                          className="input"
                          style={{ padding: '5px 8px', fontSize: 12.5 }}
                          defaultValue={t.status_today || ''}
                          onChange={(e) => markTeacher(t.id, e.target.value)}
                          disabled={marking[t.id] === 'busy'}
                        >
                          <option value="" disabled>— set status —</option>
                          {TEACHER_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!canWrite && <div className="sub" style={{ marginTop: 8 }}>Admins can mark teacher status directly from the dropdown above.</div>}
      </div>

      

      {/* 8 — Teacher Workload */}
      <div className="card">
        <div className="dashboard-block-head">
          <h3 style={{ margin: 0 }}><Clock size={16} /> Teacher Workload — {sy}</h3>
          <div className="kpi-row">
            <StatChip label="Teachers" value={teacherWorkload?.data?.length ?? 0} color="#4D96FF" />
            <StatChip label="Avg hrs/wk" value={teacherWorkload?.data?.length ? Math.round(teacherWorkload.data.reduce((a, t) => a + (Number(t.total_minutes_per_week) || 0), 0) / teacherWorkload.data.length / 60 * 10) / 10 : '—'} color="#2FD6A0" />
          </div>
        </div>
        <div className="table-wrap" style={{ marginTop: 12, maxHeight: 320, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr><th>Teacher</th><th>Position</th><th style={{ textAlign: 'center' }}>Sections</th><th style={{ textAlign: 'center' }}>Subjects</th><th style={{ textAlign: 'center' }}>Hours/Week</th></tr>
            </thead>
            <tbody>
              {(!teacherWorkload || teacherWorkload.data.length === 0) && (
                <tr><td colSpan={5} className="sub">No teacher workload data for {sy}.</td></tr>
              )}
              {teacherWorkload?.data.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td className="sub">{t.position || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{t.sections}</td>
                  <td style={{ textAlign: 'center' }}>{t.subjects}</td>
                  <td style={{ textAlign: 'center' }}>{t.total_minutes_per_week ? (Math.round(Number(t.total_minutes_per_week) / 60 * 10) / 10) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      </>
      )}
      {tab === 'career' && (
      <>
      {/* 5 — Work immersion */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}><Briefcase size={16} /> Work Immersion Status by Batch &amp; Partner Institution</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Batch</th><th>Program</th><th>Partner Institution</th><th style={{ textAlign: 'center' }}>Pending</th><th style={{ textAlign: 'center' }}>Ongoing</th><th style={{ textAlign: 'center' }}>Completed</th><th style={{ textAlign: 'center' }}>Withdrawn</th><th style={{ textAlign: 'center' }}>M / F</th><th style={{ textAlign: 'center' }}>Total</th></tr>
            </thead>
            <tbody>
              {(!immersion || immersion.rows.length === 0) && (
                <tr><td colSpan={9} className="sub">No work immersion records yet — add them under Immersion &amp; JDVP.</td></tr>
              )}
              {immersion?.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.batch}</td><td>{r.program}</td><td>{r.partner_institution || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{r.status === 'pending' ? r.learners : 0}</td>
                  <td style={{ textAlign: 'center' }}>{r.status === 'ongoing' ? r.learners : 0}</td>
                  <td style={{ textAlign: 'center' }}>{r.status === 'completed' ? r.learners : 0}</td>
                  <td style={{ textAlign: 'center' }}>{r.status === 'withdrawn' ? r.learners : 0}</td>
                  <td style={{ textAlign: 'center' }} className="sub">{r.male} / {r.female}</td>
                  <td style={{ textAlign: 'center' }}><strong>{r.learners}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6 — JDVP */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}><BadgeCheck size={16} /> JDVP Recipients by Batch &amp; Gender</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Batch</th><th>Program</th><th style={{ textAlign: 'center' }}>Male</th><th style={{ textAlign: 'center' }}>Female</th><th style={{ textAlign: 'center' }}>Total</th><th>Status Breakdown</th></tr>
            </thead>
            <tbody>
              {(!jdvp || jdvp.rows.length === 0) && (
                <tr><td colSpan={6} className="sub">No JDVP recipients recorded yet — add them under Immersion &amp; JDVP.</td></tr>
              )}
              {jdvp?.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.batch}</td><td>{r.program || 'General'}</td>
                  <td style={{ textAlign: 'center' }}>{r.sex === 'Male' ? r.n : 0}</td>
                  <td style={{ textAlign: 'center' }}>{r.sex === 'Female' ? r.n : 0}</td>
                  <td style={{ textAlign: 'center' }}><strong>{r.n}</strong></td>
                  <td><span className={`badge ${STATUS_COLORS[r.status] || 'badge-blue'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      

      

      </>
      )}
      {tab === 'outcomes' && (
      <>
      {/* 9 — Aral Program */}
      <div className="card">
        <div className="dashboard-block-head">
          <h3 style={{ margin: 0 }}><GraduationCap size={16} /> Aral Program Enrollment — {sy}{term ? ` (${term[0].toUpperCase() + term.slice(1)} Term)` : ''}</h3>
          <div className="kpi-row">
            <StatChip label="Aral learners" value={aral?.totals.total ?? 0} color="#A78BFA" />
            <StatChip label="Male" value={aral?.totals.male ?? 0} color="#4D96FF" />
            <StatChip label="Female" value={aral?.totals.female ?? 0} color="#F5B942" />
            <StatChip label="Attendance rate" value={aralAtt?.totals.rate != null ? aralAtt.totals.rate + '%' : '—'} color="#2FD6A0" />
          </div>
        </div>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr><th>Grade Level</th><th>Section</th><th>Strand</th><th style={{ textAlign: 'center' }}>Male</th><th style={{ textAlign: 'center' }}>Female</th><th style={{ textAlign: 'center' }}>Total</th></tr>
            </thead>
            <tbody>
              {(!aral || aral.rows.length === 0) && (
                <tr><td colSpan={6} className="sub">No learners tagged under the Aral Program for {sy}{term ? ` (${term} term)` : ''}.</td></tr>
              )}
              {aral?.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.grade_level}</td><td>{r.section_name}</td><td className="sub">{r.strand || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{r.male}</td>
                  <td style={{ textAlign: 'center' }}>{r.female}</td>
                  <td style={{ textAlign: 'center' }}><strong>{Number(r.male) + Number(r.female)}</strong></td>
                </tr>
              ))}
              {(aral?.totals.total ?? 0) > 0 && (
                <tr className="subtotal-row">
                  <td colSpan={2}><strong>Total Aral Learners</strong></td><td></td>
                  <td style={{ textAlign: 'center' }}><strong>{aral.totals.male}</strong></td>
                  <td style={{ textAlign: 'center' }}><strong>{aral.totals.female}</strong></td>
                  <td style={{ textAlign: 'center' }}><strong>{aral.totals.total}</strong></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 10 — Student progress */}
      <div className="card">
        <div className="dashboard-block-head">
          <h3 style={{ margin: 0 }}><TrendingUp size={16} /> Student Progress — {sy}{term ? ` (${term[0].toUpperCase() + term.slice(1)} Term)` : ''}</h3>
          <div className="kpi-row">
            <StatChip label="Learners" value={progress?.summary.learners ?? 0} color="#4D96FF" />
            <StatChip label="Passing" value={progress?.summary.passing ?? 0} color="#2FD6A0" />
            <StatChip label="At risk" value={progress?.summary.at_risk ?? 0} color="#F2555A" />
            <StatChip label="No grades" value={progress?.summary.no_grades ?? 0} color="#8A94A6" />
            <StatChip label="Aral" value={progress?.summary.aral ?? 0} color="#A78BFA" />
          </div>
        </div>
        <div className="table-wrap" style={{ marginTop: 12, maxHeight: 380, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr><th>Learner</th><th>Grade &amp; Section</th><th>Strand</th><th style={{ textAlign: 'center' }}>Subjects</th><th style={{ textAlign: 'center' }}>Average</th><th style={{ textAlign: 'center' }}>Passed</th><th style={{ textAlign: 'center' }}>Failed</th><th style={{ textAlign: 'center' }}>Status</th></tr>
            </thead>
            <tbody>
              {(!progress || progress.data.length === 0) && (
                <tr><td colSpan={8} className="sub">No enrolled learners with recorded grades for {sy}{term ? ` (${term} term)` : ''}.</td></tr>
              )}
              {progress?.data.slice(0, 100).map((r) => (
                <tr key={r.student_id}>
                  <td>{r.last_name}, {r.first_name}{r.is_aral ? ' ' : ''}{r.is_aral ? <span className="badge badge-blue" style={{ marginLeft: 6 }}>ARAL</span> : null}</td>
                  <td>{r.grade_level} — {r.section_name}</td>
                  <td className="sub">{r.strand || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{r.subjects}</td>
                  <td style={{ textAlign: 'center' }}><strong>{r.average ?? '—'}</strong></td>
                  <td style={{ textAlign: 'center' }} className="sub">{r.passed}</td>
                  <td style={{ textAlign: 'center' }} className="sub">{r.failed}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${r.status === 'passing' ? 'badge-green' : r.status === 'at risk' ? 'badge-red' : 'badge-gray'}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {progress && progress.data.length > 100 && <div className="sub" style={{ marginTop: 6 }}>Showing first 100 of {progress.data.length} learners.</div>}
      </div>

      {/* 10b — Quarterly subject performance (mean, MPS, grade range) */}
      <div className="card">
        <div className="dashboard-block-head">
          <h3 style={{ margin: 0 }}><BarChart3 size={16} /> Quarterly Report — Subject Mean &amp; MPS — {sy}, Q{quarter}</h3>
          <div className="kpi-row">
            <StatChip label="Subjects" value={qReport?.summary?.subjects ?? 0} color="#4D96FF" />
            <StatChip label="Overall mean" value={qReport?.summary?.overall_mean != null ? Number(qReport.summary.overall_mean).toFixed(1) : '—'} color="#2FD6A0" />
            <StatChip label="Overall MPS" value={qReport?.summary?.overall_mps != null ? Number(qReport.summary.overall_mps).toFixed(1) : '—'} color="#A78BFA" />
            <StatChip label="Below 75 in exam" value={qReport?.summary?.below_75_learners ?? 0} color="#F2555A" />
          </div>
        </div>
        <div className="filter-row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap', display: 'flex', alignItems: 'center' }}>
          <div className="seg">
            {[1, 2, 3].map((q) => (
              <button key={q} type="button" className={quarter === q ? 'on' : ''} onClick={() => { setQuarter(q); setQReport(null); }}>Q{q}</button>
            ))}
          </div>
          <select value={qSection} onChange={(e) => { setQSection(e.target.value); setQReport(null); }}>
            <option value="">All sections</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.grade_level} — {s.name}</option>
            ))}
          </select>
        </div>
        <div className="table-wrap" style={{ marginTop: 12, maxHeight: 420, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr><th>Subject</th><th style={{ textAlign: 'center' }}>Students</th><th style={{ textAlign: 'center' }}>Mean Grade</th><th style={{ textAlign: 'center' }}>MPS</th><th style={{ textAlign: 'center' }}>Highest</th><th style={{ textAlign: 'center' }}>Lowest</th><th style={{ textAlign: 'center' }}>Below 75</th></tr>
            </thead>
            <tbody>
              {(!qReport || !qReport.subjects || qReport.subjects.length === 0) && (
                <tr><td colSpan={7} className="sub">No grades recorded{qSection ? ' for the selected section' : ''} in Q{quarter} {sy}.</td></tr>
              )}
              {(qReport?.subjects || []).map((r) => (
                <tr key={r.subject_id}>
                  <td>{r.code ? `${r.code} — ` : ''}{r.title}</td>
                  <td style={{ textAlign: 'center' }}>{r.students}</td>
                  <td style={{ textAlign: 'center' }}><strong>{r.mean != null ? Number(r.mean).toFixed(1) : '—'}</strong></td>
                  <td style={{ textAlign: 'center' }}>{r.mps != null ? Number(r.mps).toFixed(1) : '—'}</td>
                  <td style={{ textAlign: 'center' }}>{r.highest != null ? Number(r.highest).toFixed(1) : '—'}</td>
                  <td style={{ textAlign: 'center' }}>{r.lowest != null ? Number(r.lowest).toFixed(1) : '—'}</td>
                  <td style={{ textAlign: 'center' }}><span className={`badge ${r.below_75 > 0 ? 'badge-red' : 'badge-green'}`}>{r.below_75}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 11 — Aral program attendance (remediation sessions) */}
      <div className="card">
        <div className="dashboard-block-head">
          <h3 style={{ margin: 0 }}><CalendarCheck size={16} /> Aral Program Remediation — {sy}</h3>
          <div className="kpi-row">
            <StatChip label="Sessions" value={aralAtt?.totals.sessions ?? 0} color="#4D96FF" />
            <StatChip label="Present" value={aralAtt?.totals.present ?? 0} color="#2FD6A0" />
            <StatChip label="Absent" value={aralAtt?.totals.absent ?? 0} color="#F2555A" />
            <StatChip label="Excused" value={aralAtt?.totals.excused ?? 0} color="#F5B942" />
            <StatChip label="Attendance rate" value={aralAtt?.totals.rate != null ? aralAtt.totals.rate + '%' : '—'} color="#A78BFA" />
          </div>
        </div>
        <div className="filter-row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap', display: 'flex', alignItems: 'center' }}>
          <select value={aralFilter.area} onChange={(e) => setAralFilter((f) => ({ ...f, area: e.target.value }))}>
            <option value="">All subject areas</option>
            <option value="reading">Reading</option>
            <option value="numeracy">Numeracy</option>
          </select>
          <select value={aralFilter.grade} onChange={(e) => setAralFilter((f) => ({ ...f, grade: e.target.value, section: '' }))}>
            <option value="">All grade levels</option>
            <option value="Grade 11">Grade 11</option>
            <option value="Grade 12">Grade 12</option>
          </select>
          <select value={aralFilter.section} onChange={(e) => setAralFilter((f) => ({ ...f, section: e.target.value }))}>
            <option value="">All sections</option>
            {sections.filter((s) => !aralFilter.grade || s.grade_level === aralFilter.grade).map((s) => (
              <option key={s.id} value={s.id}>{s.grade_level} — {s.name}</option>
            ))}
          </select>
          {canRecordAral && (
            <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={openAralModal}>
              <ClipboardList size={15} /> Record Session
            </button>
          )}
        </div>

        <div className="table-wrap" style={{ marginTop: 12, maxHeight: 320, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr><th>Section</th><th style={{ textAlign: 'center' }}>Learners</th><th style={{ textAlign: 'center' }}>Sessions</th><th style={{ textAlign: 'center' }}>Present</th><th style={{ textAlign: 'center' }}>Absent</th><th style={{ textAlign: 'center' }}>Excused</th><th style={{ textAlign: 'center' }}>Rate</th></tr>
            </thead>
            <tbody>
              {(!aralAtt || aralAtt.per_section.length === 0) && (
                <tr><td colSpan={7} className="sub">No remediation sessions recorded for the selected filters.</td></tr>
              )}
              {aralAtt?.per_section.map((r) => (
                <tr key={r.section_id}>
                  <td>{r.section_name}</td>
                  <td style={{ textAlign: 'center' }}>{r.learners}</td>
                  <td style={{ textAlign: 'center' }}>{r.sessions}</td>
                  <td style={{ textAlign: 'center' }}>{r.present}</td>
                  <td style={{ textAlign: 'center' }}>{r.absent}</td>
                  <td style={{ textAlign: 'center' }}>{r.excused}</td>
                  <td style={{ textAlign: 'center' }}><strong>{r.rate}%</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4 style={{ marginTop: 18, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Target size={15} /> Learner Progress <span className="sub">(baseline → latest assessment)</span>
        </h4>
        <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr><th>Learner</th><th>Grade &amp; Section</th><th>Area</th><th style={{ textAlign: 'center' }}>Baseline</th><th style={{ textAlign: 'center' }}>Latest</th><th style={{ textAlign: 'center' }}>Movement</th><th style={{ textAlign: 'center' }}>Exit</th><th style={{ textAlign: 'center' }}>Attendance</th></tr>
            </thead>
            <tbody>
              {(!aralProg || aralProg.data.length === 0) && (
                <tr><td colSpan={8} className="sub">No Aral learners matched the selected filters.</td></tr>
              )}
              {aralProg?.data.map((r, i) => (
                <tr key={i}>
                  <td>{r.last_name}, {r.first_name}</td>
                  <td>{r.grade_level} — {r.section_name}</td>
                  <td className="sub" style={{ textTransform: 'capitalize' }}>{r.kind}</td>
                  <td style={{ textAlign: 'center' }}>{r.baseline ? `${r.baseline.level}` : '—'}</td>
                  <td style={{ textAlign: 'center' }}>{r.latest ? `${r.latest.level}` : '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${r.movement === 'improved' ? 'badge-green' : r.movement === 'declined' ? 'badge-red' : r.movement === 'stable' ? 'badge-yellow' : 'badge-gray'}`}>{r.movement}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {r.exit_met ? <span className="badge badge-blue">Exit met</span> : <span className="sub">—</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>{r.attendance_rate != null ? r.attendance_rate + '%' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4 style={{ marginTop: 18, marginBottom: 8 }}>Session Log</h4>
        <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr><th>Date</th><th>Section</th><th>Area</th><th style={{ textAlign: 'center' }}>No.</th><th>Tutor</th><th style={{ textAlign: 'center' }}>Present</th><th style={{ textAlign: 'center' }}>Absent</th><th style={{ textAlign: 'center' }}>Excused</th><th style={{ textAlign: 'center' }}>Rate</th></tr>
            </thead>
            <tbody>
              {(!aralAtt || aralAtt.sessions.length === 0) && (
                <tr><td colSpan={9} className="sub">No sessions recorded.</td></tr>
              )}
              {aralAtt?.sessions.map((s) => {
                const total = Number(s.present) + Number(s.absent) + Number(s.excused);
                return (
                  <tr key={s.id}>
                    <td>{fmtDate(s.session_date)}</td>
                    <td>{s.section_name}</td>
                    <td className="sub" style={{ textTransform: 'capitalize' }}>{s.subject_area}</td>
                    <td style={{ textAlign: 'center' }}>{s.session_no || '—'}</td>
                    <td>{s.tutor || '—'}</td>
                    <td style={{ textAlign: 'center' }}>{s.present}</td>
                    <td style={{ textAlign: 'center' }}>{s.absent}</td>
                    <td style={{ textAlign: 'center' }}>{s.excused}</td>
                    <td style={{ textAlign: 'center' }}><strong>{total ? Math.round((Number(s.present) + Number(s.excused)) / total * 100) + '%' : '—'}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="sub" style={{ marginTop: 8 }}>Attendance is tracked per remediation session (date, subject area, tutor).</div>
      </div>

      </>
      )}

      {showAralModal && (
        <Modal title="Record ARAL remediation session" sub={`Session for ${sy} · ${aralForm.section_id ? sections.find((s) => s.id == aralForm.section_id)?.grade_level + ' — ' + sections.find((s) => s.id == aralForm.section_id)?.name : 'select a section'}`} onClose={() => setShowAralModal(false)} wide>
          <form onSubmit={saveAralSession}>
            <div className="grid-2" style={{ marginTop: 10 }}>
              <label>Session date <input type="date" required value={aralForm.session_date} onChange={(e) => setAralForm((f) => ({ ...f, session_date: e.target.value }))} /></label>
              <label>Subject area <select value={aralForm.subject_area} onChange={(e) => setAralForm((f) => ({ ...f, subject_area: e.target.value }))}>
                <option value="reading">Reading</option>
                <option value="numeracy">Numeracy</option>
              </select></label>
              <label>Section <select required value={aralForm.section_id} onChange={(e) => { setAralForm((f) => ({ ...f, section_id: e.target.value })); loadAralRoll(e.target.value); }}>
                <option value="">Select section…</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.grade_level} — {s.name}</option>
                ))}
              </select></label>
              <label>Session no. <input type="number" min="1" value={aralForm.session_no} onChange={(e) => setAralForm((f) => ({ ...f, session_no: e.target.value }))} /></label>
              <label>Tutor <input value={aralForm.tutor} onChange={(e) => setAralForm((f) => ({ ...f, tutor: e.target.value }))} /></label>
              <label>Remarks <input value={aralForm.remarks} onChange={(e) => setAralForm((f) => ({ ...f, remarks: e.target.value }))} /></label>
            </div>
            <h4 style={{ margin: '14px 0 8px' }}>Attendance <span className="sub">({aralRoll.length} learners)</span></h4>
            <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr><th>Learner</th><th style={{ textAlign: 'center' }}>Status</th></tr>
                </thead>
                <tbody>
                  {rollLoading && <tr><td colSpan={2} className="sub">Loading learners…</td></tr>}
                  {!rollLoading && aralRoll.length === 0 && (
                    <tr><td colSpan={2} className="sub">No enrolled learners in this section.</td></tr>
                  )}
                  {aralRoll.map((r) => (
                    <tr key={r.student_id}>
                      <td>{r.name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <select value={r.status} onChange={(e) => setRollStatus(r.student_id, e.target.value)}>
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="excused">Excused</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowAralModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving || !aralForm.section_id}>{saving ? 'Saving…' : 'Save Session'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}