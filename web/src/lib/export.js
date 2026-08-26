function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function textToHtml(text) {
  return String(text || '').split('\n').map((line) => escapeHtml(line)).join('<br/>');
}

export function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}

export function downloadTxt(text, filename) {
  downloadBlob(text, filename || 'document.txt', 'text/plain;charset=utf-8');
}

export function downloadDoc(title, bodyText, filename) {
  const html = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { size: 8.5in 11in; margin: 0.8in; }
  body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #000; }
  h3, h4 { font-family: 'Arial', sans-serif; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #000; padding: 4pt; font-size: 11pt; }
</style></head>
<body>${textToHtml(bodyText)}</body></html>`;
  downloadBlob(`\ufeff${html}`, filename || 'document.doc', 'application/msword');
}

export function printHtml(title, bodyText) {
  const fullHtml = `<!doctype html><html><head><title>${escapeHtml(title)}</title>
    <style>
      body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; margin: 0.8in; color: #000; }
      h3, h4 { font-family: 'Arial', sans-serif; }
      table { border-collapse: collapse; width: 100%; }
      td, th { border: 1px solid #000; padding: 4pt; font-size: 11pt; }
      pre { font-family: 'Times New Roman', serif; white-space: pre-wrap; }
    </style></head><body><pre>${escapeHtml(bodyText)}</pre></body></html>`;
  const w = window.open('', '_blank', 'width=850,height=1000');
  if (w) {
    w.document.write(fullHtml);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
    return;
  }
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(fullHtml);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 300);
}

function formCss(orientation, paper) {
  const orient = orientation === 'landscape' ? 'landscape' : 'portrait';
  const size = paper === 'legal' ? 'legal' : paper === 'a4' ? 'a4' : 'letter';
  return `@page { size: ${size} ${orient}; margin: 0.5in; }
    body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.3; color: #000; }
    table { border-collapse: collapse; width: 100%; margin: 6pt 0; }
    td, th { border: 1px solid #000; padding: 3pt; font-size: 9pt; vertical-align: top; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    .center { text-align: center; }
    .c { text-align: center; }
    .b { font-weight: bold; }
    .small { font-size: 8.5pt; }
    .h1 { font-size: 13pt; font-weight: bold; }
    .sig { width: 100%; border: none; }
    .sig td { border: none; text-align: center; font-size: 10pt; padding: 10pt 4pt 0; }
    .no-border td, .no-border th { border: none; }
    .pagebreak { page-break-before: always; }`;
}

export function printElementHtml(title, html, opts = {}) {
  const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>${formCss(opts.orientation, opts.paper)}</style></head><body>${html}</body></html>`;
  const w = window.open('', '_blank', 'width=1000,height=1000');
  if (w) {
    w.document.write(fullHtml);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
    return;
  }
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(fullHtml);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 300);
}

