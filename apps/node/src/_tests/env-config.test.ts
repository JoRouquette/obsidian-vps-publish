import path from 'node:path';

import { EnvConfig } from '../infra/config/env-config';

const ORIGINAL_ENV = { ...process.env };

describe('EnvConfig', () => {
  const originalCwd = process.cwd();

  afterEach(() => {
    process.chdir(originalCwd);
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
    delete process.env.LOG_FILE_PATH;
    delete process.env.MAX_EVENT_LOOP_LAG_MS;
    delete process.env.MAX_MEMORY_USAGE_MB;
    process.env.NODE_ENV = 'test';

    expect(EnvConfig.assetsRoot()).toBe(path.resolve('./tmp/assets'));
    expect(EnvConfig.contentRoot()).toBe(path.resolve('./tmp/site-content'));
    expect(EnvConfig.uiRoot()).toBe(path.resolve('./tmp/ui'));
    expect(EnvConfig.apiKey()).toBe('devkeylocal');
    expect(EnvConfig.port()).toBe(3000);
    expect(EnvConfig.loggerLevel()).toBe('info');
    expect(EnvConfig.logFilePath()).toBe(path.resolve('./node.log'));
    expect(EnvConfig.maxEventLoopLagMs()).toBe(5000);
    expect(EnvConfig.maxMemoryUsageMB()).toBe(2048);
    expect(EnvConfig.finalizationSseEnabled()).toBe(true);
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

  it('should parse configurable backpressure thresholds', () => {
    process.env.MAX_EVENT_LOOP_LAG_MS = '750';
    process.env.MAX_MEMORY_USAGE_MB = '768';

    expect(EnvConfig.maxEventLoopLagMs()).toBe(750);
    expect(EnvConfig.maxMemoryUsageMB()).toBe(768);
  });

  it('should allow realtime finalization SSE to be disabled explicitly', () => {
    process.env.FINALIZATION_SSE_ENABLED = 'false';

    expect(EnvConfig.finalizationSseEnabled()).toBe(false);
  });

  it('should normalize admin dashboard configuration', () => {
    process.env.ADMIN_API_PATH = 'internal/admin/';
    process.env.ADMIN_USERNAME_HASH = 'hash-user';
    process.env.ADMIN_PASSWORD_HASH = 'hash-password';

    expect(EnvConfig.adminApiPath()).toBe('/internal/admin');
    expect(EnvConfig.adminDashboardEnabled()).toBe(true);
  });

  describe('baseUrlOrNull', () => {
    it('returns the origin of a valid BASE_URL, dropping path and credentials', () => {
      process.env.BASE_URL = ' https://user:pw@Example.com:8443/some/path?x=1 ';

      expect(EnvConfig.baseUrlOrNull()).toBe('https://example.com:8443');
    });

    it.each([
      ['http://localhost:3000/x', 'http://localhost:3000'],
      ['HTTPS://Example.com', 'https://example.com'],
    ])('accepts the http(s) value %j', (value, origin) => {
      const logger = { warn: jest.fn() };
      process.env.BASE_URL = value;

      expect(EnvConfig.baseUrlOrNull(logger)).toBe(origin);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('returns undefined without warning when BASE_URL is unset or blank', () => {
      const logger = { warn: jest.fn() };
      delete process.env.BASE_URL;
      expect(EnvConfig.baseUrlOrNull(logger)).toBeUndefined();

      process.env.BASE_URL = '   ';
      expect(EnvConfig.baseUrlOrNull(logger)).toBeUndefined();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it.each([
      'not a url',
      'example.com',
      '/relative',
      'data:text/plain,x',
      'ftp://x',
      'ws://x',
      'wss://x.example',
      'file:///etc/passwd',
    ])('returns undefined and warns for the invalid value %j', (value) => {
      const logger = { warn: jest.fn() };
      process.env.BASE_URL = value;

      expect(EnvConfig.baseUrlOrNull(logger)).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn.mock.calls[0][0]).not.toContain(value);
    });
  });

  describe('adminSessionSecret', () => {
    it('returns the trimmed secret when set', () => {
      process.env.ADMIN_SESSION_SECRET = '  a-long-random-secret \n';

      expect(EnvConfig.adminSessionSecret()).toBe('a-long-random-secret');
    });

    it('returns undefined when unset or blank', () => {
      delete process.env.ADMIN_SESSION_SECRET;
      expect(EnvConfig.adminSessionSecret()).toBeUndefined();

      process.env.ADMIN_SESSION_SECRET = '  ';
      expect(EnvConfig.adminSessionSecret()).toBeUndefined();
    });
  });

  it('should resolve relative paths from the workspace root even if cwd changes', () => {
    process.chdir(path.join(originalCwd, 'apps', 'node'));
    process.env.CONTENT_ROOT = './tmp/site-content';
    process.env.LOG_FILE_PATH = './tmp/logs/node.log';

    expect(EnvConfig.contentRoot()).toBe(path.join(originalCwd, 'tmp', 'site-content'));
    expect(EnvConfig.logFilePath()).toBe(path.join(originalCwd, 'tmp', 'logs', 'node.log'));
  });
});
