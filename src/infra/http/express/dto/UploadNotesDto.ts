import { z } from 'zod';

export const NoteFrontmatterSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  date: z.string().optional(), // ISO string
  tags: z.array(z.string()).optional(),
});

export const NoteDtoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  route: z.string(),
  vaultPath: z.string(),
  relativePath: z.string(),
  markdown: z.string(),
  frontmatter: NoteFrontmatterSchema,
  publishedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const UploadNotesRequestSchema = z.object({
  notes: z.array(NoteDtoSchema).nonempty(),
});

export type UploadNotesRequestDto = z.infer<typeof UploadNotesRequestSchema>;
export type NoteDto = z.infer<typeof NoteDtoSchema>;
