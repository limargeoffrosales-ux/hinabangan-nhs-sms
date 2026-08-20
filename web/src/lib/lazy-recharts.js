let mod = null;
let pending = null;

export function loadRecharts() {
  if (mod) return Promise.resolve(mod);
  if (!pending) pending = import('recharts').then((m) => { mod = m; });
  return pending;
}

export function getRecharts() {
  return mod;
}
