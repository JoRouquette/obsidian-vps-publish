jest.mock('../infra/http/express/app', () => ({
  createApp: () => ({
    app: { listen: jest.fn((port: number, cb: () => void) => cb && cb()) },
    logger: { info: jest.fn() },
  }),
}));

jest.mock('../infra/config/env-config', () => ({
  EnvConfig: {
    loggerLevel: jest.fn(() => 'info'),
    port: jest.fn(() => 3000),
  },
}));

describe('main bootstrap', () => {
  it('starts server without throwing', async () => {
    await import('../main'); // bootstrap executed on import
    // If no error is thrown, test passes.
  });
});
