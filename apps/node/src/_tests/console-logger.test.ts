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
    logger.info('ignore');
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
});
