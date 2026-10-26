import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserPlus, CheckCircle2, ArrowLeft } from 'lucide-react';
import { api, sanitizeError } from '../lib/api';
import { ErrorBanner } from '../components/ui';
import TarikCrestLogo from '../components/TarikCrestLogo';

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,64}$/;

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', lrn: '', birth_date: '',
    username: '', password: '', confirm: '', email: '', phone: '',
    registration_code: '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    const { first_name, last_name, lrn, birth_date, username, password, confirm, email, phone, registration_code } = form;
    const last = String(last_name).trim();
    const lrnVal = String(lrn).trim();
    const uname = String(username).trim();
    const bDate = String(birth_date).trim();
    const regCode = String(registration_code).trim();

    if (!lrnVal || !last || !bDate || !uname || !password || !regCode) {
      setError(t('register.required', 'All fields marked * including Registration Access Code are required.'));
      return;
    }
    if (!/^\d{12}$/.test(lrnVal)) {
      setError(t('register.lrnInvalid', 'Learner Reference Number (LRN) must be exactly 12 digits.'));
      return;
    }
    if (!USERNAME_RE.test(uname)) {
      setError(t('register.usernameInvalid', 'Username must be 3-64 characters using letters, numbers, dots, dashes or underscores.'));
      return;
    }
    if (String(password).length < 12) {
      setError(t('register.passwordShort', 'Password must be at least 12 characters.'));
      return;
    }
    if (String(password) !== String(confirm)) {
      setError(t('register.passwordMismatch', 'Passwords do not match.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('/auth/register', {
        method: 'POST',
        auth: false,
        retryNetwork: true,
        body: {
          first_name: String(first_name).trim(),
          last_name: last,
          lrn: lrnVal,
          birth_date: bDate,
          username: uname,
          password,
          email: String(email || '').trim(),
          phone: String(phone || '').trim(),
          registration_code: regCode,
        },
      });
      setDone(true);
    } catch (err) {
      setError(sanitizeError(err));
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
        <TarikCrestLogo size={96} />
        <h1 className="login-branding-name">{t('schoolName')}</h1>
      </header>

      <div className="login-main">
        <div className="login-form-col">
          <div className="login-form-card card" style={{ maxWidth: 560 }}>
            <div className="login-form-header">
              <h2>{t('register.title', 'Create a student portal account')} <span className="login-form-brand">{t('brand')}</span></h2>
              <p className="sub" style={{ marginTop: 8 }}>{t('register.intro', 'Use your Learner Reference Number and birth date to verify your record. The registrar reviews your request before the link to your grades and portal access is activated.')}</p>
              <ErrorBanner error={error} />
            </div>
            {done ? (
              <div className="reset-ok">
                <CheckCircle2 size={30} />
                <h3>{t('register.successTitle', 'Request submitted')}</h3>
                <p>{t('register.successDesc', 'Your account was created. A registrar will review and approve the link to your learner record — you will be able to sign in and view grades, attendance and schedules once approved.')}</p>
                <div className="login-form-links" style={{ marginTop: 14 }}>
                  <button type="button" className="login-request-btn" onClick={() => navigate('/login')}>{t('register.backLogin', 'Back to sign in')}</button>
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="login-form">
                <div className="register-grid">
                  <div>
                    <label htmlFor="reg-first">{t('register.firstName', 'First name')} <span className="muted">({t('register.optional', 'optional')})</span></label>
                    <input id="reg-first" name="first_name" value={form.first_name} onChange={set('first_name')} autoComplete="given-name" />
                  </div>
                  <div>
                    <label htmlFor="reg-last">{t('register.lastName', 'Last name')} *</label>
                    <input id="reg-last" name="last_name" value={form.last_name} onChange={set('last_name')} autoComplete="family-name" autoFocus />
                  </div>
                  <div className="full">
                    <label htmlFor="reg-lrn">{t('register.lrn', 'LRN (Learner Reference Number)')} *</label>
                    <input id="reg-lrn" name="lrn" value={form.lrn} onChange={set('lrn')} placeholder="000000000000" inputMode="numeric" pattern="[0-9]{12}" maxLength={12} autoComplete="off" />
                  </div>
                  <div className="full">
                    <label htmlFor="reg-code">Registration Access Code *</label>
                    <input id="reg-code" name="registration_code" value={form.registration_code} onChange={set('registration_code')} placeholder="e.g. HNHS-2026-X89A" autoComplete="off" required />
                    <p className="sub" style={{ fontSize: 11, marginTop: 2 }}>Mandatory: only users with an access code generated by the Superadmin can register.</p>
                  </div>
                  <div className="full">
                    <label htmlFor="reg-dob">{t('register.birthDate', 'Birth date')} *</label>
                    <input id="reg-dob" name="birth_date" type="date" value={form.birth_date} onChange={set('birth_date')} />
                  </div>
                  <div className="full">
                    <label htmlFor="reg-username">{t('register.username', 'Username')} *</label>
                    <input id="reg-username" name="username" value={form.username} onChange={set('username')} autoComplete="username" />
                  </div>
                  <div>
                    <label htmlFor="reg-pass">{t('register.password', 'Password')} *</label>
                    <input id="reg-pass" name="password" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
                  </div>
                  <div>
                    <label htmlFor="reg-pass2">{t('register.confirmPassword', 'Confirm password')} *</label>
                    <input id="reg-pass2" name="confirm" type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
                  </div>
                  <div>
                    <label htmlFor="reg-email">{t('register.email', 'Email')} <span className="muted">({t('register.optional', 'optional')})</span></label>
                    <input id="reg-email" name="email" type="email" value={form.email} onChange={set('email')} autoComplete="email" />
                  </div>
                  <div>
                    <label htmlFor="reg-phone">{t('register.phone', 'Mobile number')} <span className="muted">({t('register.optional', 'optional')})</span></label>
                    <input id="reg-phone" name="phone" value={form.phone} onChange={set('phone')} autoComplete="tel" />
                  </div>
                </div>
                <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>{t('register.passwordHint', 'Password must be at least 12 characters and include uppercase, lowercase, numbers and symbols.')}</p>
                <button type="submit" className="btn btn-primary login-submit" disabled={busy}>
                  {busy ? <span className="login-spinner" /> : <UserPlus size={15} />}
                  {busy ? t('login.signingIn') : t('register.submit', 'Create account')}
                </button>
              </form>
            )}
            <div className="login-form-links" style={{ marginTop: 14 }}>
              <Link to="/login" className="login-request-btn"><ArrowLeft size={12} /> {t('register.backLogin', 'Back to sign in')}</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
