import type { EncodingPort } from '@core-domain/ports/compression-port';

/**
 * Browser-based encoding adapter
 * Infrastructure layer - implements EncodingPort
 */
export class BrowserEncodingAdapter implements EncodingPort {
  toBase64(buffer: Uint8Array): string {
    let binary = '';
    const len = buffer.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary);
  }

  fromBase64(base64: string): Uint8Array {
    const binary = atob(base64);
    const len = binary.length;
    const buffer = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      buffer[i] = binary.charCodeAt(i);
    }
    return buffer;
  }
}
