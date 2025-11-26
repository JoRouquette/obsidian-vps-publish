import { CreateSessionBodyDto } from '../infra/http/express/dto/create-session-body.dto';
import { FinishSessionBodyDto } from '../infra/http/express/dto/finish-session-body.dto';
import { ApiAssetsBodyDto } from '../infra/http/express/dto/upload-assets.dto';
import { UploadSessionNotesBodyDto } from '../infra/http/express/dto/upload-session-notes-body.dto';

describe('DTO validation', () => {
  it('validates CreateSessionBodyDto', () => {
    const parsed = CreateSessionBodyDto.safeParse({
      notesPlanned: 1,
      assetsPlanned: 2,
      batchConfig: { maxBytesPerRequest: 1000 },
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid CreateSessionBodyDto', () => {
    const parsed = CreateSessionBodyDto.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it('validates FinishSessionBodyDto', () => {
    const parsed = FinishSessionBodyDto.safeParse({ notesProcessed: 1, assetsProcessed: 1 });
    expect(parsed.success).toBe(true);
  });

  it('validates ApiAssetsBodyDto', () => {
    const parsed = ApiAssetsBodyDto.safeParse({
      assets: [
        {
          fileName: 'a',
          mimeType: 'text/plain',
          contentBase64: 'YQ==',
          relativePath: 'a',
          vaultPath: 'a',
        },
        {
          fileName: 'b',
          mimeType: 'text/plain',
          contentBase64: 'Yg==',
          relativePath: 'b',
          vaultPath: 'b',
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('validates UploadSessionNotesBodyDto', () => {
    const parsed = UploadSessionNotesBodyDto.safeParse({
      notes: [
        {
          noteId: '1',
          title: 'T',
          content: 'c',
          publishedAt: new Date().toISOString(),
          routing: { fullPath: '/t', slug: 't', path: '/t', routeBase: '/t' },
          eligibility: { isPublishable: true },
          vaultPath: 'v',
          relativePath: 'r',
          frontmatter: { tags: [], flat: {}, nested: {} },
          folderConfig: {
            id: 'f',
            vaultFolder: 'v',
            routeBase: '/t',
            vpsId: 'vps',
            sanitization: [],
          },
          vpsConfig: { id: 'vps', name: 'vps', url: 'http://x', apiKey: 'k' },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects UploadSessionNotesBodyDto without eligibility', () => {
    const parsed = UploadSessionNotesBodyDto.safeParse({
      notes: [
        {
          noteId: '1',
          title: 'T',
          content: 'c',
          publishedAt: new Date().toISOString(),
          routing: { fullPath: '/t', slug: 't', path: '/t', routeBase: '/t' },
          vaultPath: 'v',
          relativePath: 'r',
          frontmatter: { tags: [], flat: {}, nested: {} },
          folderConfig: { id: 'f', vaultFolder: 'v', routeBase: '/t', vpsId: 'vps' },
          vpsConfig: { id: 'vps', name: 'vps', url: 'http://x', apiKey: 'k' },
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it('validates sanitization rules shape', () => {
    const parsed = UploadSessionNotesBodyDto.safeParse({
      notes: [
        {
          noteId: '1',
          title: 'T',
          content: 'c',
          publishedAt: new Date().toISOString(),
          routing: { fullPath: '/t', slug: 't', path: '/t', routeBase: '/t' },
          eligibility: { isPublishable: true },
          vaultPath: 'v',
          relativePath: 'r',
          frontmatter: { tags: [], flat: {}, nested: {} },
          folderConfig: {
            id: 'f',
            vaultFolder: 'v',
            routeBase: '/t',
            vpsId: 'vps',
            sanitization: [{ name: 'rule', regex: 'foo', replacement: '', isEnabled: true }],
          },
          vpsConfig: { id: 'vps', name: 'vps', url: 'http://x', apiKey: 'k' },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});
