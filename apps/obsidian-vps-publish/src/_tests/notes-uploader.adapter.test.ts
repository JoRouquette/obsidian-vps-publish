import { NotesUploaderAdapter } from '../lib/infra/notes-uploader.adapter';

const makeLogger = () =>
  ({
    child: jest.fn().mockReturnThis(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as any;

describe('NotesUploaderAdapter', () => {
  const sessionClient = { uploadNotes: jest.fn() } as any;
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
    const adapter = new NotesUploaderAdapter(sessionClient, 's1', makeLogger(), 1000);
    await expect(adapter.upload([] as any)).resolves.toBe(false);
    expect(sessionClient.uploadNotes).not.toHaveBeenCalled();
  });

  it('uploade les notes en batch', async () => {
    const adapter = new NotesUploaderAdapter(sessionClient, 's1', makeLogger(), 10_000);
    await adapter.upload([sampleNote, sampleNote]);
    expect(sessionClient.uploadNotes).toHaveBeenCalledTimes(1);
    expect(sessionClient.uploadNotes).toHaveBeenCalledWith('s1', expect.any(Array));
  });
});
