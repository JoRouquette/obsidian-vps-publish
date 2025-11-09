import { z } from 'zod';

// ex: "/blog/my-note" (>= 2 segments)
const routeSchema = z
  .string()
  .regex(
    /^\/([a-z0-9-]+)(\/[a-z0-9-]+)+$/i,
    "route must start with '/' and contain at least two segments (e.g. /blog/my-note)"
  );

export const NoteDTO = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  route: routeSchema,
  markdown: z.string().min(1),
  frontmatter: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    date: z.string().datetime().optional(),
    tags: z.array(z.string()).optional(),
  }),
  publishedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const UploadRequestDTO = z.object({
  notes: z.array(NoteDTO).min(1),
});
