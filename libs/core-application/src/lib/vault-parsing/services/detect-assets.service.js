"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DetectAssetsService = void 0;
const frontmatter_strings_util_1 = require("../utils/frontmatter-strings.util");
/**
 * Regex pour capturer les embeds Obsidian : ![[...]]
 * - groupe 1 = contenu interne sans les crochets.
 */
const EMBED_REGEX = /!\[\[([^\]]+)\]\]/g;
const MARKDOWN_IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;
const HTML_TAG_REGEX = /<(img|a)\b[^>]*>/gi;
class DetectAssetsService {
    constructor(logger) {
        this._logger = logger.child({ scope: 'vault-parsing', operation: 'detectAssets' });
    }
    process(notes) {
        const startTime = Date.now();
        let totalAssets = 0;
        let notesWithAssets = 0;
        const result = notes.map((note) => {
            const contentAssets = this.detectInText(note.content, 'content');
            const frontmatterAssets = this.detectInFrontmatter(note);
            const leafletAssets = this.detectInLeafletBlocks(note);
            const assets = this.mergeAssets(contentAssets, frontmatterAssets, leafletAssets);
            if (assets.length > 0) {
                totalAssets += assets.length;
                notesWithAssets++;
            }
            return {
                ...note,
                assets: assets,
            };
        });
        this._logger.info('Asset detection complete', {
            notesProcessed: notes.length,
            notesWithAssets,
            totalAssets,
            durationMs: Date.now() - startTime,
        });
        return result;
    }
    detectForContentOverride(note, renderedContent) {
        const contentAssets = this.detectInText(renderedContent, 'content');
        const frontmatterAssets = this.detectInFrontmatter(note);
        const leafletAssets = this.detectInLeafletBlocks(note);
        return this.mergeAssets(contentAssets, frontmatterAssets, leafletAssets);
    }
    classifyAssetKind(target) {
        const lower = target.toLowerCase();
        if (lower.match(/\.(png|jpe?g|gif|webp|svg)$/))
            return 'image';
        if (lower.match(/\.(mp3|wav|flac|ogg)$/))
            return 'audio';
        if (lower.match(/\.(mp4|webm|mkv|mov)$/))
            return 'video';
        if (lower.match(/\.pdf$/))
            return 'pdf';
        return 'other';
    }
    parseAlignment(token) {
        const lower = token.toLowerCase();
        if (lower === 'left')
            return 'left';
        if (lower === 'right')
            return 'right';
        if (lower === 'center' || lower === 'centre')
            return 'center';
        return undefined;
    }
    detectInFrontmatter(note) {
        if (!note.frontmatter?.nested || typeof note.frontmatter.nested !== 'object') {
            return [];
        }
        const entries = (0, frontmatter_strings_util_1.extractFrontmatterStrings)(note.frontmatter.nested);
        const assets = [];
        for (const entry of entries) {
            const found = this.detectInText(entry.value, 'frontmatter', entry.path);
            assets.push(...found);
        }
        return assets;
    }
    detectInText(markdown, origin, frontmatterPath) {
        const assets = [];
        assets.push(...this.detectObsidianEmbeds(markdown, origin, frontmatterPath));
        assets.push(...this.detectMarkdownImages(markdown, origin, frontmatterPath));
        assets.push(...this.detectHtmlAssetRefs(markdown, origin, frontmatterPath));
        return this.mergeAssets(assets);
    }
    detectObsidianEmbeds(markdown, origin, frontmatterPath) {
        const assets = [];
        EMBED_REGEX.lastIndex = 0;
        let match;
        let embedCount = 0;
        let skippedEmpty = 0;
        let skippedNoSegments = 0;
        let skippedNonAsset = 0;
        while ((match = EMBED_REGEX.exec(markdown)) !== null) {
            embedCount++;
            const raw = match[0]; // "![[...]]"
            const inner = match[1].trim(); // contenu interne
            if (!inner) {
                skippedEmpty++;
                continue;
            }
            const segments = inner
                .split('|')
                .map((s) => s.trim())
                .filter(Boolean);
            if (segments.length === 0) {
                skippedNoSegments++;
                continue;
            }
            const target = this.normalizeTarget(segments[0]); // ex: "Tenebra1.jpg"
            const modifierTokens = segments.slice(1);
            const kind = this.classifyAssetKind(target);
            const display = this.parseModifiers(modifierTokens);
            if (kind === 'other' && !target.includes('.')) {
                skippedNonAsset++;
                continue;
            }
            assets.push({
                origin,
                frontmatterPath,
                raw,
                sourceSyntax: 'obsidian-embed',
                target,
                kind,
                display,
            });
        }
        if (embedCount > 0) {
            this._logger.debug('Detected assets in text', {
                origin,
                frontmatterPath,
                embedsFound: embedCount,
                assetsDetected: assets.length,
                skipped: {
                    empty: skippedEmpty,
                    noSegments: skippedNoSegments,
                    nonAsset: skippedNonAsset,
                },
            });
        }
        return assets;
    }
    parseModifiers(tokens) {
        let alignment;
        let width;
        const classes = [];
        const rawModifiers = [];
        for (const raw of tokens) {
            const token = raw.trim();
            if (!token)
                continue;
            rawModifiers.push(token);
            // Alignement ITS / CSS-like
            if (!alignment) {
                const a = this.parseAlignment(token);
                if (a) {
                    alignment = a;
                    continue;
                }
            }
            // Largeur en pixels : "300"
            if (!width && /^[0-9]+$/.test(token)) {
                width = parseInt(token, 10);
                continue;
            }
            // Le reste : on le traite comme classe CSS / ITS
            classes.push(token);
        }
        return {
            alignment,
            width,
            classes,
            rawModifiers,
        };
    }
    detectMarkdownImages(markdown, origin, frontmatterPath) {
        const assets = [];
        MARKDOWN_IMAGE_REGEX.lastIndex = 0;
        let match;
        while ((match = MARKDOWN_IMAGE_REGEX.exec(markdown)) !== null) {
            const raw = match[0];
            const target = this.normalizeTarget(this.parseMarkdownImageDestination(match[2]));
            if (!target || this.isExternalOrRuntimeUrl(target)) {
                continue;
            }
            const kind = this.classifyAssetKind(target);
            if (kind !== 'image') {
                continue;
            }
            assets.push({
                origin,
                frontmatterPath,
                raw,
                sourceSyntax: 'markdown-image',
                target,
                kind,
                display: this.emptyDisplay(),
            });
        }
        return assets;
    }
    /**
     * Detect exportable assets from serialized HTML without trying to "support" icon runtimes.
     *
     * Supported:
     * - <img src="...">
     * - <img data-src="...">
     * - <a href="..."> when the href clearly targets a file asset
     *
     * Intentionally not detected here:
     * - inline SVG fragments (<svg>...</svg>)
     * - DOM-only icons (<span>, <i>, emoji, data-icon)
     * - CSS/runtime-only icon packs
     * - advanced media syntaxes such as srcset or CSS url(...)
     */
    detectHtmlAssetRefs(htmlLikeContent, origin, frontmatterPath) {
        if (!htmlLikeContent.includes('<')) {
            return [];
        }
        const assets = [];
        HTML_TAG_REGEX.lastIndex = 0;
        let match;
        while ((match = HTML_TAG_REGEX.exec(htmlLikeContent)) !== null) {
            const rawTag = match[0];
            const tagName = match[1].toLowerCase();
            if (tagName === 'img') {
                const rawValue = this.extractHtmlAttribute(rawTag, 'src') ?? this.extractHtmlAttribute(rawTag, 'data-src');
                const target = rawValue ? this.normalizeHtmlAssetTarget(rawValue) : null;
                if (!target) {
                    continue;
                }
                assets.push({
                    origin,
                    frontmatterPath,
                    raw: rawTag,
                    sourceSyntax: 'html-ref',
                    target,
                    kind: 'image',
                    display: this.emptyDisplay(),
                });
                continue;
            }
            if (tagName === 'a') {
                const href = this.extractHtmlAttribute(rawTag, 'href');
                const target = href ? this.normalizeHtmlAssetTarget(href) : null;
                if (!target) {
                    continue;
                }
                const kind = this.classifyAssetKind(target);
                if (kind === 'other') {
                    continue;
                }
                assets.push({
                    origin,
                    frontmatterPath,
                    raw: rawTag,
                    sourceSyntax: 'html-ref',
                    target,
                    kind,
                    display: this.emptyDisplay(),
                });
            }
        }
        return assets;
    }
    normalizeTarget(target) {
        if (!target)
            return '';
        let t = target.trim().replace(/\\/g, '/');
        t = t.replace(/^\.\/+/, '');
        t = t.replace(/^\/+/, '');
        t = t.replace(/^assets\//, '');
        return t;
    }
    normalizeHtmlAssetTarget(value) {
        const [withoutHash] = value.split('#', 1);
        const [withoutQuery] = withoutHash.split('?', 1);
        const cleaned = withoutQuery.trim();
        if (!cleaned || this.isExternalOrRuntimeUrl(cleaned)) {
            return null;
        }
        const normalized = this.normalizeTarget(cleaned);
        return normalized || null;
    }
    parseMarkdownImageDestination(destination) {
        const trimmed = destination.trim();
        if (!trimmed) {
            return '';
        }
        if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
            return trimmed.slice(1, -1).trim();
        }
        const titleMatch = trimmed.match(/^(.+?)\s+["'][^"']*["']$/);
        return (titleMatch?.[1] ?? trimmed).trim();
    }
    isExternalOrRuntimeUrl(value) {
        return (/^[a-z]+:\/\//i.test(value) ||
            value.startsWith('mailto:') ||
            value.startsWith('data:') ||
            value.startsWith('javascript:') ||
            value.startsWith('#'));
    }
    extractHtmlAttribute(tag, attribute) {
        const escapedAttribute = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const attributeRegex = new RegExp(`${escapedAttribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
        const match = tag.match(attributeRegex);
        return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
    }
    emptyDisplay() {
        return {
            alignment: undefined,
            width: undefined,
            classes: [],
            rawModifiers: [],
        };
    }
    mergeAssets(...groups) {
        const deduped = new Map();
        for (const group of groups) {
            for (const asset of group) {
                const key = [
                    asset.origin ?? '',
                    asset.frontmatterPath ?? '',
                    asset.sourceSyntax ?? '',
                    asset.raw,
                    asset.target,
                ].join('::');
                if (!deduped.has(key)) {
                    deduped.set(key, asset);
                }
            }
        }
        return Array.from(deduped.values());
    }
    /**
     * Détecte les assets dans les blocs Leaflet (imageOverlays)
     */
    detectInLeafletBlocks(note) {
        if (!note.leafletBlocks || note.leafletBlocks.length === 0) {
            return [];
        }
        const assets = [];
        let skippedEmpty = 0;
        for (const block of note.leafletBlocks) {
            if (!block.imageOverlays || block.imageOverlays.length === 0) {
                continue;
            }
            for (const overlay of block.imageOverlays) {
                const target = this.normalizeTarget(overlay.path);
                if (!target) {
                    skippedEmpty++;
                    continue;
                }
                const kind = this.classifyAssetKind(target);
                const asset = {
                    raw: `![[${overlay.path}]]`,
                    sourceSyntax: 'leaflet-overlay',
                    target,
                    kind,
                    origin: 'content', // Considéré comme venant du contenu
                    display: this.emptyDisplay(),
                };
                assets.push(asset);
            }
        }
        if (note.leafletBlocks.length > 0) {
            // Use INFO level so it's always visible for debugging Leaflet issues
            this._logger.info('Leaflet block assets detection', {
                noteVaultPath: note.vaultPath,
                blocksCount: note.leafletBlocks.length,
                assetsDetected: assets.length,
                assetTargets: assets.map((a) => a.target),
                skippedEmpty,
            });
        }
        return assets;
    }
}
exports.DetectAssetsService = DetectAssetsService;
