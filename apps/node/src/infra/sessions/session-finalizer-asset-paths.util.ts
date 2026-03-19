import { promises as fs } from 'node:fs';
import path from 'node:path';

import { type LeafletBlock, type LoggerPort, type Manifest } from '@core-domain';
import { load } from 'cheerio';

interface ReplacementPattern {
  pattern: RegExp;
  replacement: string;
  desc: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findHtmlFiles(dir: string): Promise<string[]> {
  const htmlFiles: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      htmlFiles.push(...(await findHtmlFiles(fullPath)));
    } else if (entry.name.endsWith('.html')) {
      htmlFiles.push(fullPath);
    }
  }

  return htmlFiles;
}

function buildReplacementPatterns(mappings: Record<string, string>): ReplacementPattern[] {
  const patterns: ReplacementPattern[] = [];

  for (const [original, optimized] of Object.entries(mappings)) {
    const escapedOriginal = escapeRegex(original);
    const escapedEncoded = escapeRegex(encodeURIComponent(original));

    patterns.push({
      pattern: new RegExp(`(src=["'].*?)${escapedOriginal}(["'])`, 'gi'),
      replacement: `$1${optimized}$2`,
      desc: `src: ${original} → ${optimized}`,
    });
    patterns.push({
      pattern: new RegExp(`(href=["'].*?)${escapedOriginal}(["'])`, 'gi'),
      replacement: `$1${optimized}$2`,
      desc: `href: ${original} → ${optimized}`,
    });
    patterns.push({
      pattern: new RegExp(`(data-src=["'].*?)${escapedOriginal}(["'])`, 'gi'),
      replacement: `$1${optimized}$2`,
      desc: `data-src: ${original} → ${optimized}`,
    });

    const originalBasename = path.basename(original);
    const optimizedBasename = path.basename(optimized);
    if (originalBasename !== original) {
      const escapedBasename = escapeRegex(originalBasename);
      patterns.push({
        pattern: new RegExp(`(src=["'][^"']*/)${escapedBasename}(["'])`, 'gi'),
        replacement: `$1${optimizedBasename}$2`,
        desc: `src-basename: ${originalBasename} → ${optimizedBasename}`,
      });
      patterns.push({
        pattern: new RegExp(`(href=["'][^"']*/)${escapedBasename}(["'])`, 'gi'),
        replacement: `$1${optimizedBasename}$2`,
        desc: `href-basename: ${originalBasename} → ${optimizedBasename}`,
      });
      patterns.push({
        pattern: new RegExp(`(data-src=["'][^"']*/)${escapedBasename}(["'])`, 'gi'),
        replacement: `$1${optimizedBasename}$2`,
        desc: `data-src-basename: ${originalBasename} → ${optimizedBasename}`,
      });
    }

    if (escapedOriginal !== escapedEncoded) {
      patterns.push({
        pattern: new RegExp(`(src=["'].*?)${escapedEncoded}(["'])`, 'gi'),
        replacement: `$1${encodeURIComponent(optimized)}$2`,
        desc: `src-encoded: ${original} → ${optimized}`,
      });
      patterns.push({
        pattern: new RegExp(`(href=["'].*?)${escapedEncoded}(["'])`, 'gi'),
        replacement: `$1${encodeURIComponent(optimized)}$2`,
        desc: `href-encoded: ${original} → ${optimized}`,
      });
    }
  }

  return patterns;
}

export function replaceAssetPath(assetPath: string, mappings: Record<string, string>): string {
  if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
    return assetPath;
  }

  for (const [original, optimized] of Object.entries(mappings)) {
    if (assetPath === original) {
      return optimized;
    }
    if (assetPath.endsWith('/' + original)) {
      return assetPath.replace(original, optimized);
    }
    if (assetPath.includes('/' + original)) {
      return assetPath.replace(original, optimized);
    }
    if (assetPath.endsWith(original)) {
      return assetPath.slice(0, -original.length) + optimized;
    }
  }

  const assetBasename = path.basename(assetPath);
  for (const [original, optimized] of Object.entries(mappings)) {
    const originalBasename = path.basename(original);
    if (assetBasename === originalBasename) {
      const optimizedBasename = path.basename(optimized);
      return assetPath.replace(assetBasename, optimizedBasename);
    }
  }

  return assetPath;
}

export function replaceAssetPathsInLeafletBlocks(
  html: string,
  mappings: Record<string, string>,
  log: LoggerPort
): { content: string; modified: boolean } {
  if (!html.includes('data-leaflet-block=')) {
    return { content: html, modified: false };
  }

  const $ = (load as (...args: unknown[]) => ReturnType<typeof load>)(
    html,
    { decodeEntities: false },
    false
  );
  const leafletElements = $('[data-leaflet-block]');

  if (leafletElements.length === 0) {
    return { content: html, modified: false };
  }

  let modified = false;
  const basenameMap = new Map<string, string>();
  for (const [original, optimized] of Object.entries(mappings)) {
    basenameMap.set(path.basename(original), path.basename(optimized));
  }

  for (const element of leafletElements.toArray()) {
    const blockDataJson = $(element).attr('data-leaflet-block');
    if (!blockDataJson) {
      continue;
    }

    try {
      const blockData = JSON.parse(blockDataJson) as {
        imageOverlays?: Array<{ path?: string }>;
      };

      if (blockData.imageOverlays && Array.isArray(blockData.imageOverlays)) {
        for (const overlay of blockData.imageOverlays) {
          if (overlay.path && typeof overlay.path === 'string') {
            let replaced = false;

            for (const [original, optimized] of Object.entries(mappings)) {
              if (overlay.path === original || overlay.path.endsWith('/' + original)) {
                const newPath = overlay.path.replace(original, optimized);
                log.debug('Replacing Leaflet imageOverlay path', {
                  old: overlay.path,
                  new: newPath,
                });
                overlay.path = newPath;
                modified = true;
                replaced = true;
                break;
              }
            }

            if (!replaced) {
              const overlayBasename = path.basename(overlay.path);
              const optimizedBasename = basenameMap.get(overlayBasename);
              if (optimizedBasename) {
                const newPath = overlay.path.replace(overlayBasename, optimizedBasename);
                log.debug('Replacing Leaflet imageOverlay path (basename match)', {
                  old: overlay.path,
                  new: newPath,
                });
                overlay.path = newPath;
                modified = true;
              }
            }
          }
        }
      }

      if (modified) {
        $(element).attr('data-leaflet-block', JSON.stringify(blockData));
      }
    } catch (error) {
      log.warn('Failed to parse Leaflet block JSON for asset path replacement', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { content: $.html(), modified };
}

export async function replaceAssetPathsInHtmlFiles(
  contentRoot: string,
  mappings: Record<string, string>,
  log: LoggerPort
): Promise<number> {
  const htmlFiles = await findHtmlFiles(contentRoot);

  log.debug('Found HTML files for asset path replacement', {
    htmlFilesCount: htmlFiles.length,
    contentRoot,
  });

  if (htmlFiles.length === 0) {
    return 0;
  }

  const patterns = buildReplacementPatterns(mappings);
  log.debug('Generated replacement patterns', {
    patternCount: patterns.length,
    patterns: patterns.map((pattern) => pattern.desc),
  });

  let filesModified = 0;
  let totalReplacements = 0;

  for (const htmlFile of htmlFiles) {
    let content = await fs.readFile(htmlFile, 'utf-8');
    let modified = false;
    let fileReplacements = 0;

    for (const { pattern, replacement, desc } of patterns) {
      const newContent = content.replace(pattern, replacement);
      if (newContent !== content) {
        const matchCount = (content.match(pattern) || []).length;
        fileReplacements += matchCount;
        log.debug('Pattern matched in file', {
          file: path.basename(htmlFile),
          pattern: desc,
          matchCount,
        });
        content = newContent;
        modified = true;
      }
    }

    const leafletResult = replaceAssetPathsInLeafletBlocks(content, mappings, log);
    if (leafletResult.modified) {
      content = leafletResult.content;
      modified = true;
      fileReplacements++;
    }

    if (modified) {
      await fs.writeFile(htmlFile, content, 'utf-8');
      filesModified++;
      totalReplacements += fileReplacements;
      log.debug('Replaced asset paths in HTML file', {
        file: path.relative(contentRoot, htmlFile),
        replacements: fileReplacements,
      });
    }
  }

  log.debug('Asset path replacement summary', {
    filesScanned: htmlFiles.length,
    filesModified,
    totalReplacements,
  });

  return filesModified;
}

export function replaceAssetPathsInManifestPages(
  manifest: Manifest,
  mappings: Record<string, string>,
  log: LoggerPort
): {
  modified: boolean;
  pagesModified: number;
  coverImagesUpdated: number;
  leafletOverlaysUpdated: number;
} {
  let pagesModified = 0;
  let coverImagesUpdated = 0;
  let leafletOverlaysUpdated = 0;

  for (const page of manifest.pages) {
    let pageModified = false;

    if (page.coverImage) {
      const newCoverImage = replaceAssetPath(page.coverImage, mappings);
      if (newCoverImage !== page.coverImage) {
        log.debug('Replacing coverImage path in manifest', {
          route: page.route,
          old: page.coverImage,
          new: newCoverImage,
        });
        page.coverImage = newCoverImage;
        coverImagesUpdated++;
        pageModified = true;
      }
    }

    if (page.leafletBlocks && Array.isArray(page.leafletBlocks)) {
      for (const block of page.leafletBlocks as LeafletBlock[]) {
        if (block.imageOverlays && Array.isArray(block.imageOverlays)) {
          for (const overlay of block.imageOverlays) {
            if (overlay.path) {
              const newPath = replaceAssetPath(overlay.path, mappings);
              if (newPath !== overlay.path) {
                log.debug('Replacing Leaflet imageOverlay path in manifest', {
                  route: page.route,
                  blockId: block.id,
                  old: overlay.path,
                  new: newPath,
                });
                overlay.path = newPath;
                leafletOverlaysUpdated++;
                pageModified = true;
              }
            }
          }
        }
      }
    }

    if (pageModified) {
      pagesModified++;
    }
  }

  return {
    modified: pagesModified > 0,
    pagesModified,
    coverImagesUpdated,
    leafletOverlaysUpdated,
  };
}
