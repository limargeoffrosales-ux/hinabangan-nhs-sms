const path = require('path');

const PORT = Number(process.env.PORT || 4000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const WEB_DIR = process.env.WEB_DIR || path.join(__dirname, '..', '..', 'web', 'dist');
// Public base URL of the app (used to build reset links in emails). When empty,
// reset links fall back to the request's Host header.
const APP_URL = process.env.APP_URL || '';
const JWT_SECRET = process.env.JWT_SECRET || (() => { throw new Error('JWT_SECRET environment variable is required'); })();
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'meridianed';
const JWT_ISSUER = process.env.JWT_ISSUER || 'meridianed';
const ACCESS_TTL = process.env.ACCESS_TTL || '15m';
const REFRESH_TTL_DAYS = (() => {
  const n = Number(process.env.REFRESH_TTL_DAYS || 14);
  return Number.isFinite(n) && n > 0 ? n : 14;
})();
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

// --- Cloudflare R2 (S3-compatible object storage) ------------------------------
const R2_ENDPOINT = process.env.R2_ENDPOINT || '';
const R2_BUCKET = process.env.R2_BUCKET || 'meridianed-uploads';
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY || '';
const R2_SECRET_KEY = process.env.R2_SECRET_KEY || '';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';
const UPLOAD_MAX_MB = Number(process.env.UPLOAD_MAX_MB || 10);

module.exports = {
  PORT, DATA_DIR, WEB_DIR, JWT_SECRET, JWT_AUDIENCE, JWT_ISSUER, ACCESS_TTL, REFRESH_TTL_DAYS, GRADE_WEIGHTS,
  SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM, NOTIFY_EMAIL_MODE,
  SMS_PROVIDER_URL, SMS_PROVIDER_TOKEN, SMS_SENDER, NOTIFY_EMAIL_ENABLED, NOTIFY_SMS_ENABLED,
  R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY, R2_SECRET_KEY, R2_PUBLIC_URL, UPLOAD_MAX_MB,
  APP_URL,
};
