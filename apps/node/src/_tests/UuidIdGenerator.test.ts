import { UuidIdGenerator } from '../infra/id/UuidIdGenerator';

describe('UuidIdGenerator', () => {
  it('generates a valid UUID v4 string', () => {
    const gen = new UuidIdGenerator();
    const id = gen.generateId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});
