import { z } from 'zod';

// AssetDisplayOptions
export const AssetDisplayOptionsDto = z.object({
  alignment: z.enum(['left', 'right', 'center']).optional(),
  width: z.number().optional(),
  classes: z.array(z.string()),
  rawModifiers: z.array(z.string()),
});

// AssetRef
export const AssetRefDto = z.object({
  raw: z.string(),
  target: z.string(),
  kind: z.enum(['image', 'audio', 'video', 'pdf', 'other']),
  display: AssetDisplayOptionsDto,
});

// WikilinkRef
export const WikilinkRefDto = z.object({
  raw: z.string(),
  target: z.string(),
  path: z.string(),
  subpath: z.string().optional(),
  alias: z.string().optional(),
  kind: z.enum(['note', 'file']),
});

// ResolvedWikilink
export const ResolvedWikilinkDto = WikilinkRefDto.extend({
  isResolved: z.boolean(),
  targetNoteId: z.string().optional(),
  href: z.string().optional(),
});

// SanitizationRules
export const SanitizationRulesDto = z.object({
  removeFencedCodeBlocks: z.boolean(),
});

// FolderConfig
export const FolderConfigDto = z.object({
  id: z.string(),
  vaultFolder: z.string(),
  routeBase: z.string(),
  vpsId: z.string(),
  sanitization: SanitizationRulesDto.optional(),
});

// VpsConfig
export const VpsConfigDto = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  apiKey: z.string(),
});

// DomainFrontmatter
export const DomainFrontmatterDto = z.object({
  flat: z.record(z.string(), z.unknown()),
  nested: z.record(z.string(), z.unknown()),
});

// NoteCore
export const NoteCoreDto = z.object({
  noteId: z.string(),
  title: z.string(),
  vaultPath: z.string(),
  relativePath: z.string(),
  content: z.string(),
  frontmatter: DomainFrontmatterDto.extend({
    tags: z.array(z.string()),
  }),
  folderConfig: FolderConfigDto,
  vpsConfig: VpsConfigDto,
});

// NoteRoutingInfo
export const NoteRoutingInfoDto = z.object({
  id: z.string(),
  slug: z.string(),
  path: z.string(),
  routeBase: z.string(),
  fullPath: z.string(),
});

// PublishableNote
export const PublishableNoteDto = NoteCoreDto.extend({
  publishedAt: z.coerce.date(),
  routing: NoteRoutingInfoDto,
  assets: z.array(AssetRefDto).optional(),
  wikilinks: z.array(WikilinkRefDto).optional(),
  resolvedWikilinks: z.array(ResolvedWikilinkDto).optional(),
});

// NoteWithAssets
export const NoteWithAssetsDto = NoteCoreDto.extend({
  assets: z.array(AssetRefDto),
});

// NoteWithWikiLinks
export const NoteWithWikiLinksDto = NoteCoreDto.extend({
  wikiLinks: z.array(WikilinkRefDto),
  resolvedWikilinks: z.array(ResolvedWikilinkDto),
});

// Types
export type PublishableNoteDtoType = z.infer<typeof PublishableNoteDto>;
export type NoteCoreDtoType = z.infer<typeof NoteCoreDto>;
export type NoteWithAssetsDtoType = z.infer<typeof NoteWithAssetsDto>;
export type NoteWithWikiLinksDtoType = z.infer<typeof NoteWithWikiLinksDto>;
