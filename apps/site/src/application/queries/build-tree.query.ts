import { Injectable } from '@angular/core';
import { Manifest } from '../../domain/models/manifest';
import { Query } from './query';

export type NodeKind = 'folder' | 'file';

export interface TreeNode {
  kind: NodeKind;
  name: string;
  label: string;
  path: string;
  count: number;
  route?: string;
  children?: TreeNode[];
}

export const defaultTreeNode: TreeNode = {
  kind: 'folder',
  name: '',
  label: '',
  path: '',
  count: 0,
};

@Injectable({ providedIn: 'root' })
export class BuildTreeQuery implements Query<Manifest, TreeNode> {
  execute(m: Manifest): Promise<TreeNode> {
    const root: TreeNode = this.folder('', '', '');

    for (const p of m.pages) {
      this.processPage(p, root);
    }

    this.sortRec(root);

    return Promise.resolve(root);
  }

  private processPage(p: Manifest['pages'][number], root: TreeNode): void {
    const segs = p.route.replace(/^\/+/, '').split('/').filter(Boolean);
    if (segs.length === 0) return;

    let cur = root;

    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const atLeaf = i === segs.length - 1;

      if (atLeaf) {
        const fileNode: TreeNode = {
          kind: 'file',
          name: seg,
          label: p.title?.trim() || this.pretty(seg),
          path: (cur.path ? cur.path + '/' : '') + seg,
          route: p.route,
          count: 1,
        };
        cur.children = cur.children ?? [];
        if (!cur.children.some((c) => c.kind === 'file' && c.name === seg)) {
          cur.children.push(fileNode);
        }
        cur.count++;
      } else {
        cur = this.ensureFolderChild(cur, seg);
        cur.count++;
      }
    }
  }

  private folder(name: string, label: string, path: string): TreeNode {
    return { kind: 'folder', name, label, path, children: [], count: 0 };
  }

  private ensureFolderChild(parent: TreeNode, seg: string): TreeNode {
    parent.children = parent.children ?? [];
    let next = parent.children.find((c) => c.kind === 'folder' && c.name === seg);
    if (!next) {
      const p = parent.path ? parent.path + '/' + seg : seg;
      next = this.folder(seg, this.pretty(seg), p);
      parent.children.push(next);
    }
    return next;
  }

  private pretty(kebab: string): string {
    const s = decodeURIComponent(kebab).replace(/[-_]+/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private sortRec(n: TreeNode): void {
    if (!n.children?.length) return;
    n.children.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      return a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' });
    });
    for (const c of n.children) {
      this.sortRec(c);
    }
  }
}
