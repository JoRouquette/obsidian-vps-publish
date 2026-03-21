import { ConfigFacade } from '../application/facades/config-facade';
import type { ConfigRepository, PublicConfig } from '../domain/ports/config-repository.port';

describe('ConfigFacade', () => {
  it('loads config only once', async () => {
    const cfg: PublicConfig = {
      baseUrl: 'http://localhost',
      siteName: 'Site',
      author: 'Me',
      repoUrl: '',
      reportIssuesUrl: '',
      homeWelcomeTitle: 'Welcome',
      locale: 'en',
      adminApiPath: '',
      adminDashboardEnabled: false,
    };
    const repo: jest.Mocked<ConfigRepository> = { load: jest.fn().mockResolvedValue(cfg) };

    const facade = new ConfigFacade(repo);
    await facade.ensure();
    await facade.ensure();

    expect(repo.load).toHaveBeenCalledTimes(1);
    expect(facade.cfg()?.siteName).toBe('Site');
  });
});
