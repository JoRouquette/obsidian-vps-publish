import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatTreeModule } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';

import { CatalogFacade } from '../../../application/facades/CatalogFacade';
import { BuildTreeUseCase, TreeNode } from '../../../application/usecases/BuildTree.usecase';

@Component({
  standalone: true,
  selector: 'app-vault-explorer',
  imports: [
    CommonModule,
    RouterLink,
    MatTreeModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    MatButtonModule,
  ],
  templateUrl: './vault-explorer.component.html',
  styleUrls: ['./vault-explorer.component.scss'],
})
export class VaultExplorerComponent {
  tree = signal<TreeNode | null>(null);
  q = signal<string>('');

  // Nouveaux helpers pour l'API "childrenAccessor"
  childrenOf = (n: TreeNode) => n.children ?? [];
  isFolder = (_: number, n: TreeNode) => n.kind === 'folder';
  isFile = (_: number, n: TreeNode) => n.kind === 'file';

  filteredTree = computed(() => this.filterTree(this.tree(), this.q().trim().toLowerCase()));

  constructor(private readonly facade: CatalogFacade, private readonly build: BuildTreeUseCase) {
    this.facade.ensureManifest().then(() => {
      const m = this.facade.manifest();
      this.tree.set(m ? this.build.exec(m) : null);
    });
  }

  onInputQuery(value: string) {
    this.q.set(value ?? '');
  }

  private filterTree(node: TreeNode | null, q: string): TreeNode | null {
    if (!node) return null;
    if (!q) return node;
    const selfMatch = (node.label || node.name).toLowerCase().includes(q);
    if (node.kind === 'file') return selfMatch ? node : null;
    const children = (node.children ?? [])
      .map((c) => this.filterTree(c, q))
      .filter((x): x is TreeNode => !!x);
    return selfMatch || children.length ? { ...node, children } : null;
  }
}
