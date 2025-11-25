import { QueryHandler } from '../../common/QueryHandler';

describe('QueryHandler interface', () => {
  interface TestQuery {
    value: number;
  }

  interface TestResult {
    result: number;
  }

  class AddOneQueryHandler implements QueryHandler<TestQuery, TestResult> {
    async handle(query: TestQuery): Promise<TestResult> {
      return { result: query.value + 1 };
    }
  }

  it('should implement handle method that returns a Promise', async () => {
    const handler = new AddOneQueryHandler();
    const query: TestQuery = { value: 2 };
    const result = await handler.handle(query);
    expect(result).toEqual({ result: 3 });
  });

  it('should allow different types for Q and R', async () => {
    class StringifyQueryHandler implements QueryHandler<number, string> {
      async handle(query: number): Promise<string> {
        return `Value is ${query}`;
      }
    }
    const handler = new StringifyQueryHandler();
    const result = await handler.handle(42);
    expect(result).toBe('Value is 42');
  });

  it('should reject if handle throws', async () => {
    class ErrorQueryHandler implements QueryHandler<unknown, never> {
      async handle(): Promise<never> {
        throw new Error('Test error');
      }
    }
    const handler = new ErrorQueryHandler();
    await expect(handler.handle()).rejects.toThrow('Test error');
  });
});
