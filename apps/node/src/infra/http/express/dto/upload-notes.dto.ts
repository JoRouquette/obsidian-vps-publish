import { z } from 'zod';

// LeafletMarker
export const LeafletMarkerDto = z.object({
  type: z.string().optional(),
  lat: z.number(),
  long: z.number(),
  link: z.string().optional(),
  description: z.string().optional(),
  minZoom: z.number().optional(),
  maxZoom: z.number().optional(),
});

// LeafletImageOverlay
export const LeafletImageOverlayDto = z.object({
  path: z.string(),
  topLeft: z.tuple([z.number(), z.number()]),
  bottomRight: z.tuple([z.number(), z.number()]),
  alias: z.string().optional(),
});

// LeafletTileServer
export const LeafletTileServerDto = z.object({
  url: z.string(),
  subdomains: z.array(z.string()).optional(),
  attribution: z.string().optional(),
  minZoom: z.number().optional(),
  maxZoom: z.number().optional(),
});

// LeafletBlockDtoV1: versionné, extensible, validable
export const LeafletBlockDtoV1 = z.object({
  version: z.literal(1),
  id: z.string(),
  type: z.enum(['image', 'tile']),
  lat: z.number().optional(),
  long: z.number().optional(),
  height: z.string().optional(),
  width: z.string().optional(),
  defaultZoom: z.number().optional(),
  minZoom: z.number().optional(),
  maxZoom: z.number().optional(),
  darkMode: z.boolean().optional(),
  unit: z.string().optional(),
  image: z
    .object({
      assetRef: z.string(),
      bounds: z
        .tuple([z.tuple([z.number(), z.number()]), z.tuple([z.number(), z.number()])])
        .optional(),
      alias: z.string().optional(),
    })
    .optional(),
  tileServer: LeafletTileServerDto.optional(),
  markers: z.array(LeafletMarkerDto).optional(),
  geojson: z
    .array(
      z.object({
        assetRef: z.string(),
        style: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .optional(),
  overlays: z
    .array(
      z.object({
        type: z.literal('circle'),
        lat: z.number(),
        long: z.number(),
        radius: z.number(),
        color: z.string().optional(),
      })
    )
    .optional(),
  rawContent: z.string().optional(),
});

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
  id: z.string(),
  name: z.string(),
  regex: z.string(), // Accepter les regex vides (règles en cours de configuration)
  replacement: z.string().default(''),
  isEnabled: z.boolean().default(true),
});

// FolderConfig
export const FolderConfigDto = z.object({
  id: z.string(),
  vaultFolder: z.string(),
  routeBase: z.string(),
  vpsId: z.string(),
  displayName: z.string().optional(),
  ignoredCleanupRuleIds: z.array(z.string()).default([]),
  customIndexFile: z.string().optional(),
  flattenTree: z.boolean().optional().default(false),
  additionalFiles: z.array(z.string()).optional().default([]),
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
  folderDisplayName: z.string().optional(),
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
  leafletBlocks: z.array(LeafletBlockDtoV1).optional(),
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
