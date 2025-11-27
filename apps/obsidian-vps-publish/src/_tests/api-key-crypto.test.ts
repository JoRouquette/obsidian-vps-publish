import { decryptApiKey, encryptApiKey } from '../lib/api-key-crypto';
import { Buffer } from 'buffer';

const b64 = {
  encode: (s: string) => Buffer.from(s, 'utf8').toString('base64'),
  decode: (s: string) => Buffer.from(s, 'base64').toString('utf8'),
};

describe('api-key-crypto', () => {
  beforeAll(() => {
    (globalThis as any).btoa = b64.encode;
    (globalThis as any).atob = b64.decode;
  });

  it('chiffre et déchiffre avec préfixe enc:', () => {
    const encrypted = encryptApiKey('secret-key');
    expect(encrypted.startsWith('enc:')).toBe(true);

    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe('secret-key');
  });

  it('retourne vide si valeur vide ou undefined', () => {
    expect(encryptApiKey(undefined)).toBe('');
    expect(decryptApiKey(null)).toBe('');
  });

  it('retourne la valeur d’origine si pas de préfixe (compatibilité)', () => {
    expect(decryptApiKey('plain-key')).toBe('plain-key');
  });
});
