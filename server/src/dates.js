'use strict';

// School-calendar date helpers.
//
// Every "today" in this system must be anchored to Asia/Manila, NOT to the
// server's local time. Render runs in UTC, so `new Date().toISOString().slice(0,10)`
// returns yesterday's date during the first 8 hours of every Manila school day —
// which silently mislabeled attendance, overdue assignments and dashboard tiles.
//
// Asia/Manila is UTC+8 year-round (no DST), but this resolves through Intl so a
// future zone change can't reintroduce the bug.

const TZ = process.env.SYSTEM_TIMEZONE || 'Asia/Manila';

const PARTS_CACHE = new Map();

function formatterFor(tz) {
  let f = PARTS_CACHE.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    PARTS_CACHE.set(tz, f);
  }
  return f;
}

/** Calendar date in the school timezone as 'YYYY-MM-DD'. */
function tzDateStr(date = new Date(), tz = TZ) {
  // en-CA formats as YYYY-MM-DD by design.
  return formatterFor(tz).format(date);
}

/** Today's school-local calendar date, 'YYYY-MM-DD'. */
function todayStr(date = new Date(), tz = TZ) {
  return tzDateStr(date, tz);
}

/** School-local calendar date N days from today (negative = past). */
function daysAgoStr(days, from = new Date(), tz = TZ) {
  return tzDateStr(new Date(from.getTime() - days * 86400000), tz);
}

/** School-local calendar date N days from today (positive = future). */
function daysFromNowStr(days, from = new Date(), tz = TZ) {
  return tzDateStr(new Date(from.getTime() + days * 86400000), tz);
}

/**
 * Shift a 'YYYY-MM-DD' calendar date by N days without any timezone math —
 * the value is a plain calendar date, so UTC noon arithmetic keeps the day
 * stable across offsets.
 */
function shiftDateStr(dateStr, days) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const base = Date.UTC(y, (m || 1) - 1, d || 1);
  return new Date(base + days * 86400000).toISOString().slice(0, 10);
}

/** Validate a 'YYYY-MM-DD' string, returning it normalized or null. */
function normalizeDateStr(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const dt = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return null;
  // Rejects impossible dates like 2026-02-31 that Date would roll over.
  if (dt.toISOString().slice(0, 10) !== s) return null;
  return s;
}

module.exports = {
  TZ,
  tzDateStr,
  todayStr,
  daysAgoStr,
  daysFromNowStr,
  shiftDateStr,
  normalizeDateStr,
};
