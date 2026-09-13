import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import {
  Lock, Eye, EyeOff, ChevronDown, ChevronUp, KeyRound,
  QrCode, BarChart3, Calendar, GraduationCap, ClipboardList, FileText,
  CheckCircle2, Shield, Globe, ExternalLink, Mail, Phone, Info,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ErrorBanner } from '../components/ui';
import { getStoredApiBase, setApiBase, api, warmServer } from '../lib/api';

const FEATURES = [
  { icon: QrCode, key: 'featAttendance' },
  { icon: ClipboardList, key: 'featGrades' },
  { icon: Calendar, key: 'featScheduling' },
  { icon: BarChart3, key: 'featAnalytics' },
  { icon: GraduationCap, key: 'featCurriculum' },
  { icon: FileText, key: 'featForms' },
];

export default function Login() {
  const { login, verifyMfa } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [serverOpen, setServerOpen] = useState(false);
  const [serverBase, setServerBase] = useState(getStoredApiBase());
  const [showRequest, setShowRequest] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState(null);
  const [pendingMfa, setPendingMfa] = useState(null);
  const [slow, setSlow] = useState(false);
  const formRef = useRef(null);

  const currentLang = i18n.language?.startsWith('fil') ? 'fil' : 'en';
  function toggleLang() {
    i18n.changeLanguage(currentLang === 'en' ? 'fil' : 'en');
  }

  // Render free tier sleeps the instance when idle; waking it in the
  // background on page load means the first sign-in is not the slow one.
  useEffect(() => {
    warmServer();
  }, []);

  // If a request lingers past a few seconds it is the post-idle boot — say so
  // instead of leaving the user staring at a spinner.
  useEffect(() => {
    if (!busy) { setSlow(false); return undefined; }
    const t = setTimeout(() => setSlow(true), 7000);
    return () => clearTimeout(t);
  }, [busy]);

  function finish(result) {
    const isPortal = result.user.role === 'student' || result.user.role === 'parent';
    navigate(isPortal ? '/portal' : '/', { replace: true });
  }

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
      const result = await login(username, password);
      if (result.requiresMfa) setPendingMfa({ tempToken: result.tempToken });
      else finish(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onForgotSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const identifier = String(form.get('identifier') || '').trim();
    if (!identifier) {
      setForgotError(t('login.forgotIdRequired'));
      return;
    }
    setForgotBusy(true);
    setForgotError(null);
    setForgotSent(false);
    try {
      await api('/auth/forgot-password', { method: 'POST', auth: false, retryNetwork: true, body: { identifier } });
      setForgotSent(true);
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotBusy(false);
    }
  }

  function closeForgot() {
    setShowForgot(false);
    setForgotError(null);
    setForgotSent(false);
  }

  async function onMfaSubmit(e) {
    e.preventDefault();
    const code = String(formRef.current.get('mfaCode') || '').trim();
    if (!code) { setError(t('login.mfaCodeRequired', 'Enter the 6-digit code from your authenticator app.')); return; }
    setBusy(true);
    setError(null);
    try {
      const result = await verifyMfa(pendingMfa.tempToken, code);
      finish(result);
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

      <div className="login-topbar">
        <button className="login-lang-btn" onClick={toggleLang} aria-label="Toggle language">
          <Globe size={14} />
          {currentLang === 'en' ? 'Filipino' : 'English'}
        </button>
      </div>

      <header className="login-branding">
        <img className="login-branding-logo" src="/logo.jpg" alt="School logo" />
        <h1 className="login-branding-name">{t('schoolName')}</h1>
      </header>

      <div className="login-main">
        <div className="login-features-col">
          {FEATURES.map(({ icon: Icon, key }) => (
            <div className="login-feature-card" key={key}>
              <div className="login-feature-icon"><Icon size={22} /></div>
              <h3>{t(`login.${key}`)}</h3>
              <p>{t(`login.${key}Desc`)}</p>
            </div>
          ))}
          <div className="login-quote">
            <p>&ldquo;The Glory of God is Man Fully Alive.&rdquo;</p>
            <span>&mdash; Fr. Aloysius Schwartz</span>
          </div>
        </div>

        <div className="login-form-col">
          <div className="login-form-card card">
            <div className="login-form-header">
              <h2>{t('login.signInto')} <span className="login-form-brand">{t('brand')}</span></h2>
              <ErrorBanner error={error} />
            </div>
            {pendingMfa ? (
              <form onSubmit={onMfaSubmit} ref={formRef} className="login-form">
                <label htmlFor="login-mfa">{t('login.signInto')} — {t('login.mfaStep', 'Two-factor authentication')}</label>
                <input
                  id="login-mfa"
                  name="mfaCode"
                  placeholder="••••••"
                  autoFocus
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={8}
                />
                <button type="submit" className="btn btn-primary login-submit" disabled={busy}>
                  {busy ? <span className="login-spinner" /> : <Shield size={15} />}
                  {busy ? t('login.signingIn') : t('login.mfaVerify', 'Verify code')}
                </button>
                <div className="login-form-links">
                  <button type="button" className="login-request-btn" onClick={() => { setPendingMfa(null); setError(null); }}>
                    {t('login.back', 'Back to sign in')}
                  </button>
                </div>
              </form>
            ) : showForgot ? (
              <form onSubmit={onForgotSubmit} className="login-form">
                <h3 className="login-forgot-title">{t('login.forgotTitle')}</h3>
                <p className="login-forgot-intro">{t('login.forgotIntro')}</p>
                {forgotSent ? (
                  <p className="login-forgot-ok"><CheckCircle2 size={16} /> {t('login.forgotSent')}</p>
                ) : (
                  <>
                    <label htmlFor="login-forgot-id">{t('login.forgotIdLabel')}</label>
                    <input
                      id="login-forgot-id"
                      name="identifier"
                      placeholder={t('login.forgotIdLabel')}
                      autoComplete="username"
                      autoFocus
                    />
                    {forgotError && <div className="error-text">{forgotError}</div>}
                    <button type="submit" className="btn btn-primary login-submit" disabled={forgotBusy}>
                      {forgotBusy ? <span className="login-spinner" /> : <KeyRound size={15} />}
                      {forgotBusy ? t('login.signingIn') : t('login.forgotSubmit')}
                    </button>
                  </>
                )}
                <div className="login-form-links">
                  <button type="button" className="login-request-btn" onClick={closeForgot}>
                    {t('login.forgotBack')}
                  </button>
                </div>
              </form>
            ) : (
            <form onSubmit={onSubmit} ref={formRef} className="login-form">
              <label htmlFor="login-username">{t('login.username')}</label>
              <input
                id="login-username"
                name="username"
                placeholder={t('login.usernamePlaceholder')}
                autoFocus
                autoComplete="username"
              />

              <label htmlFor="login-password">{t('login.password')}</label>
              <div className="login-pw-wrap">
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  name="password"
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-pw-toggle"
                  onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? t('login.hidePw') : t('login.showPw')}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <button type="submit" className="btn btn-primary login-submit" disabled={busy}>
                {busy ? <span className="login-spinner" /> : <Lock size={15} />}
                {busy ? t('login.signingIn') : t('login.title')}
              </button>

              {slow && (
                <p className="login-warming" role="status">
                  <span className="login-spinner" />
                  {t('login.coldStart', 'The server is waking up from idle — this can take a minute. Please keep this page open.')}
                </p>
              )}

              <div className="login-form-links">
                <button type="button" className="login-forgot" onClick={() => setShowForgot(true)}>
                  {t('login.forgotPw')}
                </button>
                <span className="login-form-divider">·</span>
                <button type="button" className="login-request-btn" onClick={() => setShowRequest(!showRequest)}>
                  {t('login.requestAccount')}
                </button>
              </div>

              {showRequest && (
                <div className="login-request-box">
                  <Info size={14} />
                  <span>{t('login.requestAccountDesc')}</span>
                </div>
              )}
            </form>
            )}

            <div className="login-form-security">
              <Shield size={12} />
              <span>{t('login.secureLogin')}</span>
            </div>

            <button
              type="button"
              className="login-server-toggle"
              onClick={() => setServerOpen(!serverOpen)}
            >
              {t('login.serverAddress')} <span className="muted">{t('login.serverHint')}</span>
              {serverOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {serverOpen && (
              <div className="login-server-wrap">
                <input
                  value={serverBase}
                  onChange={(e) => setServerBase(e.target.value)}
                  placeholder="https://hinabangan-nhs.onrender.com/api/v1"
                  autoComplete="off"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="login-everything-section">
        <div className="login-everything-header">
          <span className="login-everything-badge">ALL ACCESS</span>
          <h2>{t('login.everythingTitle')}</h2>
        </div>
        <div className="login-everything-grid">
          {Array.from({ length: 20 }, (_, i) => (
            <div className="login-everything-item" key={i}>
              <CheckCircle2 size={16} className="login-everything-check" />
              <span>{t(`login.ef${i + 1}`)}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="login-footer">
        <div className="login-footer-inner">
          <div className="login-footer-row">
            <div className="login-footer-contact">
              <Phone size={12} />
              <span>{t('login.footerContact')}</span>
            </div>
            <div className="login-footer-contact">
              <Mail size={12} />
              <span>{t('login.footerEmail')}</span>
            </div>
          </div>
          <div className="login-footer-row">
            <a href="https://www.facebook.com/ugop.hinabangan" target="_blank" rel="noopener noreferrer" className="login-footer-social-link">
              <ExternalLink size={11} /> UGO Hinabangan
            </a>
            <span className="login-footer-sep">·</span>
            <a href="https://www.facebook.com/almamater.hinabangan" target="_blank" rel="noopener noreferrer" className="login-footer-social-link">
              <ExternalLink size={11} /> Alma Mater
            </a>
          </div>
          <div className="login-footer-bottom">
            <span>{t('login.footerAddress')}</span>
            <span className="login-footer-sep">·</span>
            <span>&copy; {new Date().getFullYear()} {t('login.copyright')}</span>
            <span className="login-footer-sep">·</span>
            <span>{t('login.footerVersion')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
