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
  origin: z.enum(['content', 'frontmatter']).optional(),
  frontmatterPath: z.string().optional(),
  raw: z.string(),
  target: z.string(),
  kind: z.enum(['image', 'audio', 'video', 'pdf', 'other']),
  display: AssetDisplayOptionsDto,
});

// WikilinkRef
export const WikilinkRefDto = z.object({
  origin: z.enum(['content', 'frontmatter']).optional(),
  frontmatterPath: z.string().optional(),
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
  name: z.string(),
  regex: z.string().min(1),
  replacement: z.string().default(''),
  isEnabled: z.boolean().default(true),
});

// FolderConfig
export const FolderConfigDto = z.object({
  id: z.string(),
  vaultFolder: z.string(),
  routeBase: z.string(),
  vpsId: z.string(),
  sanitization: z.array(SanitizationRulesDto).optional(),
});

// DomainFrontmatter
export const DomainFrontmatterDto = z.object({
  flat: z.record(z.string(), z.unknown()),
  nested: z.record(z.string(), z.unknown()),
  tags: z.array(z.string()).default([]),
});

// NoteCore
export const NoteCoreDto = z.object({
  noteId: z.string(),
  title: z.string(),
  vaultPath: z.string(),
  relativePath: z.string(),
  content: z.string(),
  frontmatter: DomainFrontmatterDto,
  folderConfig: FolderConfigDto,
});

// NoteRoutingInfo
export const NoteRoutingInfoDto = z.object({
  slug: z.string(),
  path: z.string(),
  routeBase: z.string(),
  fullPath: z.string(),
});

// NoteEligibility
export const NoteIgnoredByRuleDto = z.object({
  property: z.string(),
  reason: z.enum(['ignoreIf', 'ignoreValues']),
  matchedValue: z.unknown(),
  ruleIndex: z.number(),
});

export const NoteEligibilityDto = z.object({
  isPublishable: z.boolean(),
  ignoredByRule: NoteIgnoredByRuleDto.optional(),
});

// PublishableNote
export const PublishableNoteDto = NoteCoreDto.extend({
  publishedAt: z.coerce.date(),
  routing: NoteRoutingInfoDto,
  eligibility: NoteEligibilityDto,
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
