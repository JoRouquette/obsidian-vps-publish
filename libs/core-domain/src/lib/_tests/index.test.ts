import * as CoreDomainEntry from '../..';

describe('core-domain entrypoint', () => {
  it('se charge sans erreur et re-exporte le module lib', () => {
    expect(CoreDomainEntry).toBeDefined();
  });
});
