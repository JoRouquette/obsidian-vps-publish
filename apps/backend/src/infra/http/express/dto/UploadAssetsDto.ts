import { z } from 'zod';

export const ApiAssetDto = z.object({
  relativePath: z.string().min(1),
  vaultPath: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  contentBase64: z.string().min(1),
});

export const ApiAssetsBodyDto = z.object({
  assets: z.array(ApiAssetDto).min(1),
});

export type ApiAsset = z.infer<typeof ApiAssetDto>;
export type ApiAssetsBody = z.infer<typeof ApiAssetsBodyDto>;
