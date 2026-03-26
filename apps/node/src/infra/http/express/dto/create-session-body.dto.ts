import z from 'zod';

const IgnorePrimitiveDto = z.union([z.string(), z.number(), z.boolean()]);

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
  ignoreRules: z
    .array(
      z.object({
        property: z.string().min(1),
        ignoreIf: z.boolean().optional(),
        ignoreValues: z.array(IgnorePrimitiveDto).optional(),
      })
    )
    .optional(),
  ignoredTags: z.array(z.string()).optional(),
  folderDisplayNames: z.record(z.string(), z.string()).optional(),
  pipelineSignature: z
    .object({
      version: z.string(),
      renderSettingsHash: z.string(),
      gitCommit: z.string().optional(),
    })
    .optional(),
  /**
   * Site locale for HTML lang attribute and PWA manifest.
   * Resolved from plugin settings (en/fr/system → en/fr).
   */
  locale: z.enum(['en', 'fr']).optional(),
  deduplicationEnabled: z.boolean().optional(),
  apiOwnedDeterministicNoteTransformsEnabled: z.boolean().optional(),
});
