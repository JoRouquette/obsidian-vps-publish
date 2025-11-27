import { Slug } from '@core-domain';

describe('Slug', () => {
  it('creates from value and keeps string', () => {
    const s = Slug.from('hello-world');
    expect(s.toString()).toBe('hello-world');
  });

  it('normalizes from route', () => {
    const s = Slug.fromRoute('/Guide/Start Here.md');
    expect(s.toString()).toBe('start-here-md');
  });

  it('defaults to index when route empty', () => {
    expect(Slug.fromRoute('/').toString()).toBe('index');
  });

  it('throws on invalid value', () => {
    expect(() => Slug.from('bad slug !')).toThrow();
  });
});
