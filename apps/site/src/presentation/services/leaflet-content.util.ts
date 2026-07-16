/**
 * Shared, presentation-agnostic helpers for rendered content that embeds Leaflet
 * maps. Extracted from the viewer and home components, which decorate the same
 * kind of content and previously duplicated this logic verbatim.
 */

/**
 * Leaflet injects its own control anchors (zoom in/out/fullscreen) into the map.
 * These must be skipped when decorating internal content links so their default
 * behaviour is preserved.
 */
export function isLeafletControlLink(link: HTMLAnchorElement): boolean {
  if (
    link.classList.contains('leaflet-control-zoom-in') ||
    link.classList.contains('leaflet-control-zoom-out') ||
    link.classList.contains('leaflet-control-zoom-fullscreen')
  ) {
    return true;
  }

  return Boolean(link.closest('.leaflet-control-container'));
}

/**
 * Whether verbose Leaflet logging is enabled via a localStorage debug flag.
 * Returns false outside the browser or when storage is unavailable.
 */
export function isLeafletDebugLoggingEnabled(isBrowser: boolean): boolean {
  if (!isBrowser) {
    return false;
  }

  try {
    return (
      globalThis.window.localStorage.getItem('vps:leaflet:debug') === '1' ||
      globalThis.window.localStorage.getItem('leaflet:debug') === '1'
    );
  } catch {
    return false;
  }
}
