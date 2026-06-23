import type { PublishableNote } from '@core-domain/entities/publishable-note';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import { type BaseService } from '../../common/base-service';
export declare class ComputeRoutingService implements BaseService {
    private readonly _logger;
    constructor(logger: LoggerPort);
    process(notes: PublishableNote[]): PublishableNote[];
    private slugifySegment;
    private normalizeRouteBase;
    private normalizePath;
    /**
     * Detects slug collisions in folders with flattenTree enabled.
     * When multiple notes in different subfolders have the same filename,
     * they will generate the same route, causing a collision.
     */
    private detectSlugCollisions;
}
//# sourceMappingURL=compute-routing.service.d.ts.map