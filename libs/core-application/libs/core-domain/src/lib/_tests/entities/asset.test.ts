import { Asset } from '../../entities/asset';

describe('Asset type', () => {
  const validAsset: Asset = {
    relativePath: 'images/photo.jpg',
    vaultPath: '/vault/images/photo.jpg',
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    contentBase64: 'aGVsbG8gd29ybGQ=',
  };

  it('should have all required properties', () => {
    expect(validAsset).toHaveProperty('relativePath');
    expect(validAsset).toHaveProperty('vaultPath');
    expect(validAsset).toHaveProperty('fileName');
    expect(validAsset).toHaveProperty('mimeType');
    expect(validAsset).toHaveProperty('contentBase64');
  });

  it('should have correct types for each property', () => {
    expect(typeof validAsset.relativePath).toBe('string');
    expect(typeof validAsset.vaultPath).toBe('string');
    expect(typeof validAsset.fileName).toBe('string');
    expect(typeof validAsset.mimeType).toBe('string');
    expect(typeof validAsset.contentBase64).toBe('string');
  });

  it('should allow different mime types', () => {
    const asset: Asset = { ...validAsset, mimeType: 'application/pdf' };
    expect(asset.mimeType).toBe('application/pdf');
  });

  it('should allow empty contentBase64', () => {
    const asset: Asset = { ...validAsset, contentBase64: '' };
    expect(asset.contentBase64).toBe('');
  });

  it('should allow nested relative paths', () => {
    const asset: Asset = { ...validAsset, relativePath: 'docs/2024/notes.txt' };
    expect(asset.relativePath).toBe('docs/2024/notes.txt');
  });

  it('should match the Asset type definition', () => {
    // This test is for type-checking only; if this compiles, the type matches.
    const checkType: Asset = validAsset;
    expect(checkType).toBeDefined();
  });
});
