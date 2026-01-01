import type { CustomIndexConfig } from '@core-domain';

export interface CreateSessionCommand {
  notesPlanned: number;
  assetsPlanned: number;
  batchConfig: {
    maxBytesPerRequest: number;
  };
  customIndexConfigs?: CustomIndexConfig[];
  ignoredTags?: string[];
  folderDisplayNames?: Record<string, string>;
}
