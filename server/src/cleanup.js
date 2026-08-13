// ============================================================
// Weekly auto-cleanup for the AI Document Generator.
// Generated documents + uploaded custom formats are kept only
// until Friday of their week and are deleted automatically every
// Saturday (school time, Asia/Manila). Runs on boot and every 6h.
// ============================================================

const db = require('./db');

const TZ = 'Asia/Manila';

function phNow() {
  // A Date whose UTC components equal the current wall clock in Manila,
  // so weekday/hour math is stable regardless of the server's timezone.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const hour = get('hour') === 24 ? 0 : get('hour');
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second')));
}

// Start (00:00 Manila) of the Saturday within the week of `ph`.
function startOfSaturday(ph) {
  const d = new Date(ph);
  d.setHours(0, 0, 0, 0);
  const sinceMonday = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - sinceMonday);
  monday.setHours(0, 0, 0, 0);
  const sat = new Date(monday);
  sat.setDate(monday.getDate() + 5);
  return sat;
}

function nextSaturday() {
  const ph = phNow();
  const sat = startOfSaturday(ph);
  if (ph.getTime() >= sat.getTime()) {
    const nxt = new Date(sat);
    nxt.setDate(nxt.getDate() + 7);
    return nxt;
  }
  return sat;
}

function cutoffParam(iso) {
  return db.dialect === 'pg' ? iso : iso.replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

async function runWeeklyCleanup() {
  try {
    const ph = phNow();
    const sat = startOfSaturday(ph);
    // Defensive cutoff: the Saturday that has already passed (previous week's
    // Saturday 00:00). Anything older than that belongs to an expired week.
    const cutoff = cutoffParam(new Date(sat.getTime() - 7 * 24 * 3600 * 1000).toISOString());
    let docsRemoved = 0;
    let formatsRemoved = 0;

    if (ph.getDay() === 6) {
      docsRemoved = Number((await db.qa('SELECT COUNT(*) AS n FROM doc_generations'))[0].n);
      formatsRemoved = Number((await db.qa('SELECT COUNT(*) AS n FROM doc_formats'))[0].n);
      await db.qr('DELETE FROM doc_generations');
      await db.qr('DELETE FROM doc_formats');
    } else {
      docsRemoved = Number((await db.qa('SELECT COUNT(*) AS n FROM doc_generations WHERE created_at < ?', [cutoff]))[0].n);
      formatsRemoved = Number((await db.qa('SELECT COUNT(*) AS n FROM doc_formats WHERE created_at < ?', [cutoff]))[0].n);
      await db.qr('DELETE FROM doc_generations WHERE created_at < ?', [cutoff]);
      await db.qr('DELETE FROM doc_formats WHERE created_at < ?', [cutoff]);
    }

    if (docsRemoved || formatsRemoved) {
      console.log(`WEEKLY_CLEANUP: removed ${docsRemoved} generated doc(s) and ${formatsRemoved} custom format(s) (${ph.toISOString()})`);
    }
  } catch (e) {
    console.error('WEEKLY_CLEANUP failed:', e.message);
  }
}

function startCleanup() {
  runWeeklyCleanup();
  setInterval(runWeeklyCleanup, 6 * 60 * 60 * 1000);
}

module.exports = { startCleanup, runWeeklyCleanup, nextSaturday, phNow };
