const path = require('path');
const crypto = require('crypto');

let client = null;
let PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand;

function configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
  );
}

function getClient() {
  if (!configured()) return null;
  if (client) return client;
  ({ S3Client: client } = require('@aws-sdk/client-s3'));
  ({ PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3'));
  client = new client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
  });
  return client;
}

function safeName(name) {
  const base = path.basename(String(name || 'file')).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  return base.slice(0, 180) || 'file';
}

function objectKey(prefix, originalName) {
  return `${String(prefix || 'uploads').replace(/^\/+|\/+$/g, '')}/${Date.now()}-${crypto.randomUUID()}-${safeName(originalName)}`;
}

async function putBuffer(buffer, originalName, contentType, prefix = 'uploads') {
  const s3 = getClient();
  if (!s3) throw new Error('R2 storage is not configured');
  const key = objectKey(prefix, originalName);
  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
    ServerSideEncryption: 'AES256'
  }));
  return key;
}

async function getObject(key) {
  const s3 = getClient();
  if (!s3) throw new Error('R2 storage is not configured');
  return s3.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
}

async function headObject(key) {
  const s3 = getClient();
  if (!s3) throw new Error('R2 storage is not configured');
  return s3.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
}

async function deleteObject(key) {
  if (!key || !configured()) return;
  const s3 = getClient();
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
}

module.exports = { configured, putBuffer, getObject, headObject, deleteObject, safeName };
