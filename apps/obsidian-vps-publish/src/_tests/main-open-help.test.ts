import type { App, PluginManifest } from 'obsidian';

type CommandDefinition = { id: string; callback?: () => void };

const mockHelpModalOpen = jest.fn();
const mockHelpModalConstructor = jest.fn();

jest.mock('obsidian', () => {
  class Plugin {
    commands: CommandDefinition[] = [];
    constructor(
      public app: unknown,
      public manifest: unknown
    ) {}
    addCommand(command: CommandDefinition) {
      this.commands.push(command);
    }
    addRibbonIcon() {
      return { addClass() {}, removeClass() {}, toggleClass() {}, remove() {} };
    }
    addSettingTab() {}
    addStatusBarItem() {
      return {};
    }
    registerEvent() {}
    registerInterval() {}
    loadData() {
      return Promise.resolve({});
    }
    saveData() {
      return Promise.resolve();
    }
  }
  class Modal {}
  class Notice {}
  class PluginSettingTab {}
  const overrides: Record<string, unknown> = { Plugin, Modal, Notice, PluginSettingTab };
  const actual: Record<string, unknown> = jest.requireActual('obsidian');
  // Les autres modules importés par main.ts étendent d'autres classes d'obsidian
  // (SuggestModal…) : toute classe absente du mock devient une classe vide.
  return new Proxy(
    { ...actual, ...overrides },
    {
      get: (target: Record<string, unknown>, name: string) =>
        name in target || name === '__esModule' ? target[name] : class {},
    }
  );
});

jest.mock('../lib/setting-tab.view', () => ({ ObsidianVpsPublishSettingTab: class {} }));

type PluginUnderTest = {
  commands: CommandDefinition[];
  settings: Record<string, unknown>;
  onload(): Promise<void>;
};

async function loadOpenHelpCallback(
  helpModalModule: () => unknown
): Promise<{ callback: () => void; loggerError: jest.SpyInstance; app: App }> {
  jest.resetModules();
  jest.doMock('../lib/modals/help-modal', helpModalModule);

  const { default: PluginClass } = await import('../main');
  const app = {} as App;
  const plugin = new PluginClass(app, { id: 'vps-publish' } as PluginManifest);
  const pluginUnderTest = plugin as unknown as PluginUnderTest;
  jest.spyOn(plugin, 'loadSettings').mockImplementation(async () => {
    pluginUnderTest.settings = { locale: 'en' };
  });
  const loggerError = jest.spyOn(plugin.logger, 'error').mockImplementation(() => undefined);
  await pluginUnderTest.onload();

  const command = pluginUnderTest.commands.find((c) => c.id === 'open-help');
  if (!command?.callback) {
    throw new Error('open-help command not registered');
  }
  return { callback: command.callback, loggerError, app };
}

// The first test imports main.ts and its whole graph: a cold ts-jest compile exceeds the default 5 s.
jest.setTimeout(30_000);

describe('main open-help command', () => {
  beforeEach(() => {
    mockHelpModalOpen.mockReset();
    mockHelpModalConstructor.mockReset();
  });

  it('opens the help modal after the lazy import resolves', async () => {
    const { callback, app } = await loadOpenHelpCallback(() => ({
      HelpModal: class {
        constructor(...args: unknown[]) {
          mockHelpModalConstructor(...args);
        }
        open() {
          mockHelpModalOpen();
        }
      },
    }));

    callback();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockHelpModalConstructor).toHaveBeenCalledTimes(1);
    expect(mockHelpModalConstructor.mock.calls[0][0]).toBe(app);
    expect(mockHelpModalConstructor.mock.calls[0][1]).toHaveProperty('help');
    expect(mockHelpModalOpen).toHaveBeenCalledTimes(1);
  });

  it('logs the error and does not throw when the lazy import rejects', async () => {
    const failure = new Error('chunk missing');
    const { callback, loggerError } = await loadOpenHelpCallback(() => {
      throw failure;
    });

    expect(() => callback()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockHelpModalOpen).not.toHaveBeenCalled();
    expect(loggerError).toHaveBeenCalledWith('Failed to open the help modal', {
      error: failure,
    });
  });
});
