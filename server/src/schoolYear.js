const db = require('./db');
const { q } = db;

const DEFAULT_SCHOOL_YEAR = '2026-2027';
const SETTING_KEY = 'school_year';

let cachedSchoolYear = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getSchoolYearFromDb() {
  const row = await q('SELECT value FROM app_settings WHERE key = ?', [SETTING_KEY]);
  if (row && row.value) return row.value;
  return DEFAULT_SCHOOL_YEAR;
}

async function refreshCache() {
  cachedSchoolYear = await getSchoolYearFromDb();
  cacheTimestamp = Date.now();
}

async function getCurrentSchoolYear() {
  if (!cachedSchoolYear || Date.now() - cacheTimestamp > CACHE_TTL_MS) {
    await refreshCache();
  }
  return cachedSchoolYear;
}

async function setCurrentSchoolYear(newSchoolYear) {
  await db.tx(async (conn) => {
    await conn.qr(
      `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [SETTING_KEY, newSchoolYear]
    );
    await conn.qr(
      `INSERT INTO app_settings (key, value) VALUES ('school_year_updated_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [new Date().toISOString()]
    );
  });
  cachedSchoolYear = newSchoolYear;
  cacheTimestamp = Date.now();
  return newSchoolYear;
}

function localDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayParam() {
  return localDateStr();
}

function getDaysAgoParam(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDateStr(d);
}

function getDaysFromNowParam(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

module.exports = {
  getCurrentSchoolYear,
  setCurrentSchoolYear,
  refreshCache,
  getTodayParam,
  getDaysAgoParam,
  getDaysFromNowParam,
  DEFAULT_SCHOOL_YEAR,
};