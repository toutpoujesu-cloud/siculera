'use strict';

/**
 * Shared AES-256-CBC encryption utilities.
 * Extracted from adminController.js so chatController, chatAdminController,
 * and any future modules can share the same helpers without circular deps.
 */

const crypto = require('crypto');
const ALGO = 'aes-256-cbc';

function deriveKey() {
  const raw = process.env.DATA_ENCRYPTION_KEY || '';
  if (raw.length === 64) return Buffer.from(raw, 'hex');
  return Buffer.alloc(32, Buffer.from(raw.padEnd(32, '0')));
}

function encryptValue(plaintext) {
  const key = deriveKey();
  const iv  = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptValue(ciphertext) {
  try {
    const [ivHex, dataHex] = ciphertext.split(':');
    const key = deriveKey();
    const iv  = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
  } catch (_) {
    return null;
  }
}

function maskSecret(value) {
  if (!value || value.length <= 4) return '****';
  return '*'.repeat(Math.min(value.length - 4, 12)) + value.slice(-4);
}

const SENSITIVE_SUFFIXES = ['_key', '_secret', '_token', '_password', '_pass'];

function encryptSensitiveFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && SENSITIVE_SUFFIXES.some(s => k.toLowerCase().endsWith(s))) {
      out[k] = encryptValue(v);
      out[k + '__encrypted'] = true;
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = encryptSensitiveFields(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function decryptAndMaskFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.endsWith('__encrypted')) continue;
    if (typeof v === 'string' && obj[k + '__encrypted']) {
      const decrypted = decryptValue(v);
      out[k] = maskSecret(decrypted || v);
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = decryptAndMaskFields(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Decrypt all sensitive fields in an object (returns plaintext, not masked).
 * Used internally by chat/payment controllers before passing keys to SDKs.
 */
function decryptAllFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.endsWith('__encrypted')) continue;
    if (typeof v === 'string' && obj[k + '__encrypted']) {
      out[k] = decryptValue(v) || '';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = decryptAllFields(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

module.exports = {
  encryptValue,
  decryptValue,
  maskSecret,
  encryptSensitiveFields,
  decryptAndMaskFields,
  decryptAllFields,
  SENSITIVE_SUFFIXES
};
