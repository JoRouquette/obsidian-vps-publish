import type { RouteTreeConfig } from '../entities/route-node';
import type { CancellationPort } from './cancellation-port';

export interface VaultPort<T> {
  collectFromFolder(params: unknown, cancellation?: CancellationPort): Promise<T>;
  collectFromRouteTree(
    params: { routeTree: RouteTreeConfig; vpsId: string },
    cancellation?: CancellationPort
  ): Promise<T>;
}
