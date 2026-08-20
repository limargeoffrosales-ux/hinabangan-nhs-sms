const { Router } = require('express');
const { q, qi, dialect } = require('../db');
const { authenticate, requireRole } = require('../auth');

const router = Router();

// POST /push/register - Register device token
router.post('/register', authenticate, async (req, res) => {
  try {
    const { token, platform = 'android' } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });
    if (!['android', 'ios', 'web'].includes(platform)) {
      return res.status(400).json({ error: 'platform must be android, ios, or web' });
    }
    const params = dialect === 'pg' ? [req.user.id, token, platform] : [req.user.id, token, platform];
    if (dialect === 'pg') {
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
    console.error('push register error:', err);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// POST /push/unregister - Remove device token
router.post('/unregister', authenticate, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });
    if (dialect === 'pg') {
      await q('DELETE FROM device_tokens WHERE token = $1 AND user_id = $2', [token, req.user.id]);
    } else {
      await q('DELETE FROM device_tokens WHERE token = ? AND user_id = ?', [token, req.user.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('push unregister error:', err);
    res.status(500).json({ error: 'Failed to unregister device' });
  }
});

// POST /push/send - Send push notification (admin only)
// Requires FCM_SERVER_KEY env var. If not set, returns 503.
router.post('/send', authenticate, requireRole('super_admin', 'school_admin', 'principal'), async (req, res) => {
  const fcmKey = process.env.FCM_SERVER_KEY;
  if (!fcmKey) return res.status(503).json({ error: 'Push notifications not configured (FCM_SERVER_KEY missing)' });

  try {
    const { title, body, userIds, platform } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'title and body required' });

    let tokens;
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
      tokens = await q(`SELECT token, platform FROM device_tokens WHERE user_id IN (${placeholders})`, userIds);
    } else {
      tokens = await q('SELECT token, platform FROM device_tokens');
    }

    if (platform) tokens = tokens.filter(t => t.platform === platform);

    if (tokens.length === 0) return res.json({ ok: true, sent: 0 });

    const fcmTokens = tokens.map(t => t.token);
    const results = { sent: 0, failed: 0 };

    // Send in batches of 500 (FCM limit)
    for (let i = 0; i < fcmTokens.length; i += 500) {
      const batch = fcmTokens.slice(i, i + 500);
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Authorization': `key=${fcmKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          registration_ids: batch,
          notification: { title, body },
          data: { title, body },
        }),
      });
      const data = await response.json();
      results.sent += (data.success || 0);
      results.failed += (data.failure || 0);
    }

    res.json({ ok: true, ...results });
  } catch (err) {
    console.error('push send error:', err);
    res.status(500).json({ error: 'Failed to send push notification' });
  }
});

module.exports = router;
