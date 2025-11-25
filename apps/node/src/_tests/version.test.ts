import { APP_VERSION } from '../version';

describe('version', () => {
  it('exposes app version string', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
