import { type Asset } from '@core-domain';

export interface UploadAssetsCommand {
  sessionId: string;
  assets: Asset[];
}

export interface UploadAssetsResult {
  sessionId: string;
  published: number;
  errors?: { assetName: string; message: string }[];
}
