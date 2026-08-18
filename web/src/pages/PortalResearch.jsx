import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useLinkedStudents } from '../lib/portal';
import { PageHead, Badge, Empty, ErrorBanner, Spinner } from '../components/ui';

export default function PortalResearch() {
  const { t } = useTranslation();
  const { students, loading: meLoading, error: meError } = useLinkedStudents();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    setData(null);
    api('/portal/my-research')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { if (!meLoading) load(); }, [meLoading]);

  if (meLoading) return <Spinner />;

  if (!students.length) {
    return (
      <>
        <PageHead title={t('research.portalTitle', 'My Research')} sub={t('research.portalSub', 'Research projects and milestones assigned to you.')} />
        <div className="empty">{t('research.noLinked', 'No linked students yet. Ask the school registrar to link your portal account.')}</div>
      </>
    );
  }

  const projects = data?.data || [];

  return (
    <>
      <PageHead title={t('research.portalTitle', 'My Research')} sub={t('research.portalSub', 'Research projects and milestones assigned to you.')} />
      <ErrorBanner error={meError || error} />

      {loading ? <Spinner /> : projects.length === 0 ? (
        <Empty text={t('research.empty', 'No research projects found.')} />
      ) : (
        <div className="grid-2">
          {projects.map((p) => (
            <div className="card" key={p.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0 }}>{p.title}</h4>
                <Badge status={p.status} />
              </div>
              <div className="sub" style={{ marginBottom: 4 }}><strong>{t('research.type', 'Type')}:</strong> {p.research_type || '—'}</div>
              {p.user_name && <div className="sub" style={{ marginBottom: 4 }}><strong>{t('research.author', 'Author')}:</strong> {p.user_name}</div>}
              {p.abstract && <p className="sub" style={{ marginTop: 8, marginBottom: 8 }}>{p.abstract}</p>}

              {p.milestones?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong className="sub" style={{ fontSize: 12, textTransform: 'uppercase' }}>{t('research.milestones', 'Milestones')}</strong>
                  <div style={{ marginTop: 6 }}>
                    {p.milestones.map((m, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: i > 0 ? '1px solid var(--border)' : undefined }}>
                        <span style={{ flex: 1, fontSize: 13 }}>{m.milestone}</span>
                        <span className="sub" style={{ fontSize: 12 }}>{m.target_date || '—'}</span>
                        <Badge status={m.status} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
