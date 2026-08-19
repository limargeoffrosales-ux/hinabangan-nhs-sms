const path = require('path');

const PORT = Number(process.env.PORT || 4000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const WEB_DIR = process.env.WEB_DIR || path.join(__dirname, '..', '..', 'web', 'dist');
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('JWT_SECRET must be set in production'); })() : 'meridianed-dev-secret-change-me');
const ACCESS_TTL = process.env.ACCESS_TTL || '15m';
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 14);
let GRADE_WEIGHTS;
try { GRADE_WEIGHTS = JSON.parse(process.env.GRADE_WEIGHTS || '{"written_work":25,"performance_task":45,"quarterly_exam":30}'); } catch { GRADE_WEIGHTS = { written_work: 25, performance_task: 45, quarterly_exam: 30 }; }

// --- Email (SMTP) transport ---------------------------------------------------
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === '1' || process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const MAIL_FROM = process.env.MAIL_FROM || '';
// 'stream' keeps outgoing mail on a test transport (nodemailer streamTransport) —
// used by the smoke tests to verify the email path without a real SMTP server.
const NOTIFY_EMAIL_MODE = process.env.NOTIFY_EMAIL_MODE || 'smtp';

// --- SMS (generic HTTP provider) ----------------------------------------------
// Point SMS_PROVIDER_URL at any relay that accepts a JSON POST of
// { to, from, message } with Authorization: Bearer <token>. When empty, SMS is
// recorded as queued and never delivered.
const SMS_PROVIDER_URL = process.env.SMS_PROVIDER_URL || '';
const SMS_PROVIDER_TOKEN = process.env.SMS_PROVIDER_TOKEN || '';
const SMS_SENDER = process.env.SMS_SENDER || 'SCHOOL';

// --- Notification engine toggles (defaults; overridable per school in the UI) --
const NOTIFY_EMAIL_ENABLED = process.env.NOTIFY_EMAIL_ENABLED !== '0';
const NOTIFY_SMS_ENABLED = process.env.NOTIFY_SMS_ENABLED === '1';

// Browser/APK origins allowed to call the API cross-origin. Same-origin
// requests (the web portal served by this same process) are always allowed.
const ALLOWED_ORIGINS = [
  'https://hinabangan-nhs.onrender.com',
  'https://localhost',
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
];

function isAllowedOrigin(origin) {
  if (!origin) return true;
  for (const rule of ALLOWED_ORIGINS) {
    if (rule instanceof RegExp ? rule.test(origin) : rule === origin) return true;
  }
  return false;
}

module.exports = {
  PORT, DATA_DIR, WEB_DIR, JWT_SECRET, ACCESS_TTL, REFRESH_TTL_DAYS, GRADE_WEIGHTS, isAllowedOrigin,
  SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM, NOTIFY_EMAIL_MODE,
  SMS_PROVIDER_URL, SMS_PROVIDER_TOKEN, SMS_SENDER, NOTIFY_EMAIL_ENABLED, NOTIFY_SMS_ENABLED,
};
