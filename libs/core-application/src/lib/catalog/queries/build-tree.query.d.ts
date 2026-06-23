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
export declare const defaultTreeNode: TreeNode;
export declare class BuildTreeHandler implements QueryHandler<Manifest, TreeNode> {
    handle(manifest: Manifest): Promise<TreeNode>;
    private buildFolderDisplayNameMap;
    private processPage;
    private folder;
    private ensureFolderChild;
    private pretty;
    private sortRec;
}
//# sourceMappingURL=build-tree.query.d.ts.map