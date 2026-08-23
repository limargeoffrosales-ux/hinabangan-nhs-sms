import { useEffect, useState } from 'react';
import { Lock, CheckCircle2, Shield } from 'lucide-react';
import { api } from '../lib/api';
import { PageHead, ErrorBanner, Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';

export default function MFASetup() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [enabledAt, setEnabledAt] = useState(null);
  const [step, setStep] = useState('idle');
  const [qrCode, setQrCode] = useState(null);
  const [secret, setSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showDisable, setShowDisable] = useState(false);

  async function loadStatus() {
    setLoading(true);
    setError(null);
    try {
      const res = await api('/mfa/status');
      setMfaEnabled(res.enabled || false);
      setEnabledAt(res.enabled_at || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStatus(); }, []);

  async function startSetup() {
    setBusy(true);
    setError(null);
    setSuccess('');
    try {
      const res = await api('/mfa/setup', { method: 'POST' });
      setQrCode(res.qr_code);
      setSecret(res.secret);
      setStep('verify');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyAndEnable(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/mfa/enable', { method: 'POST', body: { code: totpCode } });
      setMfaEnabled(true);
      setStep('done');
      setSuccess('MFA has been enabled successfully');
      setQrCode(null);
      setSecret('');
      setTotpCode('');
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function disableMFA(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/mfa/disable', { method: 'POST', body: { code: disableCode } });
      setMfaEnabled(false);
      setEnabledAt(null);
      setShowDisable(false);
      setDisableCode('');
      setSuccess('MFA has been disabled');
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div><PageHead title="Two-Factor Authentication" /><Spinner /></div>;

  return (
    <div>
      <PageHead title="Two-Factor Authentication" sub="Secure your account with an authenticator app" />
      <ErrorBanner error={error} />
      {success && <div className="notice" style={{ marginBottom: 16 }}>{success}</div>}

      {!mfaEnabled && step === 'idle' && (
        <div className="card" style={{ maxWidth: 500 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Two-Factor Authentication is not enabled</h3>
              <p className="sub" style={{ margin: 0 }}>Add an extra layer of security to your account</p>
            </div>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-dim)' }}>
            When you enable two-factor authentication, you'll be asked to enter a code from your authenticator app each time you sign in.
          </p>
          <button className="btn btn-primary" onClick={startSetup} disabled={busy} style={{ marginTop: 8 }}>
            <Shield size={15} style={{ marginRight: 6 }} />
            {busy ? 'Setting up...' : 'Setup MFA'}
          </button>
        </div>
      )}

      {step === 'verify' && (
        <div className="card" style={{ maxWidth: 500 }}>
          <h3>Setup Two-Factor Authentication</h3>
          <p className="sub" style={{ marginTop: 0 }}>Scan this QR code with your authenticator app</p>
          {qrCode && (
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <img src={qrCode} alt="MFA QR Code" style={{ width: 200, height: 200, borderRadius: 8, background: '#fff', padding: 8 }} />
            </div>
          )}
          {secret && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Manual entry key:</label>
              <div style={{
                fontFamily: 'monospace', fontSize: 14, padding: '8px 12px',
                background: 'var(--border)', borderRadius: 6, marginTop: 4,
                wordBreak: 'break-all', userSelect: 'all',
              }}>
                {secret}
              </div>
            </div>
          )}
          <form onSubmit={verifyAndEnable}>
            <label>Enter the 6-digit code from your app *</label>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              required
              autoFocus
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              style={{ fontFamily: 'monospace', letterSpacing: 4, fontSize: 18, textAlign: 'center', maxWidth: 200 }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="button" className="btn" onClick={() => { setStep('idle'); setQrCode(null); setSecret(''); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy || totpCode.length !== 6}>
                {busy ? 'Verifying...' : 'Verify & Enable'}
              </button>
            </div>
          </form>
        </div>
      )}

      {mfaEnabled && step === 'done' && (
        <div className="card" style={{ maxWidth: 500 }}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle2 size={48} color="var(--success)" />
            <h3 style={{ marginTop: 12 }}>MFA Enabled Successfully</h3>
            <p className="sub">Your account is now protected with two-factor authentication.</p>
          </div>
        </div>
      )}

      {mfaEnabled && step !== 'verify' && (
        <div className="card" style={{ maxWidth: 500 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#34C77B22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={20} color="var(--success)" />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Two-Factor Authentication is Active</h3>
              <p className="sub" style={{ margin: 0 }}>
                Enabled {enabledAt ? `on ${enabledAt.replace('T', ' ').slice(0, 10)}` : ''}
              </p>
            </div>
          </div>
          {!showDisable ? (
            <button className="btn btn-danger" onClick={() => setShowDisable(true)}>
              <Lock size={15} style={{ marginRight: 6 }} />
              Disable MFA
            </button>
          ) : (
            <form onSubmit={disableMFA} style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <p style={{ fontSize: 14, margin: '0 0 10px' }}>
                Enter the 6-digit code from your authenticator app to confirm disabling MFA:
              </p>
              <input
                className="input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                required
                autoFocus
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                style={{ fontFamily: 'monospace', letterSpacing: 4, fontSize: 18, textAlign: 'center', maxWidth: 200 }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn" onClick={() => { setShowDisable(false); setDisableCode(''); }}>Cancel</button>
                <button type="submit" className="btn btn-danger" disabled={busy || disableCode.length !== 6}>
                  {busy ? 'Disabling...' : 'Confirm Disable'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
