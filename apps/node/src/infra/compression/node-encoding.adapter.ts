import type { EncodingPort } from '@core-domain/ports/compression-port';

/**
 * Node.js encoding adapter
 * Infrastructure layer - implements EncodingPort
 */
export class NodeEncodingAdapter implements EncodingPort {
  toBase64(buffer: Uint8Array): string {
    return Buffer.from(buffer).toString('base64');
  }

  fromBase64(base64: string): Uint8Array {
    return Buffer.from(base64, 'base64');
  }
}
