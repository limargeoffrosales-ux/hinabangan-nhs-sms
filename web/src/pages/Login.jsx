import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Server } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ErrorBanner } from '../components/ui';
import { getStoredApiBase, setApiBase } from '../lib/api';

const SCHOOL = {
  name: 'Hinabangan National High School',
  address: 'Hinabangan, Samar',
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
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
      setError('Please enter your username and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
      navigate('/', { replace: true });
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
          <span className="brand-text">Hinabangan NHS</span>
        </div>
        <div className="login-hero">
          <h1>{SCHOOL.name}</h1>
          <p>{SCHOOL.address} · School Management System</p>
        </div>
        <ErrorBanner error={error} />
        <form onSubmit={onSubmit} ref={formRef}>
          <label>Username</label>
          <div className="form-row">
            <input name="username" placeholder="e.g. admin" autoFocus autoComplete="username" />
          </div>
          <label>Password</label>
          <input type="password" name="password" placeholder="••••••••••••" autoComplete="current-password" />
          <label>
            <Server size={11} style={{ verticalAlign: -1 }} /> Server address <span className="muted">(for Android app)</span>
          </label>
          <input
            value={serverBase}
            onChange={(e) => setServerBase(e.target.value)}
            placeholder="http://192.168.1.100:4000/api/v1"
            autoComplete="off"
          />
          <div style={{ marginTop: 20 }}>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px' }} disabled={busy}>
              <Lock size={15} /> {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
        <div className="hint">
          <strong>Demo accounts</strong> (password: <code>REDACTED</code>)<br />
          <User size={11} style={{ verticalAlign: -1 }} /> admin · registrar · teacher · nurse · cashier · parent · student
        </div>
      </div>
    </div>
  );
}