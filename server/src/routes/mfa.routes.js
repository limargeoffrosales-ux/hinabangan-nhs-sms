const express = require('express');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const { q, qi, qr } = require('../db');
const { JWT_SECRET } = require('../config');
const { authenticate, signAccess } = require('../auth');
const { asyncH, audit } = require('../utils');

const router = express.Router();
router.use(authenticate);

const MFA_TEMP_TTL = '5m';

const mfaAttempts = new Map();
const MFA_MAX_ATTEMPTS = 5;
const MFA_WINDOW_MS = 5 * 60 * 1000;

function checkMfaRateLimit(key) {
  const now = Date.now();
  const record = mfaAttempts.get(key);
  if (!record || now - record.start > MFA_WINDOW_MS) {
    mfaAttempts.set(key, { start: now, count: 1 });
    return true;
  }
  record.count++;
  if (record.count > MFA_MAX_ATTEMPTS) {
    mfaAttempts.delete(key);
    return false;
  }
  return true;
}

// POST /mfa/setup — generate TOTP secret and return otpauth URL + QR code data URL
router.post('/setup', asyncH(async (req, res) => {
  const user = await q('SELECT id, username, mfa_secret, mfa_enabled FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.mfa_enabled) return res.status(400).json({ error: 'MFA is already enabled. Disable it first to re-setup.' });

  const secret = speakeasy.generateSecret({
    name: `Hinabangan NHS (${user.username})`,
    length: 20,
  });

  // Store the secret (not yet enabled)
  await qr('UPDATE users SET mfa_secret = ? WHERE id = ?', [secret.base32, user.id]);

  let qr_code_data_url = null;
  try {
    qr_code_data_url = await QRCode.toDataURL(secret.otpauth_url);
  } catch {}

  await audit(req, 'MFA_SETUP', 'users', user.id, {});

  res.json({
    secret: secret.base32,
    otpauth_url: secret.otpauth_url,
    qr_code_data_url,
  });
}));

// POST /mfa/enable — verify TOTP code and enable MFA for the user
router.post('/enable', asyncH(async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'code is required' });

  const user = await q('SELECT id, mfa_secret, mfa_enabled FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.mfa_enabled) return res.status(400).json({ error: 'MFA is already enabled' });
  if (!user.mfa_secret) return res.status(400).json({ error: 'No MFA secret found. Run /mfa/setup first.' });

  const verified = speakeasy.totp.verify({
    secret: user.mfa_secret,
    encoding: 'base32',
    token: String(code),
    window: 1,
  });

  if (!verified) return res.status(400).json({ error: 'Invalid TOTP code' });

  await qr('UPDATE users SET mfa_enabled = TRUE WHERE id = ?', [user.id]);
  await audit(req, 'MFA_ENABLE', 'users', user.id, {});
  res.json({ ok: true, mfa_enabled: true });
}));

// POST /mfa/disable — verify TOTP code and disable MFA
router.post('/disable', asyncH(async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'code is required' });

  const user = await q('SELECT id, mfa_secret, mfa_enabled FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.mfa_enabled) return res.status(400).json({ error: 'MFA is not enabled' });

  const verified = speakeasy.totp.verify({
    secret: user.mfa_secret,
    encoding: 'base32',
    token: String(code),
    window: 1,
  });

  if (!verified) return res.status(400).json({ error: 'Invalid TOTP code' });

  await qr('UPDATE users SET mfa_enabled = FALSE, mfa_secret = NULL WHERE id = ?', [user.id]);
  await audit(req, 'MFA_DISABLE', 'users', user.id, {});
  res.json({ ok: true, mfa_enabled: false });
}));

// POST /mfa/verify — verify TOTP code during MFA login flow
router.post('/verify', asyncH(async (req, res) => {
  const { tempToken, code } = req.body || {};
  if (!tempToken || !code) return res.status(400).json({ error: 'tempToken and code are required' });

  let payload;
  try {
    payload = jwt.verify(tempToken, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired temp token' });
  }

  if (!payload.mfa_pending) {
    return res.status(400).json({ error: 'This token is not a pending MFA token' });
  }

  const rateKey = `mfa:${payload.sub}`;
  if (!checkMfaRateLimit(rateKey)) {
    await audit(req, 'MFA_RATE_LIMITED', 'auth', payload.sub, {});
    return res.status(429).json({ error: 'Too many MFA attempts. Try again later.' });
  }

  const user = await q('SELECT id, username, name, role, status, mfa_secret, mfa_enabled FROM users WHERE id = ?', [payload.sub]);
  if (!user || user.status !== 'active') {
    return res.status(401).json({ error: 'Account disabled or removed' });
  }
  if (!user.mfa_enabled || !user.mfa_secret) {
    return res.status(400).json({ error: 'MFA is not enabled for this account' });
  }

  const verified = speakeasy.totp.verify({
    secret: user.mfa_secret,
    encoding: 'base32',
    token: String(code),
    window: 1,
  });

  if (!verified) {
    await audit(req, 'MFA_VERIFY_FAILED', 'auth', user.id, { username: user.username });
    return res.status(401).json({ error: 'Invalid TOTP code' });
  }

  // Issue real tokens
  const accessToken = signAccess(user);
  const crypto = require('crypto');
  const { REFRESH_TTL_DAYS } = require('../config');
  const { hashToken } = require('../auth');
  const rawRefresh = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000).toISOString();
  await qi('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [user.id, hashToken(rawRefresh), expiresAt]);

  await audit(req, 'LOGIN_MFA', 'auth', user.id, { username: user.username, role: user.role });

  res.json({
    token: accessToken,
    refreshToken: rawRefresh,
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  });
}));

// GET /mfa/status — get MFA status for current user
router.get('/status', asyncH(async (req, res) => {
  const user = await q('SELECT id, mfa_enabled FROM users WHERE id = ?', [req.user.id]);
  res.json({ mfa_enabled: !!user?.mfa_enabled });
}));

module.exports = router;
