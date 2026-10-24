// Chart export helpers — rasterize any in-page <svg> (recharts surfaces,
// pure-SVG donuts/sparklines/rings) to a crisp PNG. Recharts paints gradients
// and ticks with `var(--css-var)` tokens, so we walk the clone and resolve
// every token against the live computed root before serializing.

function resolveVar(name) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v && v.trim() ? v.trim() : null;
}

function resolveTokens(value) {
  return String(value).replace(/var\((--[a-zA-Z0-9-]+)\)/g, (m, name) => resolveVar(name) || m);
}

function buildSvgDocument(svg) {
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  for (const attr of ['width', 'height', 'viewBox']) {
    const v = clone.getAttribute(attr) || svg.getAttribute(attr);
    if (v) clone.setAttribute(attr, v);
  }

  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode;
  while (node) {
    for (const attr of Array.from(node.attributes || [])) {
      attr.value = resolveTokens(attr.value);
    }
    if (node.style && node.style.cssText) {
      node.setAttribute('style', resolveTokens(node.style.cssText));
    }
    node = walker.nextNode();
  }

  const font = getComputedStyle(document.documentElement).getPropertyValue('--font-body')
    || getComputedStyle(document.documentElement).fontFamily
    || 'sans-serif';
  clone.style.fontFamily = font;
  return clone;
}

export function exportChartNode(target, { filename, scale = 2 } = {}) {
  const root = typeof target === 'function' ? target.current : target;
  if (!root) return Promise.reject(new Error('Chart target not found'));
  const svg = root.querySelector('svg.recharts-surface') || root.querySelector('svg');
  if (!svg) return Promise.reject(new Error('No SVG found in chart target'));
  return exportSvgAsPng(svg, { filename, scale });
}

export function exportSvgAsPng(svg, { filename, scale = 2 } = {}) {
  const doc = buildSvgDocument(svg);
  const width = Number(doc.getAttribute('width') || svg.getBoundingClientRect().width || 0);
  const height = Number(doc.getAttribute('height') || svg.getBoundingClientRect().height || 0);
  if (!width || !height) return Promise.reject(new Error('Chart has no measurable size'));

  const blob = new Blob([new XMLSerializer().serializeToString(doc)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolveP, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return reject(new Error('Canvas unsupported'));
      }
      ctx.fillStyle = resolveVar('--card') || '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((png) => {
        if (!png) return reject(new Error('PNG encoding failed'));
        downloadBlob(png, filename || `chart-${Date.now()}.png`);
        resolveP(true);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to render chart SVG'));
    };
    img.src = url;
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}