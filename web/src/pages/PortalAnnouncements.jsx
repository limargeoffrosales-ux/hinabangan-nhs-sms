import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { subscribeLive } from '../lib/realtime';
import { PageHead, Empty, ErrorBanner, Spinner } from '../components/ui';

export default function PortalAnnouncements() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    api('/announcements?limit=100')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => subscribeLive((msg) => {
    if (msg.type === 'announcement') load();
  }), [load]);

  return (
    <>
      <PageHead title="Announcements" sub="Official announcements from Hinabangan National High School." />
      <ErrorBanner error={error} />
      {loading ? <Spinner /> : (
        <div className="card">
          {data && data.data.length === 0 && <Empty text="No announcements yet." />}
          {data && data.data.map((a) => (
            <div key={a.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <strong style={{ fontSize: 15 }}>{a.title}</strong>
              <div style={{ margin: '4px 0', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{a.body}</div>
              <div className="sub" style={{ fontSize: 12 }}>
                {a.author_name || 'School'} · {new Date(a.created_at).toLocaleDateString()} {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
