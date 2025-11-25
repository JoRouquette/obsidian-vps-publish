import { ConfigFacade } from '../application/facades/ConfigFacade';
import { PublicConfig } from '../domain/ports/ConfigRepository';

describe('ConfigFacade', () => {
  it('loads config only once', async () => {
    const cfg: PublicConfig = { siteName: 'Site', author: 'Me', repoUrl: '', reportIssuesUrl: '' };
    const repo = { load: jest.fn().mockResolvedValue(cfg) } as any;

    const facade = new ConfigFacade(repo);
    await facade.ensure();
    await facade.ensure();

    expect(repo.load).toHaveBeenCalledTimes(1);
    expect(facade.cfg()?.siteName).toBe('Site');
  });
});
