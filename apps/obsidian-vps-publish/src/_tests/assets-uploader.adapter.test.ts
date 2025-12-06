import { AssetsUploaderAdapter } from '../lib/infra/assets-uploader.adapter';

const makeLogger = () =>
  ({
    child: jest.fn().mockReturnThis(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as any;

describe('AssetsUploaderAdapter', () => {
  const sessionClient = {
    uploadAssets: jest.fn(),
    uploadAssetChunk: jest.fn().mockResolvedValue(undefined),
  } as any;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('retourne false si aucun asset', async () => {
    const adapter = new AssetsUploaderAdapter(sessionClient, 's1', makeLogger(), 1024);
    await expect(adapter.upload([])).resolves.toBe(false);
    expect(sessionClient.uploadAssets).not.toHaveBeenCalled();
  });

  it('upload en lots et encode en base64', async () => {
    const adapter = new AssetsUploaderAdapter(sessionClient, 's1', makeLogger(), 200);
    const asset = {
      relativeAssetPath: 'img/a.png',
      vaultPath: '/vault/img/a.png',
      fileName: 'a.png',
      content: new TextEncoder().encode('data'),
    } as any;

    await adapter.upload([asset, asset]);

    // Should upload via chunks
    expect(sessionClient.uploadAssetChunk).toHaveBeenCalled();
    const firstCall = sessionClient.uploadAssetChunk.mock.calls[0];
    expect(firstCall[0]).toBe('s1'); // sessionId
    expect(firstCall[1]).toHaveProperty('metadata');
    expect(firstCall[1]).toHaveProperty('data');
  });

  it('lève si un asset n’a pas de contenu', async () => {
    const adapter = new AssetsUploaderAdapter(sessionClient, 's1', makeLogger(), 200);
    const bad = {
      relativeAssetPath: 'img/a.png',
      vaultPath: '/vault/img/a.png',
      fileName: 'a.png',
      content: undefined,
    } as any;

    await expect(adapter.upload([bad])).rejects.toThrow('ResolvedAssetFile has no content');
  });
});
