import { hashAdminSecret, verifyAdminSecret } from '../infra/admin/admin-credential.util';

describe('admin-credential.util', () => {
  it('hashes and verifies a secret with scrypt', () => {
    const hash = hashAdminSecret('super-secret');

    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(verifyAdminSecret('super-secret', hash)).toBe(true);
    expect(verifyAdminSecret('wrong-secret', hash)).toBe(false);
  });

  it('rejects invalid hash formats', () => {
    expect(verifyAdminSecret('secret', 'plain-text')).toBe(false);
  });
});
