#!/usr/bin/env node
/* i18n key-consistency checker.
 * Scans web/src for static `t('key')` / `i18n.t('key')` calls and verifies each
 * key exists in BOTH web/src/i18n/en.json and fil.json.
 * - Fails (exit 1) when a statically-referenced key is missing from a locale.
 * - Reports dynamic usages (template literals / variables) and unused keys
 *   as informational counts only.
 * Usage: node scripts/i18n-check.mjs [--verbose]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, relative, dirname } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = dirname(require.resolve('../package.json'));
const srcDir = join(root, 'src');
const enPath = join(root, 'src', 'i18n', 'en.json');
const filPath = join(root, 'src', 'i18n', 'fil.json');
const verbose = process.argv.includes('--verbose');

const en = JSON.parse(readFileSync(enPath, 'utf8'));
const fil = JSON.parse(readFileSync(filPath, 'utf8'));
const enKeys = new Set(Object.keys(en));
const filKeys = new Set(Object.keys(fil));
const fileKeys = new Set([...enKeys, ...filKeys]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(js|jsx|ts|tsx|mjs)$/.test(extname(full))) out.push(full);
  }
  return out;
}

function stripCommentsAndTemplates(code) {
  code = code.replace(/\/\*[\s\S]*?\*\//g, ' ');
  code = code.replace(/\/\/[^\r\n]*/g, ' ');
  code = code.replace(/`[^`]*`/g, ' ');
  return code;
}

const CALL_RE = /(?:^|[^A-Za-z0-9_.])(?:t|i18n\.t)\s*\(\s*(['"])([^'"]+)\1/g;
const DYNAMIC_RE = /(?:^|[^A-Za-z0-9_.])(?:t|i18n\.t)\s*\(\s*([`$]|{?[^'"])/g;

const referenced = new Map(); // key -> count
const filesWithKey = new Map(); // key -> first file
let dynamicCount = 0;

for (const file of walk(srcDir)) {
  const code = stripCommentsAndTemplates(readFileSync(file, 'utf8'));
  const rel = relative(root, file);
  for (const m of code.matchAll(CALL_RE)) {
    const key = m[2];
    referenced.set(key, (referenced.get(key) || 0) + 1);
    if (!filesWithKey.has(key)) filesWithKey.set(key, rel);
  }
  for (const m of code.matchAll(DYNAMIC_RE)) {
    if (m[1] === '`' || m[1] === '$' || m[1] === '{') dynamicCount++;
  }
}

function resolved(key) {
  if (enKeys.has(key) && filKeys.has(key)) return true;
  if (!enKeys.has(key) && !filKeys.has(key) && (enKeys.has(`${key}_one`) && enKeys.has(`${key}_other`))) {
    return enKeys.has(`${key}_one`) && filKeys.has(`${key}_one`) && filKeys.has(`${key}_other`) && enKeys.has(`${key}_other`);
  }
  return false;
}

const missing = [];
for (const key of referenced.keys()) {
  if (!enKeys.has(key)) missing.push({ key, locale: 'en.json', file: filesWithKey.get(key) });
  if (!filKeys.has(key)) missing.push({ key, locale: 'fil.json', file: filesWithKey.get(key) });
}

const orphans = [...fileKeys].filter((k) => !/_[0-9a-z]+$/.test(k) && !referenced.has(k));

console.log(`i18n-check: scanned ${walk(srcDir).length} source files`);
console.log(`i18n-check: ${referenced.size} static keys referenced (${fileKeys.size} keys in locale files)`);
console.log(`i18n-check: resolved ${[...referenced.keys()].filter((k) => enKeys.has(k) && filKeys.has(k)).length} / ${referenced.size}`);
if (dynamicCount) console.log(`i18n-check: info: ${dynamicCount} dynamic t() usages (template/variable) — not validated`);
console.log(`i18n-check: info: ${orphans.length} locale keys not statically referenced (may be dynamic)${verbose ? ':\n  ' + orphans.sort().join('\n  ') : ''}`);

if (missing.length) {
  missing.sort((a, b) => a.key.localeCompare(b.key) || a.locale.localeCompare(b.locale));
  for (const { key, locale, file } of missing) {
    console.error(`i18n-check: FAIL: "${key}" (used in ${file}) missing from ${locale}`);
  }
  console.error(`i18n-check: ${missing.length} missing key(s)`);
  process.exit(1);
}

console.log('i18n-check: OK — all static keys present in both locales');
process.exit(0);