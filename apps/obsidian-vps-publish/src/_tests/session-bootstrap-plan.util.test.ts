import type { VpsConfig } from '@core-domain';
import { LogLevel } from '@core-domain/ports/logger-port';

import type { PluginSettings } from '../lib/settings/plugin-settings.type';
import {
  prepareSessionBootstrapPlan,
  startSessionBootstrapEarly,
} from '../lib/utils/session-bootstrap-plan.util';

describe('prepareSessionBootstrapPlan', () => {
  const baseSettings: PluginSettings = {
    vpsConfigs: [],
    locale: 'system',
    assetsFolder: 'assets',
    enableAssetsVaultFallback: true,
    frontmatterKeysToExclude: [],
    frontmatterTagsToExclude: ['private'],
    logLevel: LogLevel.info,
    calloutStylePaths: ['styles/callouts.css'],
    maxConcurrentDataviewNotes: 5,
    maxConcurrentUploads: 3,
    maxConcurrentFileReads: 5,
    enablePerformanceDebug: false,
    enableBackgroundThrottleDebug: false,
  };

  function createVps(overrides: Partial<VpsConfig> = {}): VpsConfig {
    return {
      id: 'vps-1',
      name: 'Test VPS',
      baseUrl: 'https://example.com',
      apiKey: 'secret',
      routeTree: undefined,
      folders: [
        {
          id: 'folder-1',
          vaultFolder: 'notes',
          routeBase: '/notes',
          vpsId: 'vps-1',
          ignoredCleanupRuleIds: [],
          customIndexFile: 'notes/_index.md',
        },
      ],
      customRootIndexFile: '_index.md',
      cleanupRules: [
        {
          id: 'enabled',
          name: 'Enabled rule',
          regex: 'foo',
          replacement: 'bar',
          isEnabled: true,
        },
        {
          id: 'disabled',
          name: 'Disabled rule',
          regex: 'baz',
          replacement: 'qux',
          isEnabled: false,
        },
      ],
      ignoreRules: [],
      ...overrides,
    } as VpsConfig;
  }

  it('starts loading callout styles immediately and prepares static session metadata', async () => {
    let resolveStyles: ((styles: Array<{ path: string; css: string }>) => void) | undefined;

    const loadCalloutStyles = jest.fn(
      () =>
        new Promise<Array<{ path: string; css: string }>>((resolve) => {
          resolveStyles = resolve;
        })
    );
    const computePipelineSignature = jest
      .fn()
      .mockResolvedValue({ version: '1.0.0', renderSettingsHash: 'hash-1' });

    const plan = prepareSessionBootstrapPlan({
      vps: createVps(),
      settings: baseSettings,
      manifestVersion: '1.0.0',
      generateGuid: (() => {
        let current = 0;
        return () => `guid-${++current}`;
      })(),
      loadCalloutStyles,
      computePipelineSignature,
    });

    expect(loadCalloutStyles).toHaveBeenCalledWith(['styles/callouts.css']);
    expect(plan.customIndexConfigs).toEqual([
      {
        id: 'guid-1',
        folderPath: '',
        indexFilePath: '_index.md',
        isRootIndex: true,
      },
      {
        id: 'guid-2',
        folderPath: '/notes',
        indexFilePath: 'notes/_index.md',
      },
    ]);
    expect(plan.validCleanupRules).toHaveLength(1);

    resolveStyles?.([{ path: 'styles/callouts.css', css: '.callout { color: red; }' }]);

    const pipelineResult = await plan.pipelineSignaturePromise;

    expect(computePipelineSignature).toHaveBeenCalledWith(
      '1.0.0',
      expect.objectContaining({
        calloutStyles: { 'styles/callouts.css': '.callout { color: red; }' },
        cleanupRules: [
          {
            id: 'enabled',
            isEnabled: true,
            regex: 'foo',
            replace: 'bar',
          },
        ],
        ignoredTags: ['private'],
      })
    );
    expect(pipelineResult.calloutStyles).toEqual([
      { path: 'styles/callouts.css', css: '.callout { color: red; }' },
    ]);
    expect(pipelineResult.pipelineSignature.renderSettingsHash).toBe('hash-1');
  });

  it('propagates bootstrap failures through the pipeline signature promise', async () => {
    const loadCalloutStyles = jest.fn(async () => {
      throw new Error('style read failed');
    });

    const plan = prepareSessionBootstrapPlan({
      vps: createVps(),
      settings: baseSettings,
      manifestVersion: '1.0.0',
      generateGuid: () => 'guid-1',
      loadCalloutStyles,
      computePipelineSignature: jest.fn(),
    });

    await expect(plan.calloutStylesPromise).rejects.toThrow('style read failed');
    await expect(plan.pipelineSignaturePromise).rejects.toThrow('style read failed');
  });

  it('starts the session request as soon as bootstrap inputs are ready without awaiting later work', async () => {
    let resolveStyles: ((styles: Array<{ path: string; css: string }>) => void) | undefined;
    const events: string[] = [];

    const plan = prepareSessionBootstrapPlan({
      vps: createVps(),
      settings: baseSettings,
      manifestVersion: '1.0.0',
      generateGuid: () => 'guid-1',
      loadCalloutStyles: jest.fn(
        () =>
          new Promise<Array<{ path: string; css: string }>>((resolve) => {
            resolveStyles = resolve;
          })
      ),
      computePipelineSignature: jest
        .fn()
        .mockResolvedValue({ version: '1.0.0', renderSettingsHash: 'hash-1' }),
    });

    const startSession = jest.fn(async () => {
      events.push('startSession-called');
      return { sessionId: 'session-1', maxBytesPerRequest: 1024 };
    });

    const startedPromise = startSessionBootstrapEarly({
      sessionBootstrapPlan: plan,
      notesPlanned: 0,
      assetsPlanned: 0,
      maxBytesPerRequest: 1024,
      ignoreRules: [],
      ignoredTags: ['private'],
      locale: 'en',
      deduplicationEnabled: true,
      startSession,
      onBeforeStartSession: () => {
        events.push('before-startSession');
      },
      onAfterStartSession: () => {
        events.push('after-startSession');
      },
    });

    expect(startSession).not.toHaveBeenCalled();

    resolveStyles?.([{ path: 'styles/callouts.css', css: '.callout { color: red; }' }]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(startSession).toHaveBeenCalledWith(
      expect.objectContaining({
        notesPlanned: 0,
        assetsPlanned: 0,
        maxBytesPerRequest: 1024,
        ignoredTags: ['private'],
      })
    );
    expect(events).toEqual(['before-startSession', 'startSession-called', 'after-startSession']);

    const started = await startedPromise;
    expect(started.startedSession).toEqual({
      sessionId: 'session-1',
      maxBytesPerRequest: 1024,
    });
  });

  it('propagates early session start failures', async () => {
    const plan = prepareSessionBootstrapPlan({
      vps: createVps(),
      settings: baseSettings,
      manifestVersion: '1.0.0',
      generateGuid: () => 'guid-1',
      loadCalloutStyles: jest
        .fn()
        .mockResolvedValue([{ path: 'styles/callouts.css', css: '.callout { color: red; }' }]),
      computePipelineSignature: jest
        .fn()
        .mockResolvedValue({ version: '1.0.0', renderSettingsHash: 'hash-1' }),
    });

    const startedPromise = startSessionBootstrapEarly({
      sessionBootstrapPlan: plan,
      notesPlanned: 0,
      assetsPlanned: 0,
      maxBytesPerRequest: 1024,
      ignoreRules: [],
      ignoredTags: [],
      deduplicationEnabled: true,
      startSession: jest.fn(async () => {
        throw new Error('session start failed');
      }),
    });

    await expect(startedPromise).rejects.toThrow('session start failed');
  });
});
