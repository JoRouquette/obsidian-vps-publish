import { ObsidianAssetsVaultAdapter } from '../lib/infra/obsidian-assets-vault.adapter';

const makeLogger = () =>
  ({
    child: jest.fn().mockReturnThis(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as any;

const makeFile = (path: string) =>
  ({
    path,
    name: path.split('/').pop() ?? path,
  }) as any;

describe('ObsidianAssetsVaultAdapter', () => {
  it('indexes files once and prefers matches inside the configured assets folder', async () => {
    const assetOutsideFolder = makeFile('misc/logo.png');
    const assetInsideFolder = makeFile('assets/icons/logo.png');
    const readBinary = jest.fn(async () => new Uint8Array([1, 2, 3]));
    const app = {
      vault: {
        getFiles: jest.fn(() => [assetOutsideFolder, assetInsideFolder]),
        readBinary,
      },
    } as any;

    const adapter = new ObsidianAssetsVaultAdapter(app, makeLogger());
    const notes = [
      {
        vaultPath: 'notes/home.md',
        assets: [{ target: 'logo.png' }],
      },
    ] as any;

    const resolvedAssets = await adapter.resolveAssetsFromNotes(notes, 'assets', true);

    expect(app.vault.getFiles).toHaveBeenCalledTimes(1);
    expect(readBinary).toHaveBeenCalledWith(assetInsideFolder);
    expect(resolvedAssets).toHaveLength(1);
    expect(resolvedAssets[0]).toEqual(
      expect.objectContaining({
        vaultPath: 'assets/icons/logo.png',
        fileName: 'logo.png',
      })
    );
  });
});
