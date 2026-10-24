import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useLinkedStudents } from '../lib/portal';
import PortalNoLinked from '../components/PortalNoLinked';
import { PageHead, Empty, ErrorBanner, Spinner } from '../components/ui';
import { fmt } from '../lib/utils';

export default function PortalAnalytics() {
  const { t } = useTranslation();
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

  

  const load = useCallback(() => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    setData(null);
    api(`/analytics/students/${studentId}?school_year=${encodeURIComponent(sy)}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId, sy]);

  useEffect(() => { load(); }, [load]);

  if (meLoading) return <Spinner />;
  if (!students.length) {
    return (
      <>
        <PageHead title={t('analytics.portalTitle', 'My Analytics')} sub={t('analytics.portalSub', 'Academic progress and performance overview.')} />
        <PortalNoLinked />
      </>
    );
  }

  return (
    <>
      <PageHead title={t('analytics.portalTitle', 'My Analytics')} sub={t('analytics.portalSub', 'Academic progress and performance overview.')} />
      <ErrorBanner error={meError || error} />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ margin: 0, alignItems: 'end' }}>
          <div><label>{t('analytics.student', 'Student')}</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {students.map((s) => <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} ({s.grade_level})</option>)}
            </select>
          </div>
          <div><label>{t('analytics.schoolYear', 'School year')}</label><input value={sy} onChange={(e) => setSy(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={load} disabled={loading || !studentId}>{t('analytics.load', 'Load')}</button>
        </div>
      </div>

      {loading ? <Spinner /> : !data ? <div className="empty">{t('analytics.selectStudent', 'Select a student and press Load.')}</div> : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ marginTop: 0 }}>{t('analytics.summary', 'Summary')}</h4>
            <div className="form-row" style={{ margin: 0 }}>
              <div className="stat-card"><span className="sub">GWA</span><div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(data.general_average)}</div></div>
              <div className="stat-card"><span className="sub">GPA</span><div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(data.gpa)}</div></div>
              <div className="stat-card"><span className="sub">{t('analytics.rank', 'Rank')}</span><div style={{ fontSize: 20, fontWeight: 700 }}>{data.rank != null && data.rank_total != null ? `${data.rank} / ${data.rank_total}` : '—'}</div></div>
              <div className="stat-card"><span className="sub">{t('analytics.honor', 'Honor')}</span><div style={{ fontSize: 16, fontWeight: 600 }}>{data.honor || '—'}</div></div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ marginTop: 0 }}>{t('analytics.classRank', 'Class Rank')}</h4>
            {data.rank != null && data.rank_total != null ? (
              <div style={{ fontSize: 32, fontWeight: 700 }}>{data.rank} <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--text-dim)' }}>/ {data.rank_total}</span></div>
            ) : <div className="sub">{t('analytics.noRank', 'No ranking data available.')}</div>}
            {data.section && <div className="sub" style={{ marginTop: 4 }}>{t('analytics.section', 'Section')}: {data.section.section_name}</div>}
          </div>

          {data.honor && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="notice ok">
                <h4 style={{ marginTop: 0 }}>{t('analytics.honorDesignation', 'Honor Designation')}</h4>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{data.honor}</div>
              </div>
            </div>
          )}

          <div className="card">
            <h4 style={{ marginTop: 0 }}>{t('analytics.subjectPerformance', 'Subject Performance')}</h4>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('analytics.colSubject', 'Subject')}</th>
                    <th style={{ textAlign: 'center' }}>{t('analytics.colGrade', 'Grade')}</th>
                    <th style={{ textAlign: 'center' }}>{t('analytics.colLetter', 'Letter')}</th>
                    <th>{t('analytics.colProficiency', 'Proficiency Level')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.subjects || []).map((r) => (
                    <tr key={r.subject_id}>
                      <td>{r.title} <span className="sub" style={{ fontSize: 12 }}>({r.code})</span></td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{fmt(r.final)}</td>
                      <td style={{ textAlign: 'center' }}>{r.letter || '—'}</td>
                      <td>{r.proficiency || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!data.subjects || !data.subjects.length) && <Empty text={t('analytics.noSubjects', 'No subject data available for this school year.')} />}
            </div>
          </div>
        </>
      )}
    </>
  );
}
