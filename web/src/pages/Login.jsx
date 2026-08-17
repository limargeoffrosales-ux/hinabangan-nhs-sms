import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, Server } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ErrorBanner } from '../components/ui';
import { getStoredApiBase, setApiBase } from '../lib/api';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [serverBase, setServerBase] = useState(getStoredApiBase());
  const formRef = useRef(null);

  async function onSubmit(e) {
    e.preventDefault();
    setApiBase(serverBase);
    const form = new FormData(formRef.current);
    const username = String(form.get('username') || '').trim();
    const password = String(form.get('password') || '');
    if (!username || !password) {
      setError(t('login.error'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const u = await login(username, password);
      const isPortal = u.role === 'student' || u.role === 'parent';
      navigate(isPortal ? '/portal' : '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card card">
        <div className="brand">
          <img className="brand-logo" src="/logo.jpg" alt="School logo" />
          <span className="brand-text">{t('brand')}</span>
        </div>
        <div className="login-hero">
          <h1>{t('schoolName')}</h1>
          <p>{t('schoolAddress')} · {t('schoolTagline')}</p>
        </div>
        <ErrorBanner error={error} />
        <form onSubmit={onSubmit} ref={formRef}>
          <label>{t('login.username')}</label>
          <div className="form-row">
            <input name="username" placeholder={t('login.usernamePlaceholder')} autoFocus autoComplete="username" />
          </div>
          <label>{t('login.password')}</label>
          <input type="password" name="password" placeholder="••••••••••••" autoComplete="current-password" />
          <label>
            <Server size={11} style={{ verticalAlign: -1 }} /> {t('login.serverAddress')} <span className="muted">{t('login.serverHint')}</span>
          </label>
          <input
            value={serverBase}
            onChange={(e) => setServerBase(e.target.value)}
            placeholder="http://192.168.1.100:4000/api/v1"
            autoComplete="off"
          />
          <div style={{ marginTop: 20 }}>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px' }} disabled={busy}>
              <Lock size={15} /> {busy ? t('login.signingIn') : t('login.title')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}