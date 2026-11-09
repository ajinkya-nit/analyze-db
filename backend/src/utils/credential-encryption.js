
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const ENCRYPTION_KEY = Buffer.from(
  env.security.dbEncryptionKey,
  'hex'
);

if (ENCRYPTION_KEY.length !== 32) {
  throw new Error('Invalid database credential encryption key.');
}

export function encryptCredential(plaintext) {
  if (typeof plaintext !== 'string') {
    throw new TypeError('Credential must be a string.');
  }

  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(
    ALGORITHM,
    ENCRYPTION_KEY,
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Format: version:iv:authTag:ciphertext
  return [
    'v1',
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

export function decryptCredential(encryptedCredential) {
  if (typeof encryptedCredential !== 'string') {
    throw new TypeError('Encrypted credential must be a string.');
  }

  const parts = encryptedCredential.split(':');

  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Invalid encrypted credential format.');
  }

  const [, ivHex, authTagHex, ciphertextHex] = parts;

  if (
    !/^[0-9a-f]+$/i.test(ivHex) ||
    !/^[0-9a-f]*$/i.test(authTagHex) ||
    !/^[0-9a-f]*$/i.test(ciphertextHex) ||
    ivHex.length !== IV_LENGTH * 2 ||
    authTagHex.length !== AUTH_TAG_LENGTH * 2 ||
    ciphertextHex.length % 2 !== 0
  ) {
    throw new Error('Invalid encrypted credential data.');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = createDecipheriv(
    ALGORITHM,
    ENCRYPTION_KEY,
    iv
  );

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
