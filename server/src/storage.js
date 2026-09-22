const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');
const {
  R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY, R2_SECRET_KEY, R2_PUBLIC_URL, R2_BUCKET_IMAGE, R2_BUCKET_VIDEO,
} = require('./config');

const r2 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
});

const BUCKET = R2_BUCKET;
const IMAGE_BUCKET = R2_BUCKET_IMAGE || BUCKET;
const VIDEO_BUCKET = R2_BUCKET_VIDEO || BUCKET;
const PUBLIC_URL = R2_PUBLIC_URL;

// Pick the destination bucket from the upload's MIME type. Unknown/other files
// go to the default bucket.
function bucketForMime(mime) {
  if (mime && mime.startsWith('video/')) return VIDEO_BUCKET;
  if (mime && mime.startsWith('image/')) return IMAGE_BUCKET;
  return BUCKET;
}

const VIDEO_EXTS = /\.(mp4|webm|mov|m4v|avi|mkv|mpeg|mpg|3gp)$/i;
const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|heic|bmp)$/i;

// Recover the owning bucket from a stored key/URL. Existing keys carry no bucket
// hint, so we infer it from the file extension. Unknown extensions -> default.
function bucketForKey(key) {
  if (!key) return BUCKET;
  if (VIDEO_EXTS.test(key)) return VIDEO_BUCKET;
  if (IMAGE_EXTS.test(key)) return IMAGE_BUCKET;
  return BUCKET;
}

function genKey(folder, originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  const id = crypto.randomBytes(16).toString('hex');
  return `${folder}/${id}${ext}`;
}

async function uploadBuffer(key, buffer, mime) {
  const bucket = bucketForMime(mime);
  await r2.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: mime || 'application/octet-stream',
  }));
  // Stored URLs always reference the authenticated serve proxy so DB values stay
  // bucket-agnostic. The proxy redirects to the public bucket when one is
  // configured, or to a short-lived presigned URL once the bucket is private.
  return { key, url: `/api/v1/uploads/file/${key}` };
}

async function uploadFile(folder, file, originalName) {
  const key = genKey(folder, originalName || file.originalname);
  return uploadBuffer(key, file.buffer, file.mimetype);
}

async function deleteFile(key) {
  const bucket = bucketForKey(key);
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

async function fileExists(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: bucketForKey(key), Key: key }));
    return true;
  } catch {
    return false;
  }
}

function getPublicUrl(key) {
  return PUBLIC_URL ? `${PUBLIC_URL}/${key}` : null;
}

// Recover the storage key from a stored URL. photo_url values are either a
// public URL (PUBLIC_URL/<key>) or the fallback serve path
// (/api/v1/uploads/file/<key>). Returns null when the key cannot be derived.
function fileKeyFromUrl(url) {
  if (!url) return null;
  if (PUBLIC_URL && url.startsWith(PUBLIC_URL)) {
    return url.slice(PUBLIC_URL.length).replace(/^\/+/, '');
  }
  const marker = '/api/v1/uploads/file/';
  const i = url.indexOf(marker);
  if (i >= 0) return url.slice(i + marker.length);
  return null;
}

async function getSignedDownloadUrl(key, expiresIn = 3600) {
  const cmd = new GetObjectCommand({ Bucket: bucketForKey(key), Key: key });
  return getSignedUrl(r2, cmd, { expiresIn });
}

// Resolve a key to a fetchable URL. With a public bucket configured this is the
// plain CDN URL; once the bucket is private we fall back to a presigned GET.
async function getDownloadUrl(key, expiresIn = 3600) {
  if (!key) return null;
  if (PUBLIC_URL && bucketForKey(key) === BUCKET) return `${PUBLIC_URL}/${key}`;
  return getSignedDownloadUrl(key, expiresIn);
}

module.exports = { uploadFile, uploadBuffer, deleteFile, fileExists, getPublicUrl, getSignedDownloadUrl, getDownloadUrl, genKey, fileKeyFromUrl, bucketForMime, bucketForKey };