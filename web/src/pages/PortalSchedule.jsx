import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useLinkedStudents } from '../lib/portal';
import { PageHead, Empty, ErrorBanner, Spinner } from '../components/ui';
import PortalNoLinked from '../components/PortalNoLinked';
import VisualTimetableGrid from '../components/VisualTimetableGrid';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function PortalSchedule() {
  const { t } = useTranslation();
  const { me, students, loading: meLoading, error: meError } = useLinkedStudents();
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
    api(`/schedule/student/${studentId}?school_year=${encodeURIComponent(sy)}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId, sy]);

  useEffect(() => { load(); }, [load]);

  if (meLoading) return <Spinner />;
  const isParent = me?.user?.role === 'parent';
  if (!students.length) {
    return (
      <>
        <PageHead title={t('portal.schedule')} sub={t(isParent ? 'portal.scheduleSubParent' : 'portal.scheduleSub')} />
        <PortalNoLinked />
      </>
    );
  }

  const days = (data && data.days && data.days.length === 5 ? data.days : DAY_NAMES);
  const grouped = {};
  if (data) {
    for (const e of data.data) {
      (grouped[e.day] = grouped[e.day] || []).push(e);
    }
  }

  return (
    <>
      <PageHead title={t('portal.schedule')} sub={t('portal.scheduleSub')} />
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

      {loading ? <Spinner /> : !data ? <div className="empty">Select a student and press Load.</div> : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th></tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((d) => (grouped[d] || []).map((e, i) => (
                <tr key={`${d}-${e.id || i}`}>
                  {i === 0 && <td rowSpan={Math.max(1, (grouped[d] || []).length)}><strong>{days[d - 1]}</strong></td>}
                  <td style={{ whiteSpace: 'nowrap' }}>{e.start_time}–{e.end_time}</td>
                  <td><strong>{e.subject_code}</strong> {e.subject_title}</td>
                  <td style={{ fontSize: 12.5 }}>{e.teacher_name || '—'}</td>
                  <td style={{ fontSize: 12.5 }}>{e.room || '—'}</td>
                </tr>
              )))}
            </tbody>
          </table>
          {!data.data.length && <Empty text="No scheduled classes for this school year." />}
        </div>
        <VisualTimetableGrid weekly={data.data} />
      )}
    </>
  );
}
