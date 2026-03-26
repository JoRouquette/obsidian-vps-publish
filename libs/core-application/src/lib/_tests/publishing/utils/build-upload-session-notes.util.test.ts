import { buildUploadSessionNotes } from '../../../publishing/utils/build-upload-session-notes.util';

describe('buildUploadSessionNotes', () => {
  const note = {
    noteId: 'n1',
    title: 'Title',
    content: 'Body [[Target]]',
    vaultPath: 'Vault/Title.md',
    relativePath: 'Title.md',
    frontmatter: { flat: {}, nested: {}, tags: [] },
    folderConfig: {
      id: 'f1',
      vaultFolder: 'Vault',
      routeBase: '/docs',
      vpsId: 'vps',
      ignoredCleanupRuleIds: [],
    },
    routing: {
      slug: 'title',
      path: '',
      routeBase: '/docs',
      fullPath: '/docs/title',
    },
    publishedAt: new Date('2026-03-26T00:00:00.000Z'),
    eligibility: { isPublishable: true },
    assets: [
      {
        raw: '![[cover.png]]',
        target: 'cover.png',
        kind: 'image',
        display: { classes: [], rawModifiers: [] },
      },
    ],
    resolvedWikilinks: [
      {
        raw: '[[Target]]',
        target: 'Target',
        path: '/docs/target',
        kind: 'note',
        isResolved: true,
      },
    ],
    leafletBlocks: [{ id: 'map-1' }],
  } as any;

  it('builds a lean source-package note for upload', () => {
    const [lean] = buildUploadSessionNotes([note]) as any[];

    expect(lean).toMatchObject({
      noteId: note.noteId,
      title: note.title,
      vaultPath: note.vaultPath,
      relativePath: note.relativePath,
      content: note.content,
      frontmatter: note.frontmatter,
      folderConfig: note.folderConfig,
      publishedAt: note.publishedAt,
      eligibility: note.eligibility,
      assets: note.assets,
      leafletBlocks: note.leafletBlocks,
    });
    expect(lean).not.toHaveProperty('routing');
    expect(lean).not.toHaveProperty('resolvedWikilinks');
  });
});
