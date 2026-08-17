import { useEffect, useState } from 'react';
import { Shield, Plus, Pencil, Trash2, Eye, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { PageHead, Badge, Modal, Empty, ErrorBanner, Spinner } from '../components/ui';

const TYPES = [
  { value: 'custom', label: 'Custom' },
  { value: 'data_privacy', label: 'RA 10173 Data Privacy' },
];

export default function ConsentForms() {
  const { t } = useTranslation();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const blank = { title: '', description: '', content: '', form_type: 'custom', is_active: true, require_sign: true };
  const [form, setForm] = useState(blank);
  const [confirmDelete, setConfirmDelete] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const r = await api('/consent/forms');
      setForms(r.data || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openNew() { setEditing('new'); setForm(blank); }
  function openEdit(f) { setEditing(f.id); setForm({ title: f.title, description: f.description || '', content: f.content, form_type: f.form_type, is_active: !!f.is_active, require_sign: !!f.require_sign }); }

  async function save() {
    if (!form.title.trim()) return setError('Title is required');
    if (!form.content.trim()) return setError('Content is required');
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const body = { ...form, title: form.title.trim(), description: form.description.trim(), content: form.content.trim() };
      if (editing === 'new') {
        await api('/consent/forms', { method: 'POST', body });
        setNotice('Consent form created.');
      } else {
        await api(`/consent/forms/${editing}`, { method: 'PUT', body });
        setNotice('Consent form updated.');
      }
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function doDelete(id) {
    setBusy(true);
    setError(null);
    try {
      await api(`/consent/forms/${id}`, { method: 'DELETE' });
      setNotice('Consent form deleted.');
      setConfirmDelete(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function input(key, val) { setForm(f => ({ ...f, [key]: val })); }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHead title={t('consent.title', 'Consent Forms')} subtitle={t('consent.subtitle', 'Manage data privacy consent forms and digital agreements')} />
      {error && <ErrorBanner msg={error} onClose={() => setError(null)} />}
      {notice && <div className="bg-emerald-900/40 border border-emerald-700/50 text-emerald-200 px-4 py-3 rounded-lg text-sm">{notice}</div>}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-zinc-400">{forms.length} form{forms.length !== 1 ? 's' : ''}</p>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors">
          <Plus className="w-4 h-4" /> New Consent Form
        </button>
      </div>

      {forms.length === 0 ? <Empty message="No consent forms yet." /> : (
        <div className="space-y-4">
          {forms.map(f => (
            <div key={f.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
                    <h3 className="text-zinc-100 font-medium">{f.title}</h3>
                    <Badge kind={f.is_active ? 'success' : 'muted'}>{f.is_active ? 'Active' : 'Inactive'}</Badge>
                    <Badge kind="info">{TYPES.find(x => x.value === f.form_type)?.label || f.form_type}</Badge>
                    {f.require_sign === 1 || f.require_sign === true ? <Badge kind="warning">Requires Signature</Badge> : null}
                  </div>
                  {f.description && <p className="text-zinc-400 text-sm mt-1">{f.description}</p>}
                  <p className="text-zinc-500 text-xs mt-2">{f.response_count ?? 0} signed</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setViewing(f)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors" title="View content">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEdit(f)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setConfirmDelete(f)} className="p-2 rounded-lg hover:bg-red-900/30 text-zinc-400 hover:text-red-400 transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Content Modal */}
      {viewing && (
        <Modal title={viewing.title} onClose={() => setViewing(null)}>
          <div className="whitespace-pre-wrap text-sm text-zinc-300 leading-relaxed max-h-[60vh] overflow-y-auto">{viewing.content}</div>
          <div className="mt-4 flex justify-end">
            <button onClick={() => setViewing(null)} className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-200">Close</button>
          </div>
        </Modal>
      )}

      {/* Edit / New Modal */}
      {editing && (
        <Modal title={editing === 'new' ? 'New Consent Form' : 'Edit Consent Form'} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Title <span className="text-red-400">*</span></label>
              <input value={form.title} onChange={e => input('title', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Description</label>
              <input value={form.description} onChange={e => input('description', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Content (consent text) <span className="text-red-400">*</span></label>
              <textarea rows={10} value={form.content} onChange={e => input('content', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Type</label>
                <select value={form.form_type} onChange={e => input('form_type', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {TYPES.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col justify-center gap-3 pt-5">
                <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => input('is_active', e.target.checked)} className="rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500" />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input type="checkbox" checked={form.require_sign} onChange={e => input('require_sign', e.target.checked)} className="rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500" />
                  Require digital signature
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-200">Cancel</button>
              <button onClick={save} disabled={busy} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Saving...' : 'Save Form'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <Modal title="Delete Consent Form" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-zinc-300 mb-4">Are you sure you want to delete <strong>{confirmDelete.title}</strong>? All signed responses will also be removed.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-200">Cancel</button>
            <button onClick={() => doDelete(confirmDelete.id)} disabled={busy} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Deleting...' : 'Delete'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
