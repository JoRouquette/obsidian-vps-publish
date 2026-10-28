import type { App, PluginManifest } from 'obsidian';

const mockNotices: string[] = [];

jest.mock('obsidian', () => {
  class Plugin {
    constructor(
      public app: unknown,
      public manifest: unknown
    ) {}
    loadData() {
      return Promise.resolve({});
    }
    saveData() {
      return Promise.resolve();
    }
  }
  class Notice {
    constructor(message: string) {
      mockNotices.push(message);
    }
  }
  const overrides: Record<string, unknown> = { Plugin, Notice };
  const actual: Record<string, unknown> = jest.requireActual('obsidian');
  // Other classes imported by main.ts extend obsidian classes (SuggestModal...):
  // every class missing from the mock becomes an empty class.
  return new Proxy(
    { ...actual, ...overrides },
    {
      get: (target: Record<string, unknown>, name: string) =>
        name in target || name === '__esModule' ? target[name] : class {},
    }
  );
});

jest.mock('../lib/setting-tab.view', () => ({ ObsidianVpsPublishSettingTab: class {} }));

type SavedVps = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  ignoreRules: unknown[];
  cleanupRules: unknown[];
  folders?: unknown[];
  customIndexes?: unknown[];
  routeTree?: { roots: Array<Record<string, unknown>> };
};

type PluginUnderTest = {
  settings: { vpsConfigs: SavedVps[] };
  logger: { warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
  loadSettings(): Promise<void>;
  loadData(): Promise<unknown>;
  saveData(data: unknown): Promise<void>;
};

const folder = (id: string, vaultFolder: string, routeBase: string) => ({
  id,
  vpsId: 'vps-1',
  vaultFolder,
  routeBase,
  ignoredCleanupRuleIds: [],
});

const savedVps = (overrides: Partial<SavedVps> = {}): SavedVps => ({
  id: 'vps-1',
  name: 'Legacy',
  baseUrl: 'https://example.com',
  apiKey: 'enc:a2V5',
  ignoreRules: [],
  cleanupRules: [],
  folders: [folder('f-blog', 'Blog', '/blog')],
  ...overrides,
});

// The first test imports main.ts and its whole graph: a cold ts-jest compile exceeds the default 5 s.
jest.setTimeout(30_000);

async function createPlugin(rawData: unknown) {
  jest.resetModules();
  const { default: PluginClass } = await import('../main');
  const app = { vault: { configDir: '.obsidian', adapter: { exists: async () => false } } };
  const plugin = new PluginClass(
    app as unknown as App,
    {
      id: 'vps-publish',
    } as PluginManifest
  ) as unknown as PluginUnderTest;
  jest.spyOn(plugin, 'loadData').mockResolvedValue(rawData);
  const saveData = jest.spyOn(plugin, 'saveData').mockResolvedValue(undefined);
  const warn = jest.spyOn(plugin.logger, 'warn').mockImplementation(() => undefined);
  const error = jest.spyOn(plugin.logger, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'debug').mockImplementation(() => undefined);
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
  return { plugin, saveData, warn, error };
}

describe('loadSettings legacy folders migration', () => {
  beforeEach(() => {
    mockNotices.length = 0;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('migrates legacy folders, saves once without them and tells the user', async () => {
    const { plugin, saveData, warn } = await createPlugin({
      locale: 'en',
      vpsConfigs: [savedVps()],
    });

    await plugin.loadSettings();

    expect(plugin.settings.vpsConfigs[0].routeTree?.roots).toHaveLength(1);
    expect(plugin.settings.vpsConfigs[0].routeTree?.roots[0]).toMatchObject({
      segment: 'blog',
      vaultFolder: 'Blog',
    });
    expect(plugin.settings.vpsConfigs[0]).not.toHaveProperty('folders');
    expect(saveData).toHaveBeenCalledTimes(1);
    expect(saveData.mock.calls[0][0]).toMatchObject({
      vpsConfigs: [{ routeTree: { roots: [{ segment: 'blog' }] } }],
    });
    expect(JSON.stringify(saveData.mock.calls[0][0])).not.toContain('"folders"');
    expect(mockNotices).toEqual([expect.stringContaining('migrated to the new route-based model')]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not save or notify when the VPS already has routes', async () => {
    const { plugin, saveData } = await createPlugin({
      locale: 'en',
      vpsConfigs: [
        savedVps({
          routeTree: { roots: [{ id: 'docs', segment: 'docs', vaultFolder: 'Docs' }] },
        }),
      ],
    });

    await plugin.loadSettings();

    expect(plugin.settings.vpsConfigs[0].routeTree?.roots[0]).toMatchObject({ segment: 'docs' });
    expect(plugin.settings.vpsConfigs[0]).not.toHaveProperty('folders');
    expect(saveData).not.toHaveBeenCalled();
    expect(mockNotices).toEqual([]);
  });

  it('keeps the migration in memory and notifies nobody when the save fails, then migrates again at the next load', async () => {
    const raw = { locale: 'en', vpsConfigs: [savedVps()] };
    const { plugin, saveData, error } = await createPlugin(raw);
    saveData.mockRejectedValue(new Error('disk full'));

    await plugin.loadSettings();

    expect(error).toHaveBeenCalledWith('Failed to save migrated settings', expect.anything());
    expect(mockNotices).toEqual([]);
    expect(plugin.settings.vpsConfigs[0].routeTree?.roots).toHaveLength(1);

    // The raw saved data was not touched: a second load starts from the same legacy shape.
    expect(raw.vpsConfigs[0].folders).toHaveLength(1);
    saveData.mockResolvedValue(undefined);
    await plugin.loadSettings();
    expect(saveData).toHaveBeenCalledTimes(2);
    expect(mockNotices).toEqual([expect.stringContaining('migrated to the new route-based model')]);
  });

  it('warns the user and the log when two folders on "/" conflict', async () => {
    const { plugin, warn } = await createPlugin({
      locale: 'en',
      vpsConfigs: [
        savedVps({ folders: [folder('f1', 'Home', '/'), folder('f2', 'Elsewhere', '/')] }),
      ],
    });

    await plugin.loadSettings();

    expect(plugin.settings.vpsConfigs[0].routeTree?.roots).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('vault folder "Elsewhere" ignored, "Home" kept'),
      { vpsId: 'vps-1' }
    );
    expect(mockNotices).toEqual(
      expect.arrayContaining([expect.stringContaining('reported problems')])
    );
  });

  it('drops VPS entries that are not objects and warns', async () => {
    const { plugin, warn } = await createPlugin({
      locale: 'en',
      vpsConfigs: [null, 'vps', savedVps({ id: 'vps-ok' })],
    });

    await plugin.loadSettings();

    expect(plugin.settings.vpsConfigs.map((vps) => vps.id)).toEqual(['vps-ok']);
    expect(plugin.settings.vpsConfigs[0].routeTree?.roots).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith('Ignoring an unreadable VPS entry in the saved settings', {
      entryType: 'null',
    });
    expect(warn).toHaveBeenCalledWith('Ignoring an unreadable VPS entry in the saved settings', {
      entryType: 'string',
    });
    expect(mockNotices).toEqual(
      expect.arrayContaining([expect.stringContaining('reported problems')])
    );
  });

  it('refuses a migration it cannot read: no save, the folders stay in memory, the user is told', async () => {
    const { plugin, saveData, warn } = await createPlugin({
      locale: 'en',
      vpsConfigs: [savedVps({ folders: [null] })],
    });

    await plugin.loadSettings();

    expect(saveData).not.toHaveBeenCalled();
    expect(plugin.settings.vpsConfigs[0].folders).toEqual([null]);
    expect(plugin.settings.vpsConfigs[0].routeTree).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Legacy folder ignored'),
      expect.anything()
    );
    expect(mockNotices).toEqual([expect.stringContaining('reported problems')]);
  });

  it('still loads when one VPS entry cannot be migrated, and keeps it as saved', async () => {
    // An unexpected failure inside the migration: the warning handler (the logger) throws
    // while the first VPS reports a conflict.
    const broken = savedVps({
      id: 'vps-broken',
      folders: [folder('f1', 'Home', '/'), folder('f2', 'Elsewhere', '/')],
    });
    const { plugin, error, warn } = await createPlugin({
      locale: 'en',
      vpsConfigs: [broken, savedVps({ id: 'vps-ok' })],
    });
    warn.mockImplementation(() => {
      throw new Error('logger down');
    });

    await plugin.loadSettings();

    expect(plugin.settings.vpsConfigs.map((vps) => vps.id)).toEqual(['vps-broken', 'vps-ok']);
    expect(plugin.settings.vpsConfigs[1].routeTree?.roots).toHaveLength(1);
    // The broken entry is kept exactly as saved: nothing is lost.
    expect(plugin.settings.vpsConfigs[0].folders).toEqual(broken.folders);
    expect(plugin.settings.vpsConfigs[0].routeTree).toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      'VPS settings migration failed, entry kept as saved',
      expect.objectContaining({ vpsId: 'vps-broken' })
    );
    expect(mockNotices).toEqual(
      expect.arrayContaining([expect.stringContaining('reported problems')])
    );
  });
});
