// src/crypto/cipher.js
// AES-256-GCM encryption — military grade, because you said it was important.

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const ITERATIONS = 100000;
const DIGEST = 'sha512';

/**
 * Derives a 256-bit key from a password using PBKDF2
 */
function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(
    password,
    salt,
    ITERATIONS,
    KEY_LENGTH,
    DIGEST
  );
}

/**
 * Encrypts a plaintext string with a password.
 * Returns a base64-encoded string: salt + iv + tag + ciphertext
 */
function encrypt(plaintext, password) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  // Pack: salt (64) + iv (16) + tag (16) + ciphertext
  const packed = Buffer.concat([salt, iv, tag, encrypted]);
  return packed.toString('base64');
}

/**
 * Decrypts a base64-encoded string with a password.
 * Throws if password is wrong or data is tampered.
 */
function decrypt(encoded, password) {
  const packed = Buffer.from(encoded, 'base64');

  const salt = packed.subarray(0, SALT_LENGTH);
  const iv = packed.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = packed.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const ciphertext = packed.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = deriveKey(password, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  } catch (e) {
    throw new Error('WRONG_PASSWORD');
  }
}

/**
 * Hashes a master password for verification (stored as a vault header)
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(32);
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, 64, DIGEST);
  return salt.toString('hex') + ':' + hash.toString('hex');
}

/**
 * Verifies a master password against stored hash
 */
function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, 64, DIGEST);
  return hash.toString('hex') === hashHex;
}

module.exports = { encrypt, decrypt, hashPassword, verifyPassword };
