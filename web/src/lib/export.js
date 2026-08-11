function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function textToHtml(text) {
  return String(text || '').split('\n').map((line) => escapeHtml(line)).join('<br/>');
}

function downloadBlob(content, filename, type) {
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
  const w = window.open('', '_blank', 'width=850,height=1000');
  if (!w) return alert('Please allow pop-ups to print the document.');
  w.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title>
    <style>
      body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; margin: 0.8in; color: #000; }
      h3, h4 { font-family: 'Arial', sans-serif; }
      table { border-collapse: collapse; width: 100%; }
      td, th { border: 1px solid #000; padding: 4pt; font-size: 11pt; }
      pre { font-family: 'Times New Roman', serif; white-space: pre-wrap; }
    </style></head><body><pre>${escapeHtml(bodyText)}</pre></body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

export function printElementHtml(title, html) {
  const w = window.open('', '_blank', 'width=1000,height=1000');
  if (!w) return alert('Please allow pop-ups to print.');
  w.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title>
    <style>
      body { font-family: 'Times New Roman', serif; font-size: 12pt; margin: 0.4in; color: #000; }
      table { border-collapse: collapse; width: 100%; }
      td, th { border: 1px solid #000; padding: 4pt; font-size: 10pt; }
      .center { text-align: center; }
      h3 { margin: 0.2em 0; }
    </style></head><body>${html}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}