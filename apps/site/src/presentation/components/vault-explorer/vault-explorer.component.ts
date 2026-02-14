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
  private visible = new WeakMap<TreeNode, TreeNode[]>();
  private matches = new WeakMap<TreeNode, boolean>();
  tree = signal<TreeNode>(defaultTreeNode);
  q = signal<string>('');
  private searchDebounceTimer?: ReturnType<typeof setTimeout>;
  private readonly EMPTY: TreeNode[] = [];
  private readonly DEBOUNCE_MS = 200; // Wait 200ms after last keystroke before filtering
  private readonly buildTree = new BuildTreeHandler();
  hasQuery = computed(() => this.q().trim().length > 0);
  rootChildren = computed(() => {
    const root = this.filteredRoot();
    if (!root) return this.EMPTY;
    if (!this.q().trim()) return root.children ?? [];
    return this.visible.get(root) ?? this.EMPTY;
  });
  noResult = computed(() => {
    if (!this.hasQuery()) return false;
    const root = this.filteredRoot();
    if (!root) return false;
    const visibles = this.visible.get(root) ?? [];
    return visibles.length === 0;
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
    const root = this.filteredRoot();
    if (!root) return 0;
    return this.countVisibleNodes(root);
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

  childrenOf = (n: TreeNode) => (this.q() ? (this.visible.get(n) ?? []) : (n.children ?? []));
  isFolder = (_: number, n: TreeNode) => n.kind === 'folder';
  isFile = (_: number, n: TreeNode) => n.kind === 'file';
  trackByPath = (_: number, n: TreeNode) => n.path ?? (n.label || n.name);

  filteredRoot = computed(() => {
    const root = this.tree();
    if (!root) return null;
    const query = this.q().trim().toLowerCase();
    this.visible = new WeakMap<TreeNode, TreeNode[]>();
    this.matches = new WeakMap<TreeNode, boolean>();
    if (!query) return root;
    this.markVisible(root, query);
    return root;
  });

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
    if (!this.hasQuery() || node.kind !== 'folder') return false;
    const hasVisibleChildren = (this.visible.get(node)?.length ?? 0) > 0;
    const selfMatch = this.matches.get(node) ?? false;
    return hasVisibleChildren || selfMatch;
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
   * Count all visible nodes (files and folders) recursively.
   * Used to display result count during search.
   */
  private countVisibleNodes(node: TreeNode): number {
    let count = 0;

    // Count this node if it matches
    if (this.matches.get(node)) {
      count++;
    }

    // Recursively count visible children
    const visibleChildren = this.visible.get(node) ?? [];
    for (const child of visibleChildren) {
      count += this.countVisibleNodes(child);
    }

    return count;
  }

  private markVisible(node: TreeNode, q: string): boolean {
    const label = node.label || node.name;
    const tags = node.tags ?? [];

    // Check if label matches query (with normalization and substring support)
    const labelMatch = this.matchesQuery(label, q);

    // Check if any tag matches query
    const tagsMatch = tags.some((t) => this.matchesQuery(t, q));

    const selfMatch = labelMatch || tagsMatch;
    this.matches.set(node, selfMatch);

    if (node.kind === 'file') return selfMatch;

    const kids = node.children ?? [];
    const vis: TreeNode[] = [];
    for (const c of kids) if (this.markVisible(c, q)) vis.push(c);

    if (selfMatch || vis.length) {
      this.visible.set(node, vis);
      return true;
    }
    return false;
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
