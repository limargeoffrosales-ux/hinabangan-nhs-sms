import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  RefreshCw, Megaphone, CalendarDays, Users, NotebookPen, Clock, ChevronRight,
  GraduationCap, CalendarCheck, BarChart3, ClipboardList,
} from 'lucide-react';
import { api, getCurrentSchoolYear } from '../lib/api';
import { useLinkedStudents } from '../lib/portal';
import PortalNoLinked from '../components/PortalNoLinked';
import { ErrorBanner, Spinner } from '../components/ui';
import { fmt } from '../lib/utils';

const DAY_ORDER = [1, 2, 3, 4, 5];
const DAY_KEY = (d) => ({ 1: 'weekday.mon', 2: 'weekday.tue', 3: 'weekday.wed', 4: 'weekday.thu', 5: 'weekday.fri' }[d]);

export default function Portal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { me, students, loading: meLoading, error: meError } = useLinkedStudents();
  const [studentId, setStudentId] = useState('');
  // Auto-select first linked child once loaded; never overwrite a manual pick.
  useEffect(() => {
    setStudentId((prev) => prev || (students[0] ? String(students[0].id) : ''));
  }, [students]);
  const [sy, setSy] = useState('2026-2027');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [today, setToday] = useState([]);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    getCurrentSchoolYear().then((y) => { if (y) setSy((prev) => (prev === '2026-2027' ? y : prev)); });
  }, []);

  const sidParam = studentId ? `student_id=${studentId}&` : '';

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api(`/portal/overview?school_year=${encodeURIComponent(sy)}`),
      api(`/portal/teacher-contacts?${sidParam}school_year=${encodeURIComponent(sy)}`).catch(() => ({ data: [] })),
      api(`/portal/weekly-schedule?${sidParam}school_year=${encodeURIComponent(sy)}`).catch(() => ({ data: [] })),
      api(`/portal/today-schedule?${sidParam}school_year=${encodeURIComponent(sy)}`).catch(() => ({ data: [] })),
      api(`/portal/upcoming-assignments?${sidParam}school_year=${encodeURIComponent(sy)}`).catch(() => ({ data: [] })),
    ])
      .then(([ov, tc, ws, td, as]) => {
        setData(ov);
        setTeachers(tc.data);
        setWeekly(ws.data);
        setToday(td.data);
        setAssignments(as.data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sidParam, sy]);

  useEffect(() => {
    if (me) load();
  }, [me, sidParam, sy, load]);

  if (meLoading) return <Spinner />;

  const err = meError || error;

  const weeklyByDay = {};
  for (const r of weekly) {
    if (!weeklyByDay[r.day]) weeklyByDay[r.day] = [];
    weeklyByDay[r.day].push(r);
  }

  const isParent = me?.user?.role === 'parent';
  const focusStudent = students.find((s) => String(s.id) === studentId);
  const currentStudent = focusStudent || students.find((s) => s.section);

  const QUICK_LINKS = [
    { to: '/portal/grades', key: 'portal.qGrades', icon: GraduationCap },
    { to: '/portal/schedule', key: 'portal.qSchedule', icon: CalendarDays },
    { to: '/portal/assignments', key: 'portal.qAssignments', icon: NotebookPen },
    { to: '/portal/attendance', key: 'portal.qAttendance', icon: CalendarCheck },
    { to: '/portal/analytics', key: 'portal.qAnalytics', icon: BarChart3 },
    { to: '/portal/enroll', key: 'portal.qEnroll', icon: ClipboardList },
  ];

  return (
    <>
      <div className="portal-hero">
        <h2 style={{ marginTop: 0 }}>
          {isParent ? t('portal.welcomeParent', 'Welcome, Parent') : t('portal.welcome', 'Welcome')}{' '}
          {me?.user?.name?.split(' ')[0] || ''} 👋
        </h2>
        <p className="sub" style={{ margin: 0 }}>
          {isParent
            ? t('portal.linkedStudents', 'You are linked to {{count}} student{{plural}}.', { count: students.length })
            : t('portal.academicOverview', 'Here is your academic overview for this school year.')}
        </p>
      </div>
      <ErrorBanner error={err} />

      {me?.link_request?.status === 'pending' && (
        <div className="notice warn" role="status" style={{ marginBottom: 16 }}>
          {t('portal.linkPending', 'Your portal account is awaiting registrar approval. You will be able to view grades and other records once it is approved.')}
        </div>
      )}
      {me?.link_request?.status === 'rejected' && (
        <div className="notice warn" role="status" style={{ marginBottom: 16 }}>
          {t('portal.linkRejected', 'Your portal account request was not approved{{note}} Contact the school registrar if you believe this is a mistake.', { note: me.link_request.notes ? ` (${me.link_request.notes})` : '' })}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ margin: 0, alignItems: 'end' }}>
          {isParent && students.length > 1 && (
            <div>
              <label>{t('portal.qStudent', 'Student')}</label>
              <select value={studentId} onChange={(e) => setStudentId(e.target.value)} aria-label={t('portal.qStudent', 'Student')}>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} ({s.grade_level})</option>
                ))}
              </select>
            </div>
          )}
          <div><label>{t('portal.schoolYearLabel', 'School year')}</label>
            <input value={sy} onChange={(e) => setSy(e.target.value)} aria-label={t('portal.schoolYearLabel', 'School year')} /></div>
          <button className="btn btn-primary" onClick={load} disabled={loading}><RefreshCw size={14} /> {t('portal.refresh', 'Refresh')}</button>
        </div>
      </div>

      {loading ? <Spinner /> : !data ? <div className="empty">{t('portal.pickSy', 'Set the school year and press Refresh.')}</div> : (
        <>
{data.students.length === 0 ? (
            <PortalNoLinked />
          ) : (
            <>
              <div className="quick-grid" style={{ marginBottom: 18 }}>
                {QUICK_LINKS.map((q) => (
                  <button key={q.to} className="quick-card" onClick={() => navigate(q.to)} aria-label={t(q.key)}>
                    <q.icon size={19} />
                    <span>{t(q.key)}</span>
                  </button>
                ))}
              </div>

              <div className="portal-grid" style={{ marginBottom: 18 }}>
                {data.students.map((s) => (
                  <div className="card" key={s.id}>
                    <h3 style={{ marginTop: 0, marginBottom: 2 }}>
                      {s.last_name}, {s.first_name}{s.middle_name ? ` ${s.middle_name}` : ''}
                    </h3>
                    <p className="sub" style={{ marginTop: 0 }}>
                      {s.grade_level} · {s.section ? s.section.section_name : t('portal.noSection')} · LRN {s.lrn}
                    </p>
                    <div className="form-row" style={{ margin: '10px 0 0', gap: 10 }}>
                      <div className="stat-card"><span className="sub">{t('portal.gwa', 'GWA')}</span><div style={{ fontSize: 19, fontWeight: 700 }}>{fmt(s.gwa)}</div></div>
                      <div className="stat-card"><span className="sub">{t('portal.gpa', 'GPA')}</span><div style={{ fontSize: 19, fontWeight: 700 }}>{fmt(s.gpa)}</div></div>
                      <div className="stat-card"><span className="sub">{t('portal.attendance', 'Attendance')}</span><div style={{ fontSize: 19, fontWeight: 700 }}>{s.attendance?.rate != null ? `${s.attendance.rate}%` : '—'}</div></div>
                    </div>
                    <div className="sub" style={{ marginTop: 10 }}>
                      {t('portal.credits', 'Credits')} {s.credits ? `${s.credits.earned}/${s.credits.total}` : '—'} · P {s.attendance?.counts?.present || 0} A {s.attendance?.counts?.absent || 0} L {s.attendance?.counts?.late || 0} E {s.attendance?.counts?.excused || 0}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}><Clock size={15} style={{ verticalAlign: -2 }} /> {t('portal.today', 'Today')}</h3>
                    <Link to="/portal/schedule" style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--accent)', textDecoration: 'none' }}>
                      {t('portal.viewSchedule', 'View schedule')} <ChevronRight size={12} style={{ verticalAlign: -1 }} />
                    </Link>
                  </div>
                  {today.length === 0 ? (
                    <div className="sub" style={{ marginTop: 8 }}>{t('portal.noToday', 'No classes today.')}</div>
                  ) : (
                    <div style={{ marginTop: 4 }}>
                      {today.map((r, i) => (
                        <div key={i} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ fontWeight: 600 }}>{r.subject_code}</span> — {r.subject_title}
                          <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>{r.start_time?.slice(0, 5)}–{r.end_time?.slice(0, 5)}</span>
                          {r.room && <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>{t('portal.room')} {r.room}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}><NotebookPen size={15} style={{ verticalAlign: -2 }} /> {t('portal.upcoming', 'Upcoming assignments')}</h3>
                    <Link to="/portal/assignments" style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--accent)', textDecoration: 'none' }}>
                      {t('portal.viewAll', 'View all')} <ChevronRight size={12} style={{ verticalAlign: -1 }} />
                    </Link>
                  </div>
                  {assignments.length === 0 ? (
                    <div className="sub" style={{ marginTop: 8 }}>{t('portal.noAssignments', 'Nothing due soon.')}</div>
                  ) : (
                    <div style={{ marginTop: 4 }}>
                      {assignments.map((a) => (
                        <div key={a.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ fontWeight: 600 }}>{a.title}</div>
                          <span style={{ color: 'var(--text-dim)' }}>
                            {a.subject_code} · {a.due_date ? t('portal.due', 'due') + ' ' + new Date(a.due_date).toLocaleDateString() : t('portal.noDue', 'no due date')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
                <div className="card">
                  <h3 style={{ marginTop: 0 }}><CalendarDays size={15} style={{ verticalAlign: -2 }} /> {t('portal.weeklySchedule', 'Weekly Schedule')}</h3>
                  {weekly.length === 0 ? (
                    <div className="sub">{t('portal.noSchedule', 'No schedule available.')}</div>
                  ) : (
                    DAY_ORDER.map((day) => (
                      weeklyByDay[day]?.length ? (
                        <div key={day} style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>{t(DAY_KEY(day))}</div>
                          {weeklyByDay[day].map((r, i) => (
                            <div key={i} style={{ fontSize: 12, padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                              <span style={{ fontWeight: 600 }}>{r.subject_code}</span> — {r.subject_title}
                              <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>{r.start_time?.slice(0, 5)}–{r.end_time?.slice(0, 5)}</span>
                              {r.room && <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>{t('portal.room')} {r.room}</span>}
                              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{r.teacher_name}</div>
                            </div>
                          ))}
                        </div>
                      ) : null
                    ))
                  )}
                </div>

                <div className="card">
                  <h3 style={{ marginTop: 0 }}><Users size={15} style={{ verticalAlign: -2 }} /> {t('portal.teachers', 'Teachers')}</h3>
                  {teachers.length === 0 ? (
                    <div className="sub">{t('portal.noTeacherInfo', 'No teacher info available.')}</div>
                  ) : (
                    teachers.map((t) => (
                      <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {t.last_name}, {t.first_name}
                          {t.is_adviser ? <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: 'rgba(77,150,255,0.12)', color: 'var(--accent)', marginLeft: 6 }}>{t('portal.adviser', 'ADVISER')}</span> : null}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t.subject_code} — {t.subject_title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                          {t.email && <span>✉ {t.email}</span>}
                          {t.email && t.contact && <span style={{ margin: '0 4px' }}>·</span>}
                          {t.contact && <span>☎ {t.contact}</span>}
                          {!t.email && !t.contact && <span style={{ fontStyle: 'italic' }}>{t('portal.noContactInfo', 'No contact info')}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="card">
                <h3 style={{ marginTop: 0 }}><Megaphone size={15} style={{ verticalAlign: -2 }} /> {t('portal.latestAnnouncements', 'Latest announcements')}</h3>
                {data.announcements.length === 0 && <div className="empty">{t('portal.noAnnouncements', 'No announcements yet.')}</div>}
                {data.announcements.map((a) => (
                  <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <strong>{a.title}</strong>
                    <div className="sub" style={{ margin: '2px 0' }}>{a.body}</div>
                    <div className="sub" style={{ fontSize: 11.5 }}>{a.author_name || 'School'} · {new Date(a.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}