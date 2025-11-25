import type { PublishPluginSettings } from '../domain/PublishPluginSettings';

export interface SettingsExportPort {
  /**
   * Export a snapshot of the current plugin settings.
   * The implementation decides where and how (file, HTTP, etc.).
   */
  exportSettings(settings: PublishPluginSettings): Promise<void>;
}
