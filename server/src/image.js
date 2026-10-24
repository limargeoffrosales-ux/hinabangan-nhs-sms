const jimp = require('jimp');

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const DEFAULT_MAX_DIMENSION = 1920;
const JPEG_QUALITY = 80;
// Decompression-bomb guard: reject dimensions that could exhaust memory before
// jimp decodes the whole buffer. ~60MP keeps peak RGBA decode under ~240MB.
const MAX_IMAGE_DIMENSION = 12000;
const MAX_IMAGE_PIXELS = 60_000_000;

// Cheap header-only dimension reads (no full decode).
function pngDims(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

function jpegDims(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 3 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (i + 8 < buf.length) return [buf.readUInt16BE(i + 5), buf.readUInt16BE(i + 7)];
      return null;
    }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

// Read [width, height] from image headers without decoding the pixel data.
function headerDims(buffer, mime) {
  if (mime === 'image/png') return pngDims(buffer);
  if (mime === 'image/jpeg') return jpegDims(buffer);
  return null;
}

// Optimize a raster image already buffered in memory (multer.memoryStorage).
// Only JPEG/PNG are re-encoded; webp/gif pass through untouched (re-encoding
// gif would drop animation and raise alpha/format edge cases). Returns
// { buffer, mime, size } when the image was changed, else null so callers
// keep the original bytes.
async function optimizeImage(buffer, mime, opts = {}) {
  if (!mime || !IMAGE_MIMES.has(mime) || !Buffer.isBuffer(buffer) || buffer.length < 512) return null;
  if (mime !== 'image/jpeg' && mime !== 'image/png') return null;
  const maxDimension = Number(opts.maxDimension) > 0 ? opts.maxDimension : DEFAULT_MAX_DIMENSION;
  try {
    const [rw, rh] = headerDims(buffer, mime) || [0, 0];
    if (rw <= 0 || rh <= 0 || rw > MAX_IMAGE_DIMENSION || rh > MAX_IMAGE_DIMENSION || rw * rh > MAX_IMAGE_PIXELS) {
      return null;
    }
    const img = await jimp.read(buffer);
    const w = img.getWidth();
    const h = img.getHeight();
    if (!w || !h) return null;
    const needsResize = w > maxDimension || h > maxDimension;
    if (!needsResize && mime === 'image/png') return null;
    if (needsResize) img.scaleToFit(maxDimension, maxDimension);
    img.quality(JPEG_QUALITY);
    const outMime = mime === 'image/png' ? jimp.MIME_PNG : jimp.MIME_JPEG;
    const out = await img.getBufferAsync(outMime);
    return { buffer: out, mime, size: out.length };
  } catch {
    return null;
  }
}

// Apply optimizeImage to a multer file object when beneficial.
async function optimizeUpload(file, opts) {
  if (!file || !file.buffer) return file;
  const opt = await optimizeImage(file.buffer, file.mimetype, opts);
  if (!opt) return file;
  return { ...file, buffer: opt.buffer, mimetype: opt.mime, size: opt.size };
}

module.exports = { optimizeImage, optimizeUpload, IMAGE_MIMES };