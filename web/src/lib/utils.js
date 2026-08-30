export function fmt(n) { if (n == null || isNaN(Number(n))) return '—'; return Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
