import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Pencil, Trash2, Upload, BookOpen, Layers, RefreshCw, FileText,
  Paperclip, Target, Video, Link2, Presentation, ListChecks, File as FileIcon,
} from 'lucide-react';
import { api, getApiBase } from '../lib/api';
import { safeHttpUrl } from '../lib/utils';
import { PageHead, Empty, ErrorBanner, Modal, ConfirmModal, RichTextEditor } from '../components/ui';

const MATERIAL_TYPES = ['reading', 'presentation', 'document', 'video', 'link', 'activity', 'other'];

const TYPE_META = {
  reading: { icon: BookOpen, color: 'var(--accent)' },
  presentation: { icon: Presentation, color: 'var(--accent-2, #6366f1)' },
  document: { icon: FileText, color: 'var(--accent)' },
  video: { icon: Video, color: 'var(--danger, #e11d48)' },
  link: { icon: Link2, color: 'var(--accent-2, #6366f1)' },
  activity: { icon: ListChecks, color: 'var(--warning, #d97706)' },
  other: { icon: FileIcon, color: 'var(--text-dim)' },
};

const EMPTY_MODULE = {
  title: '', description: '', quarter: '', week_or_module: '', order_index: 0, published: false,
};

const EMPTY_MATERIAL = {
  title: '', body: '', type: 'reading', module_id: '', url: '', drive_url: '',
  youtube_url: '', dll_url: '', lesson_plan_url: '', sort_order: 0, published: false,
  is_remedial: false, is_enrichment: false, is_differentiated: false, target_ids: [],
};

function formatBytes(n) {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function MaterialRow({ m, atts, open, onToggle, onEdit, onDelete, onUpload, onRemoveAtt }) {
  const { t } = useTranslation();
  const meta = TYPE_META[m.type] || TYPE_META.other;
  const Icon = meta.icon;
  const links = [m.url, m.drive_url, m.youtube_url, m.lesson_plan_url, m.dll_url].filter((u) => safeHttpUrl(u));
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 8, marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={15} style={{ color: meta.color, flexShrink: 0 }} />
        <strong style={{ flex: 1, fontSize: 13.5 }}>{m.title}</strong>
        {m.is_remedial && <span className="badge badge-yellow">{t('lm.isRemedial', 'Remedial')}</span>}
        {m.is_enrichment && <span className="badge badge-green">{t('lm.isEnrichment', 'Enrichment')}</span>}
        {m.target_student_ids ? <span className="badge badge-blue"><Target size={11} /> {t('lm.targeted', 'Targeted')}</span> : null}
        {m.published ? <span className="badge badge-green">{t('lm.published', 'Published')}</span> : <span className="badge badge-gray">{t('lm.draft', 'Draft')}</span>}
        <button type="button" className="icon-btn" onClick={onToggle} title={t('lm.attachments', 'Attachments')} aria-label={t('lm.attachments', 'Attachments')}><Paperclip size={14} /></button>
        <button type="button" className="icon-btn" onClick={onEdit} title={t('lm.edit', 'Edit')} aria-label={t('lm.edit', 'Edit')}><Pencil size={14} /></button>
        <button type="button" className="icon-btn" onClick={onDelete} title={t('lm.delete', 'Delete')} aria-label={t('lm.delete', 'Delete')}><Trash2 size={14} /></button>
      </div>
      {links.length > 0 && (
        <div className="sub" style={{ marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {links.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer">{u.replace(/^https?:\/\//, '').slice(0, 40)}</a>)}
        </div>
      )}
      {open && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <label className="btn btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
              <Upload size={13} /> {t('lm.uploadFile', 'Upload file')}
              <input type="file" style={{ display: 'none' }} onChange={(e) => { onUpload(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
          {!(atts || []).length ? <div className="sub">{t('lm.noAttachments', 'No files.')}</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(atts || []).map((a) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                  <FileText size={13} style={{ color: 'var(--text-dim)' }} />
                  <a href={`${getApiBase()}/lm/attachments/${a.id}/download`} target="_blank" rel="noreferrer" style={{ flex: 1 }}>{a.original_name}</a>
                  <span className="sub">{formatBytes(a.size_bytes)}</span>
                  <button type="button" className="icon-btn" onClick={() => onRemoveAtt(a)} title={t('lm.delete', 'Delete')} aria-label={t('lm.delete', 'Delete')}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LearningHub() {
  const { t } = useTranslation();
  const [sy, setSy] = useState('2026-2027');
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [spaceId, setSpaceId] = useState('');
  const [modules, setModules] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [roster, setRoster] = useState([]);
  const [atts, setAtts] = useState({});
  const [openMaterial, setOpenMaterial] = useState(null);

  const [moduleOpen, setModuleOpen] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [moduleForm, setModuleForm] = useState(EMPTY_MODULE);

  const [materialOpen, setMaterialOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [materialForm, setMaterialForm] = useState(EMPTY_MATERIAL);

  const [confirmAction, setConfirmAction] = useState(null);
  const [attachments, setAttachments] = useState({});
  const [openAttachment, setOpenAttachment] = useState(null);

  const space = spaces.find((s) => String(s.id) === String(spaceId));

  const loadSpaces = useCallback(async () => {
    setError(null);
    try {
      const d = await api(`/lm/spaces?school_year=${encodeURIComponent(sy)}`);
      setSpaces(d.data || []);
    } catch (e) {
      setError(e.message);
    }
  }, [sy]);

  useEffect(() => { loadSpaces(); }, [loadSpaces]);

  const loadSpaceData = useCallback(async () => {
    if (!spaceId) return;
    setError(null);
    try {
      const [mod, mat] = await Promise.all([
        api(`/lm/spaces/${spaceId}/modules`),
        api(`/lm/spaces/${spaceId}/materials`),
      ]);
      setModules(mod.data || []);
      setMaterials(mat.data || []);
    } catch (e) {
      setError(e.message);
    }
  }, [spaceId]);

  useEffect(() => { loadSpaceData(); }, [loadSpaceData]);

  const loadRoster = useCallback(async (sectionId) => {
    if (!sectionId) return;
    try {
      const r = await api(`/sections/${sectionId}/students`);
      setRoster(r.data || []);
    } catch { setRoster([]); }
  }, []);

  async function syncSpaces() {
    setError(null);
    setNotice(null);
    try {
      const r = await api(`/lm/spaces/sync?school_year=${encodeURIComponent(sy)}`, { method: 'POST' });
      await loadSpaces();
      setNotice(t('lm.syncDone', 'Synced: {{created}} created, {{existing}} already existed.', { created: r.created, existing: r.existing }));
    } catch (e) {
      setError(e.message);
    }
  }

  function openCreateModule() {
    setEditingModule(null);
    setModuleForm({ ...EMPTY_MODULE, order_index: modules.length });
    setModuleOpen(true);
  }
  function openEditModule(m) {
    setEditingModule(m);
    setModuleForm({
      title: m.title || '',
      description: m.description || '',
      quarter: m.quarter || '',
      week_or_module: m.week_or_module || '',
      order_index: m.order_index ?? 0,
      published: !!m.published,
    });
    setModuleOpen(true);
  }
  async function saveModule(e) {
    e.preventDefault();
    if (!moduleForm.title.trim()) return;
    setError(null);
    try {
      const body = {
        title: moduleForm.title.trim(),
        description: moduleForm.description || null,
        quarter: moduleForm.quarter ? Number(moduleForm.quarter) : null,
        week_or_module: moduleForm.week_or_module || null,
        order_index: Number(moduleForm.order_index) || 0,
        published: !!moduleForm.published,
      };
      if (editingModule) await api(`/lm/spaces/${spaceId}/modules/${editingModule.id}`, { method: 'PATCH', body });
      else await api(`/lm/spaces/${spaceId}/modules`, { method: 'POST', body });
      setModuleOpen(false);
      await loadSpaceData();
    } catch (err) {
      setError(err.message);
    }
  }

  function openCreateMaterial() {
    setEditingMaterial(null);
    setMaterialForm(EMPTY_MATERIAL);
    setOpenAttachment(null);
    setMaterialOpen(true);
    loadRoster(space?.section_id);
  }
  function openEditMaterial(m) {
    setEditingMaterial(m);
    let ids = [];
    if (Array.isArray(m.target_student_ids)) ids = m.target_student_ids.map(Number);
    else if (typeof m.target_student_ids === 'string' && m.target_student_ids) {
      try { ids = JSON.parse(m.target_student_ids).map(Number); } catch { ids = []; }
    }
    setMaterialForm({
      title: m.title || '',
      body: m.body || '',
      type: m.type || 'reading',
      module_id: m.module_id ? String(m.module_id) : '',
      url: m.url || '',
      drive_url: m.drive_url || '',
      youtube_url: m.youtube_url || '',
      dll_url: m.dll_url || '',
      lesson_plan_url: m.lesson_plan_url || '',
      sort_order: m.sort_order ?? 0,
      published: !!m.published,
      is_remedial: !!m.is_remedial,
      is_enrichment: !!m.is_enrichment,
      is_differentiated: !!m.is_differentiated,
      target_ids: ids,
    });
    setMaterialOpen(true);
    loadRoster(space?.section_id);
  }
  async function saveMaterial(e) {
    e.preventDefault();
    if (!materialForm.title.trim()) return;
    setError(null);
    try {
      const body = {
        title: materialForm.title.trim(),
        body: materialForm.body || null,
        type: materialForm.type,
        module_id: materialForm.module_id ? Number(materialForm.module_id) : null,
        url: materialForm.url || null,
        drive_url: materialForm.drive_url || null,
        youtube_url: materialForm.youtube_url || null,
        dll_url: materialForm.dll_url || null,
        lesson_plan_url: materialForm.lesson_plan_url || null,
        sort_order: Number(materialForm.sort_order) || 0,
        published: !!materialForm.published,
        is_remedial: !!materialForm.is_remedial,
        is_enrichment: !!materialForm.is_enrichment,
        is_differentiated: !!materialForm.is_differentiated,
        target_student_ids: materialForm.target_ids.length ? materialForm.target_ids : null,
      };
      if (editingMaterial) await api(`/lm/spaces/${spaceId}/materials/${editingMaterial.id}`, { method: 'PATCH', body });
      else await api(`/lm/spaces/${spaceId}/materials`, { method: 'POST', body });
      setMaterialOpen(false);
      await loadSpaceData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadAttachments(materialId) {
    try {
      const r = await api(`/lm/spaces/${spaceId}/materials/${materialId}/attachments`);
      setAttachments((prev) => ({ ...prev, [materialId]: r.data || [] }));
    } catch (e) {
      setError(e.message);
    }
  }
  function toggleAttachments(materialId) {
    if (openAttachment === materialId) { setOpenAttachment(null); return; }
    setOpenAttachment(materialId);
    if (!attachments[materialId]) loadAttachments(materialId);
  }
  async function uploadAttachment(materialId, file) {
    if (!file) return;
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api(`/lm/spaces/${spaceId}/materials/${materialId}/attachments`, { method: 'POST', body: fd });
      await loadAttachments(materialId);
    } catch (e) {
      setError(e.message);
    }
  }
  async function removeAttachment(a) {
    setError(null);
    try {
      await api(`/lm/attachments/${a.id}`, { method: 'DELETE' });
      await loadAttachments(a.material_id);
    } catch (e) {
      setError(e.message);
    }
  }

  function setMaterialField(patch) { setMaterialForm((f) => ({ ...f, ...patch })); }
  const byModule = (moduleId) => materials.filter((m) => (m.module_id ? Number(m.module_id) : null) === moduleId);
  const unlinked = materials.filter((m) => !m.module_id);

  return (
    <>
      <PageHead title={t('lm.title', 'Learning Hub')} sub={t('lm.subtitle', 'Publish learning modules, materials, and files to your classes.')}>
        <button className="btn btn-primary" onClick={syncSpaces}><RefreshCw size={15} /> {t('lm.syncClasses', 'Sync my classes')}</button>
      </PageHead>
      <ErrorBanner error={error} />
      {notice && <div className="notice ok" role="status" aria-live="polite" style={{ marginBottom: 12 }}>{notice}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ margin: 0, alignItems: 'end' }}>
          <div><label>{t('lm.schoolYear', 'School year')}</label>
            <input value={sy} onChange={(e) => setSy(e.target.value)} /></div>
          <button className="btn" onClick={loadSpaces}>{t('lm.refresh', 'Refresh')}</button>
        </div>
      </div>

      {!spaces.length ? (
        <Empty text={t('lm.noSpaces', 'No learning spaces yet. Sync your classes to create a space for each class you teach.')} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 300px) 1fr', gap: 16, alignItems: 'start' }}>
          <div className="card" style={{ padding: 8 }}>
            <div className="sub" style={{ padding: '4px 8px 8px' }}>{t('lm.spacesHeading', 'My classes')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {spaces.map((s) => {
                const on = String(s.id) === spaceId;
                return (
                  <button key={s.id} type="button"
                    onClick={() => { setSpaceId(String(s.id)); setOpenAttachment(null); }}
                    style={{
                      textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 10px', cursor: 'pointer',
                      background: on ? 'var(--card-hover)' : 'none',
                      border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border)'),
                      borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                    }}>
                    <strong style={{ fontSize: 13.5 }}>{s.section_name || '—'} · {s.subject_code || '—'}</strong>
                    <span className="sub" style={{ fontSize: 11.5 }}>{s.subject_title || ''}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            {!spaceId ? (
              <Empty text={t('lm.selectSpace', 'Select a class to manage its modules and materials.')} />
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button className="btn btn-primary" onClick={openCreateModule}><Plus size={14} /> {t('lm.newModule', 'New module')}</button>
                  <button className="btn" onClick={openCreateMaterial}><Plus size={14} /> {t('lm.newMaterial', 'New material')}</button>
                </div>

                {!modules.length && !materials.length && <Empty text={t('lm.noContent', 'No modules or materials yet.')} />}

                {modules.map((mod) => (
                  <div className="card" key={mod.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Layers size={16} style={{ color: 'var(--accent)' }} />
                      <strong style={{ flex: 1 }}>{mod.title}</strong>
                      {mod.quarter ? <span className="badge badge-blue">{t('lm.qShort', 'Q{{q}}', { q: mod.quarter })}</span> : null}
                      {mod.week_or_module ? <span className="sub">{mod.week_or_module}</span> : null}
                      {mod.published ? <span className="badge badge-green">{t('lm.published', 'Published')}</span> : <span className="badge badge-gray">{t('lm.draft', 'Draft')}</span>}
                      <button type="button" className="icon-btn" onClick={() => openEditModule(mod)} title={t('lm.edit', 'Edit')} aria-label={t('lm.edit', 'Edit')}><Pencil size={14} /></button>
                      <button type="button" className="icon-btn" onClick={() => setConfirmAction({ message: t('lm.deleteModuleConfirm', 'Delete this module?'), action: () => api(`/lm/spaces/${spaceId}/modules/${mod.id}`, { method: 'DELETE' }).then(loadSpaceData).catch((e) => setError(e.message)) })} title={t('lm.delete', 'Delete')} aria-label={t('lm.delete', 'Delete')}><Trash2 size={14} /></button>
                    </div>
                    {mod.description && <div className="sub" style={{ marginTop: 6 }}>{mod.description}</div>}
                    <div style={{ marginTop: 10 }}>
                      {byModule(Number(mod.id)).length === 0
                        ? <div className="sub">{t('lm.noMaterials', 'No materials in this module.')}</div>
                        : byModule(Number(mod.id)).map((m) => (
                          <MaterialRow key={m.id} m={m} atts={attachments[m.id]} open={openAttachment === m.id}
                            onToggle={() => toggleAttachments(m.id)} onEdit={() => openEditMaterial(m)}
                            onDelete={() => setConfirmAction({ message: t('lm.deleteMaterialConfirm', 'Delete "{{title}}"? Its files will be removed.', { title: m.title }), action: () => api(`/lm/spaces/${spaceId}/materials/${m.id}`, { method: 'DELETE' }).then(loadSpaceData).catch((e) => setError(e.message)) })}
                            onUpload={(file) => uploadAttachment(m.id, file)} onRemoveAtt={removeAttachment} />
                        ))}
                    </div>
                  </div>
                ))}

                {unlinked.length > 0 && (
                  <div className="card" style={{ marginBottom: 12 }}>
                    <div className="sub" style={{ marginBottom: 8 }}>{t('lm.unlinked', 'Materials not in a module')}</div>
                    {unlinked.map((m) => (
                      <MaterialRow key={m.id} m={m} atts={attachments[m.id]} open={openAttachment === m.id}
                        onToggle={() => toggleAttachments(m.id)} onEdit={() => openEditMaterial(m)}
                        onDelete={() => setConfirmAction({ message: t('lm.deleteMaterialConfirm', 'Delete "{{title}}"? Its files will be removed.', { title: m.title }), action: () => api(`/lm/spaces/${spaceId}/materials/${m.id}`, { method: 'DELETE' }).then(loadSpaceData).catch((e) => setError(e.message)) })}
                        onUpload={(file) => uploadAttachment(m.id, file)} onRemoveAtt={removeAttachment} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {moduleOpen && (
        <Modal title={editingModule ? t('lm.editModule', 'Edit module') : t('lm.newModule', 'New module')} onClose={() => setModuleOpen(false)}>
          <form onSubmit={saveModule}>
            <label>{t('lm.moduleTitle', 'Module title')}</label>
            <input className="input" value={moduleForm.title} onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })} required autoFocus />
            <div className="form-row">
              <div style={{ width: 150 }}><label>{t('lm.quarter', 'Quarter')}</label>
                <select className="input" value={moduleForm.quarter} onChange={(e) => setModuleForm({ ...moduleForm, quarter: e.target.value })}>
                  <option value="">{t('lm.none', 'None')}</option>
                  <option value="1">{t('lm.quarterN', 'Quarter 1')}</option>
                  <option value="2">{t('lm.quarterN2', 'Quarter 2')}</option>
                  <option value="3">{t('lm.quarterN3', 'Quarter 3')}</option>
                </select>
              </div>
              <div style={{ flex: 1 }}><label>{t('lm.weekOrModule', 'Week / module')}</label>
                <input className="input" value={moduleForm.week_or_module} onChange={(e) => setModuleForm({ ...moduleForm, week_or_module: e.target.value })} /></div>
              <div style={{ width: 110 }}><label>{t('lm.order', 'Order')}</label>
                <input className="input" type="number" value={moduleForm.order_index} onChange={(e) => setModuleForm({ ...moduleForm, order_index: e.target.value })} /></div>
            </div>
            <label>{t('lm.body', 'Description')}</label>
            <textarea className="input" rows={3} value={moduleForm.description} onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })} />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
              <input type="checkbox" checked={moduleForm.published} onChange={(e) => setModuleForm({ ...moduleForm, published: e.target.checked })} />
              {t('lm.published', 'Published')}
            </label>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setModuleOpen(false)}>{t('lm.cancel', 'Cancel')}</button>
              <button className="btn btn-primary">{editingModule ? t('lm.save', 'Save') : t('lm.create', 'Create')}</button>
            </div>
          </form>
        </Modal>
      )}

      {materialOpen && (
        <Modal wide title={editingMaterial ? t('lm.editMaterial', 'Edit material') : t('lm.newMaterial', 'New material')} onClose={() => setMaterialOpen(false)}>
          <form onSubmit={saveMaterial}>
            <label>{t('lm.materialTitle', 'Material title')}</label>
            <input className="input" value={materialForm.title} onChange={(e) => setMaterialField({ title: e.target.value })} required autoFocus />
            <div className="form-row">
              <div style={{ flex: 1 }}><label>{t('lm.type', 'Type')}</label>
                <select className="input" value={materialForm.type} onChange={(e) => setMaterialField({ type: e.target.value })}>
                  {MATERIAL_TYPES.map((ty) => <option key={ty} value={ty}>{t(`lm.type.${ty}`, ty)}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}><label>{t('lm.moduleLabel', 'Module')}</label>
                <select className="input" value={materialForm.module_id} onChange={(e) => setMaterialField({ module_id: e.target.value })}>
                  <option value="">{t('lm.none', 'None')}</option>
                  {modules.map((mo) => <option key={mo.id} value={mo.id}>{mo.title}</option>)}
                </select>
              </div>
              <div style={{ width: 110 }}><label>{t('lm.order', 'Order')}</label>
                <input className="input" type="number" value={materialForm.sort_order} onChange={(e) => setMaterialField({ sort_order: e.target.value })} /></div>
            </div>
            <label>{t('lm.bodyContent', 'Content / description')}</label>
            <RichTextEditor value={materialForm.body} onChange={(html) => setMaterialField({ body: html })} rows={3} />
            <div className="form-row">
              <div style={{ flex: 1 }}><label>{t('lm.url', 'Link URL')}</label>
                <input className="input" value={materialForm.url} onChange={(e) => setMaterialField({ url: e.target.value })} placeholder="https://…" /></div>
              <div style={{ flex: 1 }}><label>{t('lm.youtubeUrl', 'YouTube URL')}</label>
                <input className="input" value={materialForm.youtube_url} onChange={(e) => setMaterialField({ youtube_url: e.target.value })} placeholder="https://…" /></div>
            </div>
            <div className="form-row">
              <div style={{ flex: 1 }}><label>{t('lm.driveUrl', 'Google Drive URL')}</label>
                <input className="input" value={materialForm.drive_url} onChange={(e) => setMaterialField({ drive_url: e.target.value })} placeholder="https://…" /></div>
              <div style={{ flex: 1 }}><label>{t('lm.lessonPlanUrl', 'Lesson plan URL')}</label>
                <input className="input" value={materialForm.lesson_plan_url} onChange={(e) => setMaterialField({ lesson_plan_url: e.target.value })} placeholder="https://…" /></div>
              <div style={{ flex: 1 }}><label>{t('lm.dllUrl', 'DLL URL')}</label>
                <input className="input" value={materialForm.dll_url} onChange={(e) => setMaterialField({ dll_url: e.target.value })} placeholder="https://…" /></div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={materialForm.published} onChange={(e) => setMaterialField({ published: e.target.checked })} />{t('lm.published', 'Published')}</label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={materialForm.is_remedial} onChange={(e) => setMaterialField({ is_remedial: e.target.checked })} />{t('lm.isRemedial', 'Remedial')}</label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={materialForm.is_enrichment} onChange={(e) => setMaterialField({ is_enrichment: e.target.checked })} />{t('lm.isEnrichment', 'Enrichment')}</label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={materialForm.is_differentiated} onChange={(e) => setMaterialField({ is_differentiated: e.target.checked })} />{t('lm.isDifferentiated', 'Differentiated')}</label>
            </div>
            <label style={{ marginTop: 12 }}>{t('lm.targeting', 'Target students')} <span className="muted">{t('lm.targetHint', '(leave unselected for the whole class)')}</span></label>
            <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 8 }}>
              {!roster.length ? <div className="sub">{t('lm.noRoster', 'No students found for this section.')}</div> : roster.map((st) => {
                const checked = materialForm.target_ids.map(Number).includes(Number(st.id));
                return (
                  <label key={st.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '2px 0', fontSize: 13 }}>
                    <input type="checkbox" checked={checked} onChange={(e) => {
                      const cur = new Set(materialForm.target_ids.map(Number));
                      if (e.target.checked) cur.add(Number(st.id)); else cur.delete(Number(st.id));
                      setMaterialField({ target_ids: [...cur] });
                    }} />
                    {st.last_name}, {st.first_name}
                  </label>
                );
              })}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setMaterialOpen(false)}>{t('lm.cancel', 'Cancel')}</button>
              <button className="btn btn-primary">{editingMaterial ? t('lm.save', 'Save') : t('lm.create', 'Create')}</button>
            </div>
          </form>
        </Modal>
      )}

      {confirmAction && <ConfirmModal message={confirmAction.message} danger onConfirm={() => { confirmAction.action(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />}
    </>
  );
}
