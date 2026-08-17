import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ClipboardCheck, NotebookPen } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Empty, ErrorBanner, Spinner, Modal } from '../components/ui';

const KINDS = ['homework', 'classwork', 'quiz', 'activity', 'performance_task', 'project'];

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

function rubricToText(rubric) {
  if (!Array.isArray(rubric) || !rubric.length) return '';
  return rubric.map((c) => `${c.criterion}: ${c.points}`).join('\n');
}

function textToRubric(text) {
  const items = [];
  for (const line of String(text || '').split('\n')) {
    const parts = line.split(':');
    const criterion = (parts[0] || '').trim();
    const points = Number(parts.slice(1).join(':').trim());
    if (criterion && points >= 0) items.push({ criterion, points });
  }
  return items;
}

const emptyForm = {
  title: '',
  kind: 'homework',
  total_points: 20,
  due_date: '',
  description: '',
  allow_late: true,
  rubricText: '',
};

export default function Assignments() {
  const [schoolYear, setSchoolYear] = useState('2026-2027');
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [gradeOpen, setGradeOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [roster, setRoster] = useState(null);
  const [gradeBusy, setGradeBusy] = useState(false);

  async function loadClasses() {
    setLoading(true);
    setError(null);
    try {
      const d = await api(`/assignments/classes?school_year=${encodeURIComponent(schoolYear)}`);
      setClasses(d.data || []);
      if (!classId && d.data.length) setClassId(String(d.data[0].class_assignment_id));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAssignments() {
    if (!classId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await api(`/assignments?class_assignment_id=${classId}`);
      setAssignments(d.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadClasses(); }, [schoolYear]);
  useEffect(() => { loadAssignments(); }, [classId]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(a) {
    setEditing(a);
    setForm({
      title: a.title,
      kind: a.kind,
      total_points: Number(a.total_points),
      due_date: a.due_date || '',
      description: a.description || '',
      allow_late: !!a.allow_late,
      rubricText: rubricToText(a.rubric),
    });
    setFormOpen(true);
  }

  async function saveAssignment(e) {
    e.preventDefault();
    const rubric = textToRubric(form.rubricText);
    const body = {
      title: form.title,
      kind: form.kind,
      total_points: Number(form.total_points),
      due_date: form.due_date || null,
      description: form.description,
      allow_late: form.allow_late,
      rubric,
    };
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await api(`/assignments/${editing.id}`, { method: 'PATCH', body });
      } else {
        await api('/assignments', { method: 'POST', body: { ...body, class_assignment_id: classId } });
      }
      setFormOpen(false);
      await loadAssignments();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment(a) {
    if (!window.confirm(`Delete "${a.title}"? This removes all student submissions.`)) return;
    try {
      await api(`/assignments/${a.id}`, { method: 'DELETE' });
      await loadAssignments();
    } catch (err) {
      setError(err.message);
    }
  }

  async function openGrading(a) {
    setActive(a);
    setRoster(null);
    setGradeOpen(true);
    try {
      const d = await api(`/assignments/${a.id}/submissions`);
      setRoster(d);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveGrade(studentId, row) {
    setGradeBusy(true);
    try {
      await api(`/assignments/${active.id}/submissions/${studentId}`, {
        method: 'PUT',
        body: {
          score: row.score === '' || row.score === null ? null : Number(row.score),
          feedback: row.feedback || null,
          rubric_scores: Array.isArray(row.rubricScores) ? row.rubricScores : null,
        },
      });
      const d = await api(`/assignments/${active.id}/submissions`);
      setRoster(d);
      await loadAssignments();
    } catch (err) {
      setError(err.message);
    } finally {
      setGradeBusy(false);
    }
  }

  async function returnToStudent(studentId, feedback) {
    setGradeBusy(true);
    try {
      await api(`/assignments/${active.id}/submissions/${studentId}/return`, {
        method: 'PUT',
        body: { feedback: feedback || null },
      });
      const d = await api(`/assignments/${active.id}/submissions`);
      setRoster(d);
      await loadAssignments();
    } catch (err) {
      setError(err.message);
    } finally {
      setGradeBusy(false);
    }
  }

  const currentClass = classes.find((c) => String(c.class_assignment_id) === classId);

  return (
    <>
      <PageHead title="Assignments" sub="Homework, quizzes, and performance tasks with student submissions and rubric grading.">
        <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> New assignment</button>
      </PageHead>
      <ErrorBanner error={error} />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ margin: 0, alignItems: 'end' }}>
          <div><label>School year</label>
            <input value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} /></div>
          <div style={{ minWidth: 260 }}><label>Class</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              {!classes.length && <option value="">—</option>}
              {classes.map((c) => (
                <option key={c.class_assignment_id} value={c.class_assignment_id}>
                  {c.section_name} · {c.subject_code} — {c.subject_title}
                </option>
              ))}
            </select>
          </div>
          <button className="btn" onClick={loadAssignments} disabled={loading}>Refresh</button>
        </div>
        {currentClass && <div className="sub" style={{ marginTop: 8 }}>{currentClass.subject_code} · {currentClass.subject_title} — {currentClass.section_name}</div>}
      </div>

      {loading ? <Spinner /> : !classes.length ? (
        <Empty text="No classes found for this school year. Assignments are posted per class (section + subject)." />
      ) : !assignments.length ? (
        <Empty text="No assignments yet for this class. Click “New assignment” to create one." />
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Assignment</th><th>Kind</th><th>Due date</th><th>Points</th><th>Submitted</th><th>Graded</th><th style={{ width: 130 }}></th></tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.title}</strong>
                    {a.description && <div className="sub" style={{ maxWidth: 420 }}>{a.description}</div>}
                  </td>
                  <td><span className={`badge ${KIND_COLOR[a.kind] || 'badge-blue'}`}>{a.kind.replace('_', ' ')}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{a.due_date ? String(a.due_date).slice(0, 10) : 'No due date'}</td>
                  <td>{Number(a.total_points)}</td>
                  <td>{a.submitted_count} / {a.student_count}</td>
                  <td>{a.graded_count}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm btn-primary" onClick={() => openGrading(a)}><ClipboardCheck size={13} /> Grade</button>
                      <button className="icon-btn" onClick={() => openEdit(a)} title="Edit" aria-label="Edit"><Pencil size={14} aria-hidden="true" /></button>
                      <button className="icon-btn" onClick={() => removeAssignment(a)} title="Delete" aria-label="Delete"><Trash2 size={14} aria-hidden="true" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <Modal title={editing ? 'Edit assignment' : 'New assignment'} sub={`Class: ${currentClass ? currentClass.section_name + ' · ' + currentClass.subject_code : ''}`} onClose={() => setFormOpen(false)} wide>
          <form onSubmit={saveAssignment}>
            <label>Title</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required autoFocus />
            <div className="form-row">
              <div style={{ flex: 1 }}><label>Kind</label>
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  {KINDS.map((k) => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div style={{ width: 140 }}><label>Total points</label>
                <input className="input" type="number" min="0" step="0.5" value={form.total_points} onChange={(e) => setForm({ ...form, total_points: e.target.value })} required />
              </div>
              <div style={{ flex: 1 }}><label>Due date</label>
                <input className="input" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>
            <label>Instructions / description</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Explain what students need to do…" />
            <label>Rubric <span className="muted">(optional — one criterion per line: “Criterion: points”)</span></label>
            <textarea className="input" rows={3} value={form.rubricText} onChange={(e) => setForm({ ...form, rubricText: e.target.value })} placeholder={'Content: 12\nClarity: 8'} />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
              <input type="checkbox" checked={form.allow_late} onChange={(e) => setForm({ ...form, allow_late: e.target.checked })} />
              Allow late submissions
            </label>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setFormOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : (editing ? 'Save changes' : 'Create assignment')}</button>
            </div>
          </form>
        </Modal>
      )}

      {gradeOpen && (
        <Modal title={active ? `Grade — ${active.title}` : 'Grade'} sub={active ? `${Number(active.total_points)} points` : ''} onClose={() => setGradeOpen(false)} wide>
          {!roster ? <Spinner /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Student</th><th>Status</th><th>Work</th><th style={{ width: 80 }}>Score</th><th style={{ width: 200 }}>Feedback</th><th style={{ width: 110 }}></th></tr>
                </thead>
                <tbody>
                  {roster.data.map((s) => {
                    const has = !!s.submission_id;
                    const rubricScores = has && active && Array.isArray(active.rubric)
                      ? active.rubric.map((c) => {
                          const saved = (() => {
                            try { return JSON.parse(s.rubric_scores || '[]'); } catch { return []; }
                          })();
                          const hit = saved.find((x) => x.criterion === c.criterion);
                          return { criterion: c.criterion, points: c.points, score: hit ? hit.score : '' };
                        })
                      : null;
                    return (
                      <tr key={s.student_id}>
                        <td>{s.last_name}, {s.first_name}</td>
                        <td>
                          {!has ? <span className="badge badge-yellow">Not submitted</span>
                            : <span className={`badge ${STATUS_BADGE[s.submission_status] || 'badge-blue'}`}>{s.submission_status}</span>}
                        </td>
                        <td>
                          {!has ? <span className="muted">—</span> : (
                            <div style={{ maxWidth: 260 }}>
                              {s.text_content && <div className="sub">{s.text_content}</div>}
                              {s.link_url && <a href={s.link_url} target="_blank" rel="noreferrer" className="muted">Open link</a>}
                            </div>
                          )}
                        </td>
                        <td>
                          {has && <input className="input" type="number" min="0" step="0.5"
                            defaultValue={s.score ?? ''}
                            onBlur={(e) => { s.score = e.target.value; }} />}
                        </td>
                        <td>
                          {has && <input className="input" type="text"
                            defaultValue={s.feedback || ''}
                            placeholder="Feedback…"
                            onBlur={(e) => { s.feedback = e.target.value; }} />}
                        </td>
                        <td>
                          {has && (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button className="btn btn-sm btn-primary" disabled={gradeBusy} onClick={() => saveGrade(s.student_id, s)}>Save</button>
                              {s.submission_status !== 'graded' && (
                                <button className="btn btn-sm" disabled={gradeBusy} onClick={() => returnToStudent(s.student_id, s.feedback)} title="Return for revision">Return</button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {active && Array.isArray(active.rubric) && active.rubric.length > 0 && (
                <div className="sub" style={{ marginTop: 10 }}>
                  Rubric: {active.rubric.map((c) => `${c.criterion} (${c.points})`).join(' · ')}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
