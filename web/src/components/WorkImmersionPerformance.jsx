import { useEffect, useState, useCallback } from 'react';
import { Save, Edit, X, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { ErrorBanner, Empty, Spinner, Badge } from './ui';

export default function WorkImmersionPerformance() {
  const [studentId, setStudentId] = useState('');
  const [batch, setBatch] = useState('');
  const [program, setProgram] = useState('');
  const [appraisals, setAppraisals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    performance_level: 'satisfactory',
    competency_rating: '',
    attendance_rate: 0,
    hours_completed: 0,
    strengths: '',
    areas_for_improvement: '',
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Load appraisals
  useEffect(() => {
    (async () => {
      try {
        const r = await api('/immersion/tracking/performance?limit=200');
        setAppraisals(r.data || []);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  // Load student batch/program when student changes
  useEffect(() => {
    if (!studentId) {
      setBatch('');
      setProgram('');
      return;
    }
    (async () => {
      try {
        const r = await api(`/students/${studentId}`);
        const student = r.data;
        if (student) {
          setBatch(student.batch || '');
          setProgram(student.program || '');
        }
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [studentId]);

  const handleSave = useCallback(async () => {
    if (!studentId || !batch || !program) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        // Update existing appraisal
        await api(`/immersion/tracking/performance/${editingId}`, {
          method: 'PATCH',
          body: { ...form, student_id: studentId },
        });
        setEditingId(null);
      } else {
        // Create new appraisal
        await api('/immersion/tracking/performance', {
          method: 'POST',
          body: { ...form, student_id: studentId, batch, program },
        });
      }
      setForm({
        date: new Date().toISOString().slice(0, 10),
        performance_level: 'satisfactory',
        competency_rating: '',
        attendance_rate: 0,
        hours_completed: 0,
        strengths: '',
        areas_for_improvement: '',
      });
      setShowForm(false);
      setSaving(false);
      // Refresh appraisals
      const r = await api('/immersion/tracking/performance?limit=200');
      setAppraisals(r.data || []);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }, [studentId, batch, program, editingId, form]);

  const handleDelete = useCallback(async (id) => {
    if (!confirm('Are you sure you want to delete this performance appraisal?')) return;
    try {
      await api(`/immersion/tracking/performance/${id}`, { method: 'DELETE' });
      const r = await api('/immersion/tracking/performance?limit=200');
      setAppraisals(r.data || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  return (
    <>
      <ErrorBanner error={error} />

      {/* Form Section */}
      {showForm && (
        <div style={{ marginBottom: 24, padding: 20, border: '1px solid var(--border)', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 16 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{editingId ? 'Edit' : 'Add'} Performance Appraisal</span>
            <button className="btn btn-sm btn-link" onClick={() => setShowForm(false)}>Close</button>
          </h3>
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSave();
            }}
          >
            <div style={{ display: 'grid', gap: 16, marginBottom: 16 }}>
              <div>
                <label>Student</label>
                <input
                  type="text"
                  value={studentId ? 'Loading...' : ''}
                  readOnly
                  style={{ width: '100%' }}
                />
                <button
                  className="btn btn-link text-primary"
                  onClick={() => setStudentId('')
                }
                >
                  Change
                </button>
              </div>

              <div>
                <label>Batch</label>
                <input
                  type="text"
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label>Program</label>
                <input
                  type="text"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label>Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label>Performance Level</label>
                <select
                  value={form.performance_level}
                  onChange={(e) =>
                    setForm({ ...form, performance_level: e.target.value })
                  }
                  style={{ width: '100%' }}
                >
                  <option value="outstanding">Outstanding</option>
                  <option value="satisfactory" selected>
                    Satisfactory
                  </option>
                  <option value="needs_improvement">
                    Needs Improvement
                  </option>
                </select>
              </div>

              <div>
                <label>Compency Rating</label>
                <input
                  type="text"
                  value={form.competency_rating || ''}
                  onChange={(e) =>
                    setForm({ ...form, competency_rating: e.target.value })
                  }
                  placeholder="e.g., communication, teamwork, technical skills"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label>Attendance Rate (%)</label>
                <input
                  type="number"
                  value={form.attendance_rate || 0}
                  onChange={(e) =>
                    setForm({ ...form, attendance_rate: Number(e.target.value) })
                  }
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label>Hours Completed</label>
                <input
                  type="number"
                  value={form.hours_completed || 0}
                  onChange={(e) =>
                    setForm({ ...form, hours_completed: Number(e.target.value) })
                  }
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label>Strengths</label>
                <input
                  type="text"
                  value={form.strengths || ''}
                  onChange={(e) =>
                    setForm({ ...form, strengths: e.target.value })
                  }
                  placeholder="e.g., good communication, strong technical skills"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label>Areas for Improvement</label>
                <input
                  type="text"
                  value={form.areas_for_improvement || ''}
                  onChange={(e) =>
                    setForm({ ...form, areas_for_improvement: e.target.value })
                  }
                  placeholder="e.g., needs to improve participation"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="submit" disabled={saving}>
                {editingId ? 'Update' : 'Save'}
              </button>
              <button
                type="button"
                className="btn btn-link text-secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Appraisals Table */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ margin: '0 0 12 0' }}>
          Performance Appraisals
          {studentId && (
            <span style={{ float: 'right', color: 'var(--text-dim)', fontSize: 12 }}>
              Total: {appraisals.length}
            </span>
          )}
        </h3>

        {loading && <Spinner />}

        {!loading && appraisals.length === 0 && (
          <Empty
            text="No performance appraisals found. Add one using the form above."
          />)
        }

        {!loading && appraisals.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Batch</th>
                  <th>Program</th>
                  <th>Date</th>
                  <th>Performance Level</th>
                  <th>Attendance Rate</th>
                  <th>Hours Completed</th>
                  <th>Strengths</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appraisals.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.student_name || '—'}
                      <br />
                      <small style={{ color: 'var(--text-dim)' }}>
                        LRN: {a.lrn || '—'}
                      </small>
                    </td>
                    <td>{a.batch || '—'}</td>
                    <td>{a.program || '—'}</td>
                    <td>{a.appraisal_date || '—'}</td>
                    <td>
                      <Badge
                        status={a.performance_level}
                        size="small"
                      >
                        {a.performance_level}
                      </Badge>
                    </td>
                    <td>{a.attendance_rate || 0}%</td>
                    <td>{a.hours_completed || 0} hrs</td>
                    <td style={{ maxWidth: '200px' }}>
                      {a.strengths || '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        className="btn btn-sm btn-link text-primary"
                        onClick={() =>
                          setForm({
                            date: a.appraisal_date || new Date().toISOString().slice(0, 10),
                            performance_level: a.performance_level,
                            competency_rating: a.competency_rating || '',
                            attendance_rate: a.attendance_rate || 0,
                            hours_completed: a.hours_completed || 0,
                            strengths: a.strengths || '',
                            areas_for_improvement: a.areas_for_improvement || '',
                          }),
                          setEditingId(a.id)
                        }
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-link text-danger"
                        onClick={() => handleDelete(a.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>)
        }
      </div>
    </>
  );
}