import { AssetsUploaderAdapter } from '../lib/infra/assets-uploader.adapter';
import { Buffer } from 'buffer';

const makeLogger = () =>
  ({
    child: jest.fn().mockReturnThis(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as any;

describe('AssetsUploaderAdapter', () => {
  const sessionClient = { uploadAssets: jest.fn() } as any;

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

    expect(sessionClient.uploadAssets).toHaveBeenCalledTimes(2);
    const payload = sessionClient.uploadAssets.mock.calls[0][1] as any[];
    expect(payload[0].contentBase64).toBe(Buffer.from('data').toString('base64'));
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
