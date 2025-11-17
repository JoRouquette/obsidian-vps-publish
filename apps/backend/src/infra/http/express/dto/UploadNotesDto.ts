import { z } from 'zod';

export const FrontmatterDto = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(''),
  date: z.iso.datetime().optional(),
  tags: z.array(z.string()).optional().default([]),
});

export const NoteDto = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  route: z.string().regex(/^\/[^\s/].*$/), // leading slash, pas de trailing.
  relativePath: z.string().optional().default(''),
  markdown: z.string().min(1),
  frontmatter: FrontmatterDto,
  updatedAt: z.iso.datetime(),
  publishedAt: z.iso.datetime(),
});

export const UploadBodyDto = z.object({
  notes: z.array(NoteDto).min(1),
});

export type FrontmatterDtoType = z.infer<typeof FrontmatterDto>;
export type NoteDtoType = z.infer<typeof NoteDto>;
export type UploadBodyDtoType = z.infer<typeof UploadBodyDto>;
