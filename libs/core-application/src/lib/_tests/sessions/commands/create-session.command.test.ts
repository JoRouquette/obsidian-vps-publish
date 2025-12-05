import { type CreateSessionCommand } from '../../../sessions/commands/create-session.command';

describe('CreateSessionCommand', () => {
  it('should create a valid command object', () => {
    const command: CreateSessionCommand = {
      notesPlanned: 10,
      assetsPlanned: 5,
      batchConfig: {
        maxBytesPerRequest: 1024,
      },
    };

    expect(command.notesPlanned).toBe(10);
    expect(command.assetsPlanned).toBe(5);
    expect(command.batchConfig.maxBytesPerRequest).toBe(1024);
  });

  it('should allow zero values for planned notes and assets', () => {
    const command: CreateSessionCommand = {
      notesPlanned: 0,
      assetsPlanned: 0,
      batchConfig: {
        maxBytesPerRequest: 512,
      },
    };

    expect(command.notesPlanned).toBe(0);
    expect(command.assetsPlanned).toBe(0);
    expect(command.batchConfig.maxBytesPerRequest).toBe(512);
  });

  it('should throw a type error if required fields are missing', () => {
    // @ts-expect-error
    const command: CreateSessionCommand = {
      notesPlanned: 1,
      // assetsPlanned missing
      batchConfig: {
        maxBytesPerRequest: 100,
      },
    };
    void command;
  });

  it('should throw a type error if batchConfig is missing', () => {
    // @ts-expect-error
    const command: CreateSessionCommand = {
      notesPlanned: 1,
      assetsPlanned: 1,
      // batchConfig missing
    };
    void command;
  });

  it('should allow large numbers for maxBytesPerRequest', () => {
    const command: CreateSessionCommand = {
      notesPlanned: 1,
      assetsPlanned: 1,
      batchConfig: {
        maxBytesPerRequest: Number.MAX_SAFE_INTEGER,
      },
    };

    expect(command.batchConfig.maxBytesPerRequest).toBe(Number.MAX_SAFE_INTEGER);
  });
});
