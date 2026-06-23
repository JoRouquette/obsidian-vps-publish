import { type AssetHashPort, type AssetValidatorPort, type ImageOptimizerPort, type LoggerPort } from '@core-domain';
import { type CommandHandler } from '../../common/command-handler';
import { type UploadAssetsCommand, type UploadAssetsResult } from '../commands/upload-assets.command';
import { type AssetStoragePort } from '../ports/assets-storage.port';
import { type ManifestPort } from '../ports/manifest-storage.port';
type AssetStorageFactory = (sessionId: string) => AssetStoragePort;
type ManifestStorageFactory = (sessionId: string) => ManifestPort;
export declare class UploadAssetsHandler implements CommandHandler<UploadAssetsCommand, UploadAssetsResult> {
    private readonly assetStorage;
    private readonly manifestStorage?;
    private readonly assetHasher?;
    private readonly assetValidator?;
    private readonly maxAssetSizeBytes?;
    private readonly imageOptimizer?;
    private readonly _logger;
    constructor(assetStorage: AssetStoragePort | AssetStorageFactory, manifestStorage?: (ManifestPort | ManifestStorageFactory) | undefined, assetHasher?: AssetHashPort | undefined, assetValidator?: AssetValidatorPort | undefined, maxAssetSizeBytes?: number | undefined, imageOptimizer?: ImageOptimizerPort | undefined, logger?: LoggerPort);
    handle(command: UploadAssetsCommand): Promise<UploadAssetsResult>;
    private resolveAssetStorage;
    private resolveManifestStorage;
    private decodeBase64;
    private formatToMimeType;
}
export {};
//# sourceMappingURL=upload-assets.handler.d.ts.map