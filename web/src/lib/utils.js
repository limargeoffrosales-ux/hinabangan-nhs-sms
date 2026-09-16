export function fmt(n) { if (n == null || isNaN(Number(n))) return '—'; return Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }

// Only allow http(s) links to be rendered as clickable anchors; anything else
// (javascript:, data:, vbscript:) is a script-injection vector and is dropped.
export function safeHttpUrl(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return /^https?:\/\//i.test(v) ? v : null;
}
