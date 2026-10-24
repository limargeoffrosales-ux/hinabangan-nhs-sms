import { useEffect, useState, useCallback } from 'react';
import { FileCheck2, PenLine, CheckCircle2, XCircle, AlertCircle, Loader2, Plus, Pencil, Trash2, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { PageHead, Badge, Empty, Modal, ConfirmModal } from '../components/ui';

const FORM_TYPES = {
  custom: { label: 'Custom', cls: 'badge-gray', color: '#6b7280' },
  data_privacy: { label: 'Data Privacy', cls: 'badge-blue', color: '#3b82f6' },
  photo_video: { label: 'Photo / Video', cls: 'badge-green', color: '#22c55e' },
  ai_usage: { label: 'AI Usage', cls: 'badge-yellow', color: '#f59e0b' },
};

const STUDENT_BOUND = new Set(['data_privacy', 'photo_video']);

const EMPTY_FORM = { title: '', description: '', content: '', form_type: 'custom', is_active: true, require_sign: true };

function StatusDot({ active }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: active ? '#22c55e' : '#94a3b8',
      boxShadow: active ? '0 0 6px rgba(34,197,94,0.5)' : 'none',
    }} />
  );
}

function ProgressBar({ signed, total }) {
  const pct = total > 0 ? Math.round((signed / total) * 100) : 0;
  return (
    <div style={{ width: '100%', height: 6, background: 'var(--bg-soft, #f1f5f9)', borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#22c55e' : 'var(--accent, #3b82f6)', borderRadius: 3, transition: 'width 0.4s ease' }} />
    </div>
  );
}

export default function Consent() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = can(user?.role, 'super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar');

  const typeLabels = {
    custom: t('consent.formTypeCustom', 'Custom'),
    data_privacy: t('consent.formTypeDataPrivacy', 'Data Privacy'),
    photo_video: t('consent.formTypePhotoVideo', 'Photo / Video'),
    ai_usage: t('consent.formTypeAiUsage', 'AI Usage'),
  };

  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Sign modal
  const [signForm, setSignForm] = useState(null);
  const [signStudent, setSignStudent] = useState(null);
  const [signature, setSignature] = useState('');
  const [busy, setBusy] = useState(false);

  // Admin CRUD
  const [showEditor, setShowEditor] = useState(false);
  const [editingForm, setEditingForm] = useState(null);
  const [formDraft, setFormDraft] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [counts, setCounts] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoints = isAdmin
        ? [api('/consents/forms'), api('/consents/responses/counts')]
        : [api('/consents/forms/active')];
      const results = await Promise.allSettled(endpoints);
      if (isAdmin) {
        setForms(results[0]?.status === 'fulfilled' ? (results[0].value.data || []) : []);
        setCounts(results[1]?.status === 'fulfilled' ? (results[1].value.data || []) : []);
      } else {
        setForms(results[0]?.status === 'fulfilled' ? (results[0].value.data || []) : []);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const countMap = {};
  counts.forEach((c) => { countMap[c.form_id] = Number(c.count) || 0; });

  // --- Sign ---
  async function submitSign(e) {
    e.preventDefault();
    if (!signForm) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api(`/consents/forms/${signForm.id}/sign`, {
        method: 'POST',
        body: { signature_name: signature.trim() || null, student_id: signStudent || undefined },
      });
      setNotice(res.alreadySigned ? t('consent.signNoticeAlready', 'You have already signed "{{title}}".', { title: signForm.title }) : t('consent.signNoticeDone', 'You have signed "{{title}}". Thank you.', { title: signForm.title }));
      setSignForm(null);
      setSignature('');
      load();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  // --- Admin CRUD ---
  function openCreate() {
    setEditingForm(null);
    setFormDraft({ ...EMPTY_FORM });
    setShowEditor(true);
  }

  function openEdit(f) {
    setEditingForm(f);
    setFormDraft({ title: f.title, description: f.description || '', content: f.content, form_type: f.form_type, is_active: !!f.is_active, require_sign: !!f.require_sign });
    setShowEditor(true);
  }

  async function saveForm(e) {
    e.preventDefault();
    if (!formDraft.title.trim() || !formDraft.content.trim()) { setError(t('consent.titleContentRequired', 'Title and content are required.')); return; }
    setSaving(true);
    setError(null);
    try {
      if (editingForm) {
        await api(`/consents/forms/${editingForm.id}`, { method: 'PATCH', body: formDraft });
      } else {
        await api('/consents/forms', { method: 'POST', body: formDraft });
      }
      setShowEditor(false);
      load();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteForm(f) {
    try {
      await api(`/consents/forms/${f.id}`, { method: 'DELETE' });
      setConfirmDel(null);
      load();
    } catch (e2) {
      setError(e2.message);
    }
  }

  return (
    <div>
      <PageHead
        title={t('consent.title', 'Consent Forms')}
        sub={isAdmin ? t('consent.subtitleAdmin', 'Create, manage, and track consent forms') : t('consent.subtitleStudent', 'Review and sign the active consent forms issued by the school')}
        icon={<FileCheck2 size={20} />}
      >
        {isAdmin && (
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={14} /> {t('consent.newForm', 'New Form')}
          </button>
        )}
      </PageHead>

      {error && <div className="err-banner" role="alert"><AlertCircle size={14} /> {error}</div>}
      {notice && <div className="ok-banner" role="status" aria-live="polite">{notice}</div>}

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center' }}><Loader2 size={22} className="spin" /></div>
      ) : forms.length === 0 ? (
        <Empty text={isAdmin ? t('consent.emptyAdmin', 'No consent forms yet. Create one to get started.') : t('consent.emptyStudent', 'There are no active consent forms right now.')} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16, maxWidth: 1100 }}>
          {forms.map((f) => {
            const meta = FORM_TYPES[f.form_type] || FORM_TYPES.custom;
            const signed = Number(f.signed_by_me) > 0;
            const respCount = countMap[f.id] || Number(f.response_count) || 0;
            const totalUsers = isAdmin ? (f.total_users || 0) : 0;
            return (
              <div key={f.id} className="card" style={{
                display: 'flex', flexDirection: 'column', gap: 10,
                borderLeft: `3px solid ${meta.color}`,
                opacity: isAdmin && !f.is_active ? 0.65 : 1,
                transition: 'box-shadow 0.2s',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 650 }}>{f.title}</h3>
                      <Badge status={meta.cls} style={{ fontSize: 10.5 }}>{typeLabels[f.form_type] || typeLabels.custom}</Badge>
                    </div>
                    {f.description && <p className="sub" style={{ margin: '2px 0 0', fontSize: 12.5 }}>{f.description}</p>}
                  </div>
                  {/* Status chip */}
                  {isAdmin ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: f.is_active ? 'var(--success)' : 'var(--text-dim)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        <StatusDot active={f.is_active} />
                        {f.is_active ? t('consent.statusActive', 'Active') : t('consent.statusInactive', 'Inactive')}
                      </span>
                  ) : signed ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
                      <CheckCircle2 size={15} /> {t('consent.statusSigned', 'Signed')}
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-dim)', fontSize: 13 }}>
                      <XCircle size={14} /> {t('consent.statusPending', 'Pending')}
                    </span>
                  )}
                </div>

                {/* Content preview */}
                <div style={{
                  fontSize: 13, lineHeight: 1.55, color: 'var(--text)',
                  whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'hidden', position: 'relative',
                  background: 'var(--bg-soft, #f8fafc)', borderRadius: 8, padding: '10px 12px',
                }}>
                  {f.content}
                  {f.content.length > 200 && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 32, background: 'linear-gradient(transparent, var(--bg-soft, #f8fafc))' }} />}
                </div>

                {/* Response progress (admin only) */}
                {isAdmin && totalUsers > 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-dim)' }}>
                      <span>{t('consent.responsesProgress', '{{respCount}} of {{totalUsers}} signed', { respCount, totalUsers })}</span>
                      <span>{Math.round((respCount / totalUsers) * 100)}%</span>
                    </div>
                    <ProgressBar signed={respCount} total={totalUsers} />
                  </div>
                )}

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {f.require_sign ? t('consent.signatureRequired', 'Signature required') : t('consent.acknowledgementOnly', 'Acknowledgement only')}
                    {f.created_at && ` · ${new Date(f.created_at).toLocaleDateString()}`}
                  </span>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {isAdmin ? (
                      <>
                        <button className="btn btn-sm" onClick={() => openEdit(f)} title={t('consent.editTitle', 'Edit')}><Pencil size={13} /></button>
                        <button className="btn btn-sm btn-danger" onClick={() => setConfirmDel(f)} title={t('consent.deleteTitle', 'Delete')}><Trash2 size={13} /></button>
                      </>
                    ) : signed ? (
                      <button className="btn btn-sm" disabled style={{ opacity: 0.6 }}><CheckCircle2 size={13} /> {t('consent.statusSigned', 'Signed')}</button>
                    ) : (() => {
                      const needStudent = STUDENT_BOUND.has(f.form_type) && !(f.eligible_students || []).length;
                      if (needStudent) {
                        return <button className="btn btn-sm" disabled title={t('consent.linkGuardianTitle', 'Link a guardian first')}>{t('consent.perStudent', 'Per-student')}</button>;
                      }
                      return (
                        <button className="btn btn-primary btn-sm" onClick={() => { setSignature(''); setNotice(null); setSignStudent((f.eligible_students || []).length === 1 ? f.eligible_students[0].id : null); setSignForm(f); }}>
                          <PenLine size={13} /> {f.require_sign ? t('consent.actionReviewSign', 'Review & Sign') : t('consent.actionAcknowledge', 'Acknowledge')}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- Sign Modal --- */}
      {signForm && (
        <Modal
          title={t('consent.signModalTitle', 'Sign: {{title}}', { title: signForm.title })}
          sub={t('consent.signModalSub', 'Your electronic signature confirms you have read and understand this consent form')}
          onClose={() => setSignForm(null)}
        >
          <form onSubmit={submitSign}>
            <div style={{ background: 'var(--bg-soft, #f8fafc)', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', maxHeight: 240, overflowY: 'auto' }}>
              {signForm.content}
            </div>
            {(signForm.eligible_students || []).length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <label>{t('consent.signingForLabel', 'Signing for (student) *')}</label>
                <select
                  className="input"
                  value={signStudent === null ? '' : signStudent}
                  onChange={(e) => setSignStudent(e.target.value ? Number(e.target.value) : null)}
                >
                  {signForm.eligible_students.length > 1 && <option value="">{t('consent.selectStudentOption', 'Select a student...')}</option>}
                  {signForm.eligible_students.map((s) => (
                    <option key={s.id} value={s.id}>{t('consent.studentOption', '{{name}} (LRN {{lrn}})', { name: s.name, lrn: s.lrn })}</option>
                  ))}
                </select>
              </div>
            )}
            <label>{t('consent.fullNameLabel', 'Your full name (signature) *')}</label>
            <input
              className="input"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder={t('consent.fullNamePlaceholder', 'Type your full legal name')}
              required
              autoFocus
            />
            <div className="sub" style={{ marginTop: 6 }}>
              {t('consent.signAgreement', 'By signing you agree to the terms described above. This will be recorded with your account and the school time.')}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setSignForm(null)}>{t('consent.cancel', 'Cancel')}</button>
              <button className="btn btn-primary" disabled={busy}>{busy ? t('consent.signing', 'Signing...') : t('consent.confirmSignature', 'Confirm Signature')}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* --- Admin Editor Modal --- */}
      {showEditor && (
        <Modal
          title={editingForm ? t('consent.editFormTitle', 'Edit Consent Form') : t('consent.newFormTitle', 'New Consent Form')}
          sub={editingForm ? t('consent.editFormSub', 'Update consent form details') : t('consent.newFormSub', 'Create a new consent form for students, parents, or staff')}
          onClose={() => setShowEditor(false)}
          wide
        >
          <form onSubmit={saveForm}>
            <div className="form-row">
              <div style={{ flex: 2 }}>
                <label>{t('consent.titleLabel', 'Title *')}</label>
                <input className="input" value={formDraft.title} onChange={(e) => setFormDraft({ ...formDraft, title: e.target.value })} placeholder={t('consent.titlePlaceholder', 'e.g. Data Privacy Consent Form')} required />
              </div>
              <div style={{ flex: 1 }}>
                <label>{t('consent.formTypeLabel', 'Form Type')}</label>
                <select className="input" value={formDraft.form_type} onChange={(e) => setFormDraft({ ...formDraft, form_type: e.target.value })}>
                  {Object.entries(FORM_TYPES).map(([k, v]) => <option key={k} value={k}>{typeLabels[k] || v.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row" style={{ gap: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={formDraft.is_active} onChange={(e) => setFormDraft({ ...formDraft, is_active: e.target.checked })} />
                {t('consent.activeToggle', 'Active (visible to users)')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={formDraft.require_sign} onChange={(e) => setFormDraft({ ...formDraft, require_sign: e.target.checked })} />
                {t('consent.requireSignToggle', 'Require electronic signature')}
              </label>
            </div>
            <label>{t('consent.descriptionLabel', 'Description')} <span className="sub">{t('consent.optionalTag', '(optional)')}</span></label>
            <input className="input" value={formDraft.description} onChange={(e) => setFormDraft({ ...formDraft, description: e.target.value })} placeholder={t('consent.descriptionPlaceholder', 'Brief summary shown on the card')} />
            <label style={{ marginTop: 8 }}>{t('consent.contentLabel', 'Content *')}</label>
            <textarea
              className="input"
              rows={8}
              value={formDraft.content}
              onChange={(e) => setFormDraft({ ...formDraft, content: e.target.value })}
              placeholder={t('consent.contentPlaceholder', 'Full consent form text...')}
              required
              style={{ fontFamily: 'inherit', lineHeight: 1.6 }}
            />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowEditor(false)}>{t('consent.cancel', 'Cancel')}</button>
              <button className="btn btn-primary" disabled={saving}>
                <Save size={13} /> {saving ? t('consent.saving', 'Saving...') : (editingForm ? t('consent.updateForm', 'Update Form') : t('consent.createForm', 'Create Form'))}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* --- Delete Confirmation --- */}
      {confirmDel && (
        <ConfirmModal
          message={t('consent.deleteConfirm', 'Delete "{{title}}"? This cannot be undone.', { title: confirmDel.title })}
          danger
          onConfirm={() => deleteForm(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}
