import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Fixed salt is fine here — this isn't password storage (no brute-force
// concern over a low-entropy secret), just a deterministic way to stretch
// the configured key string into a 32-byte AES key.
const SALT = 'chrispa-totp-secret-encryption';

function deriveKey(configuredKey: string) {
  return scryptSync(configuredKey, SALT, 32);
}

// AES-256-GCM: iv (12 bytes) + authTag (16 bytes) + ciphertext, base64-encoded.
export function encryptTotpSecret(plainSecret: string, configuredKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(configuredKey), iv);
  const ciphertext = Buffer.concat([cipher.update(plainSecret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decryptTotpSecret(encoded: string, configuredKey: string) {
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(configuredKey), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
