import {
  collectDisplayNamesFromRouteTree,
  type CustomIndexConfig,
  type IgnoreRule,
  type SiteLocale,
  type VpsConfig,
} from '@core-domain';

import type { PluginSettings } from '../settings/plugin-settings.type';
import { getEffectiveFolders } from './get-effective-folders.util';

type CalloutStyle = { path: string; css: string };
type CleanupRule = NonNullable<VpsConfig['cleanupRules']>[number];

export interface TimedResult<T> {
  value: T;
  durationMs: number;
}

export interface SessionBootstrapPlan {
  effectiveFolders: ReturnType<typeof getEffectiveFolders>;
  customIndexConfigs: CustomIndexConfig[];
  folderDisplayNames: Record<string, string>;
  validCleanupRules: CleanupRule[];
  calloutStylesPromise: Promise<TimedResult<CalloutStyle[]>>;
  pipelineSignaturePromise: Promise<{
    calloutStyles: CalloutStyle[];
    pipelineSignature: { version: string; renderSettingsHash: string };
  }>;
}

export interface StartedSessionBootstrap<TStartedSession> {
  startedSession: TStartedSession;
  calloutStyles: CalloutStyle[];
  pipelineSignature: { version: string; renderSettingsHash: string };
  calloutStyleLoadingDurationMs: number;
}

export function prepareSessionBootstrapPlan(args: {
  vps: VpsConfig;
  settings: PluginSettings;
  manifestVersion: string;
  generateGuid: () => string;
  loadCalloutStyles: (paths: string[]) => Promise<CalloutStyle[]>;
  computePipelineSignature: (
    version: string,
    renderSettings: {
      calloutStyles: Record<string, string>;
      cleanupRules: Array<{ id: string; isEnabled: boolean; regex: string; replace: string }>;
      ignoredTags: string[];
    }
  ) => Promise<{ version: string; renderSettingsHash: string }>;
}): SessionBootstrapPlan {
  const effectiveFolders = getEffectiveFolders(args.vps);

  const customIndexConfigs: CustomIndexConfig[] = [];

  if (args.vps.customRootIndexFile) {
    customIndexConfigs.push({
      id: args.generateGuid(),
      folderPath: '',
      indexFilePath: args.vps.customRootIndexFile,
      isRootIndex: true,
    });
  }

  for (const folder of effectiveFolders) {
    if (folder.customIndexFile) {
      customIndexConfigs.push({
        id: args.generateGuid(),
        folderPath: folder.routeBase,
        indexFilePath: folder.customIndexFile,
      });
    }
  }

  const folderDisplayNames = args.vps.routeTree
    ? collectDisplayNamesFromRouteTree(args.vps.routeTree)
    : {};

  const validCleanupRules = (args.vps.cleanupRules ?? []).filter(
    (rule) => rule.isEnabled && rule.regex && rule.regex.trim().length > 0
  );

  const calloutStylesPromise = timeAsync(() =>
    args.loadCalloutStyles(args.settings.calloutStylePaths ?? [])
  );

  const pipelineSignaturePromise = (async () => {
    const { value: calloutStyles } = await calloutStylesPromise;

    const calloutStylesRecord: Record<string, string> = calloutStyles.reduce(
      (acc, { path, css }) => {
        acc[path] = css;
        return acc;
      },
      {} as Record<string, string>
    );

    const transformedCleanupRules = validCleanupRules.map((rule) => ({
      id: rule.id,
      isEnabled: rule.isEnabled,
      regex: rule.regex,
      replace: rule.replacement,
    }));

    const pipelineSignature = await args.computePipelineSignature(args.manifestVersion, {
      calloutStyles: calloutStylesRecord,
      cleanupRules: transformedCleanupRules,
      ignoredTags: args.settings.frontmatterTagsToExclude || [],
    });

    return {
      calloutStyles,
      pipelineSignature,
    };
  })();

  return {
    effectiveFolders,
    customIndexConfigs,
    folderDisplayNames,
    validCleanupRules,
    calloutStylesPromise,
    pipelineSignaturePromise,
  };
}

export function startSessionBootstrapEarly<TStartedSession>(args: {
  sessionBootstrapPlan: SessionBootstrapPlan;
  notesPlanned: number;
  assetsPlanned: number;
  maxBytesPerRequest: number;
  ignoreRules: IgnoreRule[];
  ignoredTags: string[];
  locale?: SiteLocale;
  deduplicationEnabled: boolean;
  startSession: (payload: {
    notesPlanned: number;
    assetsPlanned: number;
    maxBytesPerRequest: number;
    calloutStyles?: { path: string; css: string }[];
    customIndexConfigs?: CustomIndexConfig[];
    ignoreRules?: IgnoreRule[];
    ignoredTags?: string[];
    folderDisplayNames?: Record<string, string>;
    pipelineSignature?: { version: string; renderSettingsHash: string };
    locale?: SiteLocale;
    deduplicationEnabled?: boolean;
  }) => Promise<TStartedSession>;
  onCalloutStylesLoaded?: (result: TimedResult<CalloutStyle[]>) => void;
  onBeforeStartSession?: () => void;
  onAfterStartSession?: (startedSession: TStartedSession) => void;
}): Promise<StartedSessionBootstrap<TStartedSession>> {
  return (async () => {
    const [calloutStyleResult, { calloutStyles, pipelineSignature }] = await Promise.all([
      args.sessionBootstrapPlan.calloutStylesPromise,
      args.sessionBootstrapPlan.pipelineSignaturePromise,
    ]);

    args.onCalloutStylesLoaded?.(calloutStyleResult);
    args.onBeforeStartSession?.();

    const startedSession = await args.startSession({
      notesPlanned: args.notesPlanned,
      assetsPlanned: args.assetsPlanned,
      maxBytesPerRequest: args.maxBytesPerRequest,
      calloutStyles,
      customIndexConfigs: args.sessionBootstrapPlan.customIndexConfigs,
      ignoreRules: args.ignoreRules,
      ignoredTags: args.ignoredTags,
      folderDisplayNames: args.sessionBootstrapPlan.folderDisplayNames,
      pipelineSignature,
      locale: args.locale,
      deduplicationEnabled: args.deduplicationEnabled,
    });

    args.onAfterStartSession?.(startedSession);

    return {
      startedSession,
      calloutStyles,
      pipelineSignature,
      calloutStyleLoadingDurationMs: calloutStyleResult.durationMs,
    };
  })();
}

async function timeAsync<T>(operation: () => Promise<T>): Promise<TimedResult<T>> {
  const start = performance.now();
  const value = await operation();
  return {
    value,
    durationMs: performance.now() - start,
  };
}
