import type { DataviewApi } from '../dataview/dataview-executor';

interface SettingsApi {
  open(): void;
  openTabById(id: string): void;
}

interface AppWithSettingsCapability {
  setting?: Partial<SettingsApi>;
}

interface PluginManifestLike {
  version?: string;
}

interface DataviewPluginLike {
  api?: DataviewApi;
  manifest?: PluginManifestLike;
}

interface PluginRegistryLike {
  plugins?: Record<string, unknown>;
}

interface AppWithPluginRegistry {
  plugins?: PluginRegistryLike;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getSettingsApi(app: unknown): SettingsApi | null {
  if (!isRecord(app)) return null;

  const candidate = (app as AppWithSettingsCapability).setting;
  if (
    candidate &&
    typeof candidate.open === 'function' &&
    typeof candidate.openTabById === 'function'
  ) {
    return candidate as SettingsApi;
  }

  return null;
}

export function getDataviewPlugin(app: unknown): DataviewPluginLike | null {
  if (!isRecord(app)) return null;

  const registry = (app as AppWithPluginRegistry).plugins?.plugins;
  if (!registry) return null;

  const plugin = registry['dataview'];
  return isRecord(plugin) ? (plugin as DataviewPluginLike) : null;
}
