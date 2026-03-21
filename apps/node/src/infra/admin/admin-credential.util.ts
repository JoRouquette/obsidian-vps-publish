import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_PREFIX = 'scrypt';
const SCRYPT_KEY_LENGTH = 64;

export function hashAdminSecret(
  secret: string,
  salt = randomBytes(16).toString('base64url')
): string {
  const derivedKey = scryptSync(secret, salt, SCRYPT_KEY_LENGTH).toString('base64url');
  return `${SCRYPT_PREFIX}$${salt}$${derivedKey}`;
}

export function verifyAdminSecret(secret: string, storedHash: string): boolean {
  const [algorithm, salt, expectedKey] = storedHash.split('$');
  if (algorithm !== SCRYPT_PREFIX || !salt || !expectedKey) {
    return false;
  }

  const derivedKey = scryptSync(secret, salt, SCRYPT_KEY_LENGTH).toString('base64url');
  return timingSafeEqual(Buffer.from(derivedKey), Buffer.from(expectedKey));
}
