import { gunzipSync, gzipSync } from 'node:zlib';

import type { CompressionPort } from '@core-domain/ports/compression-port';

/**
 * Node.js compression adapter using native zlib
 * Infrastructure layer - implements CompressionPort
 */
export class NodeCompressionAdapter implements CompressionPort {
  async compress(data: string, level: number): Promise<Uint8Array> {
    const buffer = Buffer.from(data, 'utf-8');
    // zlib level: 0-9 (0=no compression, 9=max compression)
    const compressed = gzipSync(buffer, { level: Math.max(0, Math.min(9, level)) });
    return new Uint8Array(compressed);
  }

  async decompress(data: Uint8Array): Promise<string> {
    const buffer = Buffer.from(data);
    const decompressed = gunzipSync(buffer);
    return decompressed.toString('utf-8');
  }
}
