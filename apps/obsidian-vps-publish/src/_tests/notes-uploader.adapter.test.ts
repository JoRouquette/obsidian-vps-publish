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
});
