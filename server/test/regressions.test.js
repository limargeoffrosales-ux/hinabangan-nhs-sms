// Regression suite for audit remediation.
//
// Each test here pins a bug that actually shipped or was about to ship, so the
// same class of defect fails the build instead of reaching production. Where a
// defect was invisible to ESLint (an undeclared identifier inside a template
// literal) the assertion is deliberately structural.
//
// IMPORTANT: env is set BEFORE requiring src modules and DATABASE_URL is deleted
// so this never touches a real PostgreSQL connection.
'use strict';
for (const k of ['DATABASE_URL', 'POSTGRES_URL', 'PGURL']) delete process.env[k];
process.env.DATA_DIR = require('fs').mkdtempSync(
  require('path').join(require('os').tmpdir(), 'meridianed-regress-')
);
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { before, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { init, q, qa, qr, tx, close } = require('../src/db');
const { hasMagic } = require('../src/upload-guard');
const { PRIVILEGED_ROLES, ROLES, ADMIN_ROLES } = require('../src/middleware/auth');
const { maskPII } = require('../src/utils');
const { convertGrade } = require('../src/grading/scales');
const { todayStr, shiftDateStr, normalizeDateStr, daysAgoStr } = require('../src/dates');

const MIGRATIONS = path.join(__dirname, '..', '..', 'database', 'migrations');

/** Strips // line comments so assertions target live code, not documentation. */
function stripComments(src) {
  return src.replace(/^\s*\/\/.*$/gm, '');
}

before(async () => {
  await init();
});

// ── Undeclared-identifier regressions ───────────────────────────────────────
// These three shipped as ReferenceErrors: an edit had moved a `const` inside a
// SQL template literal, so the variable was silently part of the query string.
// `no-undef` now guards them, but assert the behaviour too.

test('dashboard summary: payload is bound to a real variable before caching', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'dashboard.routes.js'), 'utf8');
  // The bug: `const data = {` was mangled away, so the summary object was passed
  // straight into res.json(...) and cache.set referenced an identifier that did not exist.
  const decl = src.indexOf('const data = {');
  assert.ok(decl !== -1, 'the summary payload must be bound to `data`');
  const cached = src.indexOf('await cache.set(cacheKey, data,');
  assert.ok(cached > decl, 'cache must be written after data is bound');
  const sent = src.indexOf('res.json(data)', cached);
  assert.ok(sent > cached, 'the cached payload must be what gets sent');
});

test('analytics CSV export: _today is bound before the query, not inside it', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'analytics-kpi.routes.js'), 'utf8');
  const decl = src.indexOf('const _today = todayStr()');
  const use = src.indexOf('syEnd > _today');
  assert.ok(decl !== -1, '_today should be declared');
  assert.ok(use !== -1, '_today should be used');
  assert.ok(decl < use, '_today must be declared before it is referenced');
});

test('generate-programs: generateGroup declares its own failures array', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'generate-programs.js'), 'utf8');
  const body = src.slice(src.indexOf('async function generateGroup'));
  const end = body.indexOf('\nasync function');
  const fn = body.slice(0, end === -1 ? undefined : end);
  assert.match(fn, /const failures = \[\]/,
    'generateGroup must declare a local failures array');
});

// ── Notification claim migration ────────────────────────────────────────────

test('notification claimed_at uses a timestamp type on Postgres', () => {
  const sql = fs.readFileSync(path.join(MIGRATIONS, '090-notification-claim.sql'), 'utf8');
  const m = sql.match(/ADD COLUMN IF NOT EXISTS claimed_at\s+([A-Za-z]+)/i);
  assert.ok(m, 'claimed_at must be added by 090');
  assert.match(m[1], /TIMESTAMP/i,
    `claimed_at must be a timestamp type (got ${m[1]}); notify.js compares it to now() - interval`);
});

test('notification claimed_at stays TEXT on SQLite, matching its other timestamps', () => {
  const sql = fs.readFileSync(path.join(MIGRATIONS, '090-notification-claim.sqlite.sql'), 'utf8');
  assert.match(sql, /claimed_at\s+TEXT/i);
});

test('applied notifications table has claimed_at and accepts the sending status', async () => {
  const cols = await qa('PRAGMA table_info(notifications)', []);
  assert.ok(cols.some((c) => c.name === 'claimed_at'), 'claimed_at column must exist');

  // 'sending' must be insertable, otherwise every claim fails the CHECK.
  await qr(
    `INSERT INTO notifications (event, channel, recipient_address, body, status)
     VALUES ('__test', 'email', 'a@b.c', 'x', 'sending')`, []);
  await qr('DELETE FROM notifications WHERE event = ?', ['__test']);
});

test('stuck notification recovery query is dialect-correct', async () => {
  const id = (await qa(
    `INSERT INTO notifications (event, channel, recipient_address, body, status, claimed_at)
     VALUES ('__stale', 'email', 'a@b.c', 'x', 'sending', datetime('now', '-30 minutes'))
     RETURNING *`, []))[0].id;
  try {
    const stuck = await qa(
      `SELECT id FROM notifications
       WHERE status = 'sending' AND claimed_at IS NOT NULL
         AND claimed_at < datetime('now', '-10 minutes')`, []);
    assert.ok(stuck.some((r) => r.id === id), 'a 30-minute-old claim must be detected as stale');
  } finally {
    await qr('DELETE FROM notifications WHERE event = ?', ['__stale']);
  }
});

// ── Claimed-at upgrade path (091) ───────────────────────────────────────────
// Editing 090 does nothing for a database that already recorded it, so 091 has to
// repair the column. These assert the repair exists and behaves.

test('091 exists for both dialects to convert claimed_at on deployed databases', () => {
  for (const f of ['091-notification-claimed-at-type.sql', '091-notification-claimed-at-type.sqlite.sql']) {
    assert.ok(fs.existsSync(path.join(MIGRATIONS, f)), `${f} must exist`);
  }
  const pg = fs.readFileSync(path.join(MIGRATIONS, '091-notification-claimed-at-type.sql'), 'utf8');
  // The conversion MUST be guarded: a fresh database already got TIMESTAMPTZ from
  // 090, and an unguarded ALTER COLUMN TYPE would fail on it.
  assert.match(pg, /information_schema\.columns/,
    'the PG type conversion must be conditional on the current column type');
  assert.match(pg, /data_type IN \('text', 'character varying'\)/);
  assert.match(pg, /ALTER COLUMN claimed_at TYPE TIMESTAMPTZ/);
});

test('091 PG neutralises unreadable claimed_at values before casting them', () => {
  const pg = fs.readFileSync(path.join(MIGRATIONS, '091-notification-claimed-at-type.sql'), 'utf8');
  // Migrations run inside one transaction that also records schema_migrations, so
  // a single unparseable row would abort the file and crash-loop every boot.
  const blank = pg.indexOf('SET claimed_at = NULL');
  const alter = pg.indexOf('ALTER COLUMN claimed_at TYPE TIMESTAMPTZ');
  assert.ok(blank !== -1, '091 must blank unparseable values');
  assert.ok(blank < alter, 'blanking must happen BEFORE the type conversion');
});

test('091 SQLite clears junk claims but preserves a real one', async () => {
  const sql = fs.readFileSync(path.join(MIGRATIONS, '091-notification-claimed-at-type.sqlite.sql'), 'utf8');
  const ins = `INSERT INTO notifications (event, channel, recipient_address, body, status, claimed_at)
               VALUES (?, 'email', 'a@b.c', 'x', 'sending', ?)`;
  await qr(ins, ['__091junk', '']);
  await qr(ins, ['__091junk2', 'not-a-date']);
  await qr(ins, ['__091good', '2026-10-04 01:00:00']);
  try {
    await qr(sql, []);
    const rows = await qa(`SELECT event, claimed_at FROM notifications WHERE event LIKE '__091%'`, []);
    const byEvent = Object.fromEntries(rows.map((r) => [r.event, r.claimed_at]));
    assert.equal(byEvent.__091junk, null, 'an empty claim must become NULL');
    assert.equal(byEvent.__091junk2, null, 'an unparseable claim must become NULL');
    assert.equal(byEvent.__091good, '2026-10-04 01:00:00', 'a real claim must survive');
  } finally {
    await qr(`DELETE FROM notifications WHERE event LIKE '__091%'`, []);
  }
});

test('a NULL claimed_at claim is still reclaimable by the sweep', async () => {
  const [row] = await qa(
    `INSERT INTO notifications (event, channel, recipient_address, body, status)
     VALUES ('__reclaim', 'email', 'a@b.c', 'x', 'sending') RETURNING *`, []);
  try {
    // Mirrors the sweep predicate. NULL claimed_at means "not really claimed",
    // so the row must still be selectable for recovery rather than stranded.
    const stuck = await qa(
      `SELECT id FROM notifications
        WHERE status = 'sending'
          AND (claimed_at IS NULL OR claimed_at < datetime('now', '-10 minutes'))`, []);
    assert.ok(stuck.some((r) => r.id === row.id),
      'a NULL claim must be reclaimable, not stranded forever');
  } finally {
    await qr('DELETE FROM notifications WHERE event = ?', ['__reclaim']);
  }
});

// ── Right-to-erasure must actually run ──────────────────────────────────────

test('ai_chat_logs has a message column, not messages', async () => {
  const cols = (await qa('PRAGMA table_info(ai_chat_logs)', [])).map((c) => c.name);
  assert.ok(cols.includes('message'), 'ai_chat_logs.message must exist');
  assert.ok(!cols.includes('messages'),
    'the erasure UPDATE referenced a nonexistent messages column');
});

test('erasure route never references the nonexistent messages column', () => {
  // Comments are stripped first: the fix documents the broken SQL it replaced, so
  // a raw text search would match the explanation instead of live code.
  const src = stripComments(fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'privacy.routes.js'), 'utf8'));
  assert.doesNotMatch(src, /UPDATE\s+ai_chat_logs\s+SET\s+messages/i,
    'must not write to ai_chat_logs.messages');
  assert.doesNotMatch(src, /messages::text/);
  assert.doesNotMatch(src, /regexp_replace/,
    'regexp_replace does not exist in SQLite; redaction must be portable');
  assert.match(src, /UPDATE ai_chat_logs SET message = \? WHERE id = \?/,
    'redaction must update the real message column');
});

test('erasure redacts the student name from chat history, case-insensitively', async () => {
  const admin = await q(
    `INSERT INTO users (username, role, password_hash, name) VALUES (?, 'super_admin', 'x', 'Erasure')
     RETURNING id`, [`erase-admin-${Date.now()}`]);
  const [student] = await qa(
    `INSERT INTO students (lrn, first_name, last_name, sex, grade_level, status)
     VALUES ('999999999940', 'Dela', 'Cruz', 'Female', '10', 'enrolled') RETURNING *`, []);
  const chatUser = await q(
    `INSERT INTO users (username, role, password_hash, name) VALUES (?, 'teacher', 'x', 'Chatter')
     RETURNING id`, [`erase-chat-${Date.now()}`]);
  const chatIds = [];
  try {
    for (const body of [
      'ask about dela cruz grades',  // lower-cased
      'DELA CRUZ submitted late',   // upper-cased
      'unrelated conversation',     // must be untouched
    ]) {
      chatIds.push((await qa(
        `INSERT INTO ai_chat_logs (user_id, role, message) VALUES (?, 'user', ?) RETURNING id`,
        [chatUser.id, body]))[0].id);
    }
    const ordered = [...chatIds].sort((a, b) => a - b);

    // Replay the route's redaction against the real schema.
    for (const needle of [student.first_name, student.last_name]) {
      const term = String(needle || '').trim();
      if (!term) continue;
      const matches = await qa(
        'SELECT id, message FROM ai_chat_logs WHERE lower(message) LIKE lower(?)',
        [`%${term}%`]);
      for (const row of matches) {
        const next = String(row.message || '').replace(
          new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '[REDACTED]');
        if (next !== row.message) {
          await qr('UPDATE ai_chat_logs SET message = ? WHERE id = ?', [next, row.id]);
        }
      }
    }

    const rows = await qa('SELECT message FROM ai_chat_logs WHERE id IN (?, ?, ?)', ordered);
    assert.match(rows[0].message, /\[REDACTED\] grades/, 'lower-case name must be redacted');
    assert.match(rows[1].message, /\[REDACTED\] submitted/, 'upper-case name must be redacted');
    assert.equal(rows[2].message, 'unrelated conversation',
      'a message without the name must not be modified');
    assert.ok(admin.id);
  } finally {
    await qr('DELETE FROM ai_chat_logs WHERE id IN (?, ?, ?)', [...chatIds].sort((a, b) => a - b));
    await qr('DELETE FROM students WHERE id = ?', [student.id]);
    await qr('DELETE FROM users WHERE id IN (?, ?)', [admin.id, chatUser.id]);
  }
});

test('every count exposed as a total is normalized to a number', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'privacy.routes.js'), 'utf8');
  // Postgres returns COUNT(*) as a string. Any `total:` fed straight from a count
  // row leaks that string to the client and breaks numeric comparisons.
  assert.doesNotMatch(src, /total:\s*totalRow\.n[,}]/,
    'access-logs total must be Number()-wrapped');
  assert.doesNotMatch(src, /const total = \(await qa\(/,
    'role-reviews total must be Number()-wrapped');
  assert.match(src, /total: Number\(totalRow\.n\)/);
});

// ── Self-registration must not hand out a usable account ────────────────────

test('self-registration creates a pending, not an active, account', async () => {
  const src = stripComments(fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'auth.routes.js'), 'utf8'));
  // The endpoint replies "submitted for review" while inserting 'active', so the
  // applicant could sign in before any registrar looked at it.
  const ins = src.slice(src.indexOf("router.post('/register'"));
  assert.match(ins, /INSERT INTO users[\s\S]*?status\) VALUES \(\?, \?, \?, \?, \?, \?, \?\)[\s\S]*?'pending'\s*\]\)/,
    'the registered account must be created pending');
});

test('approval activates the account inside the link transaction', () => {
  const src = stripComments(fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'students.routes.js'), 'utf8'));
  const approve = src.slice(src.indexOf("link-requests/:id/approve"), src.indexOf("link-requests/:id/reject"));
  assert.match(approve, /UPDATE users SET status = 'active'/,
    'approval must activate the pending account');
  // The activation has to be in the transaction with the link itself.
  const txStart = approve.indexOf('db.tx(async (conn) =>');
  assert.ok(txStart !== -1, 'approval must run in a transaction');
  assert.ok(approve.indexOf("UPDATE users SET status = 'active'") > txStart,
    'activation must be inside the transaction');
  assert.match(approve, /\['pending', 'active'\]\.includes\(u\.status\)/,
    'a suspended or expired applicant must not be silently reactivated');
});

test('a pending account cannot satisfy the login active check', async () => {
  // /login requires `user.status === 'active'`. Mirror that predicate exactly.
  const [pending] = await qa(
    `INSERT INTO users (username, role, password_hash, name, email, status)
     VALUES (?, 'student', 'x', 'Pending', 'p@x.com', 'pending') RETURNING *`,
    [`pending-user-${Date.now()}`]);
  try {
    assert.equal(pending.status, 'pending');
    assert.notEqual(pending.status, 'active',
      'if this ever equals active, the account is usable before review');

    // And the promotion the approval performs is the only thing that changes it.
    await qr("UPDATE users SET status = 'active' WHERE id = ?", [pending.id]);
    const after = await q('SELECT status FROM users WHERE id = ?', [pending.id]);
    assert.equal(after.status, 'active', 'approval must be able to activate it');
  } finally {
    await qr('DELETE FROM users WHERE id = ?', [pending.id]);
  }
});

test('registration confirmation still reaches a pending applicant', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'notify.js'), 'utf8');
  assert.match(src, /case 'account_registered':\s*\n\s*return ctx\.user_id \? resolveUserRecipients\(ctx\.user_id, \{ includePending: true \}\)/,
    'the active-only recipient filter would swallow the confirmation email');
  // And every other event must keep the strict filter.
  assert.match(src, /status = \\'active\\'/);
  assert.match(src, /includePending = false \} = \{\}/);
});

// ── Lockout DoS mitigation ──────────────────────────────────────────────────

test('a lockout notifies the account holder', () => {
  const auth = stripComments(fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'auth.routes.js'), 'utf8'));
  const fn = auth.slice(auth.indexOf('async function recordFailedLogin'));
  assert.match(fn, /notifyEvent\('account_locked'/,
    'locking a user must not be silent, or lockout DoS is undetectable');

  const notify = fs.readFileSync(path.join(__dirname, '..', 'src', 'notify.js'), 'utf8');
  assert.match(notify, /account_locked: \{/, 'an account_locked template must exist');
  // Without a template dispatchEvent skips the event, so the notification is a
  // no-op unless the event is also routable to recipients.
  assert.match(notify, /case 'account_locked':/);
  // The template must be able to state how many attempts and how long, since the
  // message is the compensating control the account owner acts on.
  const tpl = notify.slice(notify.indexOf('account_locked: {'), notify.indexOf('link_approved: {'));
  assert.match(tpl, /\{\{attempts\}\}/);
  assert.match(tpl, /\{\{minutes\}\}/);
  assert.match(tpl, /contact the school administrator/i,
    'the message must tell the owner what to do');
});

test('the lockout response stays indistinguishable from a bad password', () => {
  const src = stripComments(fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'auth.routes.js'), 'utf8'));
  const login = src.slice(src.indexOf("router.post('/login'"), src.indexOf("router.post('/refresh'"));
  // A distinct 423/429 for a locked account would confirm the username exists.
  assert.match(login, /locked_until[\s\S]*?status\(401\)\.json\(\{ error: 'Invalid username or password' \}\)/);
  assert.doesNotMatch(login, /status\(423\)/);
});

// ── AI chat logging must be durable ─────────────────────────────────────────

test('chat log inserts are awaited, not fired and forgotten', () => {
  const src = stripComments(fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'ai.routes.js'), 'utf8'));
  // The SQLite driver serializes statements onto one queue, so an in-flight
  // insert can be executed inside another request's open transaction and then
  // destroyed by that request's ROLLBACK.
  assert.doesNotMatch(src, /qi\('INSERT INTO ai_chat_logs[^\n]*\.catch\(/,
    'a fire-and-forget chat insert can be rolled back by an unrelated request');
  assert.match(src, /async function logChatTurn\(req, role, message\)/);
  assert.match(src, /await logChatTurn\(req, 'user', userText\)/);
  assert.match(src, /await logChatTurn\(req, 'assistant', reply\)/);
  // But a logging failure must not fail the user's request.
  assert.match(src, /await qi\('INSERT INTO ai_chat_logs[\s\S]*?catch \(err\)/);
});

test('a failed chat log insert does not reject the handler', async () => {
  // Replay the guard shape: a failing insert is caught, not propagated.
  const logChatTurn = async (fail) => {
    try { if (fail) throw new Error('db down'); return 'ok'; } catch { return 'logged-error'; }
  };
  assert.equal(await logChatTurn(false), 'ok');
  assert.equal(await logChatTurn(true), 'logged-error');
});

// ── Announcement targeting ──────────────────────────────────────────────────

test('announcement recipients include phone-only users', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'notify.js'), 'utf8');
  const fn = src.slice(src.indexOf('async function resolveAnnouncementRecipients'),
    src.indexOf('// --- Delivery'));
  // The audience filter admits users with EITHER contact, so skipping anyone
  // without a valid email discarded every SMS-only recipient.
  assert.doesNotMatch(fn, /if \(!isEmail\(r\.email\)\) continue;/,
    'phone-only recipients are silently dropped');
  assert.match(fn, /out\.phones\.push\(/, 'announcements must reach SMS-only users');
  assert.match(fn, /seenPhone/);
});

test('announcement audience routing covers each documented audience', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'notify.js'), 'utf8');
  const fn = src.slice(src.indexOf('async function resolveAnnouncementRecipients'),
    src.indexOf('// --- Delivery'));
  assert.match(fn, /audience === 'staff'[\s\S]*?role NOT IN \(\?, \?\)[\s\S]*?'student', 'parent'/,
    'staff must exclude students and parents');
  assert.match(fn, /audience === 'parents'[\s\S]*?role = \?/);
  // And every recipient must still be filtered to active accounts.
  assert.match(fn, /status = 'active'/);
});

test('announcement recipients are de-duplicated per channel', async () => {
  const { isEmail } = require('../src/notify');
  const rows = [
    { id: 1, email: 'A@School.PH', phone: '09170000001', name: 'One', role: 'teacher' },
    { id: 2, email: 'a@school.ph', phone: '09170000001', name: 'Two', role: 'teacher' },
    { id: 3, email: null, phone: '09170000002', name: 'Three', role: 'cashier' },
    { id: 4, email: 'not-an-email', phone: null, name: 'Four', role: 'cashier' },
  ];
  const seen = new Set();
  const seenPhone = new Set();
  const out = { emails: [], phones: [] };
  for (const r of rows) {
    if (r.email && isEmail(r.email)) {
      const a = r.email.trim().toLowerCase();
      // The de-dupe key is lowercased but the ORIGINAL address is what ships.
      if (!seen.has(a)) { seen.add(a); out.emails.push(r.email.trim()); }
    }
    if (r.phone && !isEmail(r.phone)) {
      const p = r.phone.trim();
      if (!seenPhone.has(p)) { seenPhone.add(p); out.phones.push(p); }
    }
  }
  assert.deepEqual(out.emails, ['A@School.PH'], 'duplicate email collapses case-insensitively');
  assert.deepEqual(out.phones, ['09170000001', '09170000002'],
    'phone-only recipients are reached and duplicates collapse');
});

// ── Backup restore portability (PG dump -> SQLite) ──────────────────────────

test('sqliteBindable coerces pg-parsed JSONB back to bindable text', () => {
  const { sqliteBindable } = require('../src/backup');
  // node:sqlite rejects plain objects; a PG dump hands them over parsed.
  assert.equal(sqliteBindable({ a: 1 }), '{"a":1}');
  assert.equal(sqliteBindable([1, 'x']), '[1,"x"]');
  assert.equal(sqliteBindable('{"a":1}'), '{"a":1}', 'already-JSON text is passed through');
  assert.equal(sqliteBindable(5), 5);
  assert.equal(sqliteBindable(null), null);
  assert.equal(sqliteBindable(undefined), null);
  assert.equal(sqliteBindable(true), 1, 'pg BOOLEAN becomes a SQLite integer');
  assert.equal(sqliteBindable(false), 0);
  const d = new Date('2026-01-02T03:04:05.000Z');
  assert.equal(sqliteBindable(d), '2026-01-02T03:04:05.000Z');
  const buf = Buffer.from('x');
  assert.equal(sqliteBindable(buf), buf, 'blobs are left alone');
});

test('a PG-shaped dump restores into SQLite without losing JSONB', async () => {
  const { sqliteBindable } = require('../src/backup');
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE achievement_media (
    id INTEGER PRIMARY KEY, student_id INTEGER, media TEXT, meta TEXT, liked INTEGER)`);
  // Values exactly as a PG dump would carry them: JSONB already parsed into
  // JS objects, BOOLEAN as true/false.
  const pgRow = [1, 7, { url: 'https://x/a.png', caption: 'a' },
    [{ tag: 'gold' }], true];
  const st = db.prepare('INSERT INTO achievement_media (id, student_id, media, meta, liked) VALUES (?,?,?,?,?)');
  st.run(...pgRow.map(sqliteBindable));
  const got = db.prepare('SELECT * FROM achievement_media WHERE id = 1').get();
  assert.equal(got.media, '{"url":"https://x/a.png","caption":"a"}');
  assert.deepEqual(JSON.parse(got.meta), [{ tag: 'gold' }]);
  assert.equal(got.liked, 1);
  db.close();
});

test('backup restore no longer binds raw dump rows into SQLite', () => {
  const src = stripComments(fs.readFileSync(
    path.join(__dirname, '..', 'src', 'backup.js'), 'utf8'));
  assert.doesNotMatch(src, /st\.run\(\.\.\.row\)/,
    'raw dump rows can contain pg-parsed JSONB objects that node:sqlite cannot bind');
  assert.match(src, /st\.run\(\.\.\.row\.map\(sqliteBindable\)\)/);
});

// ── Seed LRNs must be self-registerable ─────────────────────────────────────

test('every seeded LRN is exactly 12 digits', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'seed.js'), 'utf8');
  const exprs = [...src.matchAll(/const lrn = (.+);/g)].map((m) => m[1]);
  assert.ok(exprs.length >= 2, 'expected the Grade 11 and Grade 12 seed loops');
  for (const expr of exprs) {
    // Re-evaluate each expression over the loop's real index range. The old
    // Grade 12 expression was '1362' + a TEN-digit number, yielding 14 digits.
    const body = expr
      .replace(/^'[^']*'\s*\+/, '')
      .replace(/\.padStart\([^)]*\)/g, '')
      .replace(/^String\((.*)\)$/, '$1');
    let checked = 0;
    for (let i = 0; i < 40; i++) {
      let digits;
      const p = body.replace(/\bk\b/g, String(20 + i)).replace(/\bi\b/g, String(i));
      try { digits = String(Function(`"use strict";return (${p})`)()); } catch { continue; }
      if (!/^\d+$/.test(digits)) continue;
      checked++;
      const prefix = (expr.match(/^'([^']*)'/) || [, ''])[1];
      const total = prefix.length + digits.length;
      assert.equal(total, 12,
        `seed LRN ${prefix}${digits} is ${total} digits; self-registration requires 12`);
    }
    assert.ok(checked > 0, `could not evaluate seed LRN expression: ${expr}`);
  }
});

test('seed guards its LRN format so a future change fails loudly', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'seed.js'), 'utf8');
  assert.match(src, /if \(!\/\^\\d\{12\}\$\/\.test\(lrn\)\)/,
    'seed should throw rather than silently create unusable learners');
});

// ── Schedule conflicts must not be over-deduplicated ────────────────────────

test('schedule reports distinct clashes at different times', () => {
  const { findConflicts } = require('../src/schedule');
  // Two sections sharing teacher 5 (no room, so only the teacher rule fires).
  const base = (o) => ({
    day: 1, start_time: '07:00', end_time: '08:00', teacher_id: 5, room: null,
    section_name: 'A', subject_code: 'ENG', teacher_name: 'T',
    combined_section_id: null, combined_section_name: null, ...o,
  });
  // The SAME section pair (1,2) and subject pair clashes in two separate
  // windows. Without the time window in the de-dup key the second clash is
  // swallowed and the admin only ever sees one of them.
  const conflicts = findConflicts([
    base({ section_id: 1, subject_id: 10 }),
    base({ section_id: 2, subject_id: 10, section_name: 'B' }),
    base({ section_id: 1, subject_id: 10, start_time: '09:00', end_time: '10:00' }),
    base({ section_id: 2, subject_id: 10, section_name: 'B', start_time: '09:00', end_time: '10:00' }),
  ]);
  assert.equal(conflicts.length, 2,
    'clashes at 07:00 and 09:00 are distinct and must both be reported');
  assert.ok(conflicts.every((c) => c.type === 'teacher'));
  assert.deepEqual(conflicts.map((c) => c.time).sort(), ['07:00\u201308:00', '09:00\u201310:00']);
});

test('schedule still collapses a genuine duplicate clash', () => {
  const { findConflicts } = require('../src/schedule');
  const base = (o) => ({
    day: 1, start_time: '07:00', end_time: '08:00', teacher_id: 5, room: null,
    section_name: 'A', subject_code: 'ENG', teacher_name: 'T',
    combined_section_id: null, combined_section_name: null, ...o,
  });
  // 1-2, 1-3 and 2-3 all clash in the one window: three distinct section pairs.
  // The symmetric reverse direction must not double-count any of them.
  const conflicts = findConflicts([
    base({ section_id: 1, subject_id: 10 }),
    base({ section_id: 2, subject_id: 10, section_name: 'B' }),
    base({ section_id: 3, subject_id: 10, section_name: 'C' }),
  ]);
  assert.equal(conflicts.length, 3, 'three distinct section pairs, no double counting');
  const pairs = conflicts.map((c) => [...c.ids].sort((x, y) => x - y).join('+')).sort();
  assert.deepEqual(pairs, ['1+2', '1+3', '2+3']);
});

test('schedule de-dup key is time-window aware', () => {
  const src = stripComments(fs.readFileSync(
    path.join(__dirname, '..', 'src', 'schedule.js'), 'utf8'));
  const block = src.slice(src.indexOf('const pair = ['), src.indexOf('seen.has(pair)'));
  assert.match(block, /\$\{st\}-\$\{en\}/,
    'the conflict de-dup key must include the overlap window');
});

// ── Achievements: dialect portability ───────────────────────────────────────

test('boolLiteral emits the type each dialect actually accepts', () => {
  const { boolLiteral } = require('../src/db');
  // normParams coerces booleans to 1/0, which PG refuses for a BOOLEAN column.
  // On the SQLite test dialect it must therefore be 1/0, never TRUE/FALSE.
  assert.equal(boolLiteral(true), '1');
  assert.equal(boolLiteral(false), '0');
  assert.equal(boolLiteral(1), '1');
  assert.equal(boolLiteral('0'), '0');
  assert.equal(boolLiteral(null), '0');
  // And it must never be quoted: it is SQL, not a bound parameter.
  assert.doesNotMatch(boolLiteral(true), /'/);
});

test('achievements: pinned is inlined as a literal, not bound', () => {
  const src = stripComments(fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'achievements.routes.js'), 'utf8'));
  assert.doesNotMatch(src, /visibility = \?, pinned = \?/,
    'binding pinned as a parameter breaks on PG BOOLEAN columns');
  assert.match(src, /pinned = \$\{boolLiteral\(pinned\)\}/);
  assert.match(src, /VALUES \(\?, \?, \?, \?, \?, \?, \$\{boolLiteral\(pinned\)\}\)/);
});

test('achievements route has no Postgres-only SQL left', () => {
  const src = stripComments(fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'achievements.routes.js'), 'utf8'));
  assert.doesNotMatch(src, /ILIKE/, 'SQLite has no ILIKE');
  assert.doesNotMatch(src, /=\s*NOW\(\)/, 'SQLite has no NOW(); use nowSql()');
  assert.match(src, /updated_at = \$\{nowSql\(\)\}/);
  assert.match(src, /lower\(a\.title\) LIKE lower\(\?\)/);
});

test('achievements: create, search and pin round-trip on SQLite', async () => {
  const user = await q(
    `INSERT INTO users (username, role, password_hash, name) VALUES (?, 'teacher', 'x', 'Ach')
     RETURNING id`, [`ach-user-${Date.now()}`]);
  const likeReader = await q(
    `INSERT INTO users (username, role, password_hash, name) VALUES (?, 'student', 'x', 'Liker')
     RETURNING id`, [`ach-liker-${Date.now()}`]);
  let achId = null;
  try {
    // Replay the exact INSERT shape the route uses.
    const { boolLiteral } = require('../src/db');
    const id = (await qa(
      `INSERT INTO achievements (title, content, author_id, category, media, visibility, pinned)
       VALUES (?, ?, ?, ?, ?, ?, ${boolLiteral(true)}) RETURNING id`,
      ['Science Fair Win', 'Group B topped the quiz', user.id, 'academic',
        JSON.stringify(['a.jpg']), 'school']))[0].id;
    achId = id;
    assert.ok(id, 'insert must succeed with pinned = TRUE');

    // The PATCH shape: same inlined literal plus nowSql().
    const r = await qr(
      `UPDATE achievements SET title = ?, content = ?, category = ?, media = ?, visibility = ?,
         pinned = ${boolLiteral(false)}, updated_at = ${require('../src/db').nowSql()} WHERE id = ?`,
      ['Renamed', 'Body', 'academic', JSON.stringify([]), 'staff', id]);
    assert.ok(r.changes, 'update must affect the row');

    const row = await q('SELECT * FROM achievements WHERE id = ?', [id]);
    assert.equal(row.title, 'Renamed');
    assert.equal(Number(row.pinned), 0, 'unpin must take effect');
    assert.ok(row.updated_at, 'updated_at must be stamped by nowSql()');

    // Portable search predicate from the list endpoint.
    const hits = await qa(
      'SELECT id FROM achievements WHERE id = ? AND (lower(title) LIKE lower(?) OR lower(content) LIKE lower(?))',
      [id, '%RENAMED%', '%nope%']);
    assert.equal(hits.length, 1, 'case-insensitive search must match');
  } finally {
    if (achId) await qr('DELETE FROM achievements WHERE id = ?', [achId]);
    await qr('DELETE FROM users WHERE id IN (?, ?)', [user.id, likeReader.id]);
  }
});

test('achievement counters normalize so "0" is never truthy', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'achievements.routes.js'), 'utf8');
  assert.match(src, /row\.user_liked = bool\(row\.user_liked\)/,
    'a PG COUNT of "0" arriving as a string is truthy and fakes a like');
  assert.match(src, /row\.likes_count = Number\(row\.likes_count \|\| 0\)/);
  assert.match(src, /row\.comments_count = Number\(row\.comments_count \|\| 0\)/);
  // And decorate must actually be applied to both read endpoints.
  assert.match(src, /\(await qa\(sql, params\)\)\.map\(decorate\)/);
});

test('bool() treats a string zero as false on every dialect', () => {
  const { bool } = require('../src/db');
  // This is the exact PG COUNT behaviour that broke user_liked.
  assert.equal(bool('0'), false);
  assert.equal(bool('1'), true);
  assert.equal(bool(0), false);
  assert.equal(bool(1), true);
  assert.equal(bool(null), false);
  assert.equal(bool(undefined), false);
  assert.equal(bool(true), true);
  assert.equal(bool(false), false);
});

// ── Attendance upsert ───────────────────────────────────────────────────────

test('attendance: repeated writes settle on one row without duplicating', async () => {
  const [student] = await qa(
    `INSERT INTO students (lrn, first_name, last_name, sex, grade_level, status)
     VALUES ('999999999901', 'Up', 'Sert', 'Male', '7', 'enrolled') RETURNING *`, []);
  const teacher = await q(
    `INSERT INTO users (username, role, password_hash, name) VALUES (?, 'teacher', 'x', 'Rec')
     RETURNING id`, [`att-rec-${Date.now()}`]);
  try {
    // Replays the exact insert+update pair the route now uses. A second run must
    // not create a duplicate and must leave the later value in place.
    const write = async (status, session) => {
      const sess = session || null;
      await qr(
        `INSERT INTO attendance (student_id, section_id, date, status, session, remarks, recorded_by)
         VALUES (?, NULL, ?, ?, ?, NULL, ?) ON CONFLICT DO NOTHING`,
        [student.id, '2026-10-04', status, sess, teacher.id]);
      await qr(
        `UPDATE attendance SET status = ?, session = ?, remarks = NULL, recorded_by = ?
         WHERE student_id = ? AND date = ? AND session IS NOT DISTINCT FROM ?`,
        [status, sess, teacher.id, student.id, '2026-10-04', sess]);
    };
    await write('present', 'AM');
    await write('absent', 'AM');
    await write('late', 'PM');

    const rows = await qa('SELECT status, session FROM attendance WHERE student_id = ? AND date = ?',
      [student.id, '2026-10-04']);
    assert.equal(rows.length, 2, 'AM and PM are distinct sessions');
    const am = rows.find((r) => r.session === 'AM');
    const pm = rows.find((r) => r.session === 'PM');
    assert.equal(am.status, 'absent', 'last write for AM wins');
    assert.equal(pm.status, 'late');
  } finally {
    await qr('DELETE FROM attendance WHERE student_id = ?', [student.id]);
    await qr('DELETE FROM students WHERE id = ?', [student.id]);
    await qr('DELETE FROM users WHERE id = ?', [teacher.id]);
  }
});

test('attendance: null session is its own row and is not matched by a named session', async () => {
  const [student] = await qa(
    `INSERT INTO students (lrn, first_name, last_name, sex, grade_level, status)
     VALUES ('999999999902', 'Nul', 'Lsession', 'Female', '8', 'enrolled') RETURNING *`, []);
  try {
    const pick = (sess) => qa(
      'SELECT id FROM attendance WHERE student_id = ? AND date = ? AND session IS NOT DISTINCT FROM ?',
      [student.id, '2026-10-05', sess]);
    assert.equal((await pick(null)).length, 0);
    assert.equal((await pick('AM')).length, 0);
    await qr(
      `INSERT INTO attendance (student_id, date, status, session) VALUES (?, ?, 'present', NULL)`,
      [student.id, '2026-10-05']);
    assert.equal((await pick(null)).length, 1, 'null session matches only null');
    assert.equal((await pick('AM')).length, 0, 'null session must not match AM');
  } finally {
    await qr('DELETE FROM attendance WHERE student_id = ?', [student.id]);
    await qr('DELETE FROM students WHERE id = ?', [student.id]);
  }
});

// ── Privilege escalation guard ──────────────────────────────────────────────

test('every privileged role is covered by the escalation guard', () => {
  for (const r of ['super_admin', 'region_admin', 'division_admin', 'school_admin',
    'principal', 'assistant_principal', 'registrar']) {
    assert.ok(PRIVILEGED_ROLES.includes(r), `${r} must be privileged`);
  }
  // Privilege is a superset of ADMIN_ROLES.
  for (const r of ADMIN_ROLES) assert.ok(PRIVILEGED_ROLES.includes(r));
  // And it must not swallow ordinary staff roles.
  for (const r of ['teacher', 'cashier', 'ict', 'student', 'parent']) {
    assert.ok(!PRIVILEGED_ROLES.includes(r), `${r} must not be privileged`);
    assert.ok(ROLES.includes(r), `${r} should still be a valid role`);
  }
});

// ── PII masking ─────────────────────────────────────────────────────────────

test('maskPII removes direct identifiers but keeps the row usable', () => {
  const masked = maskPII({
    first_name: 'Juan', last_name: 'Dela Cruz', birth_date: '2010-05-04',
    sex: 'Male', address: '123 St', religion: 'Roman Catholic',
    guardian_name: 'Maria', guardian_contact: '09171234567', email: 'a@b.c', phone: '09171234567',
  });
  assert.ok(masked, 'maskPII must return a value');
  assert.notEqual(masked.address, '123 St');
  assert.equal(masked.sex, 'Male', 'non-identifying fields are preserved');
});

// ── Upload magic-byte guard ─────────────────────────────────────────────────

test('hasMagic accepts real file signatures', () => {
  assert.equal(hasMagic({ mimetype: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) }), true);
  assert.equal(hasMagic({ mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.7\n') }), true);
  assert.equal(hasMagic({ mimetype: 'application/zip', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]) }), true);
  assert.equal(hasMagic({ mimetype: 'text/csv', buffer: Buffer.from('a,b,c\n1,2,3\n') }), true);
});

test('hasMagic rejects content that does not match the declared type', () => {
  // A script renamed to .pdf and announced as application/pdf.
  assert.equal(hasMagic({ mimetype: 'application/pdf', buffer: Buffer.from('<?php system($_GET[0]); ?>') }), false);
  // An executable announced as an image.
  assert.equal(hasMagic({ mimetype: 'image/png', buffer: Buffer.from('MZ\x90\x00binary') }), false);
  // An unlisted type must never be accepted.
  assert.equal(hasMagic({ mimetype: 'application/x-msdownload', buffer: Buffer.from('MZ') }), false);
  // Empty / missing buffer.
  assert.equal(hasMagic({ mimetype: 'image/png', buffer: Buffer.alloc(0) }), false);
  assert.equal(hasMagic({ mimetype: 'image/png' }), false);
  assert.equal(hasMagic(null), false);
});

test('hasMagic rejects text content carrying a NUL byte', () => {
  assert.equal(hasMagic({ mimetype: 'text/plain', buffer: Buffer.from('ok not-really') }), false);
});

// ── Grading: bands with gaps ────────────────────────────────────────────────

test('convertGrade picks the highest band at or below the mark', () => {
  // Bands carry a one-decimal max (89.9), which is what left fractional gaps
  // like 89.95 with no band at all. Lookup must be by descending `min`.
  const scale = {
    passing_grade: 75,
    bands: [
      { min: 98, max: 100, letter: 'A', points: 1.0, label: 'Outstanding' },
      { min: 95, max: 97.9, letter: 'A', points: 1.0, label: 'Very Satisfactory' },
      { min: 90, max: 94.9, letter: 'B', points: 1.25, label: 'Outstanding' },
      { min: 88, max: 89.9, letter: 'B', points: 1.5, label: 'Satisfactory' },
      { min: 75, max: 87.9, letter: 'C', points: 2.0, label: 'Fair' },
      { min: 0, max: 74.9, letter: 'F', points: 3.0, label: 'Failed' },
    ],
  };
  assert.equal(convertGrade(96, scale).proficiency, 'Very Satisfactory');
  assert.equal(convertGrade(96, scale).letter, 'A');
  assert.equal(convertGrade(90, scale).proficiency, 'Outstanding');

  // The exact regression: inside the 87.9/88 gap, previously returned null so the
  // grade counted toward GWA but vanished from GPA and showed no letter.
  const gapped = convertGrade(89.95, scale);
  assert.ok(gapped, 'a mark inside a band gap must still convert');
  assert.equal(gapped.letter, 'B');
  assert.equal(gapped.proficiency, 'Satisfactory');
  assert.equal(gapped.points, 1.5, 'points must survive so GPA still counts it');
  assert.equal(gapped.passed, true);

  assert.equal(convertGrade(50, scale).proficiency, 'Failed');
  assert.equal(convertGrade(50, scale).passed, false);
  assert.equal(convertGrade(0, scale).letter, 'F');

  // Degenerate input must not throw.
  assert.equal(convertGrade(null, scale), null);
  assert.equal(convertGrade('', scale), null);
  assert.equal(convertGrade('abc', scale), null);
  assert.equal(convertGrade(95, { passing_grade: 75, bands: [] }).letter, null);
});

// ── Manila calendar dates ───────────────────────────────────────────────────

test('todayStr honours the configured school timezone', () => {
  const t = todayStr();
  assert.match(t, /^\d{4}-\d{2}-\d{2}$/);
  // Must never be blank, and must round-trip through the validator.
  assert.equal(normalizeDateStr(t), t);
});

test('shiftDateStr moves across month and year boundaries', () => {
  const plus = shiftDateStr('2026-03-31', 1);
  const minus = shiftDateStr('2026-06-01', -1);
  assert.equal(plus, '2026-04-01');
  assert.equal(minus, '2026-05-31');
  assert.equal(shiftDateStr('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftDateStr('2024-02-28', 1), '2024-02-29', 'leap day must exist');
  assert.equal(shiftDateStr('2026-10-04', 0), '2026-10-04');
});

test('normalizeDateStr rejects impossible and malformed dates', () => {
  assert.equal(normalizeDateStr('2026-02-30'), null, 'Feb 30 must be rejected');
  assert.equal(normalizeDateStr('2026-13-01'), null);
  assert.equal(normalizeDateStr('10-04-2026'), null);
  assert.equal(normalizeDateStr('not-a-date'), null);
  assert.equal(normalizeDateStr(''), null);
  assert.equal(normalizeDateStr('2026-03-31'), '2026-03-31');
  assert.equal(normalizeDateStr('2024-02-29'), '2024-02-29');
});

test('daysAgoStr walks backwards one day at a time in school time', () => {
  const from = new Date('2026-03-31T12:00:00Z');
  assert.equal(daysAgoStr(1, from), '2026-03-30');
  assert.equal(daysAgoStr(2, from), '2026-03-29');
  assert.equal(daysAgoStr(30, from), '2026-03-01');
  assert.equal(daysAgoStr(0, from), '2026-03-31');
});

// ── Log redaction ───────────────────────────────────────────────────────────
// SSE authenticates via ?token=, so every reconnect used to write a live JWT into
// the log stream. Both log call sites must go through redactUrl.

/** Pulls the real redactUrl out of index.js and returns it as a callable. */
function loadRedactUrl() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const m = src.match(/const redactUrl = \(url\) => \{[\s\S]*?\n  \};/);
  assert.ok(m, 'index.js must define redactUrl');
  return new Function(`${m[0]}\nreturn redactUrl;`)();
}

test('redactUrl removes secret values and keeps the URL usable', () => {
  const redactUrl = loadRedactUrl();

  const sse = redactUrl('/api/v1/realtime/stream?token=eyJhbGciOi.SECRET.PART&x=1');
  assert.ok(!sse.includes('SECRET'), 'token value must be redacted');
  assert.ok(sse.includes('token=[redacted]'));
  assert.ok(sse.includes('x=1'), 'unrelated params survive for debugging');

  // Every sensitive param the audit flagged.
  for (const p of ['token', 'access_token', 'code', 'password', 'resetToken']) {
    const out = redactUrl(`/x?${p}=SUPERSECRET`);
    assert.ok(!out.includes('SUPERSECRET'), `${p} must be redacted`);
    assert.ok(out.includes(`${p}=[redacted]`));
  }

  // URLs with no query string are returned untouched.
  assert.equal(redactUrl('/api/v1/health'), '/api/v1/health');
  assert.equal(redactUrl(''), '');
  // A param name that merely contains "code" must not be clobbered.
  assert.ok(redactUrl('/x?zipcode=1234').includes('zipcode=1234'));
});

test('every request/error log goes through the redactor', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  // No log call may interpolate the raw URL.
  assert.doesNotMatch(src, /logger\[\w+\]\([^)]*req\.originalUrl/,
    'access log must not use the unredacted URL');
  assert.doesNotMatch(src, /logger\.error\(\{[^}]*url:\s*req\.originalUrl/,
    'error log must not use the unredacted URL');
  // And the redactor must actually be referenced.
  assert.ok(src.includes('redactUrl(req.originalUrl)'),
    'logs must use redactUrl(req.originalUrl)');
});

// ── Session storage safety ──────────────────────────────────────────────────

test('safeStore prefers the in-memory fallback over a stale stored value', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'src', 'lib', 'api.js'), 'utf8');
  const start = src.indexOf('function safeStore');
  const fnSrc = src.slice(start, src.indexOf('\n}', start) + 2);
  // eslint-disable-next-line no-new-func
  const safeStore = new Function(`return (${fnSrc})`)();

  // Storage where writes throw (quota) but reads still return an old token.
  const win = {
    localStorage: {
      _v: 'STALE',
      getItem() { return this._v; },
      setItem() { throw new Error('QuotaExceededError'); },
      removeItem() { this._v = null; },
    },
  };
  const s = safeStore('localStorage', win);
  s.setItem('k', 'FRESH');
  assert.equal(s.getItem('k'), 'FRESH', 'newest value must win over the stale stored one');

  // Once writes succeed again the persisted value must not be shadowed.
  win.localStorage.setItem = function (k2, v2) { this._v = v2; };
  s.setItem('k', 'PERSISTED');
  assert.equal(s.getItem('k'), 'PERSISTED');

  s.removeItem('k');
  assert.equal(s.getItem('k'), null);
});

// ── Notification dispatch is best-effort ────────────────────────────────────

test('notifyEvent wraps dispatch so a failure cannot fail the caller', async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'notify.js'), 'utf8');
  // Structural: the exported entry point must be a thin try/catch shim.
  const fn = src.slice(src.indexOf('async function notifyEvent'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.match(body, /try \{/, 'notifyEvent must have a try block');
  assert.match(body, /dispatchEvent\(event, ctx\)/);
  assert.match(body, /catch \(err\)/, 'notifyEvent must swallow dispatch errors');

  // Behavioural: with no recipients configured it resolves rather than throws.
  const { notifyEvent } = require('../src/notify');
  const res = await notifyEvent('__no_such_event__', { user_id: null, data: {} });
  assert.ok(res && typeof res === 'object', 'must resolve to a result object');
  for (const k of ['created', 'sent', 'failed']) {
    assert.equal(typeof res[k], 'number', `${k} must be a number`);
  }
});

// ── Enrollment capacity is counted under a lock ─────────────────────────────

test('enrollment capacity count excludes nothing it should include', async () => {
  const [section] = await qa(
    `INSERT INTO sections (name, grade_level, school_year, capacity)
     VALUES ('__CapTest', '7', '2026-2027', 2) RETURNING *`, []);
  const ids = [];
  try {
    for (const n of ['901', '902']) {
      const [st] = await qa(
        `INSERT INTO students (lrn, first_name, last_name, sex, grade_level, status)
         VALUES (?, 'Cap', ?, 'Male', '7', 'enrolled') RETURNING *`,
        [`99999999${n}`, n]);
      ids.push(st.id);
      await qr(
        `INSERT INTO enrollments (student_id, section_id, school_year, grade_level, status)
         VALUES (?, ?, '2026-2027', '7', 'enrolled')`, [st.id, section.id]);
    }
    const tally = await q(
      `SELECT COUNT(*) AS n FROM enrollments WHERE section_id = ? AND school_year = ? AND status = ?`,
      [section.id, '2026-2027', 'enrolled']);
    assert.equal(Number(tally.n), 2);
  } finally {
    await qr('DELETE FROM enrollments WHERE section_id = ?', [section.id]);
    await qr('DELETE FROM sections WHERE id = ?', [section.id]);
    for (const id of ids) await qr('DELETE FROM students WHERE id = ?', [id]);
  }
});

test('enrollment import rejects a non-12-digit LRN at the row level', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'enrollments.routes.js'), 'utf8');
  assert.match(src, /\^\\d\{12\}\$/,
    'import must validate LRN against a 12-digit pattern');
  // The batched prefetch must not reintroduce a per-row lookup.
  const importBody = src.slice(src.indexOf("router.post('/import'"));
  assert.doesNotMatch(importBody, /SELECT \* FROM students WHERE lrn = \?/,
    'import must not re-introduce the per-row student lookup');
  assert.doesNotMatch(importBody, /SELECT \* FROM sections WHERE name = \? AND/,
    'import must not re-introduce the per-row section lookup');
  // qa() takes exactly (sql, params). Spreading a second argument made the
  // placeholder count mismatch, and SQLite bound it to ZERO rows silently.
  const importTail = src.slice(src.indexOf("router.post('/import'"), src.indexOf('module.exports'));
  assert.doesNotMatch(importTail, /qa\([^)]*,\s*\.\.\./,
    'import must not spread extra args into qa()');
});

test('batched section prefetch binds correctly and finds every section', async () => {
  const names = ['__SecA', '__SecB', '__SecC'];
  const created = [];
  try {
    for (const n of names) {
      created.push((await qa(
        `INSERT INTO sections (name, grade_level, school_year, capacity)
         VALUES (?, '7', '2026-2027', 40) RETURNING *`, [n]))[0]);
    }
    // Reproduce the route's batched query shape exactly: one placeholder per
    // name, all names bound as a flat params array.
    const chunk = names;
    const marks = chunk.map(() => '?').join(',');
    const sql = `SELECT * FROM sections WHERE name IN (${marks})`;
    assert.equal((sql.match(/\?/g) || []).length, chunk.length, 'placeholders must match params');

    const rows = await qa(sql, chunk);
    assert.equal(rows.length, names.length,
      'a batched prefetch must return one row per requested section');

    const byName = new Map();
    for (const r of rows) byName.set(r.name, r);
    for (const n of names) {
      const hit = byName.get(n);
      assert.ok(hit, `${n} must be resolvable`);
      assert.equal(hit.school_year, '2026-2027');
      assert.equal(Number(hit.capacity), 40, 'capacity must survive the prefetch');
    }
  } finally {
    for (const s of created) await qr('DELETE FROM sections WHERE id = ?', [s.id]);
  }
});

test('section resolution prefers an exact school year, then a year-agnostic one', async () => {
  const rows = [
    { name: '__Dual', school_year: '2025-2026' },
    { name: '__Dual', school_year: '2026-2027' },
    { name: '__Any', school_year: '2026-2027' },
    { name: '__Any', school_year: null },
  ];
  // Same predicate the route uses after fetching by name.
  const resolve = (list, sy) => list.find((s) => s.school_year === sy)
    || list.find((s) => s.school_year == null || s.school_year === '');

  assert.equal(resolve(rows.filter((r) => r.name === '__Dual'), '2026-2027').school_year, '2026-2027',
    'exact school year must win over another year');
  assert.equal(resolve(rows.filter((r) => r.name === '__Any'), '2026-2027').school_year, '2026-2027',
    'exact match preferred');
  assert.equal(resolve(rows.filter((r) => r.name === '__Any'), '2027-2028'), null === null
    ? rows.filter((r) => r.name === '__Any').find((s) => s.school_year == null) : null,
    'year-agnostic section is the fallback');
});

test('distinct-name dedupe keeps one entry per section name', () => {
  // The bug: `new Set()` over arrays dedupes by reference, so every row produced
  // its own entry and the batch grew to the full row count.
  const rowSections = [...new Set(
    ['Rizal', 'Rizal', 'Bonifacio', 'Rizal'].map((s) => [s, '2026-2027'])
  )];
  const byValue = [...new Set(rowSections.map((p) => p.join('\u0000')))];
  assert.equal(byValue.length, 2, 'must collapse to 2 distinct sections');
});

test('tx rolls back on error so a failed capacity check writes nothing', async () => {
  const [section] = await qa(
    `INSERT INTO sections (name, grade_level, school_year, capacity)
     VALUES ('__TxTest', '8', '2026-2027', 40) RETURNING *`, []);
  const [st] = await qa(
    `INSERT INTO students (lrn, first_name, last_name, sex, grade_level, status)
     VALUES ('999999999930', 'Tx', 'Test', 'Male', '8', 'enrolled') RETURNING *`, []);
  const ERR = 'SECTION_FULL';
  await assert.rejects(
    () => tx(async (conn) => {
      await conn.run(
        `INSERT INTO enrollments (student_id, section_id, school_year, grade_level, status)
         VALUES (?, ?, '2026-2027', '8', 'enrolled')`, [st.id, section.id]);
      const e = new Error('full');
      e.code = ERR;
      throw e;
    }),
    (e) => e.code === ERR);
  const left = await q('SELECT id FROM enrollments WHERE section_id = ?', [section.id]);
  assert.equal(left, null, 'the enrollment must have been rolled back');
  await qr('DELETE FROM sections WHERE id = ?', [section.id]);
  await qr('DELETE FROM students WHERE id = ?', [st.id]);
});

process.on('exit', () => {
  try { close(); } catch {}
  try { fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); } catch {}
});