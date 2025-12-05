import { LogLevel } from '@core-domain/ports/logger-port';

import { ConsoleLoggerAdapter } from '../lib/infra/console-logger.adapter';

describe('ConsoleLoggerAdapter', () => {
  beforeEach(() => {
    jest.spyOn(console, 'debug').mockImplementation(() => undefined as any);
    jest.spyOn(console, 'info').mockImplementation(() => undefined as any);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined as any);
    jest.spyOn(console, 'error').mockImplementation(() => undefined as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('garde le contexte et le niveau sur un child', () => {
    const root = new ConsoleLoggerAdapter({ root: true }, LogLevel.info);
    const child = root.child({ feature: 'x' });

    expect(child.level & LogLevel.info).toBe(LogLevel.info);
    child.info('hello');
    const lastArg = (console.info as jest.Mock).mock.calls[0].slice(-1)[0];
    expect(lastArg).toMatchObject({ root: true, feature: 'x' });
  });

  it('filtre les logs selon le niveau', () => {
    const logger = new ConsoleLoggerAdapter({}, LogLevel.error);
    logger.info('info');
    logger.warn('warn');
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    logger.error('oops');
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});
