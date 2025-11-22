export interface PublishableNote extends NoteCore {
  publishedAt: Date;
  routing: NoteRoutingInfo;
  assets?: AssetRef[];
  wikilinks?: WikilinkRef[];
  resolvedWikilinks?: ResolvedWikilink[];
}

export interface NoteCore {
  noteId: string;
  title: string;
  vaultPath: string;
  relativePath: string;
  content: string;
  frontmatter: {
    tags: string[];
  } & DomainFrontmatter;
  folderConfig: FolderConfig;
  vpsConfig: VpsConfig;
}

export interface DomainFrontmatter {
  flat: Record<string, unknown>;
  nested: Record<string, unknown>;
}

export interface NoteWithAssets extends NoteCore {
  assets: AssetRef[];
}

export interface NoteWithWikiLinks extends NoteCore {
  wikiLinks: WikilinkRef[];
  resolvedWikilinks: ResolvedWikilink[];
}

export interface NoteRoutingInfo {
  id: string;
  slug: string;
  path: string;
  routeBase: string;
  fullPath: string;
}

export interface AssetRef {
  raw: string;
  target: string;
  kind: 'image' | 'audio' | 'video' | 'pdf' | 'other';
  display: AssetDisplayOptions;
}

export interface AssetDisplayOptions {
  alignment?: 'left' | 'right' | 'center';
  width?: number;
  classes: string[];
  rawModifiers: string[];
}

export interface FolderConfig {
  id: string;
  vaultFolder: string;
  routeBase: string;
  vpsId: string;

  sanitization?: SanitizationRules;
}

export interface SanitizationRules {
  removeFencedCodeBlocks: boolean;
}

export interface VpsConfig {
  id: string;
  name: string;
  url: string;
  apiKey: string;
}

export interface WikilinkRef {
  raw: string;
  target: string;
  path: string;
  subpath?: string;
  alias?: string;
  kind: 'note' | 'file';
}
export interface ResolvedWikilink {
  raw: string;
  target: string;
  path: string;
  subpath?: string;
  alias?: string;
  kind: 'note' | 'file';
  isResolved: boolean;
  targetNoteId?: string;
  href?: string;
}
