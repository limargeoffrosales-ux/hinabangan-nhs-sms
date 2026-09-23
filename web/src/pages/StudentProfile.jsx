import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Pencil, GraduationCap, BookOpen, CalendarDays, Award } from 'lucide-react';
import { api, getCurrentSchoolYear, fileUrl } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PageHead, Badge, Spinner, ErrorBanner, Empty } from '../components/ui';

function computeAge(birthdate) {
  if (!birthdate) return null;
  const birth = new Date(birthdate + 'T00:00:00');
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [sy, setSy] = useState('2026-2027');
  const [grades, setGrades] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getCurrentSchoolYear().then((y) => { if (y) setSy((prev) => (prev === '2026-2027' ? y : prev)); });
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api(`/students/${id}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id || !sy) return;
    setLoadingGrades(true);
    setGrades(null);
    api(`/analytics/students/${id}?school_year=${encodeURIComponent(sy)}`)
      .then(setGrades)
      .catch(() => setGrades(null))
      .finally(() => setLoadingGrades(false));
  }, [id, sy]);

  if (loading) return <Spinner />;
  if (error && !data) return <><ErrorBanner error={error} /><Empty text={t('students.noData')} /></>;

  const s = data || {};
  const canEdit = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar'].includes(user?.role);
  const canViewContact = canEdit || user?.role === 'teacher';

  return (
    <>
      <PageHead
        title={`${s.last_name}, ${s.first_name}${s.middle_name ? ` ${s.middle_name}` : ''}${s.suffix ? ` ${s.suffix}` : ''}`}
        sub={`${s.lrn || ''}${s.lrn ? ' · ' : ''}${s.grade_level || ''}${s.track_strand ? ` · ${s.track_strand}` : ''}`}
      >
        <button className="btn btn-sm" onClick={() => navigate('/students')}><ArrowLeft size={13} /> {t('profile.backToList')}</button>
        {canEdit && (
          <button className="btn btn-sm" onClick={() => navigate(`/students?edit=${id}`)}><Pencil size={13} /> {t('profile.editRecord')}</button>
        )}
      </PageHead>

      <ErrorBanner error={error} />

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ width: 130, height: 155, borderRadius: 12, overflow: 'hidden', border: '2px solid var(--border)', flexShrink: 0, background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {s.photo_url ? <img src={fileUrl(s.photo_url)} alt={t('profile.photo')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <GraduationCap size={42} style={{ color: 'var(--text-dim)' }} />}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>{s.last_name}, {s.first_name}{s.middle_name ? ` ${s.middle_name}` : ''}{s.suffix ? ` ${s.suffix}` : ''}</h2>
            <Badge status={s.status} />
          </div>
          <div className="sub" style={{ marginTop: 4 }}>LRN {s.lrn || '—'} · {s.sex || ''} · {s.birth_date ? `${s.birth_date} (age ${computeAge(s.birth_date) ?? '—'})` : ''}</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <div className="stat-card"><span className="sub">{t('profile.academicLevel')}</span><div style={{ fontSize: 15, fontWeight: 700 }}>{s.grade_level || '—'}</div></div>
            <div className="stat-card"><span className="sub">{t('students.strandTrack')}</span><div style={{ fontSize: 15, fontWeight: 700 }}>{s.track_strand || '—'}</div></div>
            {grades && (
              <>
                <div className="stat-card"><span className="sub">{t('profile.gwa')}</span><div style={{ fontSize: 15, fontWeight: 700 }}>{grades.general_average ?? '—'}</div></div>
                <div className="stat-card"><span className="sub">{t('profile.gpa')}</span><div style={{ fontSize: 15, fontWeight: 700 }}>{grades.gpa ?? '—'}</div></div>
                <div className="stat-card"><span className="sub">{t('profile.credits')}</span><div style={{ fontSize: 15, fontWeight: 700 }}>{grades.credits ? `${grades.credits.earned}/${grades.credits.total}` : '—'}</div></div>
                {grades.rank != null && <div className="stat-card"><span className="sub">{t('profile.rank')}</span><div style={{ fontSize: 15, fontWeight: 700 }}>#{grades.rank}{grades.rank_total ? ` / ${grades.rank_total}` : ''}</div></div>}
                {grades.honor && <div className="stat-card"><span className="sub" style={{ color: 'var(--accent)' }}>{t('profile.honor')}</span><div style={{ fontSize: 15, fontWeight: 700 }}>{grades.honor}</div></div>}
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}><BookOpen size={15} style={{ verticalAlign: -2 }} /> {t('profile.personalInfo')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
            <div><label>{t('students.firstName')}</label><div style={{ fontSize: 14 }}>{s.first_name || '—'}</div></div>
            <div><label>{t('students.middleName')}</label><div style={{ fontSize: 14 }}>{s.middle_name || '—'}</div></div>
            <div><label>{t('students.lastName')}</label><div style={{ fontSize: 14 }}>{s.last_name || '—'}</div></div>
            <div><label>{t('students.suffix')}</label><div style={{ fontSize: 14 }}>{s.suffix || '—'}</div></div>
            <div><label>{t('students.sex')}</label><div style={{ fontSize: 14 }}>{s.sex || '—'}</div></div>
            <div><label>{t('students.birthDate')}</label><div style={{ fontSize: 14 }}>{s.birth_date || '—'}</div></div>
            <div><label>{t('profile.birthPlace')}</label><div style={{ fontSize: 14 }}>{s.birth_place || '—'}</div></div>
            <div><label>{t('students.religion')}</label><div style={{ fontSize: 14 }}>{s.religion || '—'}</div></div>
            {s.father_name && <div><label>{t('profile.father')}</label><div style={{ fontSize: 14 }}>{s.father_name}</div></div>}
            {s.mother_name && <div><label>{t('profile.mother')}</label><div style={{ fontSize: 14 }}>{s.mother_name}</div></div>}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}><Award size={15} style={{ verticalAlign: -2 }} /> {t('profile.contactGuardian')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
            <div><label>{t('students.address')}</label><div style={{ fontSize: 14 }}>{s.address || '—'}</div></div>
            <div><label>{t('students.contactNo')}</label><div style={{ fontSize: 14 }}>{s.contact || '—'}</div></div>
            <div><label>{t('students.guardianName')}</label><div style={{ fontSize: 14 }}>{s.guardian_name || '—'}</div></div>
            <div><label>{t('students.guardianContact')}</label><div style={{ fontSize: 14 }}>{s.guardian_contact || '—'}</div></div>
            <div><label>{t('students.relationship')}</label><div style={{ fontSize: 14 }}>{s.guardian_relation || '—'}</div></div>
          </div>
          {!canViewContact && <div className="sub" style={{ marginTop: 8 }}>{t('profile.contactHidden')}</div>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}><CalendarDays size={15} style={{ verticalAlign: -2 }} /> {t('profile.enrollmentHistory')}</h3>
        {!s.enrollments?.length ? <Empty text={t('profile.noEnrollments')} /> : (
          <table>
            <thead>
              <tr>
                <th>{t('profile.schoolYear')}</th>
                <th>{t('students.gradeLevel')}</th>
                <th>{t('profile.section')}</th>
                <th>{t('profile.term')}</th>
                <th>{t('students.status')}</th>
              </tr>
            </thead>
            <tbody>
              {s.enrollments.map((e) => (
                <tr key={e.id}>
                  <td>{e.school_year}</td>
                  <td>{e.grade_level}</td>
                  <td>{e.section_name || '—'}</td>
                  <td>{e.term || '—'}</td>
                  <td><Badge status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h3 style={{ marginTop: 0 }}>{t('profile.academicSummary')}</h3>
          <div className="form-row" style={{ margin: '0 0 0 auto', gap: 8, alignItems: 'end' }}>
            <div><label>{t('profile.schoolYear')}</label>
              <input value={sy} onChange={(e) => setSy(e.target.value)} style={{ width: 130 }} /></div>
          </div>
        </div>
        {loadingGrades ? <Spinner /> : !grades ? (
          <Empty text={t('profile.noGrades')} />
        ) : (
          <>
            <div className="sub" style={{ marginBottom: 10 }}>
              {t('profile.syLabel', { sy })}
              {grades.honor && <span style={{ marginLeft: 8 }}><Badge status="honor">{grades.honor}</Badge></span>}
            </div>
            {!grades.subjects?.length ? <Empty text={t('profile.noGrades')} /> : (
              <table>
                <thead>
                  <tr>
                    <th>{t('profile.subjectCode')}</th>
                    <th>{t('profile.subjectTitle')}</th>
                    <th>{t('profile.finalGrade')}</th>
                    <th>{t('profile.gradePoints')}</th>
                    <th>{t('profile.letter')}</th>
                    <th>{t('profile.remarks')}</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.subjects.map((subj, i) => (
                    <tr key={i}>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{subj.code}</td>
                      <td>{subj.title}</td>
                      <td style={{ fontWeight: 600 }}>{subj.final ?? '—'}</td>
                      <td>{subj.points ?? '—'}</td>
                      <td>{subj.letter ?? '—'}</td>
                      <td>{subj.passed != null ? (subj.passed ? 'PASSED' : 'FAILED') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </>
  );
}