import type { PublishableNote } from '@core-domain';

function normalizeRoute(route: string | undefined): string {
  if (!route) return '';

  const normalized = route
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '');

  if (!normalized || normalized === '/') {
    return '/';
  }

  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function joinRoute(base: string, suffix: string): string {
  const normalizedBase = normalizeRoute(base);
  const normalizedSuffix = suffix
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

  if (!normalizedSuffix) {
    return normalizedBase || '/';
  }

  if (!normalizedBase || normalizedBase === '/') {
    return `/${normalizedSuffix}`;
  }

  return `${normalizedBase}/${normalizedSuffix}`;
}

function normalizeSourcePath(value: string | undefined): string {
  return (value ?? '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

function getVaultFolderLabel(vaultFolder: string | undefined): string | undefined {
  const segments = normalizeSourcePath(vaultFolder).split('/').filter(Boolean);
  return segments.at(-1);
}

export function buildFolderDisplayNamesFromPublishedNotes(
  notes: PublishableNote[],
  existingDisplayNames: Record<string, string> = {}
): Record<string, string> | undefined {
  const displayNames: Record<string, string> = { ...existingDisplayNames };

  for (const note of notes) {
    const routeBase = normalizeRoute(note.routing?.routeBase ?? note.folderConfig.routeBase);

    if (routeBase && routeBase !== '/' && !displayNames[routeBase]) {
      const routeBaseLabel =
        note.folderConfig.displayName || getVaultFolderLabel(note.folderConfig.vaultFolder);

      if (routeBaseLabel) {
        displayNames[routeBase] = routeBaseLabel;
      }
    }

    const normalizedRelativePath = normalizeSourcePath(note.relativePath);
    const isAdditionalFile = normalizedRelativePath.startsWith('__additional__/');

    if (note.folderConfig.flattenTree || isAdditionalFile) {
      continue;
    }

    const routeSegments = (note.routing?.path ?? '').split('/').filter(Boolean);
    const sourceSegments = normalizedRelativePath.split('/').filter(Boolean).slice(0, -1);
    const sharedDepth = Math.min(routeSegments.length, sourceSegments.length);

    for (let index = 0; index < sharedDepth; index++) {
      const folderRoute = joinRoute(routeBase, routeSegments.slice(0, index + 1).join('/'));
      if (!folderRoute || folderRoute === '/' || displayNames[folderRoute]) {
        continue;
      }

      const sourceSegmentLabel = sourceSegments[index];
      if (sourceSegmentLabel) {
        displayNames[folderRoute] = sourceSegmentLabel;
      }
    }
  }

  return Object.keys(displayNames).length > 0 ? displayNames : undefined;
}
