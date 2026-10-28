import type { ChunkedData } from '@core-domain/entities/chunked-data';
import type { CompressionPort, EncodingPort } from '@core-domain/ports/compression-port';

import { ChunkAssemblerService } from '../../publishing/services/chunk-assembler.service';

const compression = {} as CompressionPort;
const encoding = {
  fromBase64: (value: string): Uint8Array => new TextEncoder().encode(value),
} as unknown as EncodingPort;

const chunk = (uploadId: string): ChunkedData =>
  ({
    data: 'aGVsbG8=',
    metadata: { uploadId, chunkIndex: 0, totalChunks: 2 },
  }) as unknown as ChunkedData;

describe('ChunkAssemblerService cleanup timer', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window');
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('drops expired chunk stores on the cleanup interval and stops on shutdown', () => {
    jest.useFakeTimers();
    const service = new ChunkAssemblerService(compression, encoding, undefined, {
      cleanupIntervalMs: 1000,
      chunkExpirationMs: 500,
    });

    service.storeChunk(chunk('upload-1'));
    expect(service.getReceivedCount('upload-1')).toBe(1);

    jest.advanceTimersByTime(1000);
    expect(service.getReceivedCount('upload-1')).toBe(0);

    service.shutdown();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('uses the window timers when a window exists and clears them on shutdown', () => {
    const setInterval = jest.fn(() => 42);
    const clearInterval = jest.fn();
    Object.defineProperty(globalThis, 'window', {
      value: { setInterval, clearInterval, setTimeout: jest.fn() },
      configurable: true,
      writable: true,
    });

    const service = new ChunkAssemblerService(compression, encoding, undefined, {
      cleanupIntervalMs: 1000,
    });
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);

    service.shutdown();
    expect(clearInterval).toHaveBeenCalledWith(42);
  });
});
