import { listAllowedExtensions } from '../../../validation/asset-mime-policy';
import { isInertAssetPath } from '../security-headers';

const INERT_MIME_PREFIXES = ['audio/', 'video/'];
const INERT_MIME_TYPES = ['application/pdf', 'application/ogg'];

function isRasterImage(mimeType: string): boolean {
  return mimeType.startsWith('image/') && mimeType !== 'image/svg+xml';
}

function isExpectedInert(mimeType: string): boolean {
  return (
    isRasterImage(mimeType) ||
    INERT_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix)) ||
    INERT_MIME_TYPES.includes(mimeType)
  );
}

describe('isInertAssetPath', () => {
  const entries = listAllowedExtensions();

  it('covers every extension of the MIME policy', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries.filter((entry) => isExpectedInert(entry.mimeType)))(
    'treats .$extension ($mimeType) as inert',
    ({ extension }) => {
      expect(isInertAssetPath(`/assets/file.${extension}`)).toBe(true);
      expect(isInertAssetPath(`/assets/file.${extension.toUpperCase()}`)).toBe(true);
    }
  );

  it.each(entries.filter((entry) => !isExpectedInert(entry.mimeType)))(
    'sandboxes .$extension ($mimeType)',
    ({ extension }) => {
      expect(isInertAssetPath(`/assets/file.${extension}`)).toBe(false);
    }
  );

  it.each([
    ['/assets/page.html'],
    ['/assets/script.js'],
    ['/assets/noextension'],
    ['/assets/.png'],
  ])('sandboxes %s, which the policy does not know as inert', (filePath) => {
    expect(isInertAssetPath(filePath)).toBe(false);
  });
});
