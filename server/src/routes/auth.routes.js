const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { q, qa, qi, qr, nowSql } = require('../db');
const { signAccess, authenticate, hashToken, clearUserCache, generateCsrfToken, storeCsrfToken, clearCsrfToken } = require('../auth');
const { JWT_SECRET, REFRESH_TTL_DAYS, JWT_AUDIENCE, JWT_ISSUER, APP_URL } = require('../config');
const { asyncH, audit } = require('../utils');
const { userRateLimit } = require('../middleware/rate-limit');
const { notifyEvent } = require('../notify');
const { POLICY_KEYS, checkPasswordPolicy } = require('../password-policy');
const { RESET_CODE_TTL_MS, RESET_MAX_ATTEMPTS, genResetCode } = require('../reset-codes');
const logger = require('../logger');

// bcrypt hash used as a password stand-in when the username doesn't exist (or
// the account isn't active), so the login path always does the same bcrypt work.
// This prevents account enumeration via response-time differences.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-password-for-timing-equalization', 10);

async function getLockoutSettings() {
  const rows = await qa("SELECT key, value FROM app_settings WHERE key IN ('lockout_max_attempts','lockout_duration_minutes')", []);
  const s = {};
  for (const r of rows) s[r.key] = r.value;
  return { maxAttempts: Number(s.lockout_max_attempts || 5), lockMinutes: Number(s.lockout_duration_minutes || 15) };
}

async function recordFailedLogin(username, userId, ip) {
  const { maxAttempts, lockMinutes } = await getLockoutSettings();
  if (userId) {
    const user = await q('SELECT failed_attempts, role FROM users WHERE id = ?', [userId]);
    const attempts = (user?.failed_attempts || 0) + 1;
    if (attempts >= maxAttempts) {
      const until = new Date(Date.now() + lockMinutes * 60000).toISOString();
      await qr('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?', [attempts, until, userId]);
      await logSecurityIncident('ACCOUNT_LOCKOUT', 'high', ip, username, userId, { attempts, lockMinutes, lockedUntil: until });
      // Lockout is deliberately available to an unauthenticated caller, which
      // makes it a denial-of-service primitive: knowing a username is enough to
      // lock a real user out. It cannot be removed outright (it is what stops an
      // online password guess), so the compensating control is to tell the
      // account holder immediately - the attack stops being silent and the
      // genuine owner can get an admin to review and reset the account.
      // resolveUserRecipients only returns ACTIVE users, and a locked account is
      // still 'active' (lock is time-based via locked_until), so this delivers.
      await notifyEvent('account_locked', {
        user_id: userId,
        data: {
          username: username || '',
          attempts,
          minutes: lockMinutes,
        },
      });
    } else {
      await qr('UPDATE users SET failed_attempts = ? WHERE id = ?', [attempts, userId]);
    }
  }
}

async function clearFailedLogins(userId) {
  if (userId) await qr('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?', [userId]);
}

async function logSecurityIncident(type, severity, ip, username, userId, details) {
  try {
    await qi(
      'INSERT INTO security_incidents (incident_type, severity, source_ip, username, user_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [type, severity, ip, username, userId || null, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack, type, username }, '[AUTH] failed to record security incident');
  }
}

async function getPasswordPolicy() {
  const rows = await qa(
    `SELECT key, value FROM app_settings WHERE key IN (${POLICY_KEYS.map(() => '?').join(', ')})`,
    POLICY_KEYS);
  const policy = {};
  for (const r of rows) policy[r.key] = r.value;
  return {
    minLength: Number(policy.password_min_length || 12),
    requireUppercase: policy.password_require_uppercase !== '0',
    requireLowercase: policy.password_require_lowercase !== '0',
    requireDigit: policy.password_require_digit !== '0',
    requireSpecial: policy.password_require_special !== '0',
  };
}

let lastResetSweep = 0;
async function maybeSweepResetCodes() {
  const now = Date.now();
  if (now - lastResetSweep < 15 * 60 * 1000) return;
  lastResetSweep = now;
  try {
    await qr('DELETE FROM password_resets WHERE expires_at < ?', [new Date().toISOString()]);
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack }, '[AUTH] password-reset code sweep failed');
  }
}

const router = express.Router();

function genRefresh() {
  return crypto.randomBytes(48).toString('base64url');
}

let lastSweep = 0;
async function maybeSweepExpired() {
  const now = Date.now();
  if (now - lastSweep < 15 * 60 * 1000) return;
  lastSweep = now;
  try {
    await qr(`DELETE FROM refresh_tokens WHERE expires_at < ${nowSql()}`);
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack }, '[AUTH] refresh-token sweep failed');
  }
}

async function issueRefresh(userId) {
  const raw = genRefresh();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000).toISOString();
  await qi('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, hashToken(raw), expiresAt]);
  return raw;
}

router.post('/login', userRateLimit({ windowMs: 15 * 60 * 1000, limit: 15, message: { error: 'Too many login attempts. Try again later.' } }), asyncH(async (req, res) => {
  await maybeSweepExpired();
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });
  if (String(username).length > 100 || String(password).length > 128) {
    return res.status(400).json({ error: 'username or password too long' });
  }
  const user = await q('SELECT * FROM users WHERE username = ?', [String(username).trim()]);

  if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
    // Return the same generic 401 as any other failed login: a distinct 423
    // would let attackers confirm usernames and let them deny logins at will.
    await logSecurityIncident('LOGIN_BLOCKED_LOCKED', 'high', req.ip, user.username, user.id, {});
    await audit(req, 'LOGIN_FAILED', 'auth', null, { username });
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  if (!user || user.status !== 'active' || !(await bcrypt.compare(String(password), user.password_hash || DUMMY_PASSWORD_HASH))) {
    await audit(req, 'LOGIN_FAILED', 'auth', null, { username });
    await recordFailedLogin(String(username).trim(), user?.id || null, req.ip);
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  await clearFailedLogins(user.id);

  // Check if MFA is enabled
  if (user.mfa_enabled && user.mfa_secret) {
    const tempToken = jwt.sign(
      { sub: String(user.id), tokenUse: 'mfa', mfa_pending: true },
      JWT_SECRET,
      { expiresIn: '5m', audience: JWT_AUDIENCE, issuer: JWT_ISSUER }
    );
    await audit(req, 'LOGIN_MFA_PENDING', 'auth', user.id, { username: user.username });
    return res.json({ requiresMfa: true, tempToken });
  }

  const accessToken = signAccess(user);
  const refreshToken = await issueRefresh(user.id);
  const csrfToken = generateCsrfToken();
  await storeCsrfToken(user.id, csrfToken);
  await audit(req, 'LOGIN', 'auth', user.id, { username: user.username, role: user.role });
  res.json({
    token: accessToken,
    refreshToken,
    csrfToken,
    user: { id: user.id, username: user.username, name: user.name, role: user.role, email: user.email },
  });
}));

router.post('/refresh', asyncH(async (req, res) => {
  await maybeSweepExpired();
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' });
  const row = await q('SELECT rt.id AS token_id, rt.user_id, rt.expires_at, rt.revoked, u.id, u.username, u.name, u.role, u.status FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = ?',
    [hashToken(refreshToken)]);
  if (!row) return res.status(401).json({ error: 'Invalid refresh token' });
  if (row.revoked) {
    await qr('UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ? AND revoked = FALSE', [row.user_id]);
    await logSecurityIncident('REFRESH_TOKEN_REUSE', 'high', req.ip, row.username, row.user_id, {});
    return res.status(401).json({ error: 'Refresh token revoked (reuse detected)' });
  }
  if (new Date(row.expires_at) < new Date()) return res.status(401).json({ error: 'Refresh token expired' });
  if (row.status !== 'active') return res.status(401).json({ error: 'Account disabled' });
  // Atomic conditional revoke: of two concurrent refreshes only one wins.
  // The loser is treated as reuse and the whole token family is revoked.
  const revokeRes = await qr('UPDATE refresh_tokens SET revoked = TRUE WHERE id = ? AND revoked = FALSE', [row.token_id]);
  if (Number(revokeRes.changes || 0) === 0) {
    await qr('UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ? AND revoked = FALSE', [row.user_id]);
    await logSecurityIncident('REFRESH_TOKEN_REUSE', 'high', req.ip, row.username, row.user_id, {});
    return res.status(401).json({ error: 'Refresh token revoked (reuse detected)' });
  }
  const accessToken = signAccess({ id: row.user_id, username: row.username, name: row.name, role: row.role });
  const newRefresh = await issueRefresh(row.user_id);
  const csrfToken = generateCsrfToken();
  await storeCsrfToken(row.user_id, csrfToken);
  res.json({ token: accessToken, refreshToken: newRefresh, csrfToken });
}));

router.get('/me', authenticate, asyncH(async (req, res) => {
  const user = await q('SELECT id, username, name, role, email, phone, created_at FROM users WHERE id = ?', [req.user.id]);
  res.json({ user });
}));

router.get('/csrf-token', authenticate, asyncH(async (req, res) => {
  const token = generateCsrfToken();
  await storeCsrfToken(req.user.id, token);
  res.json({ csrfToken: token });
}));

router.post('/logout', asyncH(async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    if (req.user && req.user.id) {
      await qr('UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ?', [req.user.id]);
      await clearCsrfToken(req.user.id);
      await audit(req, 'LOGOUT', 'auth', req.user.id, { username: req.user.username });
      return res.json({ ok: true });
    }
    return res.status(400).json({ error: 'refreshToken is required' });
  }
  const row = await q('SELECT user_id FROM refresh_tokens WHERE token_hash = ?', [hashToken(refreshToken)]);
  if (!row) return res.status(401).json({ error: 'Invalid refresh token' });
  await qr('UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ?', [row.user_id]);
  await clearCsrfToken(row.user_id);
  await audit(req, 'LOGOUT', 'auth', row.user_id, {});
  res.json({ ok: true });
}));

router.post('/change-password', authenticate, asyncH(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  if (String(newPassword).length > 128) return res.status(400).json({ error: 'Password too long' });
  const user = await q('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(String(currentPassword), user.password_hash))) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  // Password policy validation from app_settings
  const policy = await getPasswordPolicy();
  const policyErr = checkPasswordPolicy(policy, newPassword);
  if (policyErr) return res.status(400).json({ error: policyErr });

  await qr('UPDATE users SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP WHERE id = ?', [await bcrypt.hash(String(newPassword), 12), req.user.id]);
  clearUserCache(req.user.id);
  await qi(
    'INSERT INTO password_audit (user_id, changed_by, action, ip_address) VALUES (?, ?, ?, ?)',
    [req.user.id, req.user.id, 'changed', req.ip]);
  await qr('UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ?', [req.user.id]);
  await audit(req, 'CHANGE_PASSWORD', 'auth', req.user.id);
  res.json({ ok: true });
}));

// --- Self-service password reset ----------------------------------------------
// POST /forgot-password { identifier }   — username, email, or phone.
// POST /reset-password   { code, newPassword } — single-use 6-digit code.
//
// The response never reveals whether an account exists (anti-enumeration);
// the code is delivered via the notification engine (email/SMS) to the
// contact stored on the account. When no channel is configured or the user
// has no contact on file, a notification row is still attempted/queued and
// the standard fallback stays: an administrator resets the password in
// Users > edit > set password.

router.post('/forgot-password',
  userRateLimit({ windowMs: 15 * 60 * 1000, limit: 6, message: { error: 'Too many reset requests. Try again later.' } }),
  asyncH(async (req, res) => {
    await maybeSweepResetCodes();
    const identifier = String(req.body?.identifier || '').trim().slice(0, 200);
    if (!identifier) return res.status(400).json({ error: 'identifier is required' });

    const user = await q(
      'SELECT id, username, status FROM users WHERE username = ? OR email = ? OR phone = ? LIMIT 1',
      [identifier, identifier, identifier]);
    if (!user || user.status !== 'active') {
      return res.status(202).json({ ok: true, message: 'If that account exists, a reset code was sent to the contact on file.' });
    }

    // One live code per account: a new request invalidates older unused codes.
    await qr('DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL', [user.id]);

    // Fail closed: never construct reset links from the request's Host header.
    // A spoofed Host would otherwise ship the reset code to an attacker domain.
    const base = APP_URL ? APP_URL.replace(/\/+$/, '') : null;
    if (!base) {
      await logSecurityIncident('PASSWORD_RESET_BLOCKED', 'medium', req.ip, user.username, user.id, { reason: 'APP_URL not configured' });
      return res.status(202).json({ ok: true, message: 'If that account exists, a reset code was sent to the contact on file.' });
    }

    const code = genResetCode();
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MS).toISOString();
    await qi('INSERT INTO password_resets (user_id, code_hash, expires_at, ip_address) VALUES (?, ?, ?, ?)',
      [user.id, hashToken(code), expiresAt, req.ip]);

    await notifyEvent('password_reset', {
      user_id: user.id,
      data: { code, url: `${base}/reset-password?code=${code}` },
    });
    await audit(req, 'FORGOT_PASSWORD_REQUEST', 'auth', user.id, { username: user.username });
    res.status(202).json({ ok: true, message: 'If that account exists, a reset code was sent to the contact on file.' });
  }));

router.post('/reset-password',
  // 5 attempts per IP per 15 minutes. This is the effective barrier: a wrong
  // code matches no password_resets row (lookup is by code_hash), so the
  // per-row attempts counter below only ever guards code replay. Entropy of
  // RESET_CODE_LENGTH plus this limit makes guessing infeasible in-window.
  userRateLimit({ windowMs: 15 * 60 * 1000, limit: 5, message: { error: 'Too many reset attempts. Try again later.' } }),
  asyncH(async (req, res) => {
    await maybeSweepResetCodes();
    const { code, newPassword } = req.body || {};
    if (!code || !newPassword) return res.status(400).json({ error: 'code and newPassword are required' });
    if (String(newPassword).length > 128) return res.status(400).json({ error: 'Password too long' });

    const policy = await getPasswordPolicy();
    const policyErr = checkPasswordPolicy(policy, newPassword);
    if (policyErr) return res.status(400).json({ error: policyErr });

    const row = await q('SELECT * FROM password_resets WHERE code_hash = ?', [hashToken(String(code).trim())]);
    if (!row) return res.status(400).json({ error: 'Invalid or expired reset code' });

    if (row.used_at) {
      await qr('UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?', [row.id]);
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }
    if (new Date(row.expires_at) < new Date()) {
      await qr('DELETE FROM password_resets WHERE id = ?', [row.id]);
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }
    if (Number(row.attempts || 0) >= RESET_MAX_ATTEMPTS) {
      await qr('DELETE FROM password_resets WHERE id = ?', [row.id]);
      await logSecurityIncident('PASSWORD_RESET_BRUTE_FORCE', 'high', req.ip, null, row.user_id, {});
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    const user = await q('SELECT id, username, status FROM users WHERE id = ?', [row.user_id]);
    if (!user || user.status !== 'active') {
      await qr('DELETE FROM password_resets WHERE id = ?', [row.id]);
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    await qr(
      'UPDATE users SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP, failed_attempts = 0, locked_until = NULL WHERE id = ?',
      [await bcrypt.hash(String(newPassword), 12), user.id]);
    await qr('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP, attempts = attempts + 1 WHERE id = ?', [row.id]);
    // A successful reset is a full session reset: kill all refresh tokens so
    // any device signed in with the old password loses access.
    await qr('UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ?', [user.id]);
    await clearCsrfToken(user.id);
    clearUserCache(user.id);
    await qi(
      'INSERT INTO password_audit (user_id, changed_by, action, ip_address) VALUES (?, ?, ?, ?)',
      [user.id, user.id, 'reset', req.ip]);
    await audit(req, 'PASSWORD_RESET', 'auth', user.id, { username: user.username });
    res.json({ ok: true });
  }));

// --- Public self-registration (student portal accounts) ----------------------
// A learner already in the school records creates their own login by proving
// they know their LRN + birth date + last name. The link to their record stays
// 'pending' until a registrar/school_admin approves it (Students module), then
// the whole student portal unlocks.

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,64}$/;

async function registrationEnabled() {
  const row = await q('SELECT value FROM app_settings WHERE key = ?', ['registration_enabled']);
  const v = String((row && row.value) || '1');
  return v === '1' || /^true$/i.test(v);
}

router.post('/register',
  userRateLimit({ windowMs: 15 * 60 * 1000, limit: 12, message: { error: 'Too many registration attempts. Try again later.' } }),
  asyncH(async (req, res) => {
    const b = req.body || {};
    const lrn = String(b.lrn || '').trim();
    const lastName = String(b.last_name || '').trim();
    const birthDate = String(b.birth_date || '').trim().slice(0, 10);
    const username = String(b.username || '').trim();
    const password = String(b.password || '');
    const firstName = String(b.first_name || '').trim();
    const email = String(b.email || '').trim().slice(0, 200);
    const phone = String(b.phone || '').trim().slice(0, 40);

    if (!lrn || !lastName || !birthDate || !username || !password) {
      return res.status(400).json({ error: 'lrn, last_name, birth_date, username and password are required' });
    }
    if (!/^\d{12}$/.test(lrn)) return res.status(400).json({ error: 'LRN must be exactly 12 digits' });
    if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'Username must be 3-64 characters using letters, numbers, dots, dashes or underscores' });
    if (String(password).length > 128) return res.status(400).json({ error: 'Password too long' });

    if (!(await registrationEnabled())) {
      return res.status(403).json({ error: 'Self-registration is currently closed. Contact the school registrar to create your portal account.' });
    }

    const policy = await getPasswordPolicy();
    const policyErr = checkPasswordPolicy(policy, password);
    if (policyErr) return res.status(400).json({ error: policyErr });

    const student = await q('SELECT id, first_name, last_name, birth_date, user_id FROM students WHERE lrn = ?', [lrn]);
    const verified = [];
    let studentId = null;
    if (student) {
      verified.push('lrn');
      if (String(student.last_name || '').trim().toLowerCase() === lastName.toLowerCase()) verified.push('last_name');
      if (String(student.birth_date || '').slice(0, 10) === birthDate) verified.push('birth_date');
      if (!firstName || String(student.first_name || '').trim().toLowerCase() === firstName.toLowerCase()) verified.push('first_name');
      if (verified.includes('last_name') && verified.includes('birth_date')) studentId = student.id;
    }
    if (!studentId) {
      await logSecurityIncident('REGISTER_MISMATCH', 'medium', req.ip, username, student ? student.id : null, { reason: 'verification-failed', student_matched: !!student });
      return res.status(400).json({ error: "We couldn't verify your learner record. Check that the LRN, birth date and last name match the school's records." });
    }

    if (student.user_id) {
      return res.status(409).json({ error: 'This learner already has a portal account.' });
    }
    const existingPending = await q("SELECT id FROM student_link_requests WHERE student_id = ? AND status = 'pending'", [studentId]);
    if (existingPending) {
      return res.status(409).json({ error: 'A registration for this learner is already waiting for approval.' });
    }

    const taken = await q('SELECT id FROM users WHERE username = ?', [username]);
    if (taken) return res.status(409).json({ error: 'That username is already taken' });
    if (email && /^\S+@\S+\.\S+$/.test(email)) {
      const takenEmail = await q('SELECT id FROM users WHERE email = ?', [email]);
      if (takenEmail) return res.status(409).json({ error: 'That email is already used by another account' });
    }

    const hash = await bcrypt.hash(password, 12);
    const name = [firstName, lastName].filter(Boolean).join(' ');
    // status MUST be 'pending'. The endpoint answers "Registration submitted...
    // will approve the link", but the account was created 'active', so the
    // applicant could sign in immediately and reach every route that only
    // requires authentication - before any registrar review. 'pending' makes the
    // account inert: /login rejects anything whose status is not 'active', and
    // students.routes.js flips it to 'active' inside the approval transaction.
    const userId = await qi('INSERT INTO users (username, password_hash, name, role, email, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, hash, name, 'student', email || null, phone || null, 'pending']);
    await qi('INSERT INTO password_audit (user_id, changed_by, action, ip_address) VALUES (?, ?, ?, ?)', [userId, userId, 'created', req.ip]);
    await qi(
      'INSERT INTO student_link_requests (student_id, user_id, status, verified, email, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [studentId, userId, 'pending', JSON.stringify(verified), email || null, phone || null]);

await audit(req, 'STUDENT_REGISTER', 'auth', userId, { student_id: studentId, username });
  await notifyEvent('account_registered', { user_id: userId, data: { username, url: APP_URL ? APP_URL.replace(/\/+$/, '') : '' } });
  res.status(201).json({ ok: true, status: 'pending', message: 'Registration submitted. The school administrator will approve the link to your learner record.' });
  }));

module.exports = router;
