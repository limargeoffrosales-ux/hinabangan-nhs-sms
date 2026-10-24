import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useLinkedStudents } from '../lib/portal';
import { PageHead, Badge, Empty, ErrorBanner, Spinner } from '../components/ui';
import { fmt } from '../lib/utils';

function Section({ title, children }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  );
}

export default function ParentPortal() {
  const { students, loading: meLoading, error: meError } = useLinkedStudents();
  const [studentId, setStudentId] = useState('');
  const [profile, setProfile] = useState(null);
  const [grades, setGrades] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [interventions, setInterventions] = useState(null);
  const [consents, setConsents] = useState(null);
  const [accessLogs, setAccessLogs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('grades');

  useEffect(() => {
    setStudentId((prev) => prev || (students[0] ? String(students[0].id) : ''));
  }, [students]);

  const load = useCallback(() => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    setAccessLogs(null);
    Promise.all([
      api(`/parent/students/${studentId}`),
      api(`/parent/students/${studentId}/grades`),
      api(`/parent/students/${studentId}/attendance`),
      api(`/parent/students/${studentId}/interventions`),
      api(`/parent/students/${studentId}/consents`),
    ])
      .then(([p, g, a, i, c]) => {
        setProfile(p?.data || null);
        setGrades(g?.data || []);
        setAttendance(a?.data || []);
        setInterventions(i?.data || []);
        setConsents(c?.data || []);
      })
      .catch((e) => setError(e.message || 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  function loadLogs() {
    if (!studentId) return;
    api(`/parent/access-logs`)
      .then((r) => setAccessLogs(r?.data || []))
      .catch((e) => setError(e.message || 'Failed to load access logs'));
  }

  useEffect(() => { if (tab === 'logs' && accessLogs === null) loadLogs(); }, [tab, studentId]);

  if (meLoading) return <Spinner />;
  if (!students.length) {
    return (
      <>
        <PageHead title="Parent Portal" sub="Monitor your children's school records." />
        <div className="empty">No linked students yet. Ask the school registrar to link your portal account to your children.</div>
      </>
    );
  }

  const current = students.find((s) => String(s.id) === String(studentId));

  return (
    <>
      <PageHead title="Parent Portal" sub="Monitor your children's school records. All data is limited to your linked children." />
      <ErrorBanner error={meError || error} />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ margin: 0, alignItems: 'end' }}>
          <div>
            <label htmlFor="parent-child">Child</label>
            <select id="parent-child" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} ({s.grade_level})</option>
              ))}
            </select>
          </div>
          {current?.section_name && (
            <div className="stat-card" style={{ marginBottom: 0 }}>
              <span className="sub">Section</span>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{current.section_name}</div>
            </div>
          )}
          <button className="btn btn-primary" onClick={load} disabled={loading || !studentId}>
            {loading ? 'Loading…' : 'Reload'}
          </button>
        </div>
      </div>

      <div className="dash-tabs" role="tablist" aria-label="Parent portal sections" style={{ marginBottom: 16 }}>
        {[
          ['grades', 'Grades'],
          ['attendance', 'Attendance'],
          ['progress', 'Interventions'],
          ['consents', 'Consents'],
          ['logs', 'Access logs'],
        ].map(([key, label]) => (
          <button key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)} role="tab" aria-selected={tab === key}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          {tab === 'grades' && (
            <Section title={`Grades${current ? ` — ${current.last_name}, ${current.first_name}` : ''}`}>
              {!grades.length ? <Empty text="No grades recorded yet." /> : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>School year</th><th>Q</th><th>Code</th><th>Subject</th>
                        <th style={{ textAlign: 'center' }}>Written</th><th style={{ textAlign: 'center' }}>Perf</th>
                        <th style={{ textAlign: 'center' }}>Exam</th><th style={{ textAlign: 'center' }}>Grade</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grades.map((g, i) => (
                        <tr key={i}>
                          <td>{g.school_year}</td>
                          <td style={{ textAlign: 'center' }}>{g.quarter}</td>
                          <td style={{ fontSize: 12.5 }}>{g.code}</td>
                          <td>{g.subject_name}</td>
                          <td style={{ textAlign: 'center' }}>{fmt(g.written_work)}</td>
                          <td style={{ textAlign: 'center' }}>{fmt(g.performance_task)}</td>
                          <td style={{ textAlign: 'center' }}>{fmt(g.quarterly_exam)}</td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{fmt(g.computed_grade)}</td>
                          <td>{g.remarks ? <Badge status={g.remarks} /> : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}

          {tab === 'attendance' && (
            <Section title="Attendance">
              {!attendance.length ? <Empty text="No attendance records." /> : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Date</th><th>Status</th><th>Time in</th><th>Time out</th><th>Remarks</th></tr>
                    </thead>
                    <tbody>
                      {attendance.map((a, i) => (
                        <tr key={i}>
                          <td>{a.date ? String(a.date).slice(0, 10) : '—'}</td>
                          <td><Badge status={a.status} /></td>
                          <td>{a.time_in ? String(a.time_in).slice(11, 19) : '—'}</td>
                          <td>{a.time_out ? String(a.time_out).slice(11, 19) : '—'}</td>
                          <td>{a.remarks || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}

          {tab === 'progress' && (
            <Section title="Interventions & progress">
              {!interventions.length ? <Empty text="No intervention plans on file." /> : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Title</th><th>Category</th><th>Status</th><th>Frequency</th><th>Recorded by</th><th>Updated</th></tr>
                    </thead>
                    <tbody>
                      {interventions.map((p) => (
                        <tr key={p.id}>
                          <td>{p.title}</td>
                          <td>{p.category}</td>
                          <td><Badge status={p.status} /></td>
                          <td>{p.frequency || '—'}</td>
                          <td>{p.recorder_name || '—'}</td>
                          <td>{p.updated_at ? String(p.updated_at).slice(0, 10) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}

          {tab === 'consents' && (
            <Section title="Consent forms">
              {!consents.length ? <Empty text="No active consent forms." /> : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Form</th><th>Type</th><th>Status</th><th>Signed</th></tr>
                    </thead>
                    <tbody>
                      {consents.map((c) => (
                        <tr key={c.id}>
                          <td>{c.title}</td>
                          <td>{c.form_type}</td>
                          <td><Badge status={c.status || 'unsigned'} /></td>
                          <td>{c.signed_at ? String(c.signed_at).slice(0, 10) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}

          {tab === 'logs' && (
            <Section title="Access logs">
              <p className="sub" style={{ marginTop: 0 }}>Latest record-access log entries involving your children. Only you see this.</p>
              {accessLogs === null ? <p><button className="btn" onClick={loadLogs}>Load access logs</button></p>
                : !accessLogs.length ? <Empty text="No access-log entries for your children." /> : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Date</th><th>Action</th><th>User</th><th>Student</th><th>IP</th></tr>
                    </thead>
                    <tbody>
                      {accessLogs.map((l) => (
                        <tr key={l.id}>
                          <td>{String(l.created_at).slice(0, 16)}</td>
                          <td>{l.action}</td>
                          <td>{l.user_name || `#${l.user_id || ''}`}</td>
                          <td>{l.first_name ? `${l.last_name}, ${l.first_name}` : `#${l.student_id || ''}`}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{l.ip || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}
        </>
      )}
    </>
  );
}