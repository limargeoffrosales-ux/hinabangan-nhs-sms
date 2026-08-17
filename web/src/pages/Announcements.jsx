import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Megaphone } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Badge, Modal, Empty, ErrorBanner, Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';

export default function Announcements() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ title: '', body: '', audience: 'all', priority: 'normal' });
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const canWrite = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'teacher'].includes(user?.role);

  async function load() {
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
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm({ title: '', body: '', audience: 'all', priority: 'normal' });
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(a) {
    setForm({ title: a.title, body: a.body, audience: a.audience, priority: a.priority });
    setEditing(a.id);
    setShowModal(true);
  }

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
    if (!confirm(t('announcements.deleteConfirm', { title: a.title }))) return;
    await api(`/announcements/${a.id}`, { method: 'DELETE' });
    load();
  }

  const canDelete = ['super_admin', 'school_admin', 'principal', 'assistant_principal'].includes(user?.role);

  return (
    <>
      <PageHead title={t('announcements.title')} sub={t('announcements.subtitle')}>
        {canWrite && <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> {t('announcements.newAnnouncement')}</button>}
      </PageHead>
      <ErrorBanner error={error} />
      {loading ? <Spinner /> : rows.length === 0 ? <Empty text={t('announcements.noData')} /> : (
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
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary">{t('announcements.publish')}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
