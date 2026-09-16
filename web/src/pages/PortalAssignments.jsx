import { useEffect, useState, useCallback } from 'react';
import { Send } from 'lucide-react';
import { api } from '../lib/api';
import { safeHttpUrl } from '../lib/utils';
import { useLinkedStudents } from '../lib/portal';
import { PageHead, Empty, ErrorBanner, Spinner } from '../components/ui';

const KIND_COLOR = {
  homework: 'badge-blue',
  classwork: 'badge-green',
  quiz: 'badge-yellow',
  activity: 'badge-blue',
  performance_task: 'badge-red',
  project: 'badge-red',
};

const STATUS_BADGE = {
  submitted: 'badge-blue',
  graded: 'badge-green',
  returned: 'badge-yellow',
};

function dueLabel(a) {
  if (!a.due_date) return 'No due date';
  const due = new Date(a.due_date + (a.due_date.length === 10 ? 'T23:59:59' : '')).getTime();
  const late = Date.now() > due;
  return `${String(a.due_date).slice(0, 10)}${late && a.submission_status !== 'graded' ? ' · overdue' : ''}`;
}

export default function PortalAssignments() {
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

  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    api(`/assignments/student/${studentId}?school_year=${encodeURIComponent(sy)}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId, sy]);

  useEffect(() => { load(); }, [load]);

  async function submit(a) {
    const d = drafts[a.id] || {};
    if (!d.text && !d.link) return setError('Enter your answer text or a link to your work.');
    setBusyId(a.id);
    setError(null);
    try {
      await api('/assignments/submit', {
        method: 'PUT',
        body: { assignment_id: a.id, student_id: studentId, text_content: d.text || null, link_url: d.link || null },
      });
      setDrafts({});
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  if (meLoading) return <Spinner />;
  if (!students.length) {
    return (
      <>
        <PageHead title="Assignments" sub="Homework and classwork with due dates and scores." />
        <div className="empty">No linked students yet. Ask the school registrar to link your portal account.</div>
      </>
    );
  }

  const rows = data ? data.data : [];

  return (
    <>
      <PageHead title="Assignments" sub="Homework and classwork with due dates, submissions, and scores." />
      <ErrorBanner error={meError || error} />
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ margin: 0, alignItems: 'end' }}>
          <div><label>Student</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {students.map((x) => <option key={x.id} value={x.id}>{x.last_name}, {x.first_name} ({x.grade_level})</option>)}
            </select>
          </div>
          <div><label>School year</label><input value={sy} onChange={(e) => setSy(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={load} disabled={loading || !studentId}>Load</button>
        </div>
      </div>

      {loading ? <Spinner /> : !data ? <div className="empty">Select a student and press Load.</div> : !rows.length ? (
        <Empty text="No assignments posted for this school year yet." />
      ) : (
        <div className="portal-grid">
          {rows.map((a) => {
            const graded = a.submission_status === 'graded';
            const editable = a.submission_status !== 'graded';
            const d = drafts[a.id] || {};
            const rubric = Array.isArray(a.rubric) ? a.rubric : null;
            return (
              <div className="card" key={a.id}>
                <div className="stat-card" style={{ margin: 0, marginBottom: 10 }}>
                  <span className="sub">{a.subject_title || 'Subject'}</span>
                  <div style={{ fontSize: 19, fontWeight: 700 }}>{a.subject_code || '—'}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className={`badge ${KIND_COLOR[a.kind] || 'badge-blue'}`}>{a.kind.replace('_', ' ')}</span>
                  {a.submission_status
                    ? <span className={`badge ${STATUS_BADGE[a.submission_status] || 'badge-blue'}`}>{a.submission_status}</span>
                    : <span className="badge badge-yellow">Not submitted</span>}
                  {graded && <span className="badge badge-green">Score: {Number(a.score)} / {Number(a.total_points)}</span>}
                </div>
                <h3 style={{ margin: '10px 0 4px' }}>{a.title}</h3>
                <div className="sub">{dueLabel(a)} · {Number(a.total_points)} pts · {a.teacher_first ? `${a.teacher_first} ${a.teacher_last}` : 'Teacher'}</div>
                {a.description && <p style={{ margin: '8px 0', fontSize: 13.5 }}>{a.description}</p>}
                {rubric && (
                  <div className="sub" style={{ marginBottom: 8 }}>
                    Rubric: {rubric.map((c) => `${c.criterion} (${c.points})`).join(' · ')}
                  </div>
                )}

                {a.text_content || a.link_url ? (
                  <div className="sub" style={{ margin: '8px 0', padding: 8, background: 'var(--panel-2, rgba(255,255,255,.04))', borderRadius: 6 }}>
                    {a.text_content && <div>{a.text_content}</div>}
                    {a.link_url && safeHttpUrl(a.link_url) && <div><a href={safeHttpUrl(a.link_url)} target="_blank" rel="noreferrer">Open submitted link</a></div>}
                  </div>
                ) : null}

                {graded && a.feedback && (
                  <div className="notice" style={{ marginTop: 8 }}><strong>Teacher feedback:</strong> {a.feedback}</div>
                )}

                {editable && (
                  <div style={{ marginTop: 10 }}>
                    <textarea
                      className="input" rows={3}
                      placeholder="Type your answer here…"
                      defaultValue={a.text_content || ''}
                      onChange={(e) => setDrafts({ ...drafts, [a.id]: { ...d, text: e.target.value } })}
                    />
                    <input
                      className="input" type="text" style={{ marginTop: 8 }}
                      placeholder="Or paste a link to your work (Google Drive, etc.)"
                      defaultValue={a.link_url || ''}
                      onChange={(e) => setDrafts({ ...drafts, [a.id]: { ...d, link: e.target.value } })}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button className="btn btn-primary" disabled={busyId === a.id} onClick={() => submit(a)}>
                        <Send size={14} /> {a.submission_status === 'returned' ? 'Resubmit' : a.submission_status === 'submitted' ? 'Update submission' : 'Submit'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
