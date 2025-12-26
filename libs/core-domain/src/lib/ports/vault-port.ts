import type { CancellationPort } from './cancellation-port';

export interface VaultPort<T> {
  collectFromFolder(params: unknown, cancellation?: CancellationPort): Promise<T>;
}
