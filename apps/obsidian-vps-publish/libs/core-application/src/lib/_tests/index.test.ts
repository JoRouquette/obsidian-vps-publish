import * as CoreApplicationEntry from '../..';

describe('core-application entrypoint', () => {
  it('se charge sans erreur et re-exporte le module lib', () => {
    expect(CoreApplicationEntry).toBeDefined();
  });
});
