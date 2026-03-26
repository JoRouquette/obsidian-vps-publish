import { NotesUploaderAdapter } from '../lib/infra/notes-uploader.adapter';

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

describe('NotesUploaderAdapter', () => {
  const sessionClient = {
    uploadNotes: jest.fn(),
    uploadChunk: jest.fn().mockResolvedValue(undefined),
  } as any;
  const sampleNote = {
    noteId: 'n1',
    title: 't',
    content: 'c',
    vaultPath: 'v',
    relativePath: 'r',
    frontmatter: { flat: {}, nested: {}, tags: [] },
    folderConfig: {
      id: 'f',
      vaultFolder: '',
      routeBase: '',
      vpsId: 'vps',
      ignoredCleanupRuleIds: [],
    },
    routing: { fullPath: '/r', path: '/r', slug: 'r', routeBase: '/' },
    publishedAt: new Date(),
    eligibility: { isPublishable: true },
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('retourne false si aucune note', async () => {
    const adapter = new NotesUploaderAdapter(
      sessionClient,
      's1',
      makeGuidGenerator(),
      makeLogger(),
      1000
    );
    await expect(adapter.upload([] as any)).resolves.toBe(false);
    expect(sessionClient.uploadNotes).not.toHaveBeenCalled();
  });

  it('uploade les notes en batch', async () => {
    const adapter = new NotesUploaderAdapter(
      sessionClient,
      's1',
      makeGuidGenerator(),
      makeLogger(),
      10_000
    );
    await adapter.upload([sampleNote, sampleNote]);
    // Should upload via chunks
    expect(sessionClient.uploadChunk).toHaveBeenCalled();
    const firstCall = sessionClient.uploadChunk.mock.calls[0];
    expect(firstCall[0]).toBe('s1'); // sessionId
    expect(firstCall[1]).toHaveProperty('metadata');
    expect(firstCall[1]).toHaveProperty('data');
  });

  it('reuses cached batch plans between getBatchInfo and upload', async () => {
    const adapter = new NotesUploaderAdapter(
      sessionClient,
      's1',
      makeGuidGenerator(),
      makeLogger(),
      10_000
    );
    const notes = [
      sampleNote,
      {
        ...sampleNote,
        noteId: 'n2',
        vaultPath: 'v2',
        relativePath: 'r2',
        routing: { fullPath: '/r2', path: '/r2', slug: 'r2', routeBase: '/' },
      },
    ];

    const batchInfo = adapter.getBatchInfo(notes as any);

    await adapter.upload(notes as any);

    expect(batchInfo.batchCount).toBeGreaterThan(0);
    expect((adapter as any).batchesByNotes.get(notes)).toHaveLength(batchInfo.batchCount);
  });

  it('builds lean upload notes when api-owned deterministic transforms are enabled', async () => {
    const adapter = new NotesUploaderAdapter(
      sessionClient,
      's1',
      makeGuidGenerator(),
      makeLogger(),
      10_000,
      undefined,
      undefined,
      undefined,
      true
    );

    const notes = [
      {
        ...sampleNote,
        assets: [
          {
            raw: '![[cover.png]]',
            target: 'cover.png',
            kind: 'image',
            display: { classes: [], rawModifiers: [] },
          },
        ],
        resolvedWikilinks: [
          { raw: '[[Target]]', target: 'Target', path: '/target', kind: 'note', isResolved: true },
        ],
      },
    ];

    adapter.getBatchInfo(notes as any);

    const uploadNotes = (adapter as any).uploadNotesByNotes.get(notes);
    expect(uploadNotes).toHaveLength(1);
    expect(uploadNotes[0]).not.toHaveProperty('routing');
    expect(uploadNotes[0]).not.toHaveProperty('resolvedWikilinks');
    expect(uploadNotes[0]).toHaveProperty('assets');
  });
});
