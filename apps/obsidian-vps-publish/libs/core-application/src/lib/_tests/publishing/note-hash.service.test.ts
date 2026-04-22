import { NoteHashService } from '../../publishing/services/note-hash.service';

describe('NoteHashService', () => {
  let service: NoteHashService;

  beforeEach(() => {
    service = new NoteHashService();
  });

  it('computes SHA-256 hash of string content', async () => {
    const content = 'Hello, world!';
    const hash = await service.computeHash(content);

    // Expected SHA-256 of "Hello, world!" in UTF-8
    expect(hash).toBe('315f5bdb76d078c43b8ac0064e4a0164612b1fce77c869345bfc94c75894edd3');
  });

  it('produces different hashes for different content', async () => {
    const content1 = 'Note content v1';
    const content2 = 'Note content v2';

    const hash1 = await service.computeHash(content1);
    const hash2 = await service.computeHash(content2);

    expect(hash1).not.toBe(hash2);
  });

  it('produces same hash for identical content', async () => {
    const content = 'Stable note content';

    const hash1 = await service.computeHash(content);
    const hash2 = await service.computeHash(content);

    expect(hash1).toBe(hash2);
  });

  it('handles UTF-8 characters correctly', async () => {
    const content = 'Héllo wörld! 日本語 🎉';
    const hash = await service.computeHash(content);

    // Hash should be deterministic for UTF-8 encoded content
    expect(hash).toHaveLength(64); // SHA-256 produces 64 hex characters
    expect(typeof hash).toBe('string');
  });

  it('handles empty string', async () => {
    const content = '';
    const hash = await service.computeHash(content);

    // SHA-256 of empty string
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('handles large content', async () => {
    const content = 'A'.repeat(100000); // 100KB of 'A'
    const hash = await service.computeHash(content);

    expect(hash).toHaveLength(64);
    expect(typeof hash).toBe('string');
  });
});
