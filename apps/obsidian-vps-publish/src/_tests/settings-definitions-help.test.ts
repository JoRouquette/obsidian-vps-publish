import type { SettingDefinitionItem } from 'obsidian';

import type { SettingsViewContext } from '../lib/settings/context';

const mockHelpModalOpen = jest.fn();
const mockHelpModalConstructor = jest.fn();

jest.mock('../lib/settings/section-page', () => ({ SectionPage: class {} }));
jest.mock('../lib/settings/sections/advanced-section', () => ({
  renderAdvancedContent: jest.fn(),
}));
jest.mock('../lib/settings/sections/ignore-rules-section', () => ({
  renderGlobalIgnoreRules: jest.fn(),
  renderVpsIgnoreRules: jest.fn(),
}));
jest.mock('../lib/settings/sections/routes-section', () => ({
  hasUnsavedRouteChanges: jest.fn(),
  renderVpsRoutes: jest.fn(),
}));
jest.mock('../lib/settings/sections/vps-section', () => ({
  addVpsConfig: jest.fn(),
  renderCleanupRulesSection: jest.fn(),
  renderVpsDetails: jest.fn(),
}));

async function loadHelpAction(helpModalModule: () => unknown): Promise<{
  action: () => void;
  logger: { error: jest.Mock; debug: jest.Mock };
  ctx: SettingsViewContext;
  t: unknown;
}> {
  jest.resetModules();
  jest.doMock('../lib/modals/help-modal', helpModalModule);

  const { buildSettingDefinitions } = await import('../lib/settings/definitions');
  const { getTranslations } = await import('../i18n');
  const { t } = getTranslations({} as never, { locale: 'en' } as never);
  const logger = { error: jest.fn(), debug: jest.fn() };
  const ctx = {
    app: {},
    t,
    settings: { vpsConfigs: [] },
    logger,
  } as unknown as SettingsViewContext;

  const helpItem: SettingDefinitionItem | undefined = buildSettingDefinitions(ctx).find(
    (item) => 'name' in item && item.name === t.help.settingsButtonLabel
  );
  if (!helpItem || !('action' in helpItem) || typeof helpItem.action !== 'function') {
    throw new Error('help button definition not found');
  }
  const { action } = helpItem;
  const element: HTMLElement = Object.create(null);
  return { action: () => action(element, 0), logger, ctx, t };
}

describe('settings definitions help button', () => {
  beforeEach(() => {
    mockHelpModalOpen.mockReset();
    mockHelpModalConstructor.mockReset();
  });

  it('opens the help modal after the lazy import resolves', async () => {
    const { action, ctx, t } = await loadHelpAction(() => ({
      HelpModal: class {
        constructor(...args: unknown[]) {
          mockHelpModalConstructor(...args);
        }
        open() {
          mockHelpModalOpen();
        }
      },
    }));

    action();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockHelpModalConstructor).toHaveBeenCalledTimes(1);
    expect(mockHelpModalConstructor.mock.calls[0][0]).toBe(ctx.app);
    expect(mockHelpModalConstructor.mock.calls[0][1]).toBe(t);
    expect(mockHelpModalOpen).toHaveBeenCalledTimes(1);
  });

  it('logs the error and does not throw when the lazy import rejects', async () => {
    const failure = new Error('chunk missing');
    const { action, logger } = await loadHelpAction(() => {
      throw failure;
    });

    expect(() => action()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockHelpModalOpen).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('Failed to open the help modal', { error: failure });
  });
});
