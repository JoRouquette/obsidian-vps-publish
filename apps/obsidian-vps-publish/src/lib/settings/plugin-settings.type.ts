import type { PublishPluginSettings } from '@core-domain/entities/publish-plugin-settings';
import type { LoggerPort, LogLevel } from '@core-domain/ports/logger-port';
import type { App } from 'obsidian';

import type { I18nSettings } from '../../i18n';

export type PluginLocale = 'en' | 'fr' | 'system';

export type PluginSettings = PublishPluginSettings &
  I18nSettings & {
    locale?: PluginLocale;
    assetsFolder: string;
    enableAssetsVaultFallback: boolean;
    frontmatterKeysToExclude: string[];
    frontmatterTagsToExclude: string[];
    logLevel: LogLevel;
    calloutStylePaths: string[];
    // Performance tuning (advanced)
    maxConcurrentDataviewNotes?: number;
    maxConcurrentUploads?: number;
    maxConcurrentFileReads?: number;
    // Performance debugging
    enablePerformanceDebug?: boolean; // Enable detailed performance tracing
    enableBackgroundThrottleDebug?: boolean; // Enable background throttling detection (heartbeat + visibility events)
  };

export type SettingsSave = () => Promise<void>;

export type SettingsRefresh = () => void;

export type SettingsContext = {
  app: App;
  settings: PluginSettings;
  save: SettingsSave;
  refresh: SettingsRefresh;
  logger: LoggerPort;
};
