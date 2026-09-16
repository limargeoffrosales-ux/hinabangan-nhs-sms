let mod = null;
let failed = false;
let pending = null;

export function loadRecharts() {
  if (failed) return Promise.resolve(null);
  if (mod) return Promise.resolve(mod);
  if (!pending) {
    pending = import('recharts')
      .then((m) => { mod = m; return m; })
      .catch(() => { failed = true; mod = null; return null; });
  }
  return pending;
}

export function getRecharts() {
  return mod;
}
