import {
  PublishableNote,
  NoteCore,
  DomainFrontmatter,
  NoteWithAssets,
  NoteWithWikiLinks,
  NoteRoutingInfo,
  AssetRef,
  AssetDisplayOptions,
  FolderConfig,
  SanitizationRules,
  VpsConfig,
  WikilinkRef,
  ResolvedWikilink,
} from '../../entities/Note';

describe('Note Entities', () => {
  const baseFrontmatter: DomainFrontmatter = {
    flat: { foo: 'bar' },
    nested: { baz: { qux: 1 } },
  };

  const folderConfig: FolderConfig = {
    id: 'folder1',
    vaultFolder: 'notes',
    routeBase: '/notes',
    vpsId: 'vps1',
    sanitization: { removeFencedCodeBlocks: true },
  };

  const vpsConfig: VpsConfig = {
    id: 'vps1',
    name: 'Main VPS',
    url: 'https://example.com',
    apiKey: 'secret',
  };

  const assetDisplay: AssetDisplayOptions = {
    alignment: 'center',
    width: 400,
    classes: ['img-responsive'],
    rawModifiers: ['mod1'],
  };

  const assetRef: AssetRef = {
    raw: '![img](img.png)',
    target: 'img.png',
    kind: 'image',
    display: assetDisplay,
  };

  const wikilinkRef: WikilinkRef = {
    raw: '[[NoteA]]',
    target: 'NoteA',
    path: '/notes/NoteA',
    kind: 'note',
    alias: 'AliasA',
    subpath: 'Section1',
  };

  const resolvedWikilink: ResolvedWikilink = {
    ...wikilinkRef,
    isResolved: true,
    targetNoteId: 'note-a-id',
    href: '/notes/NoteA#Section1',
  };

  const routing: NoteRoutingInfo = {
    id: 'note1',
    slug: 'note-1',
    path: '/notes/note-1',
    routeBase: '/notes',
    fullPath: '/notes/note-1',
  };

  const noteCore: NoteCore = {
    noteId: 'note1',
    title: 'Test Note',
    vaultPath: '/vault/notes/note1.md',
    relativePath: 'notes/note1.md',
    content: 'This is a test note.',
    frontmatter: {
      tags: ['test', 'note'],
      ...baseFrontmatter,
    },
    folderConfig,
    vpsConfig,
  };

  it('should create a valid NoteCore object', () => {
    expect(noteCore.noteId).toBe('note1');
    expect(noteCore.frontmatter.tags).toContain('test');
    expect(noteCore.folderConfig.sanitization?.removeFencedCodeBlocks).toBe(true);
    expect(noteCore.vpsConfig.url).toBe('https://example.com');
  });

  it('should create a valid PublishableNote', () => {
    const publishableNote: PublishableNote = {
      ...noteCore,
      publishedAt: new Date('2024-01-01T00:00:00Z'),
      routing,
      assets: [assetRef],
      wikilinks: [wikilinkRef],
      resolvedWikilinks: [resolvedWikilink],
    };
    expect(publishableNote.publishedAt).toBeInstanceOf(Date);
    expect(publishableNote.routing.slug).toBe('note-1');
    expect(publishableNote.assets?.[0].kind).toBe('image');
    expect(publishableNote.wikilinks?.[0].alias).toBe('AliasA');
    expect(publishableNote.resolvedWikilinks?.[0].isResolved).toBe(true);
  });

  it('should create a valid NoteWithAssets', () => {
    const noteWithAssets: NoteWithAssets = {
      ...noteCore,
      assets: [assetRef],
    };
    expect(noteWithAssets.assets.length).toBe(1);
    expect(noteWithAssets.assets[0].display.alignment).toBe('center');
  });

  it('should create a valid NoteWithWikiLinks', () => {
    const noteWithWikiLinks: NoteWithWikiLinks = {
      ...noteCore,
      wikiLinks: [wikilinkRef],
      resolvedWikilinks: [resolvedWikilink],
    };
    expect(noteWithWikiLinks.wikiLinks[0].kind).toBe('note');
    expect(noteWithWikiLinks.resolvedWikilinks[0].isResolved).toBe(true);
    expect(noteWithWikiLinks.resolvedWikilinks[0].targetNoteId).toBe('note-a-id');
  });

  it('should support optional fields in AssetDisplayOptions', () => {
    const display: AssetDisplayOptions = {
      classes: [],
      rawModifiers: [],
    };
    expect(display.alignment).toBeUndefined();
    expect(display.width).toBeUndefined();
  });

  it('should support optional fields in WikilinkRef and ResolvedWikilink', () => {
    const minimalWikilink: WikilinkRef = {
      raw: '[[NoteB]]',
      target: 'NoteB',
      path: '/notes/NoteB',
      kind: 'note',
    };
    expect(minimalWikilink.alias).toBeUndefined();
    expect(minimalWikilink.subpath).toBeUndefined();

    const minimalResolved: ResolvedWikilink = {
      ...minimalWikilink,
      isResolved: false,
    };
    expect(minimalResolved.targetNoteId).toBeUndefined();
    expect(minimalResolved.href).toBeUndefined();
  });

  it('should support optional sanitization in FolderConfig', () => {
    const folder: FolderConfig = {
      id: 'folder2',
      vaultFolder: 'archive',
      routeBase: '/archive',
      vpsId: 'vps2',
    };
    expect(folder.sanitization).toBeUndefined();
  });

  it('should support different AssetRef kinds', () => {
    const kinds: AssetRef['kind'][] = ['image', 'audio', 'video', 'pdf', 'other'];
    kinds.forEach((kind) => {
      const asset: AssetRef = { ...assetRef, kind };
      expect(asset.kind).toBe(kind);
    });
  });

  it('should support different WikilinkRef kinds', () => {
    const noteLink: WikilinkRef = { ...wikilinkRef, kind: 'note' };
    const fileLink: WikilinkRef = { ...wikilinkRef, kind: 'file' };
    expect(noteLink.kind).toBe('note');
    expect(fileLink.kind).toBe('file');
  });
});
