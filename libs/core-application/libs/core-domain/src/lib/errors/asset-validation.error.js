"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetValidationError = void 0;
class AssetValidationError extends Error {
    constructor(message, fileName, reason) {
        super(message);
        this.fileName = fileName;
        this.reason = reason;
        this.name = 'AssetValidationError';
    }
}
exports.AssetValidationError = AssetValidationError;
