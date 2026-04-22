import type { VpsConfig } from './vps-config';

export interface PublishPluginSettings {
  /**
   * List of VPS configurations (minimum 1 required)
   * Each VPS has its own folders, ignore rules, and cleanup rules
   */
  vpsConfigs: VpsConfig[];
}
