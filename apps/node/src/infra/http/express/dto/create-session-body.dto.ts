import z from 'zod';

const CustomIndexConfigDto = z.object({
  id: z.string().min(1),
  folderPath: z.string(),
  indexFilePath: z.string().min(1),
  isRootIndex: z.boolean().optional(),
});

export const CreateSessionBodyDto = z.object({
  notesPlanned: z.number().int().nonnegative(),
  assetsPlanned: z.number().int().nonnegative(),
  batchConfig: z.object({
    maxBytesPerRequest: z.number().int().positive(),
  }),
  calloutStyles: z
    .array(
      z.object({
        path: z.string().min(1),
        css: z.string().optional().default(''),
      })
    )
    .optional(),
  customIndexConfigs: z.array(CustomIndexConfigDto).optional(),
  ignoredTags: z.array(z.string()).optional(),
  folderDisplayNames: z.record(z.string(), z.string()).optional(),
  pipelineSignature: z
    .object({
      version: z.string(),
      renderSettingsHash: z.string(),
      gitCommit: z.string().optional(),
    })
    .optional(),
});
