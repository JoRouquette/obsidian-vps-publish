import { CreateSessionBodyDto } from '../infra/http/express/dto/CreateSessionBodyDto';
import { FinishSessionBodyDto } from '../infra/http/express/dto/FinishSessionBodyDto';
import { ApiAssetsBodyDto } from '../infra/http/express/dto/UploadAssetsDto';
import { UploadSessionNotesBodyDto } from '../infra/http/express/dto/UploadSessionNotesBodyDto';

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
          routing: { id: '1', fullPath: '/t', slug: 't', path: '/t', routeBase: '/t' },
          vaultPath: 'v',
          relativePath: 'r',
          frontmatter: { tags: [], flat: {}, nested: {} },
          folderConfig: { id: 'f', vaultFolder: 'v', routeBase: '/t', vpsId: 'vps' },
          vpsConfig: { id: 'vps', name: 'vps', url: 'http://x', apiKey: 'k' },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});
