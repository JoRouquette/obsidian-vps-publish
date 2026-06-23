"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetScanError = void 0;
class AssetScanError extends Error {
    constructor(message, fileName, threat) {
        super(message);
        this.fileName = fileName;
        this.threat = threat;
        this.name = 'AssetScanError';
    }
}
exports.AssetScanError = AssetScanError;
