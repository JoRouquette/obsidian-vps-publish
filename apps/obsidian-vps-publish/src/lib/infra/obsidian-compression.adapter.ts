import type { CompressionPort } from '@core-domain/ports/compression-port';

import { YieldScheduler } from '../utils/yield-scheduler.util';

/**
 * Browser-based compression adapter using native CompressionStream API
 * Infrastructure layer - implements CompressionPort
 */
export class ObsidianCompressionAdapter implements CompressionPort {
  async compress(data: string, _level: number): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const input = encoder.encode(data);

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(input);
        controller.close();
      },
    });

    const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
    const chunks: Uint8Array[] = [];

    const reader = compressedStream.getReader();
    const scheduler = new YieldScheduler(10, 50); // Yield every 10 ops or 50ms

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      await scheduler.maybeYield(); // Yield every 10 chunks or 50ms
    }

    // Concatenate all chunks with yielding
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
      await scheduler.maybeYield(); // Yield during concatenation too
    }

    return result;
  }

  async decompress(data: Uint8Array): Promise<string> {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });

    const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
    const chunks: Uint8Array[] = [];

    const reader = decompressedStream.getReader();
    const scheduler = new YieldScheduler(10, 50); // Yield every 10 ops or 50ms

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      await scheduler.maybeYield(); // Yield every 10 chunks or 50ms
    }

    // Concatenate and decode with yielding
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
      await scheduler.maybeYield(); // Yield during concatenation too
    }

    const decoder = new TextDecoder();
    return decoder.decode(result);
  }
}
