import type { CompressionPort } from '@core-domain/ports/compression-port';

/**
 * Browser-based compression adapter using pako from Obsidian
 * Infrastructure layer - implements CompressionPort
 */
export class ObsidianCompressionAdapter implements CompressionPort {
  // pako is available globally in Obsidian
  private readonly pako = (window as unknown as { pako: typeof import('pako') }).pako;

  compress(data: string, level: number): Uint8Array {
    if (!this.pako) {
      throw new Error('pako library not available in Obsidian');
    }
    // Cast level to pako's expected type (0-9 or -1)
    return this.pako.gzip(data, {
      level: level as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | -1,
    });
  }

  decompress(data: Uint8Array): string {
    if (!this.pako) {
      throw new Error('pako library not available in Obsidian');
    }
    return this.pako.ungzip(data, { to: 'string' });
  }
}
