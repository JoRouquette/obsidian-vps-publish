import type { RouteTreeConfig } from './route-node';
/**
 * Route validation error with conflict details
 */
export interface RouteConflict {
    type: 'duplicate-segment' | 'duplicate-path' | 'empty-segment' | 'multiple-root-routes';
    message: string;
    conflictingNodes: {
        id: string;
        segment: string;
        fullPath: string;
    }[];
    path: string;
}
/**
 * Validation result for a route tree
 */
export interface RouteValidationResult {
    valid: boolean;
    conflicts: RouteConflict[];
}
/**
 * Validates a route tree for conflicts and duplicates
 */
export declare function validateRouteTree(routeTree: RouteTreeConfig): RouteValidationResult;
/**
 * Get conflicts for a specific node by its ID
 */
export declare function getNodeConflicts(routeTree: RouteTreeConfig, nodeId: string): RouteConflict[];
/**
 * Check if a specific node has conflicts
 */
export declare function hasNodeConflicts(routeTree: RouteTreeConfig, nodeId: string): boolean;
//# sourceMappingURL=route-node-validation.d.ts.map