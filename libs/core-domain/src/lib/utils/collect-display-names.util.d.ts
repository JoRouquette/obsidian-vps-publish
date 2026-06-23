import type { RouteTreeConfig } from '../entities/route-node';
/**
 * Collect all displayNames from a route tree into a Record<string, string>
 * where the key is the full route path and the value is the displayName
 *
 * @param routeTree Route tree configuration
 * @returns Record of route paths to display names
 */
export declare function collectDisplayNamesFromRouteTree(routeTree: RouteTreeConfig): Record<string, string>;
//# sourceMappingURL=collect-display-names.util.d.ts.map