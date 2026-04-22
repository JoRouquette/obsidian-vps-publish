import { type Asset } from '@core-domain';

import {
  type UploadAssetsCommand,
  type UploadAssetsResult,
} from '../../../publishing/commands/upload-assets.command';

describe('UploadAssetsCommand', () => {
  it('should have a sessionId and assets array', () => {
    const assets: Asset[] = [
      {
        relativePath: 'assets/file1.png',
        vaultPath: 'vault/assets/file1.png',
        fileName: 'file1.png',
        mimeType: 'image/png',
        contentBase64: 'YmFzZTY0LWNvbnRlbnQ=',
      },
      {
        relativePath: 'assets/file2.jpg',
        vaultPath: 'vault/assets/file2.jpg',
        fileName: 'file2.jpg',
        mimeType: 'image/jpeg',
        contentBase64: 'bW9yZS1iYXNlNjQ=',
      },
    ];
    const command: UploadAssetsCommand = {
      sessionId: 'session-123',
      assets,
    };

    expect(command.sessionId).toBe('session-123');
    expect(command.assets).toHaveLength(2);
    expect(command.assets[0].fileName).toBe('file1.png');
  });
});

describe('UploadAssetsResult', () => {
  it('should represent a successful upload with no errors', () => {
    const result: UploadAssetsResult = {
      sessionId: 'session-123',
      published: 2,
    };

    expect(result.sessionId).toBe('session-123');
    expect(result.published).toBe(2);
    expect(result.errors).toBeUndefined();
  });

  it('should represent a partial upload with errors', () => {
    const result: UploadAssetsResult = {
      sessionId: 'session-456',
      published: 1,
      errors: [{ assetName: 'file2.jpg', message: 'Upload failed' }],
    };

    expect(result.sessionId).toBe('session-456');
    expect(result.published).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0].assetName).toBe('file2.jpg');
    expect(result.errors?.[0].message).toBe('Upload failed');
  });

  it('should allow an empty errors array', () => {
    const result: UploadAssetsResult = {
      sessionId: 'session-789',
      published: 0,
      errors: [],
    };

    expect(result.errors).toEqual([]);
  });
});
