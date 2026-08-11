const path = require('path');

const PORT = Number(process.env.PORT || 4000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const WEB_DIR = process.env.WEB_DIR || path.join(__dirname, '..', '..', 'web', 'dist');
const JWT_SECRET = process.env.JWT_SECRET || 'meridianed-dev-secret-change-me';
const ACCESS_TTL = process.env.ACCESS_TTL || '15m';
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 14);
const GRADE_WEIGHTS = JSON.parse(process.env.GRADE_WEIGHTS || '{"written_work":25,"performance_task":45,"quarterly_exam":30}');

module.exports = { PORT, DATA_DIR, WEB_DIR, JWT_SECRET, ACCESS_TTL, REFRESH_TTL_DAYS, GRADE_WEIGHTS };
