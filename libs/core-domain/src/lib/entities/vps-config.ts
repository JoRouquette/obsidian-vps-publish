import type { IgnoreRule } from './ignore-rule';
import type { RouteTreeConfig } from './route-node';
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

  /**
   * Route tree configuration (route-first model)
   *
   * Replaces the legacy `folders` and `customIndexes` fields, which are only
   * read once, at load, by the migration (see `LegacyVpsConfig`).
   */
  routeTree?: RouteTreeConfig;

  /**
   * Optional custom root index file path (relative to vault root).
   * This file's content will be used as the root index page (/).
   */
  customRootIndexFile?: string;

  /**
   * Display-only: sort the route tree alphabetically instead of honouring the
   * stored order.
   *
   * Sibling order carries **no functional meaning** — the domain only ever
   * traverses the tree, and routes are addressed by their segments. This is a
   * reading comfort, not a publishing behaviour.
   *
   * Defaults to `true`, which matches how root routes were already displayed.
   * Turn it off to control the order by hand, which is what the drag handle and
   * the move buttons then actually do.
   */
  sortRoutesAlphabetically?: boolean;
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
    const hasRoutes = vps.routeTree && vps.routeTree.roots && vps.routeTree.roots.length > 0;

    if (!hasRoutes) {
      throw new Error(`VPS "${vps.name}" must have at least one route`);
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
