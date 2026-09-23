import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, UserRound } from 'lucide-react';
import { api } from '../lib/api';
import { useLinkedStudents } from '../lib/portal';
import { PageHead, Spinner, ErrorBanner, Empty, Badge } from '../components/ui';

export default function PortalProfile() {
  const { t } = useTranslation();
  const { me, students, loading: meLoading, error: meError } = useLinkedStudents();
  const [studentId, setStudentId] = useState('');
  useEffect(() => {
    setStudentId((prev) => prev || (students[0] ? String(students[0].id) : ''));
  }, [students]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    api(`/portal/profile${studentId ? `?student_id=${studentId}` : ''}`)
      .then((d) => {
        setData(d);
        const f = {};
        for (const k of d.editable || []) f[k] = d.student ? d.student[k] ?? '' : '';
        for (const k of d.editable_account || []) f[k] = d.account ? d.account[k] ?? '' : '';
        setForm(f);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const body = { ...form };
      if (studentId) body.student_id = studentId;
      await api('/portal/profile', { method: 'PUT', body });
      setSaved(true);
      await load();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  function field(key, props = {}) {
    return (
      <input
        className="input"
        value={form[key] ?? ''}
        onChange={(e) => { setSaved(false); setForm((f) => ({ ...f, [key]: e.target.value })); }}
        {...props}
      />
    );
  }

  if (meLoading) return <Spinner />;

  const s = data?.student;
  const isParent = me?.user?.role === 'parent';

  return (
    <>
      <PageHead title={t('profile.title')} sub={t('profile.subtitle')} />
      {!students.length ? (
        <Empty text={t('portal.noLinked')} />
      ) : (
        <>
          <ErrorBanner error={meError || error} />
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="form-row" style={{ margin: 0, alignItems: 'end' }}>
              <div><label>{t('profile.student')}</label>
                <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                  {students.map((x) => <option key={x.id} value={x.id}>{x.last_name}, {x.first_name} ({x.grade_level})</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={load} disabled={loading || !studentId} type="button">{t('analytics.load')}</button>
            </div>
          </div>

          {loading ? <Spinner /> : !data || !s ? <Empty text={t('profile.noRecord')} /> : (
            <form onSubmit={onSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="card">
                  <h3 style={{ marginTop: 0 }}><UserRound size={15} style={{ verticalAlign: -2 }} /> {t('profile.schoolRecord')}</h3>
                  <div className="sub" style={{ marginBottom: 12 }}>{t('profile.schoolRecordSub')}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                    <div><label>{t('students.lrn')}</label><div style={{ fontSize: 14 }}>{s.lrn}</div></div>
                    <div><label>{t('students.name')}</label><div style={{ fontSize: 14 }}>{s.last_name}, {s.first_name} {s.middle_name || ''}{s.suffix ? ` ${s.suffix}` : ''}</div></div>
                    <div><label>{t('students.sex')}</label><div style={{ fontSize: 14 }}>{s.sex}</div></div>
                    <div><label>{t('students.birthDate')}</label><div style={{ fontSize: 14 }}>{s.birth_date || '—'}</div></div>
                    <div><label>{t('students.gradeLevel')}</label><div style={{ fontSize: 14 }}>{s.grade_level}</div></div>
                    <div><label>{t('students.strandTrack')}</label><div style={{ fontSize: 14 }}>{s.track_strand || '—'}</div></div>
                    <div><label>{t('students.status')}</label><div><Badge status={s.status} /></div></div>
                  </div>
                </div>

                <div className="card">
                  <h3 style={{ marginTop: 0 }}>{t('profile.account')}</h3>
                  <div className="sub" style={{ marginBottom: 12 }}>{t('profile.accountSub')}</div>
                  <div className="form-row">
                    <div><label>{t('profile.username')}</label><input className="input" value={data.account?.username || ''} disabled /></div>
                    <div><label>{t('profile.displayName')}</label>{field('name')}</div>
                  </div>
                  <div className="form-row">
                    <div><label>{t('profile.email')}</label>{field('email', { type: 'email' })}</div>
                    <div><label>{t('profile.phone')}</label>{field('phone')}</div>
                  </div>
                </div>
              </div>

              <div className="card" style={{ marginTop: 16 }}>
                <h3 style={{ marginTop: 0 }}>{t('profile.contactInfo')}</h3>
                <div className="sub" style={{ marginBottom: 12 }}>{t('profile.contactInfoSub')}</div>
                <div className="form-row">
                  <div><label>{t('students.contactNo')}</label>{field('contact')}</div>
                  <div><label>{t('students.religion')}</label>{field('religion')}</div>
                </div>
                <div className="form-row">
                  <div style={{ width: '100%' }}><label>{t('students.address')}</label>{field('address')}</div>
                </div>
                <div className="form-row">
                  <div><label>{t('students.guardianName')}</label>{field('guardian_name')}</div>
                  <div><label>{t('students.guardianContact')}</label>{field('guardian_contact')}</div>
                  <div><label>{t('students.relationship')}</label>{field('guardian_relation')}</div>
                </div>
                <div className="form-row" style={{ alignItems: 'center' }}>
                  {isParent && <span className="sub" style={{ margin: 0 }}>{t('profile.parentEditNote')}</span>}
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    {saved && <span className="notice ok" role="status" style={{ margin: 0 }}>{t('profile.saved')}</span>}
                    <button className="btn btn-primary" disabled={saving}><Save size={14} /> {saving ? t('profile.saving') : t('profile.save')}</button>
                  </span>
                </div>
              </div>
            </form>
          )}
        </>
      )}
    </>
  );
}