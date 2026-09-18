import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useLinkedStudents } from '../lib/portal';
import { PageHead, Badge, Empty, ErrorBanner, Spinner } from '../components/ui';

export default function PortalImmersion() {
  const { t } = useTranslation();
  const { students, loading: meLoading, error: meError } = useLinkedStudents();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    setData(null);
    api('/portal/my-immersion')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { if (!meLoading) load(); }, [meLoading]);

  if (meLoading) return <Spinner />;

  if (!students.length) {
    return (
      <>
        <PageHead title={t('immersion.portalTitle', 'Work Immersion')} sub={t('immersion.portalSub', 'Your work immersion records and status.')} />
        <div className="empty">{t('immersion.noLinked', 'No linked students yet. Ask the school registrar to link your portal account.')}</div>
      </>
    );
  }

  const records = data?.data || [];

  return (
    <>
      <PageHead title={t('immersion.portalTitle', 'Work Immersion')} sub={t('immersion.portalSub', 'Your work immersion records and status.')} />
      <ErrorBanner error={meError || error} />

      {loading ? <Spinner /> : records.length === 0 ? (
        <Empty text={t('immersion.empty', 'No work immersion records found.')} />
      ) : (
        <div className="grid-2">
          {records.map((rec, i) => (
            <div className="card" key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0 }}>{rec.batch}</h4>
                <Badge status={rec.status} />
              </div>
              <div className="sub" style={{ marginBottom: 4 }}><strong>{t('immersion.program', 'Program')}:</strong> {rec.program || '—'}</div>
              <div className="sub" style={{ marginBottom: 4 }}><strong>{t('immersion.partner', 'Partner Institution')}:</strong> {rec.partner_institution || '—'}</div>
              <div className="sub" style={{ marginBottom: 4 }}><strong>{t('immersion.dates', 'Dates')}:</strong> {[rec.start_date, rec.end_date].filter(Boolean).join(' → ') || '—'}</div>

              {rec.attendance_total > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="section-title">
                    {t('immersion.attendanceTitle', 'Daily attendance')}
                    <span className="sub" style={{ marginLeft: 8 }}>
                      {t('immersion.attendanceSummary', '{{total}} days · {{rate}}% attendance', { total: rec.attendance_total, rate: rec.attendance_rate ?? 0 })}
                    </span>
                  </div>
                  <div className="table-wrap" style={{ marginTop: 8 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>{t('immersion.attDate', 'Date')}</th>
                          <th style={{ textAlign: 'center' }}>{t('immersion.attStatus', 'Status')}</th>
                          <th>{t('immersion.attTimeIn', 'Time in')}</th>
                          <th>{t('immersion.attTimeOut', 'Time out')}</th>
                          <th>{t('immersion.attHours', 'Hours')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(rec.attendance || []).slice(0, 8).map((a, j) => (
                          <tr key={j}>
                            <td style={{ whiteSpace: 'nowrap' }}>{a.date}</td>
                            <td style={{ textAlign: 'center' }}><Badge status={a.status} /></td>
                            <td>{a.time_in || '—'}</td>
                            <td>{a.time_out || '—'}</td>
                            <td>{a.hours != null ? a.hours : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {rec.attendance_total === 0 && (
                <div className="sub" style={{ marginTop: 8 }}>{t('immersion.noAttendance', 'No attendance recorded yet.')}</div>
              )}
              {rec.remarks && <div className="sub" style={{ marginTop: 8 }}><strong>{t('immersion.remarks', 'Remarks')}:</strong> {rec.remarks}</div>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
