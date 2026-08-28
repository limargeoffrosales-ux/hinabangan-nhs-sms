const db = require('./db');
const { q, qa, qi, qr } = db;

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
  await qr(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [SETTING_KEY, newSchoolYear]
  );
  cachedSchoolYear = newSchoolYear;
  cacheTimestamp = Date.now();
  await db.tx(async (conn) => {
    await conn.qr(
      `INSERT INTO app_settings (key, value) VALUES ('school_year_updated_at', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [new Date().toISOString()]
    );
  });
  return newSchoolYear;
}

function getTodayParam() {
  return new Date().toISOString().slice(0, 10);
}

function getDaysAgoParam(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function getDaysFromNowParam(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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