import { useEffect, useState } from 'react';
import { Shield, CheckCircle2, PenLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { PageHead, Modal, Empty, ErrorBanner, Spinner } from '../components/ui';

export default function PortalConsent() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [signing, setSigning] = useState(null);
  const [signatureName, setSignatureName] = useState(user?.name || '');
  const [busy, setBusy] = useState(false);

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

  async function sign(id) {
    if (!signatureName.trim()) return setError('Please enter your name for the signature.');
    setBusy(true);
    setError(null);
    try {
      await api(`/consent/sign/${id}`, { method: 'POST', body: { signature_name: signatureName.trim() } });
      setNotice('Consent form signed successfully.');
      setSigning(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;

  const pending = forms.filter(f => !f.my_status);
  const signed = forms.filter(f => f.my_status);

  return (
    <div className="space-y-6">
      <PageHead title={t('consent.portal_title', 'Consent Forms')} subtitle={t('consent.portal_subtitle', 'Review and sign consent forms for your child')} />
      {error && <ErrorBanner msg={error} onClose={() => setError(null)} />}
      {notice && <div className="bg-emerald-900/40 border border-emerald-700/50 text-emerald-200 px-4 py-3 rounded-lg text-sm">{notice}</div>}

      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Pending — Action Required</h2>
          {pending.map(f => (
            <div key={f.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-zinc-100 font-medium">{f.title}</h3>
                  {f.description && <p className="text-zinc-400 text-sm mt-1">{f.description}</p>}
                  <div className="mt-3 text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto bg-zinc-800/50 rounded-lg p-4">{f.content}</div>
                  <div className="mt-4 flex justify-end">
                    <button onClick={() => { setSigning(f); setSignatureName(user?.name || ''); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors">
                      <PenLine className="w-4 h-4" /> Sign This Form
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {signed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Completed</h2>
          {signed.map(f => (
            <div key={f.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-zinc-100 font-medium">{f.title}</h3>
                  <p className="text-zinc-500 text-xs mt-0.5">Signed as {f.my_status}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pending.length === 0 && signed.length === 0 && <Empty message="No consent forms available." />}

      {/* Sign Modal */}
      {signing && (
        <Modal title="Sign Consent Form" onClose={() => setSigning(null)}>
          <div className="space-y-4">
            <h3 className="text-zinc-100 font-medium">{signing.title}</h3>
            <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto bg-zinc-800/50 rounded-lg p-4">{signing.content}</div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Your full name (digital signature) <span className="text-red-400">*</span></label>
              <input value={signatureName} onChange={e => setSignatureName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Juan Dela Cruz" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setSigning(null)} className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-200">Cancel</button>
              <button onClick={() => sign(signing.id)} disabled={busy || !signatureName.trim()} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Signing...' : 'Confirm Signature'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
