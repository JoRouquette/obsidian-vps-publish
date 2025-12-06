jest.mock('../infra/http/express/app', () => ({
  createApp: () => ({
    app: { listen: jest.fn((port: number, cb: () => void) => cb && cb()) },
    logger: { info: jest.fn(), debug: jest.fn() },
  }),
}));

jest.mock('../infra/config/env-config', () => ({
  EnvConfig: {
    loggerLevel: jest.fn(() => 'info'),
    port: jest.fn(() => 3000),
  },
}));

describe('main bootstrap', () => {
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock process.exit to prevent it from killing the test worker
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
      // Do nothing
    }) as any);
  });

  afterEach(() => {
    processExitSpy.mockRestore();
  });

  it('starts server without throwing', async () => {
    await import('../main'); // bootstrap executed on import
    // If no error is thrown, test passes.
  });
});
