import { UploadBodyDto } from '../src/infra/http/express/dto/UploadNotesDto';

describe('UploadBodyDto', () => {
  it('should accept a valid payload', () => {
    const result = UploadBodyDto.safeParse({
      notes: [
        {
          id: 't1',
          slug: 'angle-mort',
          route: '/codex',
          relativePath: '',
          markdown: '# test',
          frontmatter: {
            flat: {},
            nested: {},
          },
          vaultPath: 'Codex/Angle mort.md',
          publishedAt: '2025-11-09T18:45:50.009Z',
          updatedAt: '2025-11-09T18:45:50.009Z',
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('should reject missing notes', () => {
    const result = UploadBodyDto.safeParse({ notes: [] });
    expect(result.success).toBe(false);
  });
});
