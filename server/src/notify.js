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
const db = require('./db');
const { broadcast } = require('./realtime');
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

// Auto-provisioned SMTP (dev/demo only). When the deployment has no explicit
// SMTP credentials, the server provisions an Ethereal test relay at boot so
// the engine genuinely sends over SMTP and never stays "NOT CONFIGURED".
let autoSmtp = null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Built-in SMS gateways that need no sign-up (configured by NAME instead of a URL,
// e.g. SMS_PROVIDER_URL=textbelt or the in-app provider form). textbelt lets you
// send ONE free real SMS per phone number per day to prove the end-to-end path.
const BUILTIN_SMS = {
  textbelt: { url: 'https://textbelt.com/text', kind: 'form', keyField: 'key', defaultKey: 'textbelt' },
};

async function getSmsProvider() {
  try {
    const rows = await qa(
      'SELECT key, value FROM app_settings WHERE key IN (?, ?, ?)',
      ['sms_provider_url', 'sms_provider_token', 'sms_sender']);
    const m = {};
    for (const r of rows) m[r.key] = r.value;
    if (m.sms_provider_url) {
      return {
        url: m.sms_provider_url,
        token: m.sms_provider_token !== undefined ? m.sms_provider_token : SMS_PROVIDER_TOKEN,
        sender: m.sms_sender !== undefined ? m.sms_sender : SMS_SENDER,
        source: 'runtime',
      };
    }
  } catch { /* settings read not ready — fall back to env */ }
  return { url: SMS_PROVIDER_URL, token: SMS_PROVIDER_TOKEN, sender: SMS_SENDER, source: 'env' };
}

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
  grade_alert: {
    email: {
      subject: 'Academic notice: Low grade for {{student}} in {{subject}}',
      body: 'Hi {{name}},\n\n{{student}} received a grade of {{grade}} in {{subject}} (Term {{term}}), which is below the passing threshold.\n\nPlease check the portal for details and consult with the teacher if needed.\n— {{school}}',
    },
    sms: {
      body: 'Academic notice: {{student}} received {{grade}} in {{subject}} (Term {{term}}). Check school portal. — {{school}}',
    },
  },
  test: {
    email: { subject: 'Test notification from {{school}}', body: 'This is a test message to confirm email delivery.\n\n— {{school}}' },
    sms: { body: 'Test message from {{school}} — SMS delivery works.' },
  },
  ops_alert: {
    email: { subject: 'OPS ALERT: {{subject}}', body: 'Hi {{name}},\n\n{{body}}\n\n— {{school}}' },
    sms: { body: 'OPS ALERT: {{body}} — {{school}}' },
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
  account_locked: {
    email: {
      subject: 'Your account was temporarily locked',
      body: 'Hi {{name}},\n\nAfter {{attempts}} failed sign-in attempts, your account ({{username}}) was locked for {{minutes}} minutes to protect it from further misuse.\n\nIf this was you, simply sign in again after the lock expires and check your password. If you do not recognise these attempts, contact the school administrator to have the account reviewed and your password reset.\n\n— {{school}}',
    },
    sms: {
      body: 'Your account was locked after {{attempts}} failed sign-in attempts. It unlocks in {{minutes}} minutes. Contact the school if this was not you. — {{school}}',
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

// Provisions an Ethereal test relay when the deployment has no explicit SMTP
// credentials. Runs once at boot so the engine always has a working smtp path
// in dev/demo (production never auto-attaches a test relay).
async function ensureSmtp() {
  if (NOTIFY_EMAIL_MODE === 'stream') return;
  if (SMTP_USER) return;
  if (process.env.NODE_ENV === 'production') return;
  if (autoSmtp) return;
  const stored = await q(
    'SELECT value FROM app_settings WHERE key = ?', ['smtp_auto_provisioned']);
  if (stored && stored.value === '1') {
    const rows = await qa(
      'SELECT key, value FROM app_settings WHERE key IN (?, ?, ?, ?, ?)',
      ['smtp_auto_host', 'smtp_auto_port', 'smtp_auto_secure', 'smtp_auto_user', 'smtp_auto_pass']);
    const map = {};
    for (const r of rows) map[r.key] = r.value;
    if (map.smtp_auto_host && map.smtp_auto_user) {
      autoSmtp = {
        host: map.smtp_auto_host,
        port: Number(map.smtp_auto_port || 587),
        secure: map.smtp_auto_secure === '1',
        user: map.smtp_auto_user,
        pass: map.smtp_auto_pass || '',
      };
      return;
    }
  }
  try {
    const acct = await nodemailer.createTestAccount();
    const store = [
      ['smtp_auto_host', acct.smtp.host],
      ['smtp_auto_port', String(acct.smtp.port)],
      ['smtp_auto_secure', acct.smtp.secure ? '1' : '0'],
      ['smtp_auto_user', acct.user],
      ['smtp_auto_pass', acct.pass],
    ];
    for (const [key, value] of store) {
      await qr(
        'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
        [key, value]);
    }
    await qr(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      ['smtp_auto_provisioned', '1']);
    autoSmtp = {
      host: acct.smtp.host,
      port: acct.smtp.port,
      secure: !!acct.smtp.secure,
      user: acct.user,
      pass: acct.pass,
    };
    const inbox = `https://ethereal.email/login?user=${encodeURIComponent(acct.user)}&pass=${encodeURIComponent(acct.pass)}`;
    logger.info({ host: acct.smtp.host, port: acct.smtp.port, inbox },
      'SMTP auto-provisioned (Ethereal test relay) — set SMTP_USER/SMTP_PASS to send through your own provider');
  } catch (err) {
    logger.warn({ err: err?.message, stack: err?.stack }, 'SMTP auto-provision failed — email stays queued until SMTP is configured');
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
  // SMS-only recipients must not be dropped. The WHERE clause above already
  // admits a user who has EITHER an email or a phone, but the old body then did
  // `if (!isEmail(r.email)) continue`, which discarded everyone reachable only by
  // phone and silently sent them no announcement at all - the staff audience
  // included every non-student role, so a phone-only teacher or cashier was
  // unreachable. Delivery now mirrors resolveRoleRecipients: email when valid,
  // phone when present, each de-duplicated separately.
  const seenPhone = new Set();
  for (const r of rows) {
    if (r.email && isEmail(r.email)) {
      const a = r.email.trim().toLowerCase();
      if (!seen.has(a)) {
        seen.add(a);
        out.emails.push({ address: r.email.trim(), user_id: r.id, label: r.name || r.role });
      }
    }
    if (r.phone && !isEmail(r.phone)) {
      const p = r.phone.trim();
      if (!seenPhone.has(p)) {
        seenPhone.add(p);
        out.phones.push({ address: p, user_id: r.id, label: r.name || r.role });
      }
    }
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
  if (autoSmtp) {
    const transport = nodemailer.createTransport({
      host: autoSmtp.host,
      port: autoSmtp.port,
      secure: autoSmtp.secure,
      auth: { user: autoSmtp.user, pass: autoSmtp.pass },
    });
    const info = await transport.sendMail({
      from: autoSmtp.user,
      to: row.recipient_address,
      subject: row.subject || '',
      text: row.body,
    });
    return { providerId: info.messageId || null };
  }
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
  const prov = await getSmsProvider();
  if (!prov.url) {
    // No gateway credentials exist. In dev/demo the engine keeps the whole SMS
    // flow working end-to-end by simulating delivery: the exact message lands
    // in the delivery log marked 'simulated' (never a false 'sent'). In
    // production SMS keeps failing so queued rows flush once a provider is set.
    if (process.env.NODE_ENV === 'production') throw new Error('SMS provider not configured');
    return { providerId: 'local://simulated', simulated: true };
  }
  const builtin = BUILTIN_SMS[String(prov.url).toLowerCase()];
  const endpoint = builtin ? builtin.url : prov.url;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    let res;
    try {
      if (builtin) {
        const params = new URLSearchParams();
        params.set('phone', String(row.recipient_address));
        params.set('message', String(row.body));
        params.set(builtin.keyField, prov.token || builtin.defaultKey || '');
        res = await fetch(endpoint, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });
      } else {
        res = await fetch(endpoint, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(prov.token ? { Authorization: `Bearer ${prov.token}` } : {}),
          },
          body: JSON.stringify({ to: row.recipient_address, from: prov.sender, message: row.body }),
        });
      }
    } catch (err) {
      // The 15s timeout (or the runtime cancelling the request) aborts fetch
      // with an opaque AbortError; record the real cause instead.
      if (controller.signal.aborted) throw new Error('SMS provider timed out (15s)');
      if (err && (err.name === 'AbortError' || /aborted/i.test(String(err.message)))) {
        throw new Error('SMS provider request interrupted');
      }
      throw err;
    }
    if (builtin) {
      const body = await res.json().catch(() => null);
      if (body && body.success === false) throw new Error(String(body.error || 'SMS gateway rejected the message').slice(0, 300));
    }
    if (!res.ok) throw new Error(`SMS provider returned ${res.status}`);
    return { providerId: String(res.status) };
  } finally {
    clearTimeout(timer);
  }
}

// Claim a queued/failed row for delivery by flipping it to the in-flight
// 'sending' status. The UPDATE ... WHERE status IN (...) is the mutual
// exclusion: a second caller (a concurrent sweep, or an explicit resend racing
// the sweep) updates 0 rows and gets `false`, so it never sends. Without this,
// SELECT-then-send allowed the same notification to be delivered twice.
async function claim(id, opts = {}) {
  // `attempts < ?` keeps a permanently failing notification out of the sweep
  // once it has exhausted MAX_ATTEMPTS.
  let sql = `UPDATE notifications SET status = 'sending', claimed_at = ${nowSql()}, updated_at = ${nowSql()}
             WHERE id = ? AND status IN ('queued', 'failed'`;
  if (opts.allowRetry) sql += `, 'sending'`;
  sql += ')';
  const params = [];
  if (opts.maxAttempts != null) {
    sql += ' AND attempts < ?';
    params.push(opts.maxAttempts);
  }
  params.push(id);
  const result = await qr(sql, params);
  return (result.changes || 0) > 0;
}

async function attemptSend(row, opts = {}) {
  // `claimed: false` means the caller already holds the claim.
  if (!opts.claimed) {
    const got = await claim(row.id, opts);
    if (!got) return { ok: false, id: row.id, skipped: true, error: 'already claimed' };
  }
  try {
    const result = row.channel === 'email' ? await sendEmail(row) : await sendSms(row);
    await qr(
      `UPDATE notifications SET status = ?, attempts = attempts + 1, provider_id = ?, error = NULL,
       updated_at = ${nowSql()}, sent_at = ${nowSql()} WHERE id = ?`,
      [result.simulated ? 'simulated' : 'sent', result.providerId || null, row.id]);
    return { ok: true, id: row.id, simulated: !!result.simulated };
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
      return ctx.user_id ? resolveUserRecipients(ctx.user_id, { includePending: true }) : { emails: [], phones: [] };
    case 'account_locked':
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
// includePending is used only for the self-registration confirmation: that
// account is created with status 'pending' precisely so it cannot be signed into
// before a registrar reviews it, so the usual status='active' filter would
// silently swallow the "we received your request" email. Every other event keeps
// the strict filter.
async function resolveUserRecipients(userId, { includePending = false } = {}) {
  const u = await q(
    includePending
      ? 'SELECT id, email, phone, name FROM users WHERE id = ?'
      : 'SELECT id, email, phone, name FROM users WHERE id = ? AND status = \'active\'',
    [userId]);
  if (!u) return { emails: [], phones: [] };
  const emails = [];
  const phones = [];
  if (u.email && isEmail(u.email)) emails.push({ address: u.email.trim(), user_id: u.id, label: u.name || 'there' });
  if (u.phone && !isEmail(u.phone)) phones.push({ address: u.phone.trim(), user_id: u.id, label: u.name || 'there' });
  return { emails, phones };
}

// Notifications are a best-effort side effect of work that has ALREADY been
// committed (an enrollment row, a password-reset token, a submitted report).
// Letting this throw turned a durable success into a 500 and told the caller to
// retry, which then hit the duplicate/unique guards — so a transient SMTP or DB
// error produced both a scary error page and a duplicate submission. Failures
// are logged and reported in the return value instead.
//
// This also preserves the enumeration-safe password-reset contract: that route
// deliberately answers 202 regardless of whether the account exists, and a
// notify error used to be the one case that leaked a distinguishable 500.
async function notifyEvent(event, ctx = {}) {
  try {
    return await dispatchEvent(event, ctx);
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack, event }, '[NOTIFY] dispatch failed');
    return { created: 0, sent: 0, failed: 0, error: err.message };
  }
}

async function dispatchEvent(event, ctx) {
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
      // The insert lands as 'queued', then attemptSend claims it. Passing
      // maxAttempts keeps a queued row with a full attempt budget out.
      const result = await attemptSend({ id, channel, recipient_address: rcpt.address, subject, body });
      if (result.skipped) { created--; continue; }
      if (result.ok) sent++;
      else failed++;
    }
  }
  if (created) broadcast('notification', { event, created });
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
    // attemptSend claims each row atomically, so a concurrent sweep or resend
    // loses the UPDATE and skips the send instead of duplicating it.
    for (const row of rows) {
      await attemptSend(row, { maxAttempts: MAX_ATTEMPTS });
    }
    // Recover rows stuck in-flight. A process crash mid-send left them at
    // 'sending' forever; after the stale window they are eligible again.
    await qr(
      `UPDATE notifications SET status = 'failed', error = COALESCE(error, 'interrupted; retrying')
       WHERE status = 'sending' AND claimed_at IS NOT NULL
         AND claimed_at < ${db.dialect === 'pg' ? "now() - interval '10 minutes'" : "datetime('now', '-10 minutes')"}`
    );
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack }, 'NOTIFY_SWEEP failed:');
  } finally {
    sweeping = false;
  }
}

function startNotifySweep() {
  const leader = require('./leader');
  leader.start('notify-sweep', {
    run: sweep,
    intervalMs: SWEEP_MS,
    onError: (err) => logger.error({ err: err?.message, stack: err?.stack }, 'NOTIFY_SWEEP tick failed:'),
  });
}

// --- Public helpers used by routes --------------------------------------------
async function settings() {
  const cfg = await getConfig();
  const prov = await getSmsProvider();
  const sms_provider_configured = !!prov.url;
  const sms_simulated = !sms_provider_configured && process.env.NODE_ENV !== 'production';
  return {
    email_enabled: cfg.email_enabled,
    sms_enabled: cfg.sms_enabled,
    email_configured: !!(SMTP_HOST || NOTIFY_EMAIL_MODE === 'stream' || autoSmtp),
    sms_configured: sms_provider_configured,
    sms_simulated,
    sms_mode: sms_provider_configured ? 'provider' : (sms_simulated ? 'simulator' : 'none'),
    sms_config_source: prov.source,
    sms_provider_url: prov.source === 'runtime' ? prov.url : (SMS_PROVIDER_URL || ''),
    sms_sender: prov.sender,
    mail_from: MAIL_FROM || (SMTP_USER || autoSmtp?.user || ''),
  };
}

async function setSmsProvider({ url, token, sender }) {
  const pairs = [];
  if (url !== undefined) pairs.push(['sms_provider_url', String(url).trim()]);
  if (token !== undefined) pairs.push(['sms_provider_token', String(token).trim()]);
  if (sender !== undefined) pairs.push(['sms_sender', String(sender).trim()]);
  for (const [key, value] of pairs) {
    await qr(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      [key, value]);
  }
}

async function setSetting(key, value) {
  await qr(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    [key, value ? '1' : '0']);
}

async function resend(id) {
  const row = await q('SELECT * FROM notifications WHERE id = ?', [id]);
  if (!row) return { error: 'Notification not found' };
  if (row.status === 'sent' || row.status === 'simulated') return { error: 'Notification was already sent' };
  // Reset the attempt budget so an explicit resend always gets a real attempt,
  // but keep the atomic claim so it can't race the background sweep.
  await qr('UPDATE notifications SET attempts = 0 WHERE id = ? AND status = ?', [id, row.status]);
  return attemptSend(row);
}

async function sendTest({ email, phone }) {
  const ctx = { data: {} };
  if (email) ctx.emails = [{ address: email, label: 'Test recipient' }];
  if (phone) ctx.phones = [{ address: phone, user_id: null, label: 'Test recipient' }];
  return notifyEvent('test', ctx);
}

async function opsAlert({ subject, body }) {
  try {
    const admin = await q('SELECT id, email, phone, name FROM users WHERE role = ? AND status = ? ORDER BY id LIMIT 1', ['super_admin', 'active']);
    if (!admin) return { sent: false, reason: 'no admin' };
    const ctx = { data: { subject, body } };
    if (admin.email) ctx.emails = [{ address: admin.email, label: admin.name || 'Admin' }];
    if (admin.phone) ctx.phones = [{ address: admin.phone, user_id: admin.id, label: admin.name || 'Admin' }];
    const result = await notifyEvent('ops_alert', ctx);
    return { sent: result.sent > 0, ...result };
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack }, 'OPS_ALERT failed:');
    return { sent: false, error: err?.message };
  }
}

module.exports = {
  ensureDefaults, ensureSmtp, getConfig, getTemplates, notifyEvent, startNotifySweep, sweep,
  settings, setSetting, setSmsProvider, resend, sendTest, opsAlert, render, isEmail, MAX_ATTEMPTS,
};
