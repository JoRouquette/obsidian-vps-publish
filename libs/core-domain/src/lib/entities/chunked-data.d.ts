export interface ChunkMetadata {
    uploadId: string;
    chunkIndex: number;
    totalChunks: number;
    originalSize: number;
    compressedSize: number;
}
export interface ChunkedData {
    metadata: ChunkMetadata;
    data: string;
}
//# sourceMappingURL=chunked-data.d.ts.map