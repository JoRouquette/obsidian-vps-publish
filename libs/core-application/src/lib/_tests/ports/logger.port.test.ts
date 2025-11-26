import { LoggerPort, LogMeta } from '../../ports/logger.port';

describe('LoggerPort', () => {
  let logger: LoggerPort;
  let logs: { level: string; message: string; args: any[]; context?: LogMeta }[];

  beforeEach(() => {
    logs = [];
    const buildLogger = (context: LogMeta = {}): LoggerPort => ({
      debug: (message: string, ...args: any[]) =>
        logs.push({ level: 'debug', message, args, context }),
      info: (message: string, ...args: any[]) =>
        logs.push({ level: 'info', message, args, context }),
      warn: (message: string, ...args: any[]) =>
        logs.push({ level: 'warn', message, args, context }),
      error: (message: string, ...args: any[]) =>
        logs.push({ level: 'error', message, args, context }),
      child: (childContext: LogMeta) => buildLogger({ ...context, ...childContext }),
    });

    logger = buildLogger();
  });

  it('should log debug messages', () => {
    logger.debug('debug message', 1, 2);
    expect(logs).toEqual([
      { level: 'debug', message: 'debug message', args: [1, 2], context: {} },
    ]);
  });

  it('should log info messages', () => {
    logger.info('info message', { foo: 'bar' });
    expect(logs[0]).toMatchObject({
      level: 'info',
      message: 'info message',
      args: [{ foo: 'bar' }],
    });
  });

  it('should log warn messages', () => {
    logger.warn('warn message');
    expect(logs[0]).toMatchObject({
      level: 'warn',
      message: 'warn message',
    });
  });

  it('should log error messages', () => {
    logger.error('error message', new Error('fail'));
    expect(logs[0].level).toBe('error');
    expect(logs[0].message).toBe('error message');
    expect(logs[0].args[0]).toBeInstanceOf(Error);
  });

  it('should create a child logger with context', () => {
    const child = logger.child({ requestId: 'abc123' });
    child.info('child info');
    expect(logs[0]).toMatchObject({
      level: 'info',
      message: 'child info',
      context: { requestId: 'abc123' },
    });
  });

  it('should allow chaining child loggers', () => {
    const child1 = logger.child({ module: 'mod1' });
    const child2 = child1.child({ useCase: 'uc1' });
    child2.debug('deep child');
    expect(logs[0].level).toBe('debug');
    expect(logs[0].message).toBe('deep child');
    expect(logs[0].context).toMatchObject({ useCase: 'uc1' });
  });

  it('should support logging with no args', () => {
    logger.info('no args');
    expect(logs[0].args).toEqual([]);
  });
});
