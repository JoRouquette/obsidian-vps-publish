import { APP_VERSION } from '../version';

describe('version (site)', () => {
  it('exposes semantic version string', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
