import { Asset } from '../../../domain/entities/Asset';

export interface UploadAssetsCommand {
  sessionId: string;
  assets: Asset[];
}

export interface UploadAssetsResult {
  sessionId: string;
  published: number;
  errors?: { assetName: string; message: string }[];
}
