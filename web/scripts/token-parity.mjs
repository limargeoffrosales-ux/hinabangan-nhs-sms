#!/usr/bin/env node
/* Design-token parity checker.
 * Verifies that the CSS custom properties in web/src/styles.css (:root and
 * each [data-theme] block) match the canonical tokens in
 * web/src/design-system/tokens/colors.ts (themeColors.midnight / .light).
 * - Fails (exit 1) when a value differs or a key is missing on either side.
 *   :root must match the midnight block (the default dark theme).
 * - Value comparison normalizes hex/rgba forms; handwritten CSS values using
 *   var(--rgb-*) resolve against the same block first.
 * Usage: node scripts/token-parity.mjs
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const root = dirname(require.resolve('../package.json'));
const cssPath = join(root, 'src', 'styles.css');
const tsPath = join(root, 'src', 'design-system', 'tokens', 'colors.ts');
const css = readFileSync(cssPath, 'utf8');
const ts = readFileSync(tsPath, 'utf8');

const errors = [];
const SLUG = (s) => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
const IGNORE = new Set(['fontui', 'fontdisplay', 'fontmono', 'radius', 'rgbaccent', 'rgbgreen', 'rgbteal', 'rgbinfo']);

function parseCssVars(block) {
  const vars = {};
  const re = /--([\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(block))) vars[m[1].toLowerCase()] = m[2].trim();
  return vars;
}

function resolveRgb(vars, value) {
  return value.replace(/var\(--(rgb-[\w-]+)\)/gi, (_, n) => vars[n.toLowerCase()] || '');
}

function parseCsTheme(name) {
  const block = ts.match(new RegExp(`\\s${name}\\s*:\\s*\\{([\\s\\S]*?)\\}`, 'm'));
  if (!block) return {};
  const vars = {};
  const re = /^\s*(\w+)\s*:\s*'([^']*)',?\s*$/gm;
  let m;
  while ((m = re.exec(block[1]))) {
    if (['rank', 'heat', 'surface'].includes(m[1])) continue;
    vars[SLUG(m[1])] = m[2].trim();
  }
  return vars;
}

function findCssBlock(sel) {
  const start = css.indexOf(`${sel} {`);
  if (start === -1) return null;
  const brace = css.indexOf('{', start);
  let depth = 1;
  let i = brace + 1;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  return css.slice(brace + 1, i - 1);
}

function normColor(v) {
  v = v.trim().toLowerCase().replace(/\s+/g, '');
  // hex -> #rrggbb
  let m = v.match(/^#([0-9a-f]{3})$/);
  if (m) { const h = m[1]; return '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
  m = v.match(/^#([0-9a-f]{6})$/);
  if (m) return v;
  // rgb/rgba -> #rrggbb when opaque, rgba(...) otherwise
  m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:,\s*([\d.]+))?\s*\)$/);
  if (m) {
    const [, r, g, b, a] = m;
    if (a === undefined || Number(a) === 1) {
      return '#' + [r, g, b].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
    }
    return `rgba(${r},${g},${b},${a === '1' ? '1' : a})`;
  }
  // gradients + anything else: compare slug text
  return SLUG(v);
}

function compare(cssVars, csTheme, label) {
  for (const key of Object.keys(cssVars)) {
    const slug = SLUG(key);
    if (IGNORE.has(slug)) continue;
    if (!(slug in csTheme)) {
      errors.push(`[${label}] CSS var --${key} has no matching key in colors.ts.`);
      continue;
    }
    const a = normColor(resolveRgb(cssVars, cssVars[key]));
    const b = normColor(csTheme[slug]);
    if (a !== b) errors.push(`[${label}] --${key} mismatch:\n  css:  ${cssVars[key]}\n  ts:   ${csTheme[slug]}`);
  }
  for (const slug of Object.keys(csTheme)) {
    if (IGNORE.has(slug)) continue;
    if (!Object.keys(cssVars).some((k) => SLUG(k) === slug)) {
      errors.push(`[${label}] colors.ts key missing from styles.css.`);
    }
  }
}

const midnightVars = parseCssVars(findCssBlock(':root'));
const lightVars = parseCssVars(findCssBlock("[data-theme='light']"));
const csMidnight = parseCsTheme('midnight');
const csLight = parseCsTheme('light');

compare(midnightVars, csMidnight, 'midnight/:root');
compare(lightVars, csLight, 'light');

if (errors.length) {
  console.error('design-token parity FAILED:');
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log('design-token parity OK');

// Compare :root vs midnight data-theme block too
const rootVars = parseCssVars(findCssBlock(':root'));
const midnightBlockVars = parseCssVars(findCssBlock("[data-theme='midnight']"));
for (const key of Object.keys(rootVars)) {
  if (IGNORE.has(SLUG(key))) continue;
  if (midnightBlockVars[key] !== rootVars[key]) {
    console.error(`:root and [data-theme='midnight'] differ on --${key}`);
    process.exit(1);
  }
}