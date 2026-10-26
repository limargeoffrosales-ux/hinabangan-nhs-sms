import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shield, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { ErrorBanner } from '../components/ui';
import TarikMascot from '../components/TarikMascot';

export default function ResetPassword() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [code, setCode] = useState((params.get('code') || '').trim().slice(0, 6));
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (String(newPassword) !== String(confirm)) {
      setError(t('reset.mismatch'));
      return;
    }
    if (!code.trim()) {
      setError(t('reset.codeRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('/auth/reset-password', { method: 'POST', auth: false, body: { code: code.trim(), newPassword } });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg-orb login-bg-orb--1" />
      <div className="login-bg-orb login-bg-orb--2" />
      <div className="login-bg-orb login-bg-orb--3" />

      <header className="login-branding">
        <TarikMascot pose="happy" size={88} />
        <h1 className="login-branding-name">{t('schoolName')}</h1>
      </header>

      <div className="login-main">
        <div className="login-form-col">
          <div className="login-form-card card">
            <div className="login-form-header">
              <h2>{t('reset.title')} <span className="login-form-brand">{t('brand')}</span></h2>
              <ErrorBanner error={error} />
            </div>
            {done ? (
              <div className="reset-ok">
                <CheckCircle2 size={30} />
                <h3>{t('reset.successTitle')}</h3>
                <p>{t('reset.successDesc')}</p>
                <Link to="/login" className="btn btn-primary login-submit">{t('reset.signIn')}</Link>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="login-form">
                <label htmlFor="reset-code">{t('reset.code')}</label>
                <input
                  id="reset-code"
                  name="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="••••••••"
                  autoFocus
                />
                <label htmlFor="reset-pw">{t('reset.newPassword')}</label>
                <input
                  id="reset-pw"
                  name="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <label htmlFor="reset-pw2">{t('reset.confirmPassword')}</label>
                <input
                  id="reset-pw2"
                  name="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
                <button type="submit" className="btn btn-primary login-submit" disabled={busy}>
                  {busy ? <span className="login-spinner" /> : <Shield size={15} />}
                  {busy ? t('login.signingIn') : t('reset.submit')}
                </button>
              </form>
            )}
            <div className="login-form-links" style={{ marginTop: 14 }}>
              <Link to="/login" className="login-request-btn">{t('login.forgotBack')}</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
