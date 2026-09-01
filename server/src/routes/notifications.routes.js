const express = require('express');
const { q, qa, qr } = require('../db');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit, page } = require('../utils');
const { settings, setSetting, getTemplates, resend, sendTest, isEmail, MAX_ATTEMPTS } = require('../notify');

async function sendSmsBlast(message, studentIds) {
  let contacts;
  if (studentIds && studentIds.length) {
    const placeholders = studentIds.map(() => '?').join(',');
    contacts = await qa(
      `SELECT DISTINCT s.guardian_contact, s.guardian_name, s.first_name, s.last_name
       FROM students s
       WHERE s.guardian_contact IS NOT NULL AND s.guardian_contact != ''
         AND s.id IN (${placeholders})`,
      studentIds
    );
  } else {
    contacts = await qa(
      `SELECT DISTINCT s.guardian_contact, s.guardian_name, s.first_name, s.last_name
       FROM students s
       WHERE s.guardian_contact IS NOT NULL AND s.guardian_contact != ''`
    );
  }
  let sent = 0;
  let failed = 0;
  for (const c of contacts) {
    try {
      const phone = c.guardian_contact.replace(/\s+/g, '');
      if (!phone) { failed++; continue; }
      await qr(
        `INSERT INTO notifications (channel, event, recipient_address, body, status, attempts)
         VALUES ('sms', 'blast', ?, ?, 'queued', 0)`,
        [phone, message]
      );
      sent++;
    } catch {
      failed++;
    }
  }
  return { sent, failed, total: contacts.length };
}

const router = express.Router();
router.use(authenticate);
router.use(requireRole('super_admin', 'school_admin'));

// GET /notifications/settings — channel toggles + provider readiness.
router.get('/settings', asyncH(async (req, res) => {
  res.json(await settings());
}));

// PATCH /notifications/settings — flip email/sms on/off.
router.patch('/settings', asyncH(async (req, res) => {
  const b = req.body || {};
  if (b.email_enabled !== undefined) await setSetting('notify_email_enabled', !!b.email_enabled);
  if (b.sms_enabled !== undefined) await setSetting('notify_sms_enabled', !!b.sms_enabled);
  await audit(req, 'NOTIFY_SETTINGS', 'notifications', null, { email_enabled: !!b.email_enabled, sms_enabled: !!b.sms_enabled });
  res.json(await settings());
}));

// GET /notifications/templates — editable message copy per event/channel.
router.get('/templates', asyncH(async (req, res) => {
  const rows = await qa('SELECT event, channel, subject, body, updated_at FROM notification_templates ORDER BY event, channel');
  res.json({ data: rows });
}));

// PUT /notifications/templates/:event/:channel — save subject/body.
router.put('/templates/:event/:channel', asyncH(async (req, res) => {
  const event = String(req.params.event);
  const channel = String(req.params.channel);
  if (!['email', 'sms'].includes(channel)) return res.status(400).json({ error: 'channel must be email or sms' });
  const b = req.body || {};
  const existing = await q('SELECT id FROM notification_templates WHERE event = ? AND channel = ?', [event, channel]);
  if (!existing) return res.status(404).json({ error: 'Template not found' });
  const body = String(b.body ?? '').trim();
  if (!body) return res.status(400).json({ error: 'body is required' });
  const subject = b.subject !== undefined && b.subject !== null ? String(b.subject).trim() : null;
  await qr('UPDATE notification_templates SET subject = ?, body = ?, updated_at = CURRENT_TIMESTAMP WHERE event = ? AND channel = ?',
    [subject, body, event, channel]);
  await audit(req, 'NOTIFY_TEMPLATE_UPDATE', 'notification_templates', `${event}:${channel}`, {});
  res.json({ ok: true });
}));

// GET /notifications?limit&offset&status&channel&event — delivery log.
router.get('/', asyncH(async (req, res) => {
  const { limit, offset } = page(req);
  const where = [];
  const params = [];
  if (req.query.status) { where.push('status = ?'); params.push(req.query.status); }
  if (req.query.channel) { where.push('channel = ?'); params.push(req.query.channel); }
  if (req.query.event) { where.push('event = ?'); params.push(req.query.event); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = await qa(
    `SELECT n.*, u.name AS recipient_name
     FROM notifications n LEFT JOIN users u ON u.id = n.recipient_user_id
     ${whereSql} ORDER BY n.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]);
  const countRow = await q(`SELECT COUNT(*) AS n FROM notifications n ${whereSql}`, params);
  res.json({ data: rows, limit, offset, total: Number(countRow.n) });
}));

// POST /notifications/test — send a live test to an address.
router.post('/test', asyncH(async (req, res) => {
  const b = req.body || {};
  const email = String(b.email || '').trim();
  const phone = String(b.phone || '').trim();
  if (email && !isEmail(email)) return res.status(400).json({ error: 'email is not a valid address' });
  if (!email && !phone) return res.status(400).json({ error: 'Provide an email or phone to send the test to' });
  const result = await sendTest({ email: email || null, phone: phone || null });
  await audit(req, 'NOTIFY_TEST', 'notifications', null, { email: email || null, phone: phone || null });
  res.json(result);
}));

// POST /notifications/:id/resend — requeue a failed/queued message.
router.post('/:id/resend', asyncH(async (req, res) => {
  const row = await q('SELECT * FROM notifications WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Notification not found' });
  if (row.status === 'sent') return res.status(400).json({ error: 'Notification was already sent' });
  if (row.attempts >= MAX_ATTEMPTS) {
    await qr('UPDATE notifications SET attempts = 0, status = \'queued\' WHERE id = ?', [row.id]);
  }
  const result = await resend(row.id);
  await audit(req, 'NOTIFY_RESEND', 'notifications', row.id, { channel: row.channel });
  res.json(result);
}));

// POST /notifications/blast — send SMS blast to all parents (or specific students)
router.post('/blast', asyncH(async (req, res) => {
  const b = req.body || {};
  const message = String(b.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Message is required' });
  if (message.length > 160) return res.status(400).json({ error: 'SMS messages must be 160 characters or less' });
  const studentIds = Array.isArray(b.student_ids) && b.student_ids.length ? b.student_ids : null;
  const result = await sendSmsBlast(message, studentIds);
  await audit(req, 'NOTIFY_BLAST', 'notifications', null, { message_length: message.length, student_count: studentIds?.length || 'all' });
  res.json({ ok: true, ...result });
}));

module.exports = router;
