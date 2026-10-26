import type { ServerResponse } from 'node:http';
import path from 'node:path';

import { isInertExtension } from '../../validation/asset-mime-policy';

/**
 * CSP for files under `/assets` opened as a top-level document: no script, no
 * network, unique opaque origin. Embedding through `<img>` is unaffected.
 */
export const ASSET_SANDBOX_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

/**
 * CSP for rendered notes under `/content` opened as a top-level document. Images
 * stay allowed because the notes embed them.
 */
export const CONTENT_SANDBOX_CSP =
  "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; sandbox";

const NOSNIFF_HEADER = 'X-Content-Type-Options';
const NOSNIFF_VALUE = 'nosniff';

/**
 * Whether the file is of a type whose browser rendering cannot run script (raster images,
 * audio, video, PDF), taken from the upload MIME policy so the two lists cannot drift apart.
 * Everything else served from `/assets` gets the sandbox CSP, so a type added to the policy
 * that is not listed as inert is sandboxed by default.
 */
export function isInertAssetPath(filePath: string): boolean {
  return isInertExtension(path.extname(filePath).slice(1));
}

export function applyNosniffHeader(res: ServerResponse): void {
  res.setHeader(NOSNIFF_HEADER, NOSNIFF_VALUE);
}

export function applySandboxHeaders(res: ServerResponse, contentSecurityPolicy: string): void {
  res.setHeader('Content-Security-Policy', contentSecurityPolicy);
  applyNosniffHeader(res);
}
