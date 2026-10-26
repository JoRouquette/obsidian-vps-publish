import path from 'node:path';

/**
 * Accepted asset types and, for each, the file extensions it may be stored
 * under (lower case, no dot). The list of keys is the MIME allowlist: anything
 * else, including the `application/octet-stream` fallback for undetectable or
 * unknown content, is rejected so arbitrary executable or active content cannot
 * be stored and served.
 *
 * The extension matters as much as the type: the file is stored under the name
 * the client supplied and the static file server derives its Content-Type from
 * that extension, so a PNG header in `x.html` must not be accepted.
 */
const EXTENSIONS_BY_MIME_TYPE: Readonly<Record<string, readonly string[]>> = {
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'image/svg+xml': ['svg'],
  'application/pdf': ['pdf'],
  'audio/mpeg': ['mp3'],
  'audio/wav': ['wav'],
  'audio/x-wav': ['wav'],
  'audio/wave': ['wav'],
  'audio/vnd.wave': ['wav'],
  'audio/ogg': ['ogg', 'oga'],
  'video/ogg': ['ogv', 'ogg'],
  'application/ogg': ['ogg'],
  'video/mp4': ['mp4'],
  'video/webm': ['webm'],
  'text/plain': ['txt'],
  'text/markdown': ['md'],
  'application/json': ['json'],
};

const MIME_TYPE_BY_EXTENSION: ReadonlyMap<string, string> = new Map([
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['gif', 'image/gif'],
  ['svg', 'image/svg+xml'],
  ['webp', 'image/webp'],
  ['pdf', 'application/pdf'],
  ['mp3', 'audio/mpeg'],
  ['wav', 'audio/wav'],
  ['ogg', 'audio/ogg'],
  ['mp4', 'video/mp4'],
  ['webm', 'video/webm'],
  ['txt', 'text/plain'],
  ['md', 'text/markdown'],
  ['json', 'application/json'],
]);

export const OCTET_STREAM_MIME_TYPE = 'application/octet-stream';

export function isAllowedMimeType(mimeType: string): boolean {
  return Object.prototype.hasOwnProperty.call(EXTENSIONS_BY_MIME_TYPE, mimeType);
}

/**
 * Last extension of the file name, lower-cased and without the dot; empty when
 * the name has none. Only the last one counts (`x.png.html` is an `html` file),
 * and a name that merely starts with a dot (`.png`) has no extension.
 */
export function extensionOf(filename: string): string {
  const baseName = path.posix.basename(filename.replace(/\\/g, '/'));
  return path.posix.extname(baseName).slice(1).toLowerCase();
}

export function isExtensionAllowedForMimeType(filename: string, mimeType: string): boolean {
  if (!isAllowedMimeType(mimeType)) {
    return false;
  }
  return EXTENSIONS_BY_MIME_TYPE[mimeType].includes(extensionOf(filename));
}

/** Every accepted (MIME type, extension) pair, for callers that must stay in step with the policy. */
export function listAllowedExtensions(): ReadonlyArray<{ mimeType: string; extension: string }> {
  return Object.entries(EXTENSIONS_BY_MIME_TYPE).flatMap(([mimeType, extensions]) =>
    extensions.map((extension) => ({ mimeType, extension }))
  );
}

// Browsers render these without running script when opened as a top-level document. SVG, text
// and JSON are deliberately not listed: they can carry or be sniffed as active content.
function isInertMimeType(mimeType: string): boolean {
  return (
    (mimeType.startsWith('image/') && mimeType !== 'image/svg+xml') ||
    mimeType.startsWith('audio/') ||
    mimeType.startsWith('video/') ||
    mimeType === 'application/pdf' ||
    mimeType === 'application/ogg'
  );
}

/** True when a file with this extension (no dot, any case) is an inert type of the policy. */
export function isInertExtension(extension: string): boolean {
  const normalized = extension.toLowerCase();
  return listAllowedExtensions().some(
    (entry) => entry.extension === normalized && isInertMimeType(entry.mimeType)
  );
}

/** MIME type implied by the file extension alone; octet-stream when unknown. */
export function guessMimeTypeFromExtension(filename: string): string {
  return MIME_TYPE_BY_EXTENSION.get(extensionOf(filename)) ?? OCTET_STREAM_MIME_TYPE;
}
