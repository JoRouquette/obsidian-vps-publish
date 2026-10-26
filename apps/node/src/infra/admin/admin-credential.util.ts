import { randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const SCRYPT_PREFIX = 'scrypt';
const SCRYPT_KEY_LENGTH = 64;

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number
) => Promise<Buffer>;

// Only used by tests, never on a request path, so it may stay synchronous.
export function hashAdminSecret(
  secret: string,
  salt = randomBytes(16).toString('base64url')
): string {
  const derivedKey = scryptSync(secret, salt, SCRYPT_KEY_LENGTH).toString('base64url');
  return `${SCRYPT_PREFIX}$${salt}$${derivedKey}`;
}

export async function verifyAdminSecret(secret: string, storedHash: string): Promise<boolean> {
  const [algorithm, salt, expectedKey] = storedHash.split('$');
  if (algorithm !== SCRYPT_PREFIX || !salt || !expectedKey) {
    return false;
  }

  const derivedKey = Buffer.from(
    (await scryptAsync(secret, salt, SCRYPT_KEY_LENGTH)).toString('base64url')
  );
  const expected = Buffer.from(expectedKey);
  // timingSafeEqual throws on a length mismatch. The derived key length is fixed and public,
  // so an early return on a truncated stored hash leaks nothing.
  if (derivedKey.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(derivedKey, expected);
}
