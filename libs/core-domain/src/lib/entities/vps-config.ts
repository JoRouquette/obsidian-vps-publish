import type { FolderConfig } from './folder-config';
import type { IgnoreRule } from './ignore-rule';
import type { SanitizationRules, SanitizationRulesDefaults } from './sanitization-rules';

export interface VpsConfig {
  /** Unique identifier for this VPS */
  id: string;

  /** Display name - must be unique across all VPS */
  name: string;

  /** Base URL - must be unique across all VPS */
  baseUrl: string;

  /** API key for authentication */
  apiKey: string;

  /** Ignore rules at VPS level */
  ignoreRules: IgnoreRule[];

  /**
   * Content cleanup/sanitization rules at VPS level.
   * Can contain both default rules (with i18n keys) and custom user rules.
   */
  cleanupRules: (SanitizationRules | SanitizationRulesDefaults)[];

  /** Folders associated with this VPS (minimum 1 required) */
  folders: FolderConfig[];
}

/**
 * Domain invariants for VPS configuration
 */
export class VpsConfigInvariants {
  static validateUniqueName(vpsConfigs: VpsConfig[], name: string, excludeId?: string): void {
    const duplicate = vpsConfigs.find((vps) => vps.name === name && vps.id !== excludeId);
    if (duplicate) {
      throw new Error(`VPS name "${name}" is already used by another VPS`);
    }
  }

  static validateUniqueUrl(vpsConfigs: VpsConfig[], baseUrl: string, excludeId?: string): void {
    const normalized = normalizeUrl(baseUrl);
    const duplicate = vpsConfigs.find(
      (vps) => normalizeUrl(vps.baseUrl) === normalized && vps.id !== excludeId
    );
    if (duplicate) {
      throw new Error(`VPS URL "${baseUrl}" is already used by another VPS`);
    }
  }

  static validateMinimumFolders(vps: VpsConfig): void {
    if (!vps.folders || vps.folders.length === 0) {
      throw new Error(`VPS "${vps.name}" must have at least one folder`);
    }
  }

  static validateMinimumVps(vpsConfigs: VpsConfig[]): void {
    if (!vpsConfigs || vpsConfigs.length === 0) {
      throw new Error('At least one VPS configuration is required');
    }
  }
}

function normalizeUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, '');
}
