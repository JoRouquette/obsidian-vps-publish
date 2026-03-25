import { AssetsUploaderAdapter } from '../lib/infra/assets-uploader.adapter';

const makeLogger = () =>
  ({
    child: jest.fn().mockReturnThis(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as any;

const makeGuidGenerator = () =>
  ({
    generateGuid: jest.fn().mockReturnValue('test-guid-123'),
  }) as any;

const makeAssetHasher = () =>
  ({
    computeHash: jest.fn().mockResolvedValue('mock-hash-abc123'),
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
    const adapter = new AssetsUploaderAdapter(
      sessionClient,
      's1',
      makeGuidGenerator(),
      makeAssetHasher(),
      makeLogger(),
      1024
    );
    await expect(adapter.upload([])).resolves.toBe(false);
    expect(sessionClient.uploadAssets).not.toHaveBeenCalled();
  });

  it('upload en lots et encode en base64', async () => {
    const adapter = new AssetsUploaderAdapter(
      sessionClient,
      's1',
      makeGuidGenerator(),
      makeAssetHasher(),
      makeLogger(),
      200
    );
    const asset = {
      relativeAssetPath: 'img/a.png',
      vaultPath: '/vault/img/a.png',
      fileName: 'a.png',
      content: new TextEncoder().encode('data'),
    } as any;

    await adapter.upload([asset, asset]);

    expect(sessionClient.uploadAssetChunk).toHaveBeenCalled();
    const firstCall = sessionClient.uploadAssetChunk.mock.calls[0];
    expect(firstCall[0]).toBe('s1');
    expect(firstCall[1]).toHaveProperty('metadata');
    expect(firstCall[1]).toHaveProperty('data');
  });

  it("lève si un asset n'a pas de contenu", async () => {
    const adapter = new AssetsUploaderAdapter(
      sessionClient,
      's1',
      makeGuidGenerator(),
      makeAssetHasher(),
      makeLogger(),
      200
    );
    const bad = {
      relativeAssetPath: 'img/a.png',
      vaultPath: '/vault/img/a.png',
      fileName: 'a.png',
      content: undefined,
    } as any;

    await expect(adapter.upload([bad])).rejects.toThrow('ResolvedAssetFile has no content');
  });

  it('désactive la déduplication client des assets quand l’option est décochée', async () => {
    const hasher = makeAssetHasher();
    const adapter = new AssetsUploaderAdapter(
      sessionClient,
      's1',
      makeGuidGenerator(),
      hasher,
      makeLogger(),
      200,
      undefined,
      1,
      ['mock-hash-abc123'],
      false
    );
    const asset = {
      relativeAssetPath: 'img/a.png',
      vaultPath: '/vault/img/a.png',
      fileName: 'a.png',
      content: new TextEncoder().encode('data'),
    } as any;

    await expect(adapter.upload([asset])).resolves.toBe(true);

    expect(hasher.computeHash).not.toHaveBeenCalled();
    expect(sessionClient.uploadAssetChunk).toHaveBeenCalled();
  });
  it('reuses prepared asset payloads between getBatchInfo and upload', async () => {
    const adapter = new AssetsUploaderAdapter(
      sessionClient,
      's1',
      makeGuidGenerator(),
      makeAssetHasher(),
      makeLogger(),
      200
    );
    const buildApiAssetSpy = jest.spyOn(adapter as any, 'buildApiAsset');
    const assets = [
      {
        relativeAssetPath: 'img/a.png',
        vaultPath: '/vault/img/a.png',
        fileName: 'a.png',
        content: new TextEncoder().encode('data-a'),
      },
      {
        relativeAssetPath: 'img/b.png',
        vaultPath: '/vault/img/b.png',
        fileName: 'b.png',
        content: new TextEncoder().encode('data-b'),
      },
    ] as any;

    const batchInfo = await adapter.getBatchInfo(assets);
    await adapter.upload(assets);

    expect(batchInfo.batchCount).toBeGreaterThan(0);
    expect(buildApiAssetSpy).toHaveBeenCalledTimes(2);
  });
});
