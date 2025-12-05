import type { CompressionPort } from '@core-domain/ports/compression-port';

// pako will be loaded dynamically to avoid ESLint errors
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pakoInstance: any = null;

/**
 * Node.js compression adapter using pako
 * Infrastructure layer - implements CompressionPort
 */
export class NodeCompressionAdapter implements CompressionPort {
  private get pako() {
    if (!pakoInstance) {
      // Dynamic import to avoid ESLint module boundary issues
      pakoInstance = require('pako');
    }
    return pakoInstance;
  }

  compress(data: string, level: number): Uint8Array {
    // Cast level to pako's expected type (0-9 or -1)
    return this.pako.gzip(data, {
      level: level as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | -1,
    });
  }

  decompress(data: Uint8Array): string {
    return this.pako.ungzip(data, { to: 'string' });
  }
}
