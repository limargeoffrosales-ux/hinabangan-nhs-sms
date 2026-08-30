const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');
const { R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY, R2_SECRET_KEY, R2_PUBLIC_URL } = require('./config');

const r2 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
});

const BUCKET = R2_BUCKET;
const PUBLIC_URL = R2_PUBLIC_URL;

function genKey(folder, originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  const id = crypto.randomBytes(16).toString('hex');
  return `${folder}/${id}${ext}`;
}

async function uploadBuffer(key, buffer, mime) {
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mime || 'application/octet-stream',
  }));
  return { key, url: PUBLIC_URL ? `${PUBLIC_URL}/${key}` : null };
}

async function uploadFile(folder, file, originalName) {
  const key = genKey(folder, originalName || file.originalname);
  return uploadBuffer(key, file.buffer, file.mimetype);
}

async function deleteFile(key) {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

async function fileExists(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

function getPublicUrl(key) {
  return PUBLIC_URL ? `${PUBLIC_URL}/${key}` : null;
}

async function getSignedDownloadUrl(key, expiresIn = 3600) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(r2, cmd, { expiresIn });
}

module.exports = { uploadFile, uploadBuffer, deleteFile, fileExists, getPublicUrl, getSignedDownloadUrl, genKey };
