import { hashAdminSecret, verifyAdminSecret } from '../infra/admin/admin-credential.util';

describe('admin-credential.util', () => {
  it('hashes and verifies a secret with scrypt', async () => {
    const hash = hashAdminSecret('super-secret');

    expect(hash.startsWith('scrypt$')).toBe(true);
    await expect(verifyAdminSecret('super-secret', hash)).resolves.toBe(true);
    await expect(verifyAdminSecret('wrong-secret', hash)).resolves.toBe(false);
  });

  it('returns false instead of throwing when the stored key is truncated', async () => {
    await expect(verifyAdminSecret('secret', 'scrypt$salt$court')).resolves.toBe(false);
  });

  it('rejects invalid hash formats', async () => {
    await expect(verifyAdminSecret('secret', 'plain-text')).resolves.toBe(false);
  });
});
