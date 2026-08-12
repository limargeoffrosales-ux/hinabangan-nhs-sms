import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { PageHead, Modal, Empty, ErrorBanner, Spinner, Badge } from '../components/ui';

export default function Enroll() {
  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ student_id: '', section_id: '', school_year: '2026-2027', grade_level: 'Grade 11', strand: '', term: 'first', is_aral: false, status: 'enrolled', enrolled_at: '' });
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [history, setHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [st, se] = await Promise.all([api('/students?limit=200'), api('/sections?limit=200')]);
      setStudents(st.data);
      setSections(se.data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function loadSubjectsFor(gradeLevel, term) {
    try {
      const q = new URLSearchParams({ grade_level: gradeLevel, term, limit: '300' });
      const res = await api(`/subjects?${q}`);
      setSubjects(res.data);
    } catch (e) {
      setError(e.message);
    }
  }

  function onStudentChange(v) {
    const s = students.find((x) => x.id === Number(v));
    setForm((f) => ({ ...f, student_id: v, grade_level: s?.grade_level || f.grade_level, strand: s?.track_strand || f.strand }));
  }

  function onSectionChange(v) {
    const sec = sections.find((x) => x.id === Number(v));
    setForm((f) => ({ ...f, section_id: v, grade_level: sec?.grade_level || f.grade_level, strand: sec?.strand || f.strand }));
  }

  function onTermChange(v) {
    setForm((f) => ({ ...f, term: v }));
    const gradeLevel = form.grade_level;
    if (gradeLevel) loadSubjectsFor(gradeLevel, v);
  }

  useEffect(() => {
    const g = form.grade_level;
    const t = form.term;
    if (g && /^Grade 1[12]$/.test(g)) loadSubjectsFor(g, t);
    else setSubjects([]);
  }, [form.grade_level, form.term]);

  const isShsGrade = /^Grade 1[12]$/.test(form.grade_level || '');
  const byTerm = (s) => s.term === 'all' || s.term === form.term;
  const group = useMemo(() => {
    if (!isShsGrade) return { core: [], academic: [], tvl: [] };
    return {
      core: subjects.filter((s) => byTerm(s) && (s.track === 'general' || s.code.startsWith('SSHS-') || s.code.startsWith('CORE-'))),
      academic: subjects.filter((s) => byTerm(s) && s.track === 'academic' && !s.code.startsWith('SSHS-') && !s.code.startsWith('CORE-')),
      tvl: subjects.filter((s) => byTerm(s) && s.track === 'tvl'),
    };
  }, [subjects, form.term, isShsGrade]);

  function toggleSubject(id) {
    setSelectedSubjects((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));
  }

  function toggleGroup(list) {
    const ids = list.map((s) => s.id);
    const allSelected = ids.every((id) => selectedSubjects.includes(id));
    setSelectedSubjects((sel) => (allSelected ? sel.filter((x) => !ids.includes(x)) : [...new Set([...sel, ...ids])]));
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!form.student_id || !form.section_id) return setError('Select a student and a section.');
    try {
      const selected = students.find((s) => s.id === Number(form.student_id));
      const isShs = /^Grade 1[12]$/.test(form.grade_level || selected?.grade_level || '');
      const body = {
        ...form,
        student_id: Number(form.student_id),
        section_id: Number(form.section_id),
        grade_level: selected?.grade_level || form.grade_level,
        is_aral: form.is_aral,
        subject_ids: isShs ? selectedSubjects : [],
      };
      if (!isShs) delete body.term;
      await api('/enrollments', { method: 'POST', body });
      alert('Student enrolled successfully.');
      setForm((f) => ({ ...f, student_id: '', section_id: '', is_aral: false }));
      setSelectedSubjects([]);
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function viewHistory(s) {
    const res = await api(`/enrollments/student/${s.id}`);
    setHistory({ student: s, rows: res.data });
    setShowHistory(true);
  }

  const eligible = students.filter((s) => s.status === 'enrolled');
  const selectedCount = selectedSubjects.length;

  const CheckGroup = ({ title, items }) => items.length === 0 ? null : (
    <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
      <legend style={{ fontWeight: 600, fontSize: 13, padding: '0 6px' }}>{title} ({items.length})</legend>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
        {items.map((s) => (
          <label key={s.id} className="check-item" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={selectedSubjects.includes(s.id)} onChange={() => toggleSubject(s.id)} />
            <span>{s.code} — {s.title}</span>
          </label>
        ))}
      </div>
      <button type="button" className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => toggleGroup(items)}>
        {items.every((s) => selectedSubjects.includes(s.id)) ? 'Clear all' : 'Select all'}
      </button>
    </fieldset>
  );

  return (
    <>
      <PageHead title="Enrollment" sub="Assign learners to sections with subject checklist (DepEd LRN-based)" />
      <ErrorBanner error={error} />
      {loading ? <Spinner /> : (
        <div className="two-col">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Enroll a Student</h3>
            <form onSubmit={submit}>
              <label>Student</label>
              <select required value={form.student_id} onChange={(e) => onStudentChange(e.target.value)}>
                <option value="">— select learner —</option>
                {eligible.map((s) => (
                  <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} ({s.lrn})</option>
                ))}
              </select>
              <label>Section</label>
              <select required value={form.section_id} onChange={(e) => onSectionChange(e.target.value)}>
                <option value="">— select section —</option>
                {sections.filter((s) => s.status === 'active').map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {s.grade_level} ({s.school_year})</option>
                ))}
              </select>
              <div className="form-row">
                <div>
                  <label>School year</label>
                  <input required value={form.school_year} onChange={(e) => set('school_year', e.target.value)} />
                </div>
                <div>
                  <label>Term (SHS)</label>
                  <select value={form.term} onChange={(e) => onTermChange(e.target.value)} disabled={!isShsGrade}>
                    <option value="first">First Term</option>
                    <option value="second">Second Term</option>
                    <option value="third">Third Term</option>
                  </select>
                  <div className="hint">SHS learners enroll once per term (3× per school year).</div>
                </div>
                <div>
                  <label>Strand (SHS)</label>
                  <input value={form.strand} onChange={(e) => set('strand', e.target.value)} />
                </div>
                <div>
                  <label>Status</label>
                  <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                    <option>enrolled</option><option>provisional</option><option>conditional</option>
                  </select>
                </div>
              </div>

              {isShsGrade ? (
                <>
                  <label style={{ marginTop: 12 }}>
                    <input type="checkbox" checked={form.is_aral} onChange={(e) => set('is_aral', e.target.checked)} style={{ marginRight: 8 }} />
                    Student belongs to the <strong>Aral Program</strong>
                  </label>
                  <div style={{ margin: '12px 0 4px' }}>
                    <label style={{ fontWeight: 600 }}>Enrolled subjects — tick the cores and electives for this term</label>
                    <div className="hint">Filtered by {form.grade_level} · {form.term} term · {selectedCount} selected</div>
                  </div>
                  {group.core.length + group.academic.length + group.tvl.length === 0 ? (
                    <div className="hint">No subjects found for this grade level and term in the catalog.</div>
                  ) : (
                    <>
                      <CheckGroup title="Core Subjects" items={group.core} />
                      <CheckGroup title="Academic Electives" items={group.academic} />
                      <CheckGroup title="TechPro (TVL) Electives" items={group.tvl} />
                    </>
                  )}
                </>
              ) : (
                <div className="hint" style={{ marginTop: 10 }}>Subject checklist is available for Senior High School learners.</div>
              )}

              <div className="modal-actions" style={{ marginTop: 16 }}>
                <button className="btn btn-primary">Enroll student</button>
              </div>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Recently Enrolled</h3>
            {eligible.length === 0 ? <Empty text="No students available." /> : (
              <table>
                <thead>
                  <tr><th>Name</th><th>Grade</th><th></th></tr>
                </thead>
                <tbody>
                  {eligible.slice(0, 8).map((s) => (
                    <tr key={s.id}>
                      <td>{s.last_name}, {s.first_name}</td>
                      <td>{s.grade_level}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-sm" onClick={() => viewHistory(s)}>History</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {showHistory && history && (
        <Modal
          title={`Enrollment History — ${history.student.last_name}, ${history.student.first_name}`}
          sub={`LRN ${history.student.lrn}`}
          onClose={() => setShowHistory(false)}
          wide
        >
          {history.rows.length === 0 ? <Empty text="No enrollment records." /> : (
            <table>
              <thead>
                <tr><th>School Year</th><th>Term</th><th>Section</th><th>Grade</th><th>Aral</th><th>Subjects</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {history.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.school_year}</td>
                    <td>{r.term ? r.term[0].toUpperCase() + r.term.slice(1) : '—'}</td>
                    <td>{r.section_name || '—'}</td>
                    <td>{r.grade_level}</td>
                    <td>{r.is_aral ? <Badge status="aral" /> : '—'}</td>
                    <td style={{ maxWidth: 320 }}>
                      {r.subjects && r.subjects.length ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {r.subjects.map((su) => (
                            <span key={su.subject_id} className="badge badge-blue">{su.code}</span>
                          ))}
                        </div>
                      ) : '—'}
                    </td>
                    <td>{r.status}</td>
                    <td>{r.enrolled_at || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </>
  );
}
