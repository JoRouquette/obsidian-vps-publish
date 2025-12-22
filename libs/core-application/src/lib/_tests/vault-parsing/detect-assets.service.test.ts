import type { PublishableNote } from '@core-domain/entities/publishable-note';

import { DetectAssetsService } from '../../vault-parsing/services/detect-assets.service';
import { NoopLogger } from '../helpers/fake-logger';

describe('DetectAssetsService', () => {
  const logger = new NoopLogger();
  const service = new DetectAssetsService(logger);

  const note = {
    noteId: '1',
    title: 'A',
    vaultPath: 'Vault/A.md',
    relativePath: 'A.md',
    content: 'Image ![[img.png|center]] and pdf ![[doc.pdf]]',
    frontmatter: { flat: {}, nested: {}, tags: [] },
    folderConfig: {
      id: 'f',
      vaultFolder: 'Vault',
      routeBase: '/blog',
      vpsId: 'vps',
      ignoredCleanupRuleIds: [],
    },
    publishedAt: new Date(),
    eligibility: { isPublishable: true },
    routing: { slug: '', path: '', routeBase: '', fullPath: '' },
  } as PublishableNote;

  it('detects assets with kind and display options', () => {
    const [withAssets] = service.process([note]);
    expect(withAssets.assets?.length).toBe(2);
    expect(withAssets.assets?.[0].origin).toBe('content');
    expect(withAssets.assets?.[0].kind).toBe('image');
    expect(withAssets.assets?.[0].display?.alignment).toBe('center');
    expect(withAssets.assets?.[1].kind).toBe('pdf');
    expect(withAssets.assets?.[0].target).toBe('img.png');
  });

  it('detects assets declared in frontmatter', () => {
    const withFrontmatter: PublishableNote = {
      ...note,
      content: 'No embeds here',
      frontmatter: { flat: {}, nested: { cover: '![[cover.png]]' }, tags: [] },
    };

    const [result] = service.process([withFrontmatter]);

    expect(result.assets?.length).toBe(1);
    expect(result.assets?.[0].origin).toBe('frontmatter');
    expect(result.assets?.[0].frontmatterPath).toBe('cover');
    expect(result.assets?.[0].target).toBe('cover.png');
  });
});
