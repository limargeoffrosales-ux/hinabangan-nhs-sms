// Migration parity: the PG and SQLite migration sets must cover the same
// numbered steps. CI runs the quality gate with SQLite tests only, so a
// PG-only migration would otherwise sail through to production where the
// server boots with DATABASE_URL set and crashes on the missing file.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'database', 'migrations');

function collect() {
  const pg = [];
  const sqlite = [];
  for (const name of fs.readdirSync(MIGRATIONS_DIR)) {
    if (!/^\d+-/.test(name)) continue;
    if (name.endsWith('.sqlite.sql')) {
      sqlite.push(name.slice(0, -'.sqlite.sql'.length));
    } else if (name.endsWith('.sql')) {
      pg.push(name.slice(0, -'.sql'.length));
    }
  }
  // Filter out files matching both patterns from one list (none, but be safe).
  const norm = (names) => names.filter((n) => !n.endsWith('.sqlite'));
  const numbers = (names) => new Set(norm(names).map((n) => Number.parseInt(n, 10)));
  return { pg, sqlite, pgNumbers: numbers(pg), sqliteNumbers: numbers(sqlite) };
}

test('PG and SQLite migrations cover identical step numbers', () => {
  const { pg, sqlite, pgNumbers, sqliteNumbers } = collect();
  const onlyPg = [...pgNumbers].filter((n) => !sqliteNumbers.has(n)).sort((a, b) => a - b);
  const onlySqlite = [...sqliteNumbers].filter((n) => !pgNumbers.has(n)).sort((a, b) => a - b);
  assert.deepStrictEqual(
    onlyPg,
    [],
    `Migrations present only in PG (would crash production boot once DATABASE_URL is set): ${onlyPg.join(', ')}`,
  );
  assert.deepStrictEqual(
    onlySqlite,
    [],
    `Migrations present only in SQLite: ${onlySqlite.join(', ')}`,
  );
  assert.strictEqual(pg.length, sqlite.length, 'PG and SQLite migration counts must match');
});

test('migration file names never duplicate within a dialect', () => {
  const count = (names) =>
    names.reduce((acc, n) => ({ ...acc, [n]: (acc[n] || 0) + 1 }), {});
  const dupes = (names) =>
    Object.entries(count(names)).filter(([, c]) => c > 1).map(([n]) => n);
  const { pg, sqlite } = collect();
  assert.deepStrictEqual(dupes(pg), [], 'duplicate PG migration names');
  assert.deepStrictEqual(dupes(sqlite), [], 'duplicate SQLite migration names');
});