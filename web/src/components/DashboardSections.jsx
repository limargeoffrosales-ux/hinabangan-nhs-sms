import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Users, CalendarCheck, UserCheck, BookOpen, Briefcase, BadgeCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { Empty, Spinner } from './ui';

const WRITE = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'];
const SCHOOL_YEARS = ['2027-2028', '2026-2027', '2025-2026', '2024-2025'];
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
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [attGroups, setAttGroups] = useState(null);
  const [teacherStatus, setTeacherStatus] = useState(null);
  const [subjectEnr, setSubjectEnr] = useState(null);
  const [immersion, setImmersion] = useState(null);
  const [jdvp, setJdvp] = useState(null);
  const [marking, setMarking] = useState({});

  useEffect(() => {
    let dead = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [en, at, ts, se, im, jv] = await Promise.all([
          api(`/dashboard/enrollment?school_year=${encodeURIComponent(sy)}`),
          api(`/dashboard/attendance-groups?date=${encodeURIComponent(date)}`),
          api(`/dashboard/teacher-status?date=${encodeURIComponent(date)}`),
          api(`/dashboard/subject-enrollment?school_year=${encodeURIComponent(sy)}`),
          api('/dashboard/immersion-summary'),
          api('/dashboard/jdvp-summary'),
        ]);
        if (dead) return;
        setEnrollment(en); setAttGroups(at); setTeacherStatus(ts);
        setSubjectEnr(se); setImmersion(im); setJdvp(jv);
      } catch (e) {
        if (!dead) setError(e.message);
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => { dead = true; };
  }, [sy, date]);

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
            Date
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} style={{ marginTop: 4, width: 150 }} />
          </label>
        </div>
      </div>

      {/* 1 — Enrollment data */}
      <div className="card">
        <div className="dashboard-block-head">
          <h3 style={{ margin: 0 }}><Users size={16} /> Enrollment Data — {sy}</h3>
          <div className="kpi-row">
            <StatChip label="Grade 11" value={enrollment?.by_grade?.['Grade 11']?.total ?? 0} color="#4D96FF" />
            <StatChip label="Grade 12" value={enrollment?.by_grade?.['Grade 12']?.total ?? 0} color="#2FD6A0" />
            <StatChip label="Male" value={enrollment?.totals?.male ?? 0} color="#4D96FF" />
            <StatChip label="Female" value={enrollment?.totals?.female ?? 0} color="#F5B942" />
            <StatChip label="Total" value={totalEnrolled} color="#A78BFA" />
          </div>
        </div>
        {chartData.length > 0 && (
          <div style={{ height: 180, margin: '14px 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
                <XAxis dataKey="section" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }} />
                <Bar dataKey="Male" fill="#4D96FF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Female" fill="#F5B942" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
            <StatChip label="Attendance" value={teacherStatus?.teachers?.length ? Math.round((teacherStatus.counts.present / (teacherStatus.counts.present + teacherStatus.counts.absent + teacherStatus.counts.on_leave)) * 100) + '%' : '—'} color="#F5B942" />
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

      {/* 4 — Subject enrollment */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}><BookOpen size={16} /> Students Enrolled per Subject — {sy}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <h4 style={{ margin: '0 0 8px', color: 'var(--text-dim)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>Core Subjects</h4>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Subject</th><th style={{ textAlign: 'center' }}>Enrolled</th></tr></thead>
                <tbody>
                  {subjectEnr?.core.length === 0 && <tr><td colSpan={2} className="sub">No core subjects assigned yet.</td></tr>}
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
                  {subjectEnr?.electives.length === 0 && <tr><td colSpan={2} className="sub">No elective subjects assigned yet.</td></tr>}
                  {subjectEnr?.electives.map((s) => (
                    <tr key={s.id}><td>{s.code} — {s.title}</td><td style={{ textAlign: 'center' }}><strong>{s.enrolled}</strong></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="sub" style={{ marginTop: 10 }}>
          Counts reflect learners enrolled in sections that offer each subject for {sy}. Set subject offerings under Teacher Programs.
        </div>
      </div>

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
  );
}