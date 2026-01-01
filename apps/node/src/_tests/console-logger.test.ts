import { ConsoleLogger } from '../infra/logging/console-logger';

describe('ConsoleLogger', () => {
  const originalConsole = { ...console };
  let logs: string[];

  beforeEach(() => {
    logs = [];
    console.debug = console.log = console.warn = console.error = (msg: string) => logs.push(msg);
  });

  afterEach(() => {
    Object.assign(console, originalConsole);
  });

  it('filters logs below level', () => {
    const logger = new ConsoleLogger({ level: 'warn' });
    logger.debug('ignore');
    logger.warn('show');
    expect(logs.some((l) => l.includes('ignore'))).toBe(false);
    expect(logs.some((l) => l.includes('show'))).toBe(true);
  });

  it('merges child context', () => {
    const logger = new ConsoleLogger({ level: 'debug', context: { service: 'root' } });
    const child = logger.child({ module: 'm1' });
    child.debug('hello', { extra: true });
    const payload = JSON.parse(logs[0]);
    expect(payload.service).toBe('root');
    expect(payload.module).toBe('m1');
    expect(payload.extra).toBe(true);
    expect(payload.message).toBe('hello');
  });

  it('serializes Error objects correctly', () => {
    const logger = new ConsoleLogger({ level: 'error' });
    const error = new Error('Test error message');
    error.stack = 'Error: Test error message\n    at test.ts:10:5';

    logger.error('An error occurred', { error });

    const payload = JSON.parse(logs[0]);
    expect(payload.level).toBe('error');
    expect(payload.message).toBe('An error occurred');
    expect(payload.error).toBeDefined();
    expect(payload.error.name).toBe('Error');
    expect(payload.error.message).toBe('Test error message');
    expect(payload.error.stack).toContain('Error: Test error message');
  });

  it('serializes nested error objects', () => {
    const logger = new ConsoleLogger({ level: 'warn' });
    const innerError = new Error('Inner error');
    const outerError = new Error('Outer error');

    logger.warn('Nested errors', {
      error: outerError,
      details: { innerError },
    });

    const payload = JSON.parse(logs[0]);
    expect(payload.error.name).toBe('Error');
    expect(payload.error.message).toBe('Outer error');
    expect(payload.details).toBeDefined();
  });
});
