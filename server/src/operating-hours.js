'use strict';

// Operating hours — the school system only accepts API requests between
// SYSTEM_OPEN_HOUR (default 06:00) and SYSTEM_CLOSE_HOUR (default 24:00, an
// exclusive bound meaning "until midnight"), in Asia/Manila time (UTC+8, no
// DST). Setting SYSTEM_OPEN_HOUR >= SYSTEM_CLOSE_HOUR disables the gate so the
// system answers requests around the clock. The health endpoint is always
// exempt so Render's health checks (and monitoring pingers) keep working even
// while the school is closed.

const DEFAULT_OPEN_HOUR = 6;
const DEFAULT_CLOSE_HOUR = 24; // midnight (exclusive upper bound)
const MANILA_UTC_OFFSET = 8;

function manilaHour(now = new Date()) {
  return (now.getUTCHours() + MANILA_UTC_OFFSET) % 24;
}

function parseHour(value, fallback) {
  const h = Number(value);
  return Number.isInteger(h) && h >= 0 && h <= 24 ? h : fallback;
}

/** @param {NodeJS.ProcessEnv} [env] @returns {{ enabled: boolean, openHour: number, closeHour: number }} */
function config(env = process.env) {
  const openHour = parseHour(env.SYSTEM_OPEN_HOUR, DEFAULT_OPEN_HOUR);
  const closeHour = parseHour(env.SYSTEM_CLOSE_HOUR, DEFAULT_CLOSE_HOUR);
  return { enabled: openHour < closeHour, openHour, closeHour };
}

function isOpen(now = new Date(), opts = config()) {
  if (!opts.enabled) return true;
  const h = manilaHour(now);
  return h >= opts.openHour && h < opts.closeHour;
}

function formatHour(h) {
  if (h === 24) return '12:00 AM (midnight)';
  const suffix = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:00 ${suffix}`;
}

function gate(opts = config(), now = () => new Date()) {
  const { openHour, closeHour } = opts;
  return (req, res, next) => {
    if (!opts.enabled) return next();
    const path = req.originalUrl || req.url;
    if (path === '/api/v1/health' || path.startsWith('/api/v1/health/')) return next();
    if (isOpen(now(), opts)) return next();
    const error = `The system is currently closed. Operating hours are ${formatHour(openHour)} to ${formatHour(closeHour)}.`;
    return res.status(423).json({ error, code: 'SYSTEM_CLOSED' });
  };
}

module.exports = { config, isOpen, manilaHour, formatHour, gate, DEFAULT_OPEN_HOUR, DEFAULT_CLOSE_HOUR };