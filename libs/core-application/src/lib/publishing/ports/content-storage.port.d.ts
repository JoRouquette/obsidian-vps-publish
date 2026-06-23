export interface ContentStoragePort {
    save(params: {
        route: string;
        content: string;
        slug: string;
    }): Promise<void>;
    read(route: string): Promise<string | null>;
}
//# sourceMappingURL=content-storage.port.d.ts.map