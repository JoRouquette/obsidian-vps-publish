import path from 'node:path';
import { EnvConfig } from '../infra/config/EnvConfig';

const ORIGINAL_ENV = { ...process.env };

describe('EnvConfig', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('should parse allowed origins as a trimmed list', () => {
    process.env.ALLOWED_ORIGINS = ' https://a.com , http://b.local ,, ';
    expect(EnvConfig.allowedOrigins()).toEqual(['https://a.com', 'http://b.local']);
  });

  it('should fall back to defaults when env vars are missing', () => {
    delete process.env.ASSETS_ROOT;
    delete process.env.CONTENT_ROOT;
    delete process.env.UI_ROOT;
    delete process.env.API_KEY;
    delete process.env.PORT;
    delete process.env.LOGGER_LEVEL;

    expect(EnvConfig.assetsRoot()).toBe(path.resolve('./tmp/assets'));
    expect(EnvConfig.contentRoot()).toBe(path.resolve('./tmp/site-content'));
    expect(EnvConfig.uiRoot()).toBe(path.resolve('./tmp/ui'));
    expect(EnvConfig.apiKey()).toBe('devkeylocal');
    expect(EnvConfig.port()).toBe(3000);
    expect(EnvConfig.loggerLevel()).toBe('info');
  });

  it('should coerce and clamp logger level to allowed values', () => {
    process.env.LOGGER_LEVEL = 'DeBuG';
    expect(EnvConfig.loggerLevel()).toBe('debug');

    process.env.LOGGER_LEVEL = 'unknown';
    expect(EnvConfig.loggerLevel()).toBe('info');
  });

  it('should normalize and parse port numbers safely', () => {
    process.env.PORT = '8081';
    expect(EnvConfig.port()).toBe(8081);

    process.env.PORT = 'not-a-number';
    expect(EnvConfig.port()).toBe(3000);
  });
});
