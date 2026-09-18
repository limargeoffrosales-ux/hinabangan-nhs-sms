import { useEffect, useState, useCallback } from 'react';
import { AlertCircle, CheckCircle, X, Save, Search } from 'lucide-react';
import { api } from '../lib/api';
import { ErrorBanner, Empty, Spinner, Badge } from './ui';

export default function WorkImmersionIssues() {
  const [studentId, setStudentId] = useState('');
  const [batch, setBatch] = useState('');
  const [program, setProgram] = useState('');
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    issue_type: 'safety',
    severity: 'medium',
    description: '',
    reported_date: new Date().toISOString().slice(0, 10),
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Load issues
  useEffect(() => {
    (async () => {
      try {
        const r = await api('/immersion/tracking/issues?limit=200');
        setIssues(r.data || []);
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
    if (!studentId) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        // Update existing issue
        await api(`/immersion/tracking/issues/${editingId}`, {
          method: 'PATCH',
          body: { ...form, student_id: studentId },
        });
        setEditingId(null);
      } else {
        // Create new issue
        await api('/immersion/tracking/issues', {
          method: 'POST',
          body: { ...form, student_id: studentId, batch, program },
        });
      }
      setForm({
        issue_type: 'safety',
        severity: 'medium',
        description: '',
        reported_date: new Date().toISOString().slice(0, 10),
      });
      setShowForm(false);
      setSaving(false);
      // Refresh issues
      const r = await api('/immersion/tracking/issues?limit=200');
      setIssues(r.data || []);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }, [studentId, editingId, form]);

  const handleDelete = useCallback(async (id) => {
    if (!confirm('Are you sure you want to delete this issue report?')) return;
    try {
      await api(`/immersion/tracking/issues/${id}`, { method: 'DELETE' });
      const r = await api('/immersion/tracking/issues?limit=200');
      setIssues(r.data || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const issueTypes = [
    { value: 'safety', label: 'Safety' },
    { value: 'security', label: 'Security' },
    { value: 'behavioral', label: 'Behavioral' },
    { value: 'academic', label: 'Academic' },
    { value: 'other', label: 'Other' },
  ];

  const severities = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium', selected: true },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ];

  return (
    <>
      <ErrorBanner error={error} />

      {/* Form Section */}
      {showForm && (
        <div style={{ marginBottom: 24, padding: 20, border: '1px solid var(--border)', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 16 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{editingId ? 'Edit' : 'Report'} Issue</span>
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
                <label>Issue Type</label>
                <select
                  value={form.issue_type}
                  onChange={(e) => setForm({ ...form, issue_type: e.target.value })}
                  style={{ width: '100%' }}
                >
                  {issueTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Severity</label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value })}
                  style={{ width: '100%' }}
                >
                  {severities.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Description</label>
                <textarea
                  value={form.description || ''}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Describe the issue or concern"
                  rows={3}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label>Reported Date</label>
                <input
                  type="date"
                  value={form.reported_date}
                  onChange={(e) => setForm({ ...form, reported_date: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="submit" disabled={saving}>
                {editingId ? 'Update' : 'Submit'}
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

      {/* Issues Table */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ margin: '0 0 12 0' }}>
          Issue Reports
          {studentId && (
            <span style={{ float: 'right', color: 'var(--text-dim)', fontSize: 12 }}>
              Total: {issues.length}
            </span>
          )}
        </h3>

        {loading && <Spinner />}

        {!loading && issues.length === 0 && (
          <Empty
            text="No issue reports found. Submit one using the form above."
          />)
        }

        {!loading && issues.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Issue Type</th>
                  <th>Severity</th>
                  <th>Reported Date</th>
                  <th>Resolved</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((i) => (
                  <tr key={i.id}>
                    <td>
                      {i.student_name || '—'}
                      <br />
                      <small style={{ color: 'var(--text-dim)' }}>
                        LRN: {i.lrn || '—'}
                      </small>
                    </td>
                    <td>
                      <Badge
                        status={i.issue_type}
                        size="small"
                      >
                        {i.issue_type}
                      </Badge>
                    </td>
                    <td>
                      <Badge
                        status={i.severity}
                        size="small"
                      >
                        {i.severity}
                      </Badge>
                    </td>
                    <td>{i.reported_date || '—'}</td>
                    <td>
                      {i.resolved ? (
                        <Badge status="success" size="small">
                          ✓ Resolved
                        </Badge>
                      ) : (
                        <Badge status="critical" size="small">✗ Open</Badge>
                      )}
                    </td>
                    <td style={{ maxWidth: '250px' }}>
                      {i.description ? i.description.substring(0, 100) + '...' : '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        className="btn btn-sm btn-link text-primary"
                        onClick={() =>
                          setForm({
                            issue_type: i.issue_type,
                            severity: i.severity,
                            description: i.description || '',
                            reported_date: i.reported_date || new Date().toISOString().slice(0, 10),
                          }),
                          setEditingId(i.id)
                        }
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-link text-danger"
                        onClick={() => handleDelete(i.id)}
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