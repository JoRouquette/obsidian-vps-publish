import { IdGeneratorPort } from '../../ports/IdGeneratorPort';

describe('IdGeneratorPort', () => {
  // Example implementation for testing
  class MockIdGenerator implements IdGeneratorPort {
    generateId(): string {
      return Math.random().toString(36).substring(2, 15);
    }
  }

  let idGenerator: IdGeneratorPort;

  beforeEach(() => {
    idGenerator = new MockIdGenerator();
  });

  it('should generate a string id', () => {
    const id = idGenerator.generateId();
    expect(typeof id).toBe('string');
  });

  it('should generate a non-empty id', () => {
    const id = idGenerator.generateId();
    expect(id.length).toBeGreaterThan(0);
  });

  it('should generate unique ids on multiple calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(idGenerator.generateId());
    }
    expect(ids.size).toBe(100);
  });

  it('should not generate ids with whitespace', () => {
    const id = idGenerator.generateId();
    expect(/\s/.test(id)).toBe(false);
  });
});
