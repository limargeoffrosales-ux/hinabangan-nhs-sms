const path = require('path');

const PORT = Number(process.env.PORT || 4000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const WEB_DIR = process.env.WEB_DIR || path.join(__dirname, '..', '..', 'web', 'dist');
const JWT_SECRET = process.env.JWT_SECRET || 'meridianed-dev-secret-change-me';
const ACCESS_TTL = process.env.ACCESS_TTL || '15m';
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 14);
const GRADE_WEIGHTS = JSON.parse(process.env.GRADE_WEIGHTS || '{"written_work":25,"performance_task":45,"quarterly_exam":30}');

// Browser/APK origins allowed to call the API cross-origin. Same-origin
// requests (the web portal served by this same process) are always allowed.
const ALLOWED_ORIGINS = [
  'https://hinabangan-nhs.onrender.com',
  'https://hinabangan-nhs.onrender.com/',
  'capacitor://localhost',
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

module.exports = { PORT, DATA_DIR, WEB_DIR, JWT_SECRET, ACCESS_TTL, REFRESH_TTL_DAYS, GRADE_WEIGHTS, isAllowedOrigin };
