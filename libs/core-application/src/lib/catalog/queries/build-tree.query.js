"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuildTreeHandler = exports.defaultTreeNode = void 0;
exports.defaultTreeNode = {
    kind: 'folder',
    name: '',
    label: '',
    path: '',
    count: 0,
};
class BuildTreeHandler {
    async handle(manifest) {
        const root = this.folder('', '', '');
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
    buildFolderDisplayNameMap(manifest) {
        const map = new Map();
        // Use manifest.folderDisplayNames directly (populated by plugin route tree config)
        if (manifest.folderDisplayNames) {
            for (const [routePath, displayName] of Object.entries(manifest.folderDisplayNames)) {
                // Remove leading slash for consistency with route processing
                const normalizedPath = routePath.replace(/^\/+/, '');
                map.set(normalizedPath, displayName);
            }
        }
        return map;
    }
    processPage(page, root, folderDisplayNames) {
        const segments = page.route.replace(/^\/+/, '').split('/').filter(Boolean);
        if (segments.length === 0)
            return;
        let current = root;
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const atLeaf = i === segments.length - 1;
            if (atLeaf) {
                const fileNode = {
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
            }
            else {
                // Build the cumulative folder path for this segment to look up displayName
                const folderPath = segments.slice(0, i + 1).join('/');
                const displayName = folderDisplayNames.get(folderPath);
                current = this.ensureFolderChild(current, segment, displayName);
                current.count++;
            }
        }
    }
    folder(name, label, path, displayName) {
        return { kind: 'folder', name, label, path, children: [], count: 0, displayName };
    }
    ensureFolderChild(parent, segment, displayName) {
        parent.children = parent.children ?? [];
        let next = parent.children.find((child) => child.kind === 'folder' && child.name === segment);
        if (!next) {
            const path = parent.path ? parent.path + '/' + segment : segment;
            next = this.folder(segment, this.pretty(segment), path, displayName);
            parent.children.push(next);
        }
        else if (displayName && !next.displayName) {
            // Update displayName if provided and not already set
            next.displayName = displayName;
        }
        return next;
    }
    pretty(kebab) {
        const s = decodeURIComponent(kebab).replace(/[-_]+/g, ' ').trim();
        return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    }
    sortRec(node) {
        if (!node.children?.length)
            return;
        node.children.sort((a, b) => {
            if (a.kind !== b.kind)
                return a.kind === 'folder' ? -1 : 1;
            return a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' });
        });
        for (const child of node.children) {
            this.sortRec(child);
        }
    }
}
exports.BuildTreeHandler = BuildTreeHandler;
