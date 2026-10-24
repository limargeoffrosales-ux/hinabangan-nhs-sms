import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Megaphone, X, Film } from 'lucide-react';
import { api, fileUrl } from '../lib/api';
import { subscribeLive } from '../lib/realtime';
import { PageHead, Badge, Modal, Empty, ErrorBanner, ConfirmModal, SkeletonTable } from '../components/ui';
import { useAuth } from '../lib/auth';
import FileUpload from '../components/FileUpload';

export default function Announcements() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ title: '', body: '', audience: 'all', priority: 'normal', media: [] });
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const canWrite = ['super_admin', 'school_admin'].includes(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('/announcements?limit=100');
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
    if (msg.type === 'announcement') load();
  }), [load]);

  function openCreate() {
    setForm({ title: '', body: '', audience: 'all', priority: 'normal', media: [] });
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(a) {
    setForm({ title: a.title, body: a.body, audience: a.audience, priority: a.priority, media: a.media || [] });
    setEditing(a.id);
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
      if (editing) await api(`/announcements/${editing}`, { method: 'PATCH', body: form });
      else await api('/announcements', { method: 'POST', body: form });
      setShowModal(false);
      load();
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function remove(a) {
    setConfirmAction({ message: t('announcements.deleteConfirm', { title: a.title }), action: async () => {
      try {
        await api(`/announcements/${a.id}`, { method: 'DELETE' });
      } catch (e) {
        setError(e.message);
      } finally {
        load();
      }
    } });
  }

  const canDelete = ['super_admin', 'school_admin'].includes(user?.role);

  return (
    <>
      <PageHead title={t('announcements.title')} sub={t('announcements.subtitle')}>
        {canWrite && <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> {t('announcements.newAnnouncement')}</button>}
      </PageHead>
      <ErrorBanner error={error} />
      {loading ? <SkeletonTable rows={5} cols={3} /> : rows.length === 0 ? <Empty text={t('announcements.noData')} /> : (
        <div className="grid" style={{ gap: 14 }}>
          {rows.map((a) => (
            <div className="card" key={a.id}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <Megaphone size={16} style={{ color: 'var(--accent)' }} />
                <strong>{a.title}</strong>
                <Badge status={a.priority} />
                <Badge status={a.audience === 'all' ? 'ok' : a.audience} />
                <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: 12.5 }}>
                  {a.author_name || 'System'} · {a.created_at?.slice(0, 10)}
                </span>
                {canDelete && (
                  <span style={{ display: 'flex', gap: 6 }}>
                    {canWrite && <button className="btn btn-sm" onClick={() => openEdit(a)} aria-label="Edit announcement"><Pencil size={13} aria-hidden="true" /></button>}
                    <button className="btn btn-sm btn-danger" onClick={() => remove(a)} aria-label="Delete announcement"><Trash2 size={13} aria-hidden="true" /></button>
                  </span>
                )}
              </div>
              <p style={{ margin: '10px 0 0', color: 'var(--text-dim)', lineHeight: 1.7, fontSize: 14 }}>{a.body}</p>
              {(a.media || []).length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginTop: 12 }}>
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
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal
          title={editing ? t('announcements.editAnnouncement') : t('announcements.newAnnouncement')}
          sub={t('announcements.audienceInfo')}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={save}>
            <label>{t('common.title')} *</label>
            <input required value={form.title} onChange={(e) => set('title', e.target.value)} />
            <label>{t('announcements.message')} *</label>
            <textarea required rows={5} value={form.body} onChange={(e) => set('body', e.target.value)} />
              <div className="form-row">
                <div>
                  <label>{t('announcements.audienceLabel')}</label>
                  <select value={form.audience} onChange={(e) => set('audience', e.target.value)}>
                    <option value="all">{t('announcements.everyone')}</option>
                    <option value="teachers">{t('announcements.teachersStaff')}</option>
                    <option value="students">{t('announcements.students')}</option>
                    <option value="parents">{t('announcements.parents')}</option>
                  </select>
                </div>
                <div>
                  <label>{t('announcements.priorityLabel')}</label>
                  <select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                    <option value="normal">{t('announcements.normal')}</option>
                    <option value="high">{t('announcements.high')}</option>
                    <option value="urgent">{t('announcements.urgent')}</option>
                  </select>
                </div>
              </div>
              <label>{t('announcements.media')}</label>
              {form.media.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  {form.media.map((m, i) => (
                    <div key={i} style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', position: 'relative', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {m.type === 'video' ? (
                        <Film size={24} style={{ color: 'var(--accent-2)' }} />
                      ) : (
                        <img src={fileUrl(m.url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                      <button type="button" onClick={() => removeMedia(i)} aria-label="Remove media" style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <FileUpload folder="announcements" accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime" onUpload={onUploadMedia} label={t('announcements.mediaHint')} compact />
            </form>
        </Modal>
      )}
      {confirmAction && <ConfirmModal message={confirmAction.message} danger onConfirm={() => { confirmAction.action(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />}
    </>
  );
}
