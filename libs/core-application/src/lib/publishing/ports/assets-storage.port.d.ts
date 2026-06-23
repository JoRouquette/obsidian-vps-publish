export interface AssetStoragePort {
    save(params: {
        filename: string;
        content: Uint8Array;
    }[]): Promise<void>;
}
//# sourceMappingURL=assets-storage.port.d.ts.map