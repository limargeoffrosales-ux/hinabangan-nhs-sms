import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useLinkedStudents } from '../lib/portal';
import { PageHead, Badge, Empty, ErrorBanner, Spinner } from '../components/ui';
import { fmt } from '../lib/utils';

export default function PortalGrades() {
  const { students, loading: meLoading, error: meError } = useLinkedStudents();
  const [studentId, setStudentId] = useState(() => students[0] ? String(students[0].id) : '');
  const [sy, setSy] = useState('2026-2027');
  const [term, setTerm] = useState('1');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    setData(null);
    api(`/grades/report-card/${studentId}?school_year=${encodeURIComponent(sy)}&term=${term}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId, term, sy]);

  useEffect(() => { load(); }, [load]);

  if (meLoading) return <Spinner />;
  if (!students.length) {
    return (
      <>
        <PageHead title="Grades" sub="Report cards for your linked students." />
        <div className="empty">No linked students yet. Ask the school registrar to link your portal account.</div>
      </>
    );
  }

  return (
    <>
      <PageHead title="Grades" sub="Quarterly report cards with written work, performance tasks and exams." />
      <ErrorBanner error={meError || error} />
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ margin: 0, alignItems: 'end' }}>
          <div><label>Student</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {students.map((s) => <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} ({s.grade_level})</option>)}
            </select>
          </div>
          <div><label>School year</label><input value={sy} onChange={(e) => setSy(e.target.value)} /></div>
          <div><label>Quarter</label>
              <select value={term} onChange={(e) => setTerm(e.target.value)}>
              <option value="1">Quarter 1</option><option value="2">Quarter 2</option><option value="3">Quarter 3</option><option value="4">Quarter 4</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={load} disabled={loading || !studentId}>Load</button>
        </div>
      </div>

      {loading ? <Spinner /> : !data ? <div className="empty">Select a student and press Load.</div> : (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{data.student.last_name}, {data.student.first_name}
            <span style={{ fontWeight: 400, color: 'var(--text-dim)', fontSize: 13 }}> · {data.school_year} · Quarter {data.quarter} · {data.scale?.name || 'No scale'}</span>
          </h3>
          <div className="form-row" style={{ margin: '8px 0 14px' }}>
            <div className="stat-card"><span className="sub">General average</span><div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(data.general_average)}</div></div>
            <div className="stat-card"><span className="sub">GPA</span><div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(data.gpa)}</div></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Subject</th><th>Code</th>
                  <th style={{ textAlign: 'center' }}>Written Work</th><th style={{ textAlign: 'center' }}>Perf Task</th>
                  <th style={{ textAlign: 'center' }}>Exam</th><th style={{ textAlign: 'center' }}>Grade</th>
                  <th style={{ textAlign: 'center' }}>Letter</th><th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {data.subjects.map((r) => (
                  <tr key={r.subject_id}>
                    <td>{r.title}</td><td style={{ fontSize: 12.5 }}>{r.code}</td>
                    <td style={{ textAlign: 'center' }}>{fmt(r.written_work)}</td>
                    <td style={{ textAlign: 'center' }}>{fmt(r.performance_task)}</td>
                    <td style={{ textAlign: 'center' }}>{fmt(r.quarterly_exam)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{fmt(r.computed_grade)}</td>
                    <td style={{ textAlign: 'center' }}>{r.letter || '—'}</td>
                    <td>{r.remarks ? <Badge status={r.remarks} /> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.subjects.length && <Empty text="No grades recorded for this quarter yet." />}
          </div>
        </div>
      )}
    </>
  );
}
