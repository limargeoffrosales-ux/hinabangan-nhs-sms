import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Send, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { useLinkedStudents } from '../lib/portal';
import { PageHead, Badge, Empty, ErrorBanner, Spinner } from '../components/ui';

const isShs = (g) => /^Grade 1[12]$/.test(String(g || ''));

export default function PortalEnroll() {
  const { t } = useTranslation();
  const { me, students, loading: meLoading, error: meError } = useLinkedStudents();
  const [studentId, setStudentId] = useState('');
  useEffect(() => {
    setStudentId((prev) => prev || (students[0] ? String(students[0].id) : ''));
  }, [students]);

  const [opts, setOpts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sectionId, setSectionId] = useState('');
  const [term, setTerm] = useState('first');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(null);

  const load = useCallback(() => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    api(`/portal/enrollment-options${studentId ? `?student_id=${studentId}` : ''}`)
      .then((d) => {
        setOpts(d);
        setSectionId((prev) => (d.sections.some((s) => String(s.id) === String(prev)) ? prev : ''));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!opts || !sectionId) return;
    const section = opts.sections.find((s) => String(s.id) === String(sectionId));
    const termValue = section && isShs(section.grade_level) ? term : null;
    setApplying(true);
    setError(null);
    setApplied(null);
    try {
      await api('/enrollments/self-apply', {
        method: 'POST',
        body: { section_id: sectionId, school_year: opts.next_school_year, grade_level: section?.grade_level, term: termValue, student_id: studentId },
      });
      setApplied({ messageKey: 'applied' });
      await load();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setApplying(false);
    }
  }

  if (meLoading) return <Spinner />;

  const pendingNotice = me?.user?.role === 'student' ? me?.link_request : null;

  return (
    <>
      <PageHead title={t('portal.enroll', 'Enrollment')} sub={t('portal.enrollSub', 'Apply for the upcoming school year. Your application is submitted for review — the registrar confirms it in the Enrollment module.')} />
      <ErrorBanner error={meError || error} />

      {pendingNotice && pendingNotice.status === 'pending' && (
        <div className="notice warn" role="status">{t('portal.linkPending', 'Your portal account is awaiting registrar approval. You will be able to apply for enrollment once it is approved.')}</div>
      )}
      {pendingNotice && pendingNotice.status === 'rejected' && (
        <div className="notice warn" role="status">{t('portal.linkRejected', 'Your portal account request was not approved.{{note}} Contact the school registrar if you believe this is a mistake.', { note: pendingNotice.notes ? ` (${pendingNotice.notes})` : '' })}</div>
      )}

      {!students.length ? (
        <div className="empty">
          {pendingNotice && pendingNotice.status === 'pending'
            ? t('portal.linkPending', 'Your portal account is awaiting registrar approval. You will be able to view records and apply for enrollment once it is approved.')
            : t('portal.enrollNoLink', 'No student record is linked to this account yet. Ask the school registrar to link your portal account.')}
        </div>
      ) : loading ? <Spinner /> : !opts ? null : (
        <>
          {students.length > 1 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="form-row" style={{ margin: 0, alignItems: 'end' }}>
                <div><label>{t('portal.enrollStudent', 'Student')}</label>
                  <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                    {students.map((s) => <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} ({s.grade_level})</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {opts.sections.length === 0 ? (
            <Empty text={t('portal.enrollNoSections', 'No open sections are available yet for the upcoming school year ({{sy}}). Check again later.', { sy: opts.next_school_year || '' })} />
          ) : (
            <form onSubmit={onSubmit} className="card" style={{ maxWidth: 640 }}>
              <h3 style={{ marginTop: 0 }}><ClipboardList size={16} style={{ verticalAlign: -2 }} /> {t('portal.enrollApply', 'Apply for {{sy}}', { sy: opts.next_school_year || '' })}</h3>
              <p className="sub" style={{ marginTop: 0 }}>{t('portal.enrollApplySub', 'Pick a section for the upcoming school year and submit. The registrar reviews your application before it is confirmed.')}</p>

              <label>{t('portal.enrollSection', 'Section')} *</label>
              <select required value={sectionId} onChange={(e) => { setSectionId(e.target.value); setTerm('first'); }}>
                <option value="">—</option>
                {opts.sections.map((s) => {
                  const open = Number(s.capacity) <= 0 || Number(s.enrolled_count) < Number(s.capacity);
                  return (
                    <option key={s.id} value={s.id} disabled={!open}>
                      {s.name} — {s.grade_level}{s.strand ? ` · ${s.strand}` : ''} ({s.enrolled_count}/{s.capacity || '∞'})
                      {open ? '' : ' · full'}
                    </option>
                  );
                })}
              </select>

              {(() => {
                const section = opts.sections.find((s) => String(s.id) === String(sectionId));
                return section && isShs(section.grade_level) ? (
                  <>
                    <label>{t('portal.enrollTerm', 'Term')} *</label>
                    <select value={term} onChange={(e) => setTerm(e.target.value)}>
                      <option value="first">{t('portal.enrollFirst', 'First')}</option>
                      <option value="second">{t('portal.enrollSecond', 'Second')}</option>
                      <option value="third">{t('portal.enrollThird', 'Third')}</option>
                    </select>
                  </>
                ) : null;
              })()}

              <div className="modal-actions" style={{ marginTop: 14 }}>
                <button className="btn btn-primary" disabled={applying || !sectionId}>
                  {applying ? <span className="login-spinner" /> : <Send size={14} />}
                  {applying ? t('common.saving') : t('portal.enrollSubmit', 'Submit application')}
                </button>
              </div>
            </form>
          )}

          {(opts.enrollments || []).length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ marginTop: 0 }}>{t('portal.enrollHistory', 'Enrollment applications')}</h3>
              <table>
                <thead><tr><th>{t('portal.enrollYear', 'School year')}</th><th>{t('portal.enrollSection', 'Section')}</th><th>{t('portal.enrollGrade', 'Grade level')}</th><th>{t('common.status', 'Status')}</th></tr></thead>
                <tbody>
                  {opts.enrollments.map((en) => (
                    <tr key={en.id}>
                      <td>{en.school_year}</td>
                      <td>{en.section_name || '—'}</td>
                      <td>{en.grade_level}{en.term ? ` · ${String(en.term)[0].toUpperCase() + String(en.term).slice(1)}` : ''}</td>
                      <td><Badge status={en.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {applied && (
            <div className="notice ok" role="status" style={{ marginTop: 14 }}>
              <CheckCircle2 size={15} /> {t('portal.enrollApplied', 'Application submitted. The registrar will review it in the Enrollment module.')}
            </div>
          )}
        </>
      )}
    </>
  );
}