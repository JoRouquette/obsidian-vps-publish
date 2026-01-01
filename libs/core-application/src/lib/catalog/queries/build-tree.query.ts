import type { Manifest } from '@core-domain';

import { type QueryHandler } from '../../common/query-handler';

export type NodeKind = 'folder' | 'file';

export interface TreeNode {
  kind: NodeKind;
  name: string;
  label: string;
  path: string;
  count: number;
  route?: string;
  tags?: string[];
  children?: TreeNode[];
  /**
   * Optional display name from route configuration
   * Takes precedence over label for folder names
   */
  displayName?: string;
}

export const defaultTreeNode: TreeNode = {
  kind: 'folder',
  name: '',
  label: '',
  path: '',
  count: 0,
};

export class BuildTreeHandler implements QueryHandler<Manifest, TreeNode> {
  async handle(manifest: Manifest): Promise<TreeNode> {
    const root: TreeNode = this.folder('', '', '');

    // Filter out custom index pages from the tree
    const regularPages = manifest.pages.filter((page) => !page.isCustomIndex);

    // Use folder display names from manifest (preserves accents like "Trésors", "Panthéon")
    const folderDisplayNames = this.buildFolderDisplayNameMap(manifest);

    for (const page of regularPages) {
      this.processPage(page, root, folderDisplayNames);
    }

    this.sortRec(root);

    return root;
  }

  private buildFolderDisplayNameMap(manifest: Manifest): Map<string, string> {
    const map = new Map<string, string>();

    // Use manifest.folderDisplayNames directly (populated by plugin route tree config)
    if (manifest.folderDisplayNames) {
      for (const [routePath, displayName] of Object.entries(manifest.folderDisplayNames)) {
        // Remove leading slash for consistency with route processing
        const normalizedPath = routePath.replace(/^\/+/, '');
        map.set(normalizedPath, displayName);
      }
    }

    // Also extract from pages for backward compatibility (when pages have folderDisplayName)
    for (const page of manifest.pages) {
      if (!page.folderDisplayName || !page.route) continue;

      const segments = page.route.split('/').filter(Boolean);
      if (segments.length === 0) continue;

      // The folderDisplayName corresponds to the parent folder (all segments except last)
      const folderPath = segments.slice(0, -1).join('/');
      if (folderPath && !map.has(folderPath)) {
        map.set(folderPath, page.folderDisplayName);
      }
    }

    return map;
  }

  private processPage(
    page: Manifest['pages'][number],
    root: TreeNode,
    folderDisplayNames: Map<string, string>
  ): void {
    const segments = page.route.replace(/^\/+/, '').split('/').filter(Boolean);
    if (segments.length === 0) return;

    let current = root;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const atLeaf = i === segments.length - 1;

      if (atLeaf) {
        const fileNode: TreeNode = {
          kind: 'file',
          name: segment,
          label: page.title?.trim() || this.pretty(segment),
          path: (current.path ? current.path + '/' : '') + segment,
          route: page.route,
          tags: page.tags ?? [],
          count: 1,
        };

        current.children = current.children ?? [];
        if (!current.children.some((c) => c.kind === 'file' && c.name === segment)) {
          current.children.push(fileNode);
        }
        current.count++;
      } else {
        // Build the cumulative folder path for this segment to look up displayName
        const folderPath = segments.slice(0, i + 1).join('/');
        const displayName = folderDisplayNames.get(folderPath);
        current = this.ensureFolderChild(current, segment, displayName);
        current.count++;
      }
    }
  }

  private folder(name: string, label: string, path: string, displayName?: string): TreeNode {
    return { kind: 'folder', name, label, path, children: [], count: 0, displayName };
  }

  private ensureFolderChild(parent: TreeNode, segment: string, displayName?: string): TreeNode {
    parent.children = parent.children ?? [];
    let next = parent.children.find((child) => child.kind === 'folder' && child.name === segment);

    if (!next) {
      const path = parent.path ? parent.path + '/' + segment : segment;
      next = this.folder(segment, this.pretty(segment), path, displayName);
      parent.children.push(next);
    } else if (displayName && !next.displayName) {
      // Update displayName if provided and not already set
      next.displayName = displayName;
    }

    return next;
  }

  private pretty(kebab: string): string {
    const s = decodeURIComponent(kebab).replace(/[-_]+/g, ' ').trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  private sortRec(node: TreeNode): void {
    if (!node.children?.length) return;

    node.children.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      return a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' });
    });

    for (const child of node.children) {
      this.sortRec(child);
    }
  }
}
