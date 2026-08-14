import { useEffect, useState } from 'react';
import { RefreshCw, Megaphone } from 'lucide-react';
import { api } from '../lib/api';
import { useLinkedStudents } from '../lib/portal';
import { ErrorBanner, Spinner } from '../components/ui';

function fmt(n) { return n == null ? '—' : Number(n); }

export default function Portal() {
  const { me, students, loading: meLoading, error: meError } = useLinkedStudents();
  const [sy, setSy] = useState('2026-2027');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    api(`/portal/overview?school_year=${encodeURIComponent(sy)}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (me) load();
  }, [me]);

  if (meLoading) return <Spinner />;

  const err = meError || error;
  return (
    <>
      <div className="portal-hero">
        <h2>Welcome, {me?.user?.name || 'there'} 👋</h2>
        <p className="sub" style={{ margin: 0 }}>
          {me?.user?.role === 'parent'
            ? `You are linked to ${students.length} student${students.length === 1 ? '' : 's'}.`
            : 'Here is your academic overview for this school year.'}
        </p>
      </div>
      <ErrorBanner error={err} />

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
                  <div className="stat-card"><span className="sub">GWA</span><div style={{ fontSize: 19, fontWeight: 700 }}>{fmt(s.gwa)}</div></div>
                  <div className="stat-card"><span className="sub">GPA</span><div style={{ fontSize: 19, fontWeight: 700 }}>{fmt(s.gpa)}</div></div>
                  <div className="stat-card"><span className="sub">Attendance</span><div style={{ fontSize: 19, fontWeight: 700 }}>{s.attendance?.rate != null ? `${s.attendance.rate}%` : '—'}</div></div>
                </div>
                <div className="sub" style={{ marginTop: 10 }}>
                  Credits {s.credits ? `${s.credits.earned}/${s.credits.total}` : '—'} · P {s.attendance?.counts?.present || 0} A {s.attendance?.counts?.absent || 0} L {s.attendance?.counts?.late || 0} E {s.attendance?.counts?.excused || 0}
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}><Megaphone size={15} style={{ verticalAlign: -2 }} /> Latest announcements</h3>
            {data.announcements.length === 0 && <div className="empty">No announcements yet.</div>}
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
