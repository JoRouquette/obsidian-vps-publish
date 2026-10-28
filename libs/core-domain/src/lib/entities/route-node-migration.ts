import type { CustomIndexConfig } from './custom-index-config';
import type { FolderConfig } from './folder-config';
import type { RouteNode, RouteTreeConfig } from './route-node';
import { validateRouteTree } from './route-node-validation';
import type { VpsConfig } from './vps-config';

/** Receives a human-readable message for each problem the migration meets. */
export type MigrationWarningHandler = (message: string) => void;

/**
 * Migration utility: convert legacy FolderConfig[] to RouteTreeConfig
 *
 * BREAKING CHANGE: This function transforms the old "folder-first" model
 * into the new "route-first" model.
 *
 * Strategy:
 * - Each FolderConfig becomes a RouteNode
 * - routeBase is parsed into route segments to build tree structure
 * - IDs are preserved when possible for stability
 * - Folder properties (vaultFolder, flattenTree, etc.) are attached to nodes
 *
 * @param legacyFolders - Old FolderConfig[] array
 * @param onWarning - Called when two folders on the same route cannot both be kept
 * @returns New RouteTreeConfig
 */
export function migrateLegacyFoldersToRouteTree(
  legacyFolders: FolderConfig[],
  onWarning?: MigrationWarningHandler
): RouteTreeConfig {
  const roots: RouteNode[] = [];
  const nodeMap = new Map<string, RouteNode>(); // path -> node ('' for the root route "/")
  const folderNodes = new Set<RouteNode>(); // nodes already carrying a legacy folder

  for (const folder of legacyFolders) {
    const routePath = normalizeRoutePath(folder.routeBase);
    // Segments are trimmed so " a" and "a" are one route, as the route validation sees them.
    const segments = routePath
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (segments.length === 0) {
      // Root route: "/". Only one root route is valid, later folders merge into it.
      const existingRoot = nodeMap.get('');
      if (existingRoot) {
        mergeFolderIntoNode(existingRoot, folder, folderNodes, '/', onWarning);
      } else {
        const rootNode = createFolderNode(folder, '');
        folderNodes.add(rootNode);
        roots.push(rootNode);
        nodeMap.set('', rootNode);
      }
    } else {
      // Build nested structure
      let currentPath = '';
      let parentNode: RouteNode | null = null;

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const isLeaf = i === segments.length - 1;
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;

        let node = nodeMap.get(currentPath);

        if (!node) {
          if (isLeaf) {
            node = createFolderNode(folder, segment);
            folderNodes.add(node);
          } else {
            // Intermediate (pure route) node
            node = {
              id: `route-${currentPath.replace(/\//g, '-')}`,
              segment,
              ignoredCleanupRuleIds: [],
              children: [],
            };
          }

          nodeMap.set(currentPath, node);

          // Attach to parent or roots
          if (parentNode) {
            parentNode.children = parentNode.children || [];
            parentNode.children.push(node);
          } else {
            roots.push(node);
          }
        } else if (isLeaf) {
          // Node already exists: created as an intermediate node for a deeper
          // folder (e.g. "/a" after "/a/b"), or by another folder on the same route.
          mergeFolderIntoNode(node, folder, folderNodes, `/${currentPath}`, onWarning);
        }

        parentNode = node;
      }
    }
  }

  return { roots };
}

function createFolderNode(folder: FolderConfig, segment: string): RouteNode {
  return {
    id: folder.id, // Preserve original ID
    segment,
    vaultFolder: folder.vaultFolder,
    customIndexFile: folder.customIndexFile,
    additionalFiles: folder.additionalFiles,
    flattenTree: folder.flattenTree,
    ignoredCleanupRuleIds: folder.ignoredCleanupRuleIds,
    children: [],
  };
}

/**
 * Attach a legacy folder to an existing node without losing anything already set.
 *
 * - An intermediate node takes the folder ID, as a leaf created for it would.
 * - Values already set on the node win (first folder wins on a real conflict);
 *   an empty or missing value never overwrites a set one.
 * - List values are merged without duplicates.
 */
function mergeFolderIntoNode(
  node: RouteNode,
  folder: FolderConfig,
  folderNodes: Set<RouteNode>,
  routePath: string,
  onWarning?: MigrationWarningHandler
): void {
  if (!folderNodes.has(node)) {
    node.id = folder.id;
    folderNodes.add(node);
  }

  // A real conflict loses the second value: say so instead of dropping it silently.
  if (node.vaultFolder && folder.vaultFolder && node.vaultFolder !== folder.vaultFolder) {
    onWarning?.(
      `Route "${routePath}": vault folder "${folder.vaultFolder}" ignored, "${node.vaultFolder}" kept`
    );
  }
  if (
    node.customIndexFile &&
    folder.customIndexFile &&
    node.customIndexFile !== folder.customIndexFile
  ) {
    onWarning?.(
      `Route "${routePath}": custom index "${folder.customIndexFile}" ignored, "${node.customIndexFile}" kept`
    );
  }

  node.vaultFolder = node.vaultFolder || folder.vaultFolder;
  node.customIndexFile = node.customIndexFile || folder.customIndexFile;
  node.flattenTree = node.flattenTree ?? folder.flattenTree;
  node.additionalFiles = mergeUnique(node.additionalFiles, folder.additionalFiles);
  node.ignoredCleanupRuleIds = mergeUnique(
    node.ignoredCleanupRuleIds,
    folder.ignoredCleanupRuleIds
  );
}

function mergeUnique(first?: string[], second?: string[]): string[] | undefined {
  if (!first && !second) return undefined;
  return Array.from(new Set([...(first ?? []), ...(second ?? [])]));
}

/**
 * Migration-only shape of a VPS as saved before the route-first model.
 * The legacy fields are not part of the public `VpsConfig` anymore; they are
 * only read once from the raw saved settings to build the route tree.
 */
export interface LegacyVpsConfig extends VpsConfig {
  /** Legacy folder configuration (folder-first model) */
  folders?: FolderConfig[];

  /** Legacy custom indexes, moved to `RouteNode.customIndexFile` */
  customIndexes?: CustomIndexConfig[];
}

export interface LegacyVpsMigrationResult {
  /** VPS without legacy fields */
  vps: VpsConfig;

  /** True when legacy folders were converted to a new route tree */
  migrated: boolean;
}

/**
 * One-time migration of a saved VPS: legacy `folders` (and `customIndexes`)
 * become a `routeTree` when the VPS has none. An existing `routeTree` is kept
 * as is. Legacy fields are always dropped from the result.
 *
 * The saved data is not trusted: a malformed `folders` or `customIndexes` entry is skipped
 * and reported, never thrown. A migrated tree that fails the route validation is not
 * adopted: the VPS is returned unchanged, legacy fields included, so nothing is lost and
 * the migration runs again at the next load.
 *
 * A route tree that holds only the empty default root counts as absent, so legacy folders
 * saved next to it are still migrated.
 *
 * @param legacyVps - VPS as read from the raw saved settings
 * @param onWarning - Called for each problem met (skipped entry, dropped value, invalid tree)
 */
export function migrateLegacyVpsConfig(
  legacyVps: LegacyVpsConfig,
  onWarning?: MigrationWarningHandler
): LegacyVpsMigrationResult {
  const { folders, customIndexes, ...vps } = legacyVps;

  if (hasMeaningfulRoutes(vps.routeTree) || !Array.isArray(folders) || folders.length === 0) {
    return { vps, migrated: false };
  }

  const validFolders = folders.filter((folder): folder is FolderConfig => {
    const valid =
      typeof folder === 'object' &&
      folder !== null &&
      (folder.routeBase === undefined || typeof folder.routeBase === 'string');
    if (!valid) {
      onWarning?.(`Legacy folder ignored: unreadable entry ${JSON.stringify(folder)}`);
    }
    return valid;
  });
  if (validFolders.length === 0) {
    return { vps: legacyVps, migrated: false };
  }

  const routeTree = migrateLegacyFoldersToRouteTree(validFolders, onWarning);

  const validation = validateRouteTree(routeTree);
  if (!validation.valid) {
    onWarning?.(
      `Legacy folders not migrated, the resulting routes are invalid: ${validation.conflicts
        .map((conflict) => conflict.message)
        .join('; ')}`
    );
    return { vps: legacyVps, migrated: false };
  }

  if (Array.isArray(customIndexes) && customIndexes.length > 0) {
    const validIndexes = customIndexes.filter(
      (index) => typeof index?.folderPath === 'string' && typeof index?.indexFilePath === 'string'
    );
    if (validIndexes.length !== customIndexes.length) {
      onWarning?.('Some legacy custom indexes are unreadable and were ignored');
    }
    for (const unmatched of applyCustomIndexesToRouteTree(routeTree, validIndexes)) {
      onWarning?.(`Legacy custom index for "${unmatched}" matches no route and was ignored`);
    }
  }

  return { vps: { ...vps, routeTree }, migrated: true };
}

/**
 * True when the tree holds something a user configured: a vault folder, a custom index, a
 * named route or a child. The empty default root ("/") created for a new VPS does not count.
 */
function hasMeaningfulRoutes(routeTree: RouteTreeConfig | undefined): boolean {
  const roots = routeTree?.roots;
  if (!Array.isArray(roots)) return false;
  return roots.some(
    (root) =>
      Boolean(root?.segment) ||
      Boolean(root?.vaultFolder) ||
      Boolean(root?.customIndexFile) ||
      (root?.children?.length ?? 0) > 0
  );
}

/**
 * Reverse migration: convert RouteTreeConfig to FolderConfig[]
 * Useful for temporary backward compatibility or export
 *
 * @param routeTree - New RouteTreeConfig
 * @param vpsId - VPS ID to assign to generated FolderConfig items
 * @returns Legacy FolderConfig[]
 */
export function migrateRouteTreeToLegacyFolders(
  routeTree: RouteTreeConfig,
  vpsId: string
): FolderConfig[] {
  const folders: FolderConfig[] = [];

  const traverse = (node: RouteNode, pathSegments: string[]) => {
    const currentSegments = [...pathSegments, node.segment].filter(Boolean);

    // Only generate FolderConfig if this node has a vaultFolder attached
    if (node.vaultFolder) {
      const routeBase = currentSegments.length > 0 ? `/${currentSegments.join('/')}` : '/';

      folders.push({
        id: node.id,
        vpsId,
        vaultFolder: node.vaultFolder,
        routeBase,
        displayName: node.displayName, // Propagate displayName from RouteNode
        ignoredCleanupRuleIds: node.ignoredCleanupRuleIds || [],
        customIndexFile: node.customIndexFile,
        flattenTree: node.flattenTree,
        additionalFiles: node.additionalFiles,
      });
    }

    // Traverse children
    if (node.children) {
      for (const child of node.children) {
        traverse(child, currentSegments);
      }
    }
  };

  for (const root of routeTree.roots) {
    traverse(root, []);
  }

  return folders;
}

/**
 * Normalize route path for consistent parsing
 * - Ensures leading slash
 * - Removes trailing slash
 * - Trims whitespace
 */
function normalizeRoutePath(routePath: string | undefined): string {
  if (typeof routePath !== 'string' || !routePath) return '';
  let normalized = routePath.trim();
  if (!normalized.startsWith('/')) normalized = '/' + normalized;
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Apply custom indexes from LegacyVpsConfig.customIndexes to route tree
 * Migrates legacy customIndexes array to per-node customIndexFile
 *
 * @param routeTree - Route tree to update
 * @param customIndexes - Legacy custom indexes array from LegacyVpsConfig
 * @returns Normalized folder paths of the custom indexes that matched no route
 */
export function applyCustomIndexesToRouteTree(
  routeTree: RouteTreeConfig,
  customIndexes: { folderPath: string; indexFilePath: string }[]
): string[] {
  if (!customIndexes || customIndexes.length === 0) return [];

  // Build a map of folderPath (normalized) -> indexFilePath
  const indexMap = new Map<string, string>();
  for (const config of customIndexes) {
    const normalizedPath = normalizeRoutePath(config.folderPath);
    indexMap.set(normalizedPath, config.indexFilePath);
  }

  const applied = new Set<string>();

  // Traverse tree and apply customIndexFile to matching nodes
  const applyToNode = (node: RouteNode, currentPath: string) => {
    const nodePath = currentPath ? `${currentPath}/${node.segment}` : `/${node.segment}`;
    const normalizedNodePath = normalizeRoutePath(nodePath);

    // Check if this node matches a custom index config
    if (indexMap.has(normalizedNodePath)) {
      node.customIndexFile = indexMap.get(normalizedNodePath);
      applied.add(normalizedNodePath);
    }

    // Recursively apply to children
    if (node.children) {
      for (const child of node.children) {
        applyToNode(child, normalizedNodePath);
      }
    }
  };

  // Apply to all roots
  for (const root of routeTree.roots) {
    // Root node check (empty segment = "/")
    const rootPath = root.segment === '' ? '/' : `/${root.segment}`;
    const normalizedRootPath = normalizeRoutePath(rootPath);

    if (indexMap.has(normalizedRootPath)) {
      root.customIndexFile = indexMap.get(normalizedRootPath);
      applied.add(normalizedRootPath);
    }

    // Process children
    if (root.children) {
      for (const child of root.children) {
        applyToNode(child, normalizedRootPath);
      }
    }
  }

  // Paths that matched no route: the caller decides how to report them.
  return Array.from(indexMap.keys()).filter((path) => !applied.has(path));
}
