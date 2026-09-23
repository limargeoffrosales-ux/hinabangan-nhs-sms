import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Trophy, X, Film, Search } from 'lucide-react';
import { api, fileUrl } from '../lib/api';
import { subscribeLive } from '../lib/realtime';
import { PageHead, Badge, Modal, Empty, ErrorBanner, Spinner, ConfirmModal, SkeletonTable } from '../components/ui';
import { useAuth } from '../lib/auth';
import FileUpload from '../components/FileUpload';

const CATEGORIES = ['announcement', 'news', 'results', 'schedule', 'gallery'];
const STATUSES = ['published', 'draft', 'pinned'];

export default function SportsNews() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({ title: '', body: '', category: 'announcement', status: 'published', audience: 'all', media: [] });
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const canWrite = ['super_admin', 'school_admin'].includes(user?.role);

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
      if (status && p.status !== status) return false;
      if (needle && !(`${p.title} ${p.body}`.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [rows, q, category, status]);

  function openCreate() {
    setForm({ title: '', body: '', category: 'announcement', status: 'published', audience: 'all', media: [] });
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(p) {
    setForm({ title: p.title, body: p.body, category: p.category, status: p.status, audience: p.audience, media: p.media || [] });
    setEditing(p.id);
    setShowModal(true);
  }

  const onUploadMedia = (file) => {
    setForm((f) => ({
      ...f,
      media: [...f.media, { url: file.url || `/api/v1/uploads/file/${file.key}`, type: file.name?.match(/\.(mp4|webm|ogg|mov)$/i) ? 'video' : 'image', name: file.name }],
    }));
  };

  const removeMedia = (idx) => {
    setForm((f) => ({ ...f, media: f.media.filter((_, i) => i !== idx) }));
  };

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e) {
    e.preventDefault();
    setError(null);
    try {
      if (editing) await api(`/sports-news/${editing}`, { method: 'PATCH', body: form });
      else await api('/sports-news', { method: 'POST', body: form });
      setShowModal(false);
      load();
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function remove(p) {
    setConfirmAction({ message: t('sports.deleteConfirm', { title: p.title }), action: async () => {
      try {
        await api(`/sports-news/${p.id}`, { method: 'DELETE' });
      } catch (e) {
        setError(e.message);
      } finally {
        load();
      }
    } });
  }

  const statusBadge = (p) => p.status === 'pinned'
    ? <Badge status="yellow">{t('sports.status.pinned')}</Badge>
    : p.status === 'draft'
      ? <Badge status="gray">{t('sports.status.draft')}</Badge>
      : <Badge status="green">{t('sports.status.published')}</Badge>;

  return (
    <>
      <PageHead title={t('sports.title')} sub={t('sports.subtitle')}>
        {canWrite && <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> {t('sports.newPost')}</button>}
      </PageHead>
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
              {CATEGORIES.map((c) => <option key={c} value={c}>{t(`sports.cat.${c}`)}</option>)}
            </select>
          </div>
          <div>
            <label>{t('sports.statusLabel')}</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('sports.statusLabel')}>
              <option value="">{t('sports.allStatuses')}</option>
              {STATUSES.map((s) => <option key={s} value={s}>{t(`sports.status.${s}`)}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? <SkeletonTable rows={5} cols={3} /> : rows.length === 0 ? <Empty text={t('sports.noData')} /> : filtered.length === 0 ? <Empty text={t('sports.noResults')} /> : (
        <div className="grid" style={{ gap: 14 }}>
          {filtered.map((p) => (
            <div className="card" key={p.id} style={p.status === 'pinned' ? { borderColor: 'var(--accent)' } : undefined}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <Trophy size={16} style={{ color: 'var(--accent)' }} />
                <strong>{p.title}</strong>
                <Badge status="blue">{t(`sports.cat.${p.category}`, p.category)}</Badge>
                {p.status !== 'published' && statusBadge(p)}
                <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: 12.5 }}>
                  {p.created_at?.slice(0, 10)} · {t('sports.by', { name: p.author_name || 'System' })}
                </span>
                {canWrite && (
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm" onClick={() => openEdit(p)} aria-label={t('sports.editPost')}><Pencil size={13} aria-hidden="true" /></button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(p)} aria-label={t('sports.deletePost')}><Trash2 size={13} aria-hidden="true" /></button>
                  </span>
                )}
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

      {showModal && (
        <Modal
          title={editing ? t('sports.editPost') : t('sports.newPost')}
          sub={t('sports.modalSub')}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={save}>
            <label>{t('sports.postTitle')} *</label>
            <input required value={form.title} onChange={(e) => set('title', e.target.value)} />
            <label>{t('sports.postBody')} *</label>
            <textarea required rows={6} value={form.body} onChange={(e) => set('body', e.target.value)} />
            <div className="form-row">
              <div>
                <label>{t('sports.categoryLabel')}</label>
                <select value={form.category} onChange={(e) => set('category', e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{t(`sports.cat.${c}`)}</option>)}
                </select>
              </div>
              <div>
                <label>{t('sports.statusLabel')}</label>
                <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{t(`sports.status.${s}`)}</option>)}
                </select>
              </div>
              <div>
                <label>{t('sports.audienceLabel')}</label>
                <select value={form.audience} onChange={(e) => set('audience', e.target.value)}>
                  <option value="all">{t('sports.audienceAll')}</option>
                  <option value="teachers">{t('sports.audienceTeachers')}</option>
                  <option value="students">{t('sports.audienceStudents')}</option>
                  <option value="parents">{t('sports.audienceParents')}</option>
                </select>
              </div>
            </div>
            <label>{t('sports.media')}</label>
            {form.media.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                {form.media.map((m, i) => (
                  <div key={i} style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', position: 'relative', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {m.type === 'video' ? (
                      <Film size={24} style={{ color: 'var(--accent-2)' }} />
                    ) : (
                      <img src={fileUrl(m.url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <button type="button" onClick={() => removeMedia(i)} aria-label={t('sports.removeMedia')} style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <FileUpload folder="sports-news" accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime" onUpload={onUploadMedia} label={t('sports.mediaHint')} compact />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-primary" type="submit">{editing ? t('common.save') : t('sports.publish')}</button>
            </div>
          </form>
        </Modal>
      )}
      {confirmAction && <ConfirmModal message={confirmAction.message} danger onConfirm={() => { confirmAction.action(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />}
    </>
  );
}