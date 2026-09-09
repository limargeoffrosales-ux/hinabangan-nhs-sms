import { useEffect, useState, useCallback } from 'react';
import { FileCheck2, PenLine, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, Badge, Empty, Modal } from '../components/ui';

const FORM_TYPES = {
  custom: { label: 'Custom', cls: 'gray' },
  data_privacy: { label: 'Data Privacy', cls: 'blue' },
  photo_video: { label: 'Photo / Video', cls: 'green' },
  ai_usage: { label: 'AI Usage', cls: 'yellow' },
};

const STUDENT_BOUND = new Set(['data_privacy', 'photo_video']);

export default function Consent() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signForm, setSignForm] = useState(null);
  const [signStudent, setSignStudent] = useState(null);
  const [signature, setSignature] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api('/consents/forms/active');
      setForms(res.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
      setNotice(res.alreadySigned ? `You have already signed "${signForm.title}".` : `You have signed "${signForm.title}". Thank you.`);
      setSignForm(null);
      setSignature('');
      load();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHead
        title="Consent Forms"
        sub="Review and sign the active consent forms issued by the school"
        icon={<FileCheck2 size={20} />}
      />
      {error && <div className="err-banner" role="alert"><AlertCircle size={14} /> {error}</div>}
      {notice && <div className="notice" role="status" aria-live="polite" style={{ marginBottom: 12 }}>{notice}</div>}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center' }}><Loader2 size={22} className="spin" /></div>
      ) : forms.length === 0 ? (
        <Empty text="There are no active consent forms right now." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 820 }}>
          {forms.map((f) => {
            const meta = FORM_TYPES[f.form_type] || FORM_TYPES.custom;
            const signed = Number(f.signed_by_me) > 0;
            return (
              <div key={f.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: 15 }}>{f.title}</h3>
                      <Badge status={meta.cls}>{meta.label}</Badge>
                    </div>
                    {f.description && <p className="sub" style={{ margin: '4px 0 0' }}>{f.description}</p>}
                  </div>
                  {signed ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
                      <CheckCircle2 size={15} /> Signed
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-dim)', fontSize: 13 }}>
                      <XCircle size={14} /> Not yet signed
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{f.content}</div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {signed ? (
                    <button className="btn" disabled><CheckCircle2 size={14} /> Signature recorded</button>
                  ) : (() => {
                    const needStudent = STUDENT_BOUND.has(f.form_type) && !(f.eligible_students || []).length;
                    if (needStudent) {
                      return (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <span className="sub">This form is per student — a linked guardian record is required to sign it.</span>
                          <button className="btn" disabled title="Contact the registrar to link or verify a guardian before signing">Per-student form</button>
                        </span>
                      );
                    }
                    return (
                      <button className="btn btn-primary" onClick={() => { setSignature(''); setNotice(null); setSignStudent((f.eligible_students || []).length === 1 ? f.eligible_students[0].id : null); setSignForm(f); }}>
                        <PenLine size={14} /> {f.require_sign ? 'Review & Sign' : 'Acknowledge'}
                      </button>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {signForm && (
        <Modal
          title={`Sign: ${signForm.title}`}
          sub="Your electronic signature confirms you have read and understand this consent form"
          onClose={() => setSignForm(null)}
        >
          <form onSubmit={submitSign}>
            {(signForm.eligible_students || []).length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <label>Signing for (student) *</label>
                <select
                  className="input"
                  value={signStudent === null ? '' : signStudent}
                  onChange={(e) => setSignStudent(e.target.value ? Number(e.target.value) : null)}
                >
                  {signForm.eligible_students.length > 1 && <option value="">Select a student…</option>}
                  {signForm.eligible_students.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} (LRN {s.lrn})</option>
                  ))}
                </select>
              </div>
            )}
            <label>Your full name (signature) *</label>
            <input
              className="input"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Type your full legal name"
              required
            />
            <div className="sub" style={{ marginTop: 6 }}>
              By signing you agree to the terms described above. This will be recorded with your account and the school time.
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setSignForm(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Signing…' : 'Confirm Signature'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}