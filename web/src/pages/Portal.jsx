import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Megaphone, CalendarDays, Users } from 'lucide-react';
import { api, getCurrentSchoolYear } from '../lib/api';
import { useLinkedStudents } from '../lib/portal';
import { ErrorBanner, Spinner } from '../components/ui';
import { fmt } from '../lib/utils';

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Portal() {
  const { t } = useTranslation();
  const { me, students, loading: meLoading, error: meError } = useLinkedStudents();
  const [sy, setSy] = useState('2026-2027');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [weekly, setWeekly] = useState([]);

  useEffect(() => {
    getCurrentSchoolYear().then((y) => { if (y) setSy((prev) => (prev === '2026-2027' ? y : prev)); });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api(`/portal/overview?school_year=${encodeURIComponent(sy)}`),
      api(`/portal/teacher-contacts?school_year=${encodeURIComponent(sy)}`).catch(() => ({ data: [] })),
      api(`/portal/weekly-schedule?school_year=${encodeURIComponent(sy)}`).catch(() => ({ data: [] })),
    ])
      .then(([ov, tc, ws]) => { setData(ov); setTeachers(tc.data); setWeekly(ws.data); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sy]);

  useEffect(() => {
    if (me) load();
  }, [me, sy, load]);

  if (meLoading) return <Spinner />;

  const err = meError || error;

  const weeklyByDay = {};
  for (const r of weekly) {
    if (!weeklyByDay[r.day]) weeklyByDay[r.day] = [];
    weeklyByDay[r.day].push(r);
  }

  return (
    <>
      <div className="portal-hero">
        <h2>{t('portal.welcome', 'Welcome')} {me?.user?.name || 'there'} 👋</h2>
        <p className="sub" style={{ margin: 0 }}>
          {me?.user?.role === 'parent'
            ? t('portal.linkedStudents', 'You are linked to {{count}} student{{plural}}.', { count: students.length })
            : t('portal.academicOverview', 'Here is your academic overview for this school year.')}
        </p>
      </div>
      <ErrorBanner error={err} />

      {me?.user?.role === 'student' && me?.link_request && me?.link_request.status === 'pending' && (
        <div className="notice warn" role="status" style={{ marginBottom: 16 }}>
          {t('portal.linkPending', 'Your portal account is awaiting registrar approval. You will be able to view grades and other records once it is approved.')}
        </div>
      )}
      {me?.user?.role === 'student' && me?.link_request && me?.link_request.status === 'rejected' && (
        <div className="notice warn" role="status" style={{ marginBottom: 16 }}>
          {t('portal.linkRejected', 'Your portal account request was not approved{{note}} Contact the school registrar if you believe this is a mistake.', { note: me.link_request.notes ? ` (${me.link_request.notes})` : '' })}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ margin: 0, alignItems: 'end' }}>
          <div><label>School year</label>
            <input value={sy} onChange={(e) => setSy(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={load} disabled={loading}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      {loading ? <Spinner /> : !data ? <div className="empty">Set the school year and press Refresh.</div> : (
        <>
          {data.students.length === 0 && (
            <div className="empty">
              {me?.user?.role === 'parent'
                ? 'No linked students yet. Ask the school registrar to link your child to your portal account.'
                : 'No student record is linked to this account yet. Ask the school registrar to link your portal account.'}
            </div>
          )}

          <div className="portal-grid" style={{ marginBottom: 18 }}>
            {data.students.map((s) => (
              <div className="card" key={s.id}>
                <h3 style={{ marginTop: 0, marginBottom: 2 }}>
                  {s.last_name}, {s.first_name}{s.middle_name ? ` ${s.middle_name}` : ''}
                </h3>
                <p className="sub" style={{ marginTop: 0 }}>
                  {s.grade_level} · {s.section ? s.section.section_name : 'No active section'} · LRN {s.lrn}
                </p>
                <div className="form-row" style={{ margin: '10px 0 0', gap: 10 }}>
                  <div className="stat-card"><span className="sub">{t('portal.gwa', 'GWA')}</span><div style={{ fontSize: 19, fontWeight: 700 }}>{fmt(s.gwa)}</div></div>
                  <div className="stat-card"><span className="sub">{t('portal.gpa', 'GPA')}</span><div style={{ fontSize: 19, fontWeight: 700 }}>{fmt(s.gpa)}</div></div>
                  <div className="stat-card"><span className="sub">{t('portal.attendance', 'Attendance')}</span><div style={{ fontSize: 19, fontWeight: 700 }}>{s.attendance?.rate != null ? `${s.attendance.rate}%` : '—'}</div></div>
                </div>
                <div className="sub" style={{ marginTop: 10 }}>
                  Credits {s.credits ? `${s.credits.earned}/${s.credits.total}` : '—'} · P {s.attendance?.counts?.present || 0} A {s.attendance?.counts?.absent || 0} L {s.attendance?.counts?.late || 0} E {s.attendance?.counts?.excused || 0}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
            {/* Weekly Schedule */}
            <div className="card">
              <h3 style={{ marginTop: 0 }}><CalendarDays size={15} style={{ verticalAlign: -2 }} /> {t('portal.weeklySchedule', 'Weekly Schedule')}</h3>
              {weekly.length === 0 ? (
                <div className="sub">{t('portal.noSchedule', 'No schedule available.')}</div>
              ) : (
                DAY_ORDER.map((day) => (
                  weeklyByDay[day]?.length ? (
                    <div key={day} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>{day}</div>
                      {weeklyByDay[day].map((r, i) => (
                        <div key={i} style={{ fontSize: 12, padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ fontWeight: 600 }}>{r.subject_code}</span> — {r.subject_title}
                          <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>{r.start_time?.slice(0, 5)}–{r.end_time?.slice(0, 5)}</span>
                          {r.room && <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>Room {r.room}</span>}
                          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{r.teacher_name}</div>
                        </div>
                      ))}
                    </div>
                  ) : null
                ))
              )}
            </div>

            {/* Teacher Contacts */}
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
                      {!t.email && !t.contact && <span style={{ fontStyle: 'italic' }}>No contact info</span>}
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
  );
}
