export function fmt(n) { return n == null ? '—' : Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
