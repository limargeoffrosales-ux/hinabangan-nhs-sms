'use strict';

// Magic-byte (file signature) validation, per the OWASP File Upload Cheat Sheet.
// A declared Content-Type and filename extension are both attacker-controlled,
// so the only reliable check is whether the leading bytes match the claimed type.
//
// Shared by uploads.routes.js and submissions.routes.js: the submission endpoint
// previously validated only the extension and the client-supplied MIME type, so
// a file renamed to .pdf (or a script labelled image/png) passed untouched.

/**
 * @param {{ buffer?: Buffer, mimetype?: string }} file
 * @returns {boolean}
 */
function hasMagic(file) {
  const b = file && file.buffer;
  if (!b || b.length === 0) return false;
  const sw = (off, arr) => b.length >= off + arr.length && arr.every((x, i) => b[off + i] === x);
  const ascii = (off, s) => b.toString('latin1', off, off + s.length) === s;
  switch (file.mimetype) {
    case 'image/png':
      return sw(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/jpeg':
      return sw(0, [0xff, 0xd8, 0xff]);
    case 'image/gif':
      return ascii(0, 'GIF87a') || ascii(0, 'GIF89a');
    case 'image/webp':
      return sw(0, [0x52, 0x49, 0x46, 0x46]) && sw(8, [0x57, 0x45, 0x42, 0x50]);
    case 'application/pdf':
      return ascii(0, '%PDF-');
    case 'application/msword':
    case 'application/vnd.ms-excel':
    case 'application/vnd.ms-powerpoint':
      return sw(0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    case 'video/mp4':
    case 'video/quicktime':
    case 'video/x-m4v':
      return ascii(4, 'ftyp');
    case 'video/webm':
    case 'video/x-matroska':
      return sw(0, [0x1a, 0x45, 0xdf, 0xa3]);
    case 'video/x-msvideo':
      return ascii(0, 'RIFF') && ascii(8, 'AVI ');
    case 'application/zip':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return sw(0, [0x50, 0x4b, 0x03, 0x04]) || sw(0, [0x50, 0x4b, 0x05, 0x06]);
    case 'text/plain':
    case 'text/csv':
      return !b.includes(0);
    default:
      return false;
  }
}

module.exports = { hasMagic };