// ============================================================
// Notification engine (P1 — Communication & internationalization).
// Email via SMTP (nodemailer) and SMS via a generic HTTP provider.
//
//  - Every outbound message is persisted to `notifications` (queued/sent/failed)
//    so nothing is ever lost silently.
//  - Channel on/off toggles live in app_settings (notify_email_enabled /
//    notify_sms_enabled) and default from env flags.
//  - Message copy comes from `notification_templates` ({{token}} substitution).
//  - A background sweep retries queued/failed rows, so mail/SMS that was
//    recorded while the provider was unconfigured flushes once it is configured.
// ============================================================

const nodemailer = require('nodemailer');
const { q, qa, qi, qr, nowSql } = require('./db');
const logger = require('./logger');
const {
  SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM, NOTIFY_EMAIL_MODE,
  SMS_PROVIDER_URL, SMS_PROVIDER_TOKEN, SMS_SENDER, NOTIFY_EMAIL_ENABLED, NOTIFY_SMS_ENABLED,
} = require('./config');

const SCHOOL = 'Hinabangan National High School';
const MAX_ATTEMPTS = 5;
const SWEEP_LIMIT = 30;
const SWEEP_MS = 60 * 1000;

let sweeping = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmail(v) { return EMAIL_RE.test(String(v || '').trim()); }

// --- Template defaults (seeded idempotently) ---------------------------------
const DEFAULT_TEMPLATES = {
  assignment_created: {
    email: {
      subject: 'New {{kind}}: {{title}} — {{subject}} ({{section}})',
      body: 'Hi {{name}},\n\nA new {{kind}} "{{title}}" was posted for {{subject}} ({{section}}).\nDue: {{due_date}} · Points: {{points}}\n\nSign in to the school portal or app for the full instructions.\n— {{school}}',
    },
    sms: {
      body: 'New {{kind}}: {{title}} ({{subject}}, {{section}}). Due {{due_date}}. See the school app. — {{school}}',
    },
  },
  assignment_graded: {
    email: {
      subject: 'Grade posted: {{title}}',
      body: 'Hi {{name}},\n\nYour submission for "{{title}}" ({{subject}}) was graded.\nScore: {{score}}/{{total}}\n\nFeedback may be available in the portal.\n— {{school}}',
    },
    sms: {
      body: 'Grade for {{title}} ({{subject}}): {{score}}/{{total}}. — {{school}}',
    },
  },
  attendance_alert: {
    email: {
      subject: 'Attendance notice: {{student}} — {{status}}',
      body: 'Hi {{name}},\n\n{{student}} ({{section}}) was recorded as {{status}} on {{date}}.\n{{remarks}}\nIf this is unexpected, please contact the school office.\n— {{school}}',
    },
    sms: {
      body: '{{student}} ({{section}}) was marked {{status}} on {{date}}. Please contact the school if this is unexpected. — {{school}}',
    },
  },
  announcement_posted: {
    email: {
      subject: '{{title}}',
      body: '{{body}}\n\nPriority: {{priority}}\n— {{school}}',
    },
  },
  grade_posted: {
    email: {
      subject: 'Grades posted — Term {{term}} ({{school_year}})',
      body: 'Hi {{name}},\n\nTerm {{term}} grades for {{subject}} ({{section}}) have been posted for {{school_year}}. Sign in to the portal to view {{student}}\'s report card.\n— {{school}}',
    },
  },
  test: {
    email: { subject: 'Test notification from {{school}}', body: 'This is a test message to confirm email delivery.\n\n— {{school}}' },
    sms: { body: 'Test message from {{school}} — SMS delivery works.' },
  },
  password_reset: {
    email: {
      subject: 'Password reset code',
      body: 'Hi {{name}},\n\nA password reset was requested for your account.\nYour reset code is {{code}} — it expires in 15 minutes.\n\nReset your password here: {{url}}\n\nIf you did not request this, you can ignore this message and your password stays the same.\n— {{school}}',
    },
    sms: {
      body: 'Your reset code is {{code}}. Valid for 15 minutes. — {{school}}',
    },
  },
  account_registered: {
    email: {
      subject: 'Welcome to {{school}} — account created',
      body: 'Hi {{name}},\n\nA portal account was created for username {{username}}. Your request has been submitted for review by the registrar. Once approved, you can sign in to view grades, attendance, schedules and more.\n\nSign in here: {{url}}\n\n— {{school}}',
    },
    sms: {
      body: 'Account for {{username}} created. The registrar will review your portal request. — {{school}}',
    },
  },
  link_approved: {
    email: {
      subject: 'Your portal account is now linked',
      body: 'Hi {{name}},\n\nYour student portal account has been approved and linked to your learner record. You can now sign in to view grades, attendance, schedules and assignments.\n\nSign in: {{url}}\n\n— {{school}}',
    },
    sms: {
      body: 'Portal account approved — you can now view grades and schedules in the school portal. — {{school}}',
    },
  },
  link_rejected: {
    email: {
      subject: 'Portal account request update',
      body: 'Hi {{name}},\n\nYour portal account request was not approved{{note}}.\n\nPlease contact the school registrar if you believe this is a mistake.\n— {{school}}',
    },
    sms: {
      body: 'Your portal account request was not approved. Contact the school registrar for help. — {{school}}',
    },
  },
  enrollment_applied: {
    email: {
      subject: 'New enrollment application: {{student}} ({{school_year}})',
      body: 'Hi {{name}},\n\n{{student}} (LRN {{lrn}}) applied for enrollment for school year {{school_year}} ({{grade_level}}{{strand}}).\nPlease review the application in the Enrollment module.\n— {{school}}',
    },
    sms: {
      body: 'Enrollment application: {{student}} ({{lrn}}) for {{school_year}}. Review in Enrollment. — {{school}}',
    },
  },
  enrollment_approved: {
    email: {
      subject: 'Enrollment confirmed — {{school_year}}',
      body: 'Hi {{name}},\n\nYour enrollment for school year {{school_year}} has been confirmed{{section}}.\n\n— {{school}}',
    },
    sms: {
      body: 'Enrollment for {{school_year}} confirmed{{section}}. — {{school}}',
    },
  },
};

function render(template, data) {
  return String(template || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) => {
    const v = data[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

async function ensureDefaults() {
  await qr(
    `INSERT INTO app_settings (key, value) VALUES (?, ?), (?, ?)
     ON CONFLICT (key) DO NOTHING`,
    ['notify_email_enabled', NOTIFY_EMAIL_ENABLED ? '1' : '0',
     'notify_sms_enabled', NOTIFY_SMS_ENABLED ? '1' : '0']);
  const rows = [];
  for (const [event, chans] of Object.entries(DEFAULT_TEMPLATES)) {
    for (const [channel, tpl] of Object.entries(chans)) {
      rows.push([event, channel, tpl.subject || null, tpl.body]);
    }
  }
  for (const [event, channel, subject, body] of rows) {
    await qr(
      `INSERT INTO notification_templates (event, channel, subject, body) VALUES (?, ?, ?, ?)
       ON CONFLICT (event, channel) DO NOTHING`,
      [event, channel, subject, body]);
  }
}

async function getConfig() {
  const rows = await qa('SELECT key, value FROM app_settings WHERE key IN (?, ?)',
    ['notify_email_enabled', 'notify_sms_enabled']);
  const map = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    email_enabled: map.notify_email_enabled === '1',
    sms_enabled: map.notify_sms_enabled === '1',
  };
}

async function getTemplates() {
  const rows = await qa('SELECT event, channel, subject, body FROM notification_templates');
  const out = {};
  for (const r of rows) {
    if (!out[r.event]) out[r.event] = {};
    out[r.event][r.channel] = { subject: r.subject || null, body: r.body };
  }
  return out;
}

// --- Recipient resolution ------------------------------------------------------
function rowLabel(u) {
  return (u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || 'there').trim();
}

async function resolveSectionRecipients(sectionId, schoolYear) {
  const emails = [];
  const seenEmails = new Set();
  const phones = [];
  const seenPhones = new Set();

  const studentRows = await qa(
    `SELECT st.id, u.id AS user_id, u.email, u.phone, u.name, st.first_name, st.last_name, st.guardian_contact, st.guardian_name
     FROM enrollments e
     JOIN students st ON st.id = e.student_id
     LEFT JOIN users u ON u.id = st.user_id
     WHERE e.section_id = ? AND e.school_year = ? AND e.status = 'enrolled'`,
    [sectionId, schoolYear]);
  for (const r of studentRows) {
    if (r.email && isEmail(r.email)) {
      const addr = r.email.trim().toLowerCase();
      if (!seenEmails.has(addr)) {
        seenEmails.add(addr);
        emails.push({ address: r.email.trim(), user_id: r.user_id, label: rowLabel(r) });
      }
    }
    if (r.phone && !isEmail(r.phone)) {
      const p = r.phone.trim();
      if (!seenPhones.has(p)) { seenPhones.add(p); phones.push({ address: p, user_id: r.user_id, label: rowLabel(r) }); }
    }
    if (r.guardian_contact && !isEmail(r.guardian_contact)) {
      const p = r.guardian_contact.trim();
      if (!seenPhones.has(p)) {
        seenPhones.add(p);
        phones.push({ address: p, user_id: null, label: r.guardian_name || 'Parent/Guardian' });
      }
    }
  }

  const parentRows = await qa(
    `SELECT ps.parent_user_id AS user_id, u.email, u.phone, u.name, st.first_name, st.last_name
     FROM parent_students ps
     JOIN users u ON u.id = ps.parent_user_id
     JOIN enrollments e ON e.student_id = ps.student_id
     JOIN students st ON st.id = ps.student_id
     WHERE e.section_id = ? AND e.school_year = ? AND e.status = 'enrolled' AND u.status = 'active'`,
    [sectionId, schoolYear]);
  for (const r of parentRows) {
    const studentName = [r.first_name, r.last_name].filter(Boolean).join(' ');
    const label = `${r.name || 'Parent/Guardian'} (${studentName})`;
    if (r.email && isEmail(r.email)) {
      const addr = r.email.trim().toLowerCase();
      if (!seenEmails.has(addr)) { seenEmails.add(addr); emails.push({ address: r.email.trim(), user_id: r.user_id, label }); }
    }
    if (r.phone && !isEmail(r.phone)) {
      const p = r.phone.trim();
      if (!seenPhones.has(p)) { seenPhones.add(p); phones.push({ address: p, user_id: r.user_id, label }); }
    }
  }

  return { emails, phones };
}

async function resolveStudentRecipients(studentId) {
  const student = await q(
    `SELECT st.*, u.id AS user_id, u.email AS user_email, u.phone AS user_phone, u.name AS user_name
     FROM students st LEFT JOIN users u ON u.id = st.user_id
     WHERE st.id = ?`, [studentId]);
  if (!student) return { emails: [], phones: [] };
  const emails = [];
  const seenEmails = new Set();
  const phones = [];
  const seenPhones = new Set();
  const studentName = [student.first_name, student.last_name].filter(Boolean).join(' ');

  const addEmail = (addr, user_id, label) => {
    if (!addr || !isEmail(addr)) return;
    const a = addr.trim().toLowerCase();
    if (seenEmails.has(a)) return;
    seenEmails.add(a);
    emails.push({ address: addr.trim(), user_id, label });
  };
  const addPhone = (p, user_id, label) => {
    if (!p || isEmail(p)) return;
    const ph = p.trim();
    if (seenPhones.has(ph)) return;
    seenPhones.add(ph);
    phones.push({ address: ph, user_id, label });
  };

  if (student.user_id) {
    addEmail(student.user_email, student.user_id, student.user_name || studentName);
    addPhone(student.user_phone, student.user_id, student.user_name || studentName);
  }
  addPhone(student.guardian_contact, null, student.guardian_name || 'Parent/Guardian');
  addEmail(student.guardian_contact, null, student.guardian_name || 'Parent/Guardian');

  const parents = await qa(
    `SELECT u.id AS user_id, u.email, u.phone, u.name
     FROM parent_students ps JOIN users u ON u.id = ps.parent_user_id
     WHERE ps.student_id = ? AND u.status = 'active'`, [studentId]);
  for (const r of parents) {
    addEmail(r.email, r.user_id, `${r.name || 'Parent/Guardian'} (${studentName})`);
    addPhone(r.phone, r.user_id, `${r.name || 'Parent/Guardian'} (${studentName})`);
  }
  return { emails, phones };
}

async function resolveAnnouncementRecipients(audience) {
  const out = { emails: [], phones: [] };
  const seen = new Set();
  let sql = `SELECT id, email, phone, name, role FROM users WHERE status = 'active'
             AND ((email IS NOT NULL AND email <> '') OR (phone IS NOT NULL AND phone <> ''))`;
  const params = [];
  if (audience === 'staff') { sql += ' AND role NOT IN (?, ?)'; params.push('student', 'parent'); }
  else if (audience === 'students') { sql += ' AND role IN (?, ?)'; params.push('student', 'parent'); }
  else if (audience === 'parents') { sql += ' AND role = ?'; params.push('parent'); }
  const rows = await qa(sql, params);
  for (const r of rows) {
    if (!isEmail(r.email)) continue;
    const a = r.email.trim().toLowerCase();
    if (seen.has(a)) continue;
    seen.add(a);
    out.emails.push({ address: r.email.trim(), user_id: r.id, label: r.name || r.role });
  }
  return out;
}

// --- Delivery -----------------------------------------------------------------
let emailTransport = null;
function getEmailTransport() {
  if (emailTransport) return emailTransport;
  if (NOTIFY_EMAIL_MODE === 'stream') {
    emailTransport = nodemailer.createTransport({ streamTransport: true, buffer: false });
  } else {
    emailTransport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }
  return emailTransport;
}

async function sendEmail(row) {
  if (!SMTP_HOST && NOTIFY_EMAIL_MODE !== 'stream') throw new Error('SMTP not configured');
  const from = MAIL_FROM || (SMTP_USER || 'no-reply@school.local');
  const info = await getEmailTransport().sendMail({
    from,
    to: row.recipient_address,
    subject: row.subject || '',
    text: row.body,
  });
  return { providerId: info.messageId || null };
}

async function sendSms(row) {
  if (!SMS_PROVIDER_URL) throw new Error('SMS provider not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    let res;
    try {
      res = await fetch(SMS_PROVIDER_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(SMS_PROVIDER_TOKEN ? { Authorization: `Bearer ${SMS_PROVIDER_TOKEN}` } : {}),
        },
        body: JSON.stringify({ to: row.recipient_address, from: SMS_SENDER, message: row.body }),
      });
    } catch (err) {
      // The 15s timeout (or the runtime cancelling the request) aborts fetch
      // with an opaque AbortError; record the real cause instead.
      if (controller.signal.aborted) throw new Error('SMS provider timed out (15s)');
      if (err && (err.name === 'AbortError' || /aborted/i.test(String(err.message)))) {
        throw new Error('SMS provider request interrupted');
      }
      throw err;
    }
    if (!res.ok) throw new Error(`SMS provider returned ${res.status}`);
    return { providerId: String(res.status) };
  } finally {
    clearTimeout(timer);
  }
}

async function attemptSend(row) {
  try {
    const result = row.channel === 'email' ? await sendEmail(row) : await sendSms(row);
    await qr(
      `UPDATE notifications SET status = 'sent', attempts = attempts + 1, provider_id = ?,
       error = NULL, updated_at = ${nowSql()}, sent_at = ${nowSql()} WHERE id = ?`,
      [result.providerId, row.id]);
    return { ok: true, id: row.id };
  } catch (err) {
    const message = String(err.message || err).slice(0, 300);
    await qr(
      `UPDATE notifications SET status = 'failed', attempts = attempts + 1, error = ?,
       updated_at = ${nowSql()} WHERE id = ?`,
      [message, row.id]);
    return { ok: false, id: row.id, error: message };
  }
}

// --- Event dispatch -----------------------------------------------------------
async function resolveRecipientsFor(event, ctx) {
  switch (event) {
    case 'assignment_created':
    case 'grade_posted':
      return resolveSectionRecipients(ctx.section_id, ctx.school_year);
    case 'assignment_graded':
    case 'attendance_alert':
      return resolveStudentRecipients(ctx.student_id);
    case 'announcement_posted':
      return resolveAnnouncementRecipients(ctx.audience);
    case 'test':
      return {
        emails: (ctx.emails || []).map((e) => ({ address: e.address, user_id: null, label: e.label || 'there' })),
        phones: (ctx.phones || []).map((p) => ({ address: p.address, user_id: null, label: p.label || 'there' })),
      };
    case 'password_reset':
      if (!ctx.user_id) return { emails: [], phones: [] };
      return resolveUserRecipients(ctx.user_id);
    case 'account_registered':
    case 'link_approved':
    case 'link_rejected':
    case 'enrollment_approved':
      if (!ctx.user_id) return { emails: [], phones: [] };
      return resolveUserRecipients(ctx.user_id);
    case 'enrollment_applied':
      return resolveRoleRecipients(['super_admin', 'school_admin', 'registrar']);
    default:
      return { emails: [], phones: [] };
  }
}

// Deliver to every active holder of a given set of roles (registrars etc.).
async function resolveRoleRecipients(roles) {
  const out = { emails: [], phones: [] };
  if (!roles || !roles.length) return out;
  const placeholders = roles.map(() => '?').join(',');
  const rows = await qa(
    `SELECT id, email, phone, name, role FROM users
     WHERE status = 'active' AND role IN (${placeholders})
       AND ((email IS NOT NULL AND email <> '') OR (phone IS NOT NULL AND phone <> ''))`,
    roles);
  const seenE = new Set();
  const seenP = new Set();
  for (const r of rows) {
    const label = r.name || r.role;
    if (r.email && isEmail(r.email)) {
      const a = r.email.trim().toLowerCase();
      if (!seenE.has(a)) { seenE.add(a); out.emails.push({ address: r.email.trim(), user_id: r.id, label }); }
    }
    if (r.phone && !isEmail(r.phone)) {
      const p = r.phone.trim();
      if (!seenP.has(p)) { seenP.add(p); out.phones.push({ address: p, user_id: r.id, label }); }
    }
  }
  return out;
}

// Password reset goes to the account holder's own contact details.
async function resolveUserRecipients(userId) {
  const u = await q(
    'SELECT id, email, phone, name FROM users WHERE id = ? AND status = \'active\'',
    [userId]);
  if (!u) return { emails: [], phones: [] };
  const emails = [];
  const phones = [];
  if (u.email && isEmail(u.email)) emails.push({ address: u.email.trim(), user_id: u.id, label: u.name || 'there' });
  if (u.phone && !isEmail(u.phone)) phones.push({ address: u.phone.trim(), user_id: u.id, label: u.name || 'there' });
  return { emails, phones };
}

async function notifyEvent(event, ctx = {}) {
  const cfg = await getConfig();
  const channels = [];
  if (cfg.email_enabled) channels.push('email');
  if (cfg.sms_enabled) channels.push('sms');
  if (!channels.length) return { created: 0, sent: 0, failed: 0 };

  const tpls = await getTemplates();
  const recipients = await resolveRecipientsFor(event, ctx);
  let created = 0, sent = 0, failed = 0;

  for (const channel of channels) {
    const tpl = tpls[event] && tpls[event][channel];
    if (!tpl) continue;
    const list = channel === 'email' ? recipients.emails : recipients.phones;
    const base = { ...(ctx.data || {}), school: SCHOOL };
    for (const rcpt of list) {
      const data = { ...base, name: rcpt.label || 'there' };
      const subject = render(tpl.subject || '', data);
      const body = render(tpl.body, data);
      if (!body) continue;
      const id = await qi(
        `INSERT INTO notifications (event, channel, recipient_user_id, recipient_address, subject, body)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [event, channel, rcpt.user_id || null, rcpt.address, subject, body]);
      created++;
      const result = await attemptSend({ id, channel, recipient_address: rcpt.address, subject, body });
      if (result.ok) sent++;
      else failed++;
    }
  }
  return { created, sent, failed };
}

// --- Background sweep ---------------------------------------------------------
async function sweep() {
  if (sweeping) return;
  sweeping = true;
  try {
    const rows = await qa(
      `SELECT * FROM notifications
       WHERE (status = 'queued' OR (status = 'failed' AND attempts < ?))
       ORDER BY created_at
       LIMIT ?`,
      [MAX_ATTEMPTS, SWEEP_LIMIT]);
    for (const row of rows) await attemptSend(row);
  } catch (err) {
    logger.error({ err: err.message }, 'NOTIFY_SWEEP failed:');
  } finally {
    sweeping = false;
  }
}

function startNotifySweep() {
  sweep();
  setInterval(sweep, SWEEP_MS);
}

// --- Public helpers used by routes --------------------------------------------
async function settings() {
  const cfg = await getConfig();
  return {
    email_enabled: cfg.email_enabled,
    sms_enabled: cfg.sms_enabled,
    email_configured: !!(SMTP_HOST || NOTIFY_EMAIL_MODE === 'stream'),
    sms_configured: !!SMS_PROVIDER_URL,
    mail_from: MAIL_FROM || (SMTP_USER || ''),
    sms_sender: SMS_SENDER,
  };
}

async function setSetting(key, value) {
  await qr(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    [key, value ? '1' : '0']);
}

async function resend(id) {
  const row = await q('SELECT * FROM notifications WHERE id = ?', [id]);
  if (!row) return { error: 'Notification not found' };
  if (row.status === 'sent') return { error: 'Notification was already sent' };
  return attemptSend(row);
}

async function sendTest({ email, phone }) {
  const ctx = { data: {} };
  if (email) ctx.emails = [{ address: email, label: 'Test recipient' }];
  if (phone) ctx.phones = [{ address: phone, user_id: null, label: 'Test recipient' }];
  return notifyEvent('test', ctx);
}

module.exports = {
  ensureDefaults, getConfig, getTemplates, notifyEvent, startNotifySweep, sweep,
  settings, setSetting, resend, sendTest, render, isEmail, MAX_ATTEMPTS,
};
