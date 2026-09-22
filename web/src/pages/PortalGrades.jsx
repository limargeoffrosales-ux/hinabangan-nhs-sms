import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useLinkedStudents } from '../lib/portal';
import { PageHead, Badge, Empty, ErrorBanner, Spinner } from '../components/ui';
import { fmt } from '../lib/utils';

const TERMS = [1, 2, 3];
const G = (v) => (v == null ? '—' : fmt(v));

export default function PortalGrades() {
  const { students, loading: meLoading, error: meError } = useLinkedStudents();
  const [studentId, setStudentId] = useState('');
  // Linked students arrive after mount (fetch), so the old lazy initializer
  // always saw an empty list. Auto-select the first child once they load, and
  // never overwrite a manual choice afterwards.
  useEffect(() => {
    setStudentId((prev) => prev || (students[0] ? String(students[0].id) : ''));
  }, [students]);
  const [sy, setSy] = useState('2026-2027');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    setData(null);
    api(`/portal/report-card-full?student_id=${studentId}&school_year=${encodeURIComponent(sy)}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId, sy]);

  useEffect(() => { load(); }, [load]);

  if (meLoading) return <Spinner />;
  if (!students.length) {
    return (
      <>
        <PageHead title="Grades" sub="Full school-year report cards for your linked students." />
        <div className="empty">No linked students yet. Ask the school registrar to link your portal account.</div>
      </>
    );
  }

  const terms = data?.terms || TERMS.map((t) => ({ term: t, subjects: [], general_average: null }));
  const termMap = {};
  for (const tr of terms) termMap[tr.term] = tr;

  // Matrix: one row per subject (from finals), cells = quarterly grades + final.
  const finals = data?.finals || [];
  const byTermSubject = {};
  for (const tr of terms) {
    for (const s of tr.subjects) {
      byTermSubject[`${s.subject_id}:${tr.term}`] = s;
    }
  }
  const matrix = finals.map((f) => {
    const qs = {};
    for (const t of TERMS) qs[t] = byTermSubject[`${f.subject_id}:${t}`] || null;
    return { ...f, qs };
  });
  const hasAnyGrade = matrix.some((m) => TERMS.some((t) => m.qs[t]?.computed_grade != null));

  return (
    <>
      <PageHead title="Grades" sub="Full school-year report cards with written work, performance tasks and exams." />
      <ErrorBanner error={meError || error} />
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ margin: 0, alignItems: 'end' }}>
          <div><label>Student</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {students.map((s) => <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} ({s.grade_level})</option>)}
            </select>
          </div>
          <div><label>School year</label><input value={sy} onChange={(e) => setSy(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={load} disabled={loading || !studentId}>Load</button>
        </div>
      </div>

      {loading ? <Spinner /> : !data ? <div className="empty">Select a student and press Load.</div> : (
        <>
          {!data.student ? (
            <div className="empty">This student has no records for <strong>{sy}</strong>.</div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ marginTop: 0, marginBottom: 2 }}>
                  {data.student.last_name}, {data.student.first_name}
                  {data.student.middle_name ? ` ${data.student.middle_name}` : ''}
                </h3>
                <p className="sub" style={{ margin: 0 }}>
                  {data.student.grade_level} · {data.student.track_strand || '—'} · LRN {data.student.lrn}
                </p>
                <div className="form-row" style={{ margin: '12px 0 0', gap: 10 }}>
                  <div className="stat-card"><span className="sub">GWA</span><div style={{ fontSize: 20, fontWeight: 700 }}>{G(data.summary?.gwa)}</div></div>
                  <div className="stat-card"><span className="sub">GPA</span><div style={{ fontSize: 20, fontWeight: 700 }}>{G(data.summary?.gpa)}</div></div>
                  <div className="stat-card"><span className="sub">Attendance</span><div style={{ fontSize: 20, fontWeight: 700 }}>{data.attendance?.rate != null ? `${data.attendance.rate}%` : '—'}</div></div>
                  <div className="stat-card"><span className="sub">Credits</span><div style={{ fontSize: 20, fontWeight: 700 }}>{data.summary ? `${data.summary.credits_earned}/${data.summary.credits_total}` : '—'}</div></div>
                </div>
                <div className="sub" style={{ marginTop: 10 }}>
                  P {data.attendance?.counts?.present || 0} · L {data.attendance?.counts?.late || 0} · A {data.attendance?.counts?.absent || 0} · E {data.attendance?.counts?.excused || 0}
                </div>
              </div>

              <div className="card table-wrap" style={{ marginBottom: 16 }}>
                <table>
                  <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Subject</th><th>Code</th>
                    <th style={{ textAlign: 'center' }}>Term 1</th><th style={{ textAlign: 'center' }}>Term 2</th>
                    <th style={{ textAlign: 'center' }}>Term 3</th><th style={{ textAlign: 'center' }}>Final</th>
                    <th style={{ textAlign: 'left' }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((m) => (
                    <tr key={m.subject_id}>
                      <td>{m.title}</td><td style={{ fontSize: 12.5 }}>{m.code}</td>
                      {TERMS.map((t) => {
                        const s = m.qs[t];
                        return (
                          <td key={t} style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 600 }}>{G(s?.computed_grade)}</div>
                            {s?.letter && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{s.letter}</div>}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>
                        {fmt(m.final)}
                        {m.letter && <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 400 }}>{m.letter}</div>}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {m.passed != null
                          ? <Badge status={m.passed ? 'PASSED' : 'FAILED'} />
                          : <span className="sub">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{ fontWeight: 700 }}>General average</td>
                    {TERMS.map((t) => <td key={t} style={{ textAlign: 'center' }}>{G(termMap[t]?.general_average)}</td>)}
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{G(data.summary?.gwa)}</td>
                    <td />
                  </tr>
                </tfoot>
                </table>
              </div>
              {!hasAnyGrade && <Empty text={`No grades recorded for ${sy} yet.`} />}

              <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>Term detail — written work, performance task, exam</h3>
                {TERMS.map((t) => {
                  const tr = termMap[t];
                  const subs = tr ? tr.subjects : [];
                  const withGrades = subs.filter((s) => s.computed_grade != null);
                  return (
                    <div key={t} style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>
                        Term {t} <span className="sub">· GA {G(tr?.general_average)}</span>
                      </div>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left' }}>Subject</th><th>Code</th>
                              <th style={{ textAlign: 'center' }}>Written Work</th><th style={{ textAlign: 'center' }}>Perf Task</th>
                              <th style={{ textAlign: 'center' }}>Exam</th><th style={{ textAlign: 'center' }}>Grade</th>
                              <th style={{ textAlign: 'center' }}>Letter</th>
                            </tr>
                          </thead>
                          <tbody>
                            {subs.map((r) => (
                              <tr key={r.subject_id}>
                                <td>{r.title}</td><td style={{ fontSize: 12.5 }}>{r.code}</td>
                                <td style={{ textAlign: 'center' }}>{G(r.written_work)}</td>
                                <td style={{ textAlign: 'center' }}>{G(r.performance_task)}</td>
                                <td style={{ textAlign: 'center' }}>{G(r.quarterly_exam)}</td>
                                <td style={{ textAlign: 'center', fontWeight: 600 }}>{G(r.computed_grade)}</td>
                                <td style={{ textAlign: 'center' }}>{r.letter || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {!withGrades.length && <Empty text={`No grades recorded for Term ${t} yet.`} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}