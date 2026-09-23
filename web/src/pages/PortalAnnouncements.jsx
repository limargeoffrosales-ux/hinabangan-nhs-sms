import { useEffect, useState, useCallback } from 'react';
import { api, fileUrl } from '../lib/api';
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
              {(a.media || []).length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginTop: 10 }}>
                  {(a.media || []).map((m, i) => (
                    <div key={i} style={{ borderRadius: 8, overflow: 'hidden', background: 'var(--bg-2)', aspectRatio: '4/3' }}>
                      {m.type === 'video' || (m.url && /\.(mp4|webm|ogg|mov)$/i.test(m.url)) ? (
                        <video src={fileUrl(m.url)} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} preload="metadata" />
                      ) : (
                        <img src={fileUrl(m.url)} alt={m.name || a.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      )}
                    </div>
                  ))}
                </div>
              )}
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
