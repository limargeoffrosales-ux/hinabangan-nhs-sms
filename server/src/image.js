const jimp = require('jimp');

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const DEFAULT_MAX_DIMENSION = 1920;
const JPEG_QUALITY = 80;

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