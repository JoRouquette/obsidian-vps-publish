import { ChunkedUploadService } from '../../publishing/services/chunked-upload.service';

const makeLogger = () =>
  ({
    child: jest.fn().mockReturnThis(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as any;

describe('ChunkedUploadService', () => {
  it('keeps every serialized chunk under maxRequestBytes', async () => {
    const compression = {
      compress: jest.fn(async (input: string) => new TextEncoder().encode(input)),
    } as any;
    const encoding = {
      toBase64: jest.fn((bytes: Uint8Array) => Buffer.from(bytes).toString('base64')),
    } as any;

    const logger = makeLogger();
    const service = new ChunkedUploadService(compression, encoding, logger, {
      maxChunkSize: 512,
      maxRequestBytes: 700,
      retryAttempts: 1,
    });

    const payload = {
      assets: [
        {
          relativePath: '_assets/huge.bin',
          vaultPath: 'vault/huge.bin',
          fileName: 'huge.bin',
          mimeType: 'application/octet-stream',
          contentBase64: Buffer.from('x'.repeat(5000)).toString('base64'),
        },
      ],
    };

    const chunks = await service.prepareUpload('upload-1', payload);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      const requestBodySize = new TextEncoder().encode(JSON.stringify(chunk)).length;
      expect(requestBodySize).toBeLessThanOrEqual(700);
    }
    expect(logger.debug).toHaveBeenCalledWith(
      'Upload prepared',
      expect.objectContaining({
        uploadId: 'upload-1',
        chunk_prepare_duration_ms: expect.any(Number),
      })
    );
  });

  it('does not retry non-retryable payload-too-large errors', async () => {
    const compression = {
      compress: jest.fn(async (input: string) => new TextEncoder().encode(input)),
    } as any;
    const encoding = {
      toBase64: jest.fn((bytes: Uint8Array) => Buffer.from(bytes).toString('base64')),
    } as any;

    const service = new ChunkedUploadService(compression, encoding, makeLogger(), {
      maxChunkSize: 64,
      retryAttempts: 3,
    });

    const uploader = {
      uploadChunk: jest.fn().mockRejectedValue(new Error('HTTP Error 413 Payload Too Large')),
    };

    const chunk = {
      metadata: {
        uploadId: 'upload-413',
        chunkIndex: 0,
        totalChunks: 1,
        originalSize: 10,
        compressedSize: 10,
      },
      data: 'AAAA',
    };

    await expect(service.uploadChunk(chunk, uploader)).rejects.toThrow('413 Payload Too Large');
    expect(uploader.uploadChunk).toHaveBeenCalledTimes(1);
  });
});
