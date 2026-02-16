import { CdkTreeModule } from '@angular/cdk/tree';
import type { ElementRef, OnDestroy, OnInit } from '@angular/core';
import { Component, computed, effect, signal, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltip } from '@angular/material/tooltip';
import { MatTree, MatTreeModule } from '@angular/material/tree';
import { RouterLink } from '@angular/router';
import type { TreeNode } from '@core-application';
import { BuildTreeHandler, defaultTreeNode } from '@core-application';

import { CatalogFacade } from '../../../application/facades/catalog-facade';
import { SearchBarComponent } from '../search-bar/search-bar.component';

@Component({
  standalone: true,
  selector: 'app-vault-explorer',
  imports: [
    CdkTreeModule,
    MatButtonModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTreeModule,
    RouterLink,
    MatTooltip,
    SearchBarComponent,
  ],
  templateUrl: './vault-explorer.component.html',
  styleUrls: ['./vault-explorer.component.scss'],
})
export class VaultExplorerComponent implements OnInit, OnDestroy {
  tree = signal<TreeNode>(defaultTreeNode);
  q = signal<string>('');
  private searchDebounceTimer?: ReturnType<typeof setTimeout>;
  private readonly EMPTY: TreeNode[] = [];
  private readonly DEBOUNCE_MS = 200; // Wait 200ms after last keystroke before filtering
  private readonly buildTree = new BuildTreeHandler();
  hasQuery = computed(() => this.q().trim().length > 0);

  /**
   * Filtered tree: rebuilds the entire tree structure with only matching nodes.
   * If no query, returns the original tree. If query, returns a new tree with only matches.
   */
  filteredTree = computed(() => {
    const root = this.tree();
    if (!root) return defaultTreeNode;
    const query = this.q().trim();
    if (!query) return root;

    // Special case for root: filter its children, not the root itself
    const children = root.children ?? [];
    const filteredChildren: TreeNode[] = [];

    for (const child of children) {
      const filtered = this.buildFilteredTree(child, query);
      if (filtered !== null) {
        filteredChildren.push(filtered);
      }
    }

    return {
      ...root,
      children: filteredChildren,
      count: filteredChildren.length,
    };
  });

  rootChildren = computed(() => {
    const root = this.filteredTree();
    return root.children ?? this.EMPTY;
  });

  noResult = computed(() => {
    if (!this.hasQuery()) return false;
    const root = this.filteredTree();
    return (root.children?.length ?? 0) === 0;
  });

  noData = computed(() => {
    const root = this.tree();
    if (!root) return true;
    const children = root.children ?? [];
    return children.length === 0;
  });

  /**
   * Count total results (files + folders) when searching.
   * Returns 0 when not searching.
   */
  resultCount = computed(() => {
    if (!this.hasQuery()) return 0;
    const root = this.filteredTree();
    return this.countNodes(root);
  });

  @ViewChild('treeScroller', { static: false })
  private readonly treeScroller?: ElementRef<HTMLDivElement>;
  @ViewChild('hScroller', { static: false })
  private readonly hScroller?: ElementRef<HTMLDivElement>;
  @ViewChild(MatTree, { static: false })
  private readonly matTree?: MatTree<TreeNode>;
  treeScrollWidth = 0;

  // Track if any folder is expanded
  hasExpandedFolders = signal<boolean>(false);

  childrenOf = (n: TreeNode) => n.children ?? [];
  isFolder = (_: number, n: TreeNode) => n.kind === 'folder';
  isFile = (_: number, n: TreeNode) => n.kind === 'file';
  trackByPath = (_: number, n: TreeNode) => {
    const base = n.path ?? (n.label || n.name);
    // Force new identity when filtering so Angular re-renders nodes correctly
    // Without this, mat-tree keeps old expanded node references with unfiltered children
    return this.hasQuery() ? `filtered-${base}` : base;
  };

  constructor(private readonly facade: CatalogFacade) {
    effect(() => {
      this.rootChildren();
      queueMicrotask(() => this.measureScrollWidth());
    });
  }

  ngOnInit(): void {
    void this.facade.ensureManifest().then(async () => {
      const m = this.facade.manifest();
      this.tree.set(m ? await this.buildTree.handle(m) : defaultTreeNode);
    });
  }

  ngOnDestroy(): void {
    // Clean up debounce timer to prevent memory leaks
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
  }

  onInputQuery(value: string): void {
    // Clear any pending debounce timer
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    // For empty queries, apply immediately without debounce
    if (!value || value.trim().length === 0) {
      this.q.set('');
      return;
    }

    // Debounce non-empty queries to improve performance
    this.searchDebounceTimer = setTimeout(() => {
      this.q.set(value ?? '');
    }, this.DEBOUNCE_MS);
  }

  syncX(source: 'tree' | 'h'): void {
    const t = this.treeScroller?.nativeElement,
      h = this.hScroller?.nativeElement;
    if (!t || !h) return;
    if (source === 'h') t.scrollLeft = h.scrollLeft;
    else h.scrollLeft = t.scrollLeft;
  }

  measureScrollWidth(): void {
    const t = this.treeScroller?.nativeElement;
    if (!t) return;
    const w = t.scrollWidth;
    if (w !== this.treeScrollWidth) this.treeScrollWidth = w;
  }

  shouldAutoExpand(node: TreeNode): boolean {
    // When filtering, auto-expand all folders to show matches
    return this.hasQuery() && node.kind === 'folder';
  }

  /**
   * Extract the basename (last segment) from a path.
   * Handles both forward slashes (/) and backslashes (\\).
   * Examples:
   *   'regles/sens-et-capacites' → 'sens-et-capacites'
   *   'regles\\sens-et-capacites' → 'sens-et-capacites'
   *   'sens-et-capacites' → 'sens-et-capacites'
   */
  private getBaseName(path: string): string {
    if (!path) return '';
    // Normalize path separators to forward slashes
    const normalized = path.replaceAll('\\', '/');
    const segments = normalized.split('/');
    return segments.at(-1) ?? '';
  }

  /**
   * Normalize a string by removing diacritics/accents and converting to lowercase.
   * This allows searching "tenebra" to match "Ténébra".
   */
  private normalizeString(str: string): string {
    return str
      .normalize('NFD') // Decompose combined characters (é → e + ´)
      .replaceAll(/[\u0300-\u036f]/g, '') // Remove diacritical marks
      .toLowerCase()
      .trim();
  }

  /**
   * Check if a search query matches a text.
   * Supports:
   * - Accent-insensitive search: "tenebra" matches "Ténébra"
   * - Substring matching: "ebr" matches "Ténébra"
   * - Multi-word search: each word must match (space-separated)
   */
  private matchesQuery(text: string, query: string): boolean {
    const normalizedText = this.normalizeString(text);
    const normalizedQuery = this.normalizeString(query);

    // Support multi-word search: all words must be present
    const queryWords = normalizedQuery.split(/\s+/).filter((w) => w.length > 0);
    if (queryWords.length === 0) return false;

    // Each query word must appear somewhere in the text (substring match)
    return queryWords.every((word) => normalizedText.includes(word));
  }

  /**
   * Count all nodes (files and folders) recursively in a filtered tree.
   * Does NOT count the root node itself.
   */
  private countNodes(node: TreeNode): number {
    let count = 0;
    const children = node.children ?? [];

    for (const child of children) {
      count++; // Count this child
      if (child.kind === 'folder') {
        count += this.countNodes(child); // Recursively count children
      }
    }

    return count;
  }

  /**
   * Build a filtered tree containing only nodes that match the query.
   * Returns a new tree structure with only matching files/folders.
   * Parent folders are included if they have matching descendants.
   * Returns null if the node and its descendants don't match.
   */
  private buildFilteredTree(node: TreeNode, query: string): TreeNode | null {
    const basename = this.getBaseName(node.name);
    const selfMatch = this.matchesQuery(basename, query);

    // For files: include if basename matches
    if (node.kind === 'file') {
      return selfMatch ? { ...node } : null;
    }

    // For folders: filter children recursively
    const children = node.children ?? [];
    const filteredChildren: TreeNode[] = [];

    for (const child of children) {
      const filtered = this.buildFilteredTree(child, query);
      if (filtered !== null) {
        filteredChildren.push(filtered);
      }
    }

    // Include folder if it matches OR has matching children
    if (selfMatch || filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren,
        count: filteredChildren.length,
      };
    }

    return null;
  }

  toggleAllFolders(): void {
    if (!this.matTree) return;

    const shouldCollapse = this.hasExpandedFolders();

    if (shouldCollapse) {
      // Collapse all
      this.matTree.collapseAll();
      this.hasExpandedFolders.set(false);
    } else {
      // Expand all
      this.matTree.expandAll();
      this.hasExpandedFolders.set(true);
    }
  }

  onNodeExpanded(): void {
    // Update the signal when a folder is expanded
    this.hasExpandedFolders.set(true);
  }

  checkExpandedState(): void {
    // Check if any folder is still expanded after collapse
    if (!this.matTree?.treeControl) return;
    const hasExpanded = this.rootChildren().some(
      (node) => node.kind === 'folder' && this.matTree?.treeControl?.isExpanded(node)
    );
    this.hasExpandedFolders.set(hasExpanded);
  }
}
