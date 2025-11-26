
export interface VaultPort<T> {
  collectFromFolder(params: unknown): Promise<T>;
}
