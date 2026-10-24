import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Search } from 'lucide-react';
import { api, fileUrl } from '../lib/api';
import { subscribeLive } from '../lib/realtime';
import { PageHead, Badge, Empty, ErrorBanner, Spinner } from '../components/ui';

export default function PortalSportsNews() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('/sports-news?limit=100');
      setRows(res.data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => subscribeLive((msg) => {
    if (msg.type === 'sports-news') load();
  }), [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((p) => {
      if (category && p.category !== category) return false;
      if (needle && !(`${p.title} ${p.body}`.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [rows, q, category]);

  return (
    <>
      <PageHead title={t('sports.title')} sub={t('sports.subtitle')} />
      <ErrorBanner error={error} />

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="form-row" style={{ margin: 0, alignItems: 'end' }}>
          <div style={{ flex: '1 1 240px' }}>
            <label>{t('sports.searchLabel')}</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('sports.search')} style={{ width: '100%', paddingLeft: 30 }} aria-label={t('sports.searchLabel')} />
            </div>
          </div>
          <div>
            <label>{t('sports.categoryLabel')}</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t('sports.categoryLabel')}>
              <option value="">{t('sports.allCategories')}</option>
              {['announcement', 'news', 'results', 'schedule', 'gallery'].map((c) => <option key={c} value={c}>{t(`sports.cat.${c}`)}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? <Spinner /> : rows.length === 0 ? <Empty text={t('sports.noData')} /> : filtered.length === 0 ? <Empty text={t('sports.noResults')} /> : (
        <div className="grid" style={{ gap: 14 }}>
          {filtered.map((p) => (
            <div className="card" key={p.id} style={p.status === 'pinned' ? { borderColor: 'var(--accent)' } : undefined}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <Trophy size={16} style={{ color: 'var(--accent)' }} />
                <strong>{p.title}</strong>
                <Badge status="blue">{t(`sports.cat.${p.category}`, p.category)}</Badge>
                {p.status === 'pinned' && <Badge status="yellow">{t('sports.status.pinned')}</Badge>}
                <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: 12.5 }}>
                  {p.created_at?.slice(0, 10)} · {t('sports.by', { name: p.author_name || 'School' })}
                </span>
              </div>
              <p style={{ margin: '10px 0 0', color: 'var(--text-dim)', lineHeight: 1.7, fontSize: 14, whiteSpace: 'pre-wrap' }}>{p.body}</p>
              {(p.media || []).length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginTop: 12 }}>
                  {(p.media || []).map((m, i) => (
                    <div key={i} style={{ borderRadius: 8, overflow: 'hidden', background: 'var(--bg-2)', aspectRatio: '4/3' }}>
                      {m.type === 'video' || (m.url && /\.(mp4|webm|ogg|mov)$/i.test(m.url)) ? (
                        <video src={fileUrl(m.url)} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} preload="metadata" />
                      ) : (
                        <img src={fileUrl(m.url)} alt={m.name || p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}