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
    const root = new ConsoleLoggerAdapter({ root: true }, LogLevel.debug | LogLevel.info);
    const child = root.child({ feature: 'x' });

    expect(child.level & LogLevel.info).toBe(LogLevel.info);
    child.debug('hello');

    // Le logger formate tout dans une seule chaîne avec JSON.stringify
    const output = (console.debug as jest.Mock).mock.calls[0][0];
    expect(output).toContain('hello');
    expect(output).toContain('"root": true');
    expect(output).toContain('"feature": "x"');
  });

  it('filtre les logs selon le niveau', () => {
    const logger = new ConsoleLoggerAdapter({}, LogLevel.error);
    logger.debug('info');
    logger.warn('warn');
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    logger.error('oops');
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});
