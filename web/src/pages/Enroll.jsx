import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { PageHead, Modal, Empty, ErrorBanner, Spinner } from '../components/ui';

export default function Enroll() {
  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ student_id: '', section_id: '', school_year: '2025-2026', grade_level: 'Grade 11', strand: '', status: 'enrolled', enrolled_at: '' });
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(null);

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

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!form.student_id || !form.section_id) return setError('Select a student and a section.');
    try {
      const selected = students.find((s) => s.id === Number(form.student_id));
      await api('/enrollments', {
        method: 'POST',
        body: { ...form, student_id: Number(form.student_id), section_id: Number(form.section_id), grade_level: selected?.grade_level || form.grade_level },
      });
      alert('Student enrolled successfully.');
      setForm((f) => ({ ...f, student_id: '', section_id: '' }));
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function viewHistory(s) {
    const res = await api(`/enrollments/student/${s.id}`);
    setShowHistory({ student: s, rows: res.data });
  }

  const eligible = students.filter((s) => s.status === 'enrolled');

  return (
    <>
      <PageHead title="Enrollment" sub="Assign learners to sections for the current school year (DepEd LRN-based)" />
      <ErrorBanner error={error} />
      {loading ? <Spinner /> : (
        <div className="two-col">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Enroll a Student</h3>
            <form onSubmit={submit}>
              <label>Student</label>
              <select required value={form.student_id} onChange={(e) => set('student_id', e.target.value)}>
                <option value="">— select learner —</option>
                {eligible.map((s) => (
                  <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} ({s.lrn})</option>
                ))}
              </select>
              <label>Section</label>
              <select required value={form.section_id} onChange={(e) => set('section_id', e.target.value)}>
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

      {showHistory && (
        <Modal
          title={`Enrollment History — ${showHistory.student.last_name}, ${showHistory.student.first_name}`}
          sub={`LRN ${showHistory.student.lrn}`}
          onClose={() => setShowHistory(null)}
        >
          {showHistory.rows.length === 0 ? <Empty text="No enrollment records." /> : (
            <table>
              <thead>
                <tr><th>School Year</th><th>Section</th><th>Grade</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {showHistory.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.school_year}</td>
                    <td>{r.section_name || '—'}</td>
                    <td>{r.grade_level}</td>
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
