import { z } from 'zod';

export const FrontmatterDomainDto = z.object({
  flat: z.record(z.string(), z.unknown()).optional().default({}),
  nested: z.record(z.string(), z.unknown()).optional().default({}),
});

export const NoteDto = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().min(1),
  route: z.string().regex(/^\/[^\s/].*$/), // leading slash, pas de trailing.
  relativePath: z.string().optional().default(''),
  markdown: z.string().min(1),
  frontmatter: z
    .object({
      tags: z.array(z.string()).optional().default([]),
      ...FrontmatterDomainDto.shape,
    })
    .optional()
    .default({ tags: [], flat: {}, nested: {} }),
  publishedAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid ISO date string',
  }),
});

export const UploadBodyDto = z.object({
  notes: z.array(NoteDto).min(1),
});

export type FrontmatterDtoType = z.infer<typeof FrontmatterDomainDto>;
export type NoteDtoType = z.infer<typeof NoteDto>;
export type UploadBodyDtoType = z.infer<typeof UploadBodyDto>;
