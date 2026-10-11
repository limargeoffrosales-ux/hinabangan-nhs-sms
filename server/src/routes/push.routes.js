const { Router } = require('express');
const jwt = require('jsonwebtoken');
const { q, qa, qi } = require('../db');
const db = require('../db');
const { authenticate, requireRole } = require('../auth');
const logger = require('../logger');

const router = Router();

// fetch with an AbortController hard cap so a hung Google endpoint can never
// pin a send request forever (fetch has no default timeout).
async function fetchWithTimeout(url, init = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      const e = new Error(`FCM request timed out after ${timeoutMs}ms`);
      e.code = 'FCM_TIMEOUT';
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// POST /push/register - Register device token
router.post('/register', authenticate, async (req, res) => {
  try {
    const { token, platform = 'android' } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });
    if (!['android', 'ios', 'web'].includes(platform)) {
      return res.status(400).json({ error: 'platform must be android, ios, or web' });
    }
    const params = [req.user.id, token, platform];
    if (db.dialect === 'pg') {
      await q(
        `INSERT INTO device_tokens (user_id, token, platform) VALUES ($1, $2, $3)
         ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = NOW()`,
        params,
      );
    } else {
      const existing = await q('SELECT id FROM device_tokens WHERE token = ?', [token]);
      if (existing) {
        await qi('UPDATE device_tokens SET user_id = ?, platform = ?, updated_at = datetime(\'now\') WHERE token = ?', [req.user.id, platform, token]);
      } else {
        await qi('INSERT INTO device_tokens (user_id, token, platform) VALUES (?, ?, ?)', params);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack }, 'push register error:');
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// POST /push/unregister - Remove device token
router.post('/unregister', authenticate, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });
    if (db.dialect === 'pg') {
      await q('DELETE FROM device_tokens WHERE token = $1 AND user_id = $2', [token, req.user.id]);
    } else {
      await q('DELETE FROM device_tokens WHERE token = ? AND user_id = ?', [token, req.user.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack }, 'push unregister error:');
    res.status(500).json({ error: 'Failed to unregister device' });
  }
});

// --- FCM HTTP v1 --------------------------------------------------------------
// Firebase shut down the legacy key-based endpoint (https://fcm.googleapis.com/fcm/send)
// on 2024-06-24. v1 requires an OAuth2 access token minted from a Firebase service
// account. Provide the service account JSON via the FCM_SERVICE_ACCOUNT env var.
let _fcmToken = null;
let _fcmTokenExp = 0;
let _fcmProjectId = null;

function parseFcmServiceAccount() {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) {
    const err = new Error('Push notifications not configured (FCM_SERVICE_ACCOUNT missing)');
    err.fcmCode = 'NO_FCM_CONFIG';
    throw err;
  }
  let sa;
  try {
    sa = JSON.parse(raw);
  } catch {
    const err = new Error('FCM_SERVICE_ACCOUNT is not valid JSON');
    err.fcmCode = 'BAD_FCM_CONFIG';
    throw err;
  }
  if (!sa.client_email || !sa.private_key || !sa.project_id) {
    const err = new Error('FCM_SERVICE_ACCOUNT JSON is missing client_email/private_key/project_id');
    err.fcmCode = 'BAD_FCM_CONFIG';
    throw err;
  }
  return sa;
}

async function getFcmConfig() {
  if (_fcmToken && _fcmTokenExp > Date.now() + 60 * 1000) {
    return { accessToken: _fcmToken, projectId: _fcmProjectId };
  }
  const sa = parseFcmServiceAccount();
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    },
    sa.private_key,
    { algorithm: 'RS256', header: { kid: sa.private_key_id } },
  );
  const params = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const tokenResp = await fetchWithTimeout(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  }, 10_000);
  if (!tokenResp.ok) {
    logger.error({ status: tokenResp.status }, 'FCM OAuth token exchange failed');
    const err = new Error('Failed to obtain FCM access token');
    err.fcmCode = 'FCM_AUTH_FAILED';
    throw err;
  }
  const data = await tokenResp.json();
  _fcmToken = data.access_token;
  _fcmProjectId = sa.project_id;
  _fcmTokenExp = Date.now() + (Number(data.expires_in) || 3600) * 1000;
  return { accessToken: _fcmToken, projectId: _fcmProjectId };
}

async function sendFcmMessage(token, payload) {
  const { accessToken, projectId } = await getFcmConfig();
  const resp = await fetchWithTimeout(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        notification: payload.notification,
        data: payload.data,
      },
    }),
  }, 10_000);
  return resp.ok;
}

// POST /push/send - Send push notification (admin only)
// Requires the FCM_SERVICE_ACCOUNT env var (Firebase service account JSON).
// If not set, returns 503.
router.post('/send', authenticate, requireRole('super_admin', 'school_admin', 'principal'), async (req, res) => {
  try {
    const { title, body, userIds, platform } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'title and body required' });

    let tokens;
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      const placeholders = userIds.map((_, i) => (db.dialect === 'pg' ? `$${i + 1}` : '?')).join(',');
      tokens = await qa(`SELECT token, platform FROM device_tokens WHERE user_id IN (${placeholders})`, userIds);
    } else {
      tokens = await qa('SELECT token, platform FROM device_tokens');
    }

    if (platform) tokens = tokens.filter(t => t.platform === platform);

    if (tokens.length === 0) return res.json({ ok: true, sent: 0 });

    // Parse the service account once so getFcmConfig() can't fail mid-loop with
    // a misleading per-device error, then send one v1 message per token.
    parseFcmServiceAccount();

    const payload = {
      notification: { title, body },
      data: { title: String(title), body: String(body) },
    };
    const results = { sent: 0, failed: 0 };
    for (const t of tokens) {
      try {
        if (await sendFcmMessage(t.token, payload)) results.sent += 1;
        else results.failed += 1;
      } catch (err) {
        logger.error({ err: err?.message, stack: err?.stack }, 'push send failed for a device:');
        results.failed += 1;
      }
    }

    res.json({ ok: true, ...results });
  } catch (err) {
    if (err.fcmCode === 'NO_FCM_CONFIG') return res.status(503).json({ error: err.message });
    logger.error({ err: err?.message, stack: err?.stack }, 'push send error:');
    res.status(500).json({ error: 'Failed to send push notification' });
  }
});

module.exports = router;

