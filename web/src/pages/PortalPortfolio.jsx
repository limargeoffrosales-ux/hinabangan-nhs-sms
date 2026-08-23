import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useLinkedStudents } from '../lib/portal';
import { PageHead, Badge, Empty, ErrorBanner, Spinner } from '../components/ui';
import { fmt } from '../lib/utils';

export default function PortalPortfolio() {
  const { t } = useTranslation();
  const { students, loading: meLoading, error: meError } = useLinkedStudents();
  const [studentId, setStudentId] = useState('');
  const [sy, setSy] = useState('2026-2027');
  const [analytics, setAnalytics] = useState(null);
  const [immersion, setImmersion] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (students.length && !studentId) setStudentId(String(students[0].id));
  }, [students]);

  function load() {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    setAnalytics(null);
    setImmersion(null);
    setAttendance(null);
    const enc = encodeURIComponent(sy);
    Promise.all([
      api(`/analytics/students/${studentId}?school_year=${enc}`),
      api(`/portal/my-immersion?student_id=${studentId}`),
      api(`/attendance/student/${studentId}?school_year=${enc}`),
    ])
      .then(([a, i, att]) => { setAnalytics(a); setImmersion(i); setAttendance(att); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (students.length && studentId) load();
  }, [studentId, sy]);

  if (meLoading) return <Spinner />;
  if (!students.length) {
    return (
      <>
        <PageHead title={t('portfolio.title', 'Student Portfolio')} sub={t('portfolio.noLinked', 'No linked students yet. Ask the school registrar to link your portal account.')} />
        <div className="empty">{t('portfolio.noLinked', 'No linked students yet. Ask the school registrar to link your portal account.')}</div>
      </>
    );
  }

  const s = students.find((st) => String(st.id) === studentId);
  const counts = attendance?.summary?.counts || {};
  const rate = attendance?.summary?.rate;

  return (
    <>
      <PageHead title={t('portfolio.title', 'Student Portfolio')} sub={t('portfolio.sub', 'Academic profile overview for your linked student.')} />
      <ErrorBanner error={meError || error} />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ margin: 0, alignItems: 'end' }}>
          <div><label>{t('portfolio.student', 'Student')}</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {students.map((st) => <option key={st.id} value={st.id}>{st.last_name}, {st.first_name} ({st.grade_level})</option>)}
            </select>
          </div>
          <div><label>{t('portfolio.schoolYear', 'School year')}</label><input value={sy} onChange={(e) => setSy(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={load} disabled={loading || !studentId}>{t('portfolio.load', 'Load')}</button>
        </div>
      </div>

      {loading ? <Spinner /> : !analytics ? <div className="empty">{t('portfolio.selectStudent', 'Select a student and press Load.')}</div> : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>{s?.last_name}, {s?.first_name}</h3>
            <div className="form-row" style={{ margin: '8px 0 0' }}>
              {s?.lrn && <div className="stat-card"><span className="sub">LRN</span><div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>{s.lrn}</div></div>}
              {s?.grade_level && <div className="stat-card"><span className="sub">{t('portfolio.gradeLevel', 'Grade Level')}</span><div style={{ fontSize: 16, fontWeight: 700 }}>{s.grade_level}</div></div>}
              {s?.track_strand && <div className="stat-card"><span className="sub">{t('portfolio.trackStrand', 'Track / Strand')}</span><div style={{ fontSize: 14, fontWeight: 600 }}>{s.track_strand}</div></div>}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ marginTop: 0 }}>{t('portfolio.summary', 'Summary')}</h4>
            <div className="form-row" style={{ margin: 0 }}>
              <div className="stat-card"><span className="sub">GWA</span><div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(analytics.general_average)}</div></div>
              <div className="stat-card"><span className="sub">GPA</span><div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(analytics.gpa)}</div></div>
              <div className="stat-card"><span className="sub">{t('portfolio.attendanceRate', 'Attendance Rate')}</span><div style={{ fontSize: 20, fontWeight: 700 }}>{rate != null ? `${fmt(rate)}%` : '—'}</div></div>
              <div className="stat-card"><span className="sub">{t('portfolio.creditsEarned', 'Credits Earned')}</span><div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(analytics.credits)}</div></div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ marginTop: 0 }}>{t('portfolio.subjectGrades', 'Subject Grades')}</h4>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('portfolio.colSubject', 'Subject')}</th>
                    <th>{t('portfolio.colCode', 'Code')}</th>
                    <th style={{ textAlign: 'center' }}>{t('portfolio.colGrade', 'Final Grade')}</th>
                    <th style={{ textAlign: 'center' }}>{t('portfolio.colLetter', 'Letter')}</th>
                    <th>{t('portfolio.colRemarks', 'Remarks')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics.subjects || []).map((r) => (
                    <tr key={r.subject_id}>
                      <td>{r.title}</td>
                      <td style={{ fontSize: 12.5 }}>{r.code}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{fmt(r.final)}</td>
                      <td style={{ textAlign: 'center' }}>{r.letter || '—'}</td>
                      <td>{r.passed != null ? <Badge status={r.passed ? 'PASSED' : 'FAILED'} /> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!analytics.subjects || !analytics.subjects.length) && <Empty text={t('portfolio.noGrades', 'No grades recorded for this school year yet.')} />}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ marginTop: 0 }}>{t('portfolio.attendanceBreakdown', 'Attendance Breakdown')}</h4>
            <div className="form-row" style={{ margin: 0 }}>
              <div className="stat-card"><span className="sub" style={{ color: '#4ade80' }}>{t('portfolio.present', 'Present')}</span><div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(counts.present)}</div></div>
              <div className="stat-card"><span className="sub" style={{ color: '#f87171' }}>{t('portfolio.absent', 'Absent')}</span><div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(counts.absent)}</div></div>
              <div className="stat-card"><span className="sub" style={{ color: '#facc15' }}>{t('portfolio.late', 'Late')}</span><div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(counts.late)}</div></div>
              <div className="stat-card"><span className="sub" style={{ color: '#60a5fa' }}>{t('portfolio.excused', 'Excused')}</span><div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(counts.excused)}</div></div>
            </div>
          </div>

          <div className="card">
            <h4 style={{ marginTop: 0 }}>{t('portfolio.immersionStatus', 'Work Immersion Status')}</h4>
            {immersion?.data?.length ? immersion.data.map((rec, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: i < immersion.data.length - 1 ? '1px solid var(--border)' : undefined }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>{rec.batch}</strong>
                  <span className="sub">{rec.program}</span>
                  <Badge status={rec.status} />
                </div>
                {rec.partner_institution && <div className="sub">{rec.partner_institution}</div>}
                <div className="sub">{[rec.start_date, rec.end_date].filter(Boolean).join(' → ') || '—'}</div>
                {rec.remarks && <div className="sub">{rec.remarks}</div>}
              </div>
            )) : <Empty text={t('portfolio.noImmersion', 'No work immersion records found.')} />}
          </div>
        </>
      )}
    </>
  );
}
