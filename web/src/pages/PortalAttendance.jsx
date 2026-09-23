import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useLinkedStudents } from '../lib/portal';
import PortalNoLinked from '../components/PortalNoLinked';
import { PageHead, Empty, ErrorBanner, Spinner } from '../components/ui';

const STATUS_LABELS = { present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused' };

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function PortalAttendance() {
  const { t } = useTranslation();
  const { me, students, loading: meLoading, error: meError } = useLinkedStudents();
  const [studentId, setStudentId] = useState('');
  // Linked students arrive after mount (fetch), so the old lazy initializer
  // always saw an empty list. Auto-select the first child once they load, and
  // never overwrite a manual choice afterwards.
  useEffect(() => {
    setStudentId((prev) => prev || (students[0] ? String(students[0].id) : ''));
  }, [students]);
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    setData(null);
    api(`/attendance/student/${studentId}?month=${month}&summary=1`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId, month]);

  useEffect(() => { load(); }, [load]);

  if (meLoading) return <Spinner />;
  const isParent = me?.user?.role === 'parent';
  if (!students.length) {
    return (
      <>
        <PageHead title={t('portal.attendance')} sub={t(isParent ? 'portal.attendanceSubParent' : 'portal.attendanceSub')} />
        <PortalNoLinked />
      </>
    );
  }

  const s = data?.summary;
  return (
    <>
      <PageHead title={t('portal.attendance')} sub={t('portal.attendanceSub')} />
      <ErrorBanner error={meError || error} />
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ margin: 0, alignItems: 'end' }}>
          <div><label>Student</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {students.map((x) => <option key={x.id} value={x.id}>{x.last_name}, {x.first_name} ({x.grade_level})</option>)}
            </select>
          </div>
          <div><label>Month</label>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={load} disabled={loading || !studentId}>Load</button>
        </div>
      </div>

      {loading ? <Spinner /> : !data ? <div className="empty">Select a student and month, then press Load.</div> : (
        <>
          {s && (
            <div className="form-row" style={{ margin: '0 0 14px' }}>
              <div className="stat-card"><span className="sub">Attendance rate</span><div style={{ fontSize: 20, fontWeight: 700 }}>{s.rate != null ? `${s.rate}%` : '—'}</div></div>
              <div className="stat-card"><span className="sub">Present</span><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>{s.counts.present}</div></div>
              <div className="stat-card"><span className="sub">Late</span><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--warn)' }}>{s.counts.late}</div></div>
              <div className="stat-card"><span className="sub">Absent</span><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--danger)' }}>{s.counts.absent}</div></div>
              <div className="stat-card"><span className="sub">Excused</span><div style={{ fontSize: 20, fontWeight: 700 }}>{s.counts.excused}</div></div>
            </div>
          )}
          <div className="card table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Status</th><th>Remarks</th></tr>
              </thead>
              <tbody>
                {data.data.map((a) => (
                  <tr key={a.date}>
                    <td>{a.date}</td>
                    <td><span className={`badge ${a.status === 'present' ? 'badge-green' : a.status === 'late' ? 'badge-yellow' : a.status === 'excused' ? 'badge-blue' : 'badge-red'}`}>{STATUS_LABELS[a.status] || a.status}</span></td>
                    <td style={{ color: 'var(--text-dim)' }}>{a.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.data.length && <Empty text="No attendance records for this month." />}
          </div>
        </>
      )}
    </>
  );
}
