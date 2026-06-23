"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancellationError = void 0;
/**
 * Error thrown when an operation is cancelled
 */
class CancellationError extends Error {
    constructor(message = 'Operation cancelled') {
        super(message);
        this.name = 'CancellationError';
    }
}
exports.CancellationError = CancellationError;
