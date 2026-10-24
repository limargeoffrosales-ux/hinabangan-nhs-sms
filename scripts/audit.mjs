// Dependency audit gate.
//
// `npm audit --audit-level=high` alone is not usable as a CI gate here: it flags
// `braces`, which has NO upstream fix (the advisory covers <=3.0.3 and 3.0.3 is
// the newest published version), so the build could never go green. npm's own
// suggested "fix" is a two-major upgrade of @sentry/vite-plugin plus a
// DOWNGRADE of exceljs — both risk breaking working features.
//
// This gate keeps the signal instead of discarding it: it fails on any
// high/critical finding that is NOT explicitly justified below, so a new
// serious vulnerability still blocks a deploy. Adding an entry to the
// allowlist is a deliberate, reviewable act.
//
// To re-check after upgrading a dependency:  npm run audit

import { execFileSync } from 'node:child_process';

const LEVEL = 'high';

// Allowlisted advisories, keyed by GHSA id. Each needs a reason and a revisit
// condition so these do not become permanent blind spots.
const ALLOWLIST = {
  'GHSA-vfj7-8cjw-p6xm': {
    package: 'braces',
    reason:
      'Unfixed upstream: advisory covers <=3.0.3 and 3.0.3 is the newest release, ' +
      'so there is no version to upgrade to. Reached only at BUILD time via ' +
      '@sentry/vite-plugin -> unplugin -> chokidar. The flaw is stack exhaustion ' +
      'from deeply nested glob patterns; the patterns come from this repo\'s own ' +
      'vite config, never from request input, and the plugin is not shipped in the ' +
      'runtime image.',
    revisit: 'When @sentry/vite-plugin reaches a v5+ release that drops the vulnerable chokidar.',
  },
};

function runAudit() {
  const isWin = process.platform === 'win32';
  try {
    return execFileSync(isWin ? 'npm.cmd' : 'npm', ['audit', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
      // Windows resolves npm through a .cmd shim, which spawnSync cannot exec
      // directly on Node >= 20 (EINVAL). CI is Linux and does not need this.
      ...(isWin ? { shell: true } : {}),
    });
  } catch (err) {
    // npm audit exits 1 when it finds anything. That output is still on stdout.
    if (err.stdout) return err.stdout;
    throw err;
  }
}

const rank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const threshold = rank[LEVEL];

const raw = runAudit();
let report;
try {
  report = JSON.parse(raw);
} catch {
  console.error('audit: could not parse `npm audit --json` output');
  process.exit(2);
}

const vulns = report.vulnerabilities || {};

// Collect the root advisories per finding, walking the `via` chains.
function advisoriesFor(name, seen = new Set()) {
  const v = vulns[name];
  if (!v || seen.has(name)) return [];
  seen.add(name);
  const out = [];
  for (const via of v.via || []) {
    if (typeof via === 'string') out.push(...advisoriesFor(via, seen));
    else if (via.url) out.push(via);
  }
  return out;
}

const blocking = [];
const ignored = [];

for (const [name, v] of Object.entries(vulns)) {
  if ((rank[v.severity] ?? 0) < threshold) continue;

  const advisories = advisoriesFor(name);
  const ids = advisories.map((a) => (a.url || '').split('/').pop()).filter(Boolean);
  const known = ids.filter((id) => ALLOWLIST[id]);

  if (advisories.length > 0 && known.length === advisories.length) {
    ignored.push({ name, severity: v.severity, ids: known });
  } else {
    blocking.push({
      name,
      severity: v.severity,
      direct: v.isDirect,
      range: v.range,
      fixAvailable: v.fixAvailable,
      via: ids,
    });
  }
}

if (ignored.length > 0) {
  // One advisory often poisons a whole chain (unplugin -> chokidar -> braces).
  // Group by advisory id so the justification prints once, not per package.
  const byId = new Map();
  for (const i of ignored) {
    for (const id of i.ids) {
      if (!byId.has(id)) byId.set(id, new Set());
      byId.get(id).add(i.name);
    }
  }
  console.log('audit: allowlisted (documented, non-blocking):');
  for (const [id, pkgs] of byId) {
    const entry = ALLOWLIST[id];
    console.log(`  - ${id} affects: ${[...pkgs].join(', ')}`);
    console.log(`      reason: ${entry.reason}`);
    console.log(`      revisit: ${entry.revisit}`);
  }
  console.log('');
}

if (blocking.length > 0) {
  console.error(`audit: ${blocking.length} blocking ${LEVEL}+ finding(s):`);
  for (const b of blocking) {
    console.error(`  - ${b.name} (${b.severity}${b.direct ? ', direct' : ''}) range ${b.range}`);
    if (b.via.length) console.error(`      via: ${b.via.join(', ')}`);
    console.error(`      fix available: ${JSON.stringify(b.fixAvailable)}`);
  }
  console.error('');
  console.error('Fix these, or justify them in ALLOWLIST above if they are unfixable.');
  process.exit(1);
}

console.log(`audit: OK - no un-allowlisted ${LEVEL}+ vulnerabilities.`);