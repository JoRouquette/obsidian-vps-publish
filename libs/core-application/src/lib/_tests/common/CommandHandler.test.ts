import { CommandHandler } from '../../common/CommandHandler';

describe('CommandHandler interface', () => {
  interface TestCommand {
    value: number;
  }

  class AddOneHandler implements CommandHandler<TestCommand, number> {
    async handle(command: TestCommand): Promise<number> {
      return command.value + 1;
    }
  }

  class VoidHandler implements CommandHandler<TestCommand> {
    async handle(command: TestCommand): Promise<void> {
      // no-op
    }
  }

  it('should return the correct result from handle', async () => {
    const handler = new AddOneHandler();
    const result = await handler.handle({ value: 41 });
    expect(result).toBe(42);
  });

  it('should support void return type', async () => {
    const handler = new VoidHandler();
    await expect(handler.handle({ value: 0 })).resolves.toBeUndefined();
  });

  it('should allow different command types', async () => {
    interface StringCommand {
      text: string;
    }
    class EchoHandler implements CommandHandler<StringCommand, string> {
      async handle(command: StringCommand): Promise<string> {
        return command.text;
      }
    }
    const handler = new EchoHandler();
    await expect(handler.handle({ text: 'hello' })).resolves.toBe('hello');
  });
});
