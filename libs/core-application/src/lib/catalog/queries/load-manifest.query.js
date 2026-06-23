"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoadManifestHandler = void 0;
class LoadManifestHandler {
    constructor(repository) {
        this.repository = repository;
    }
    async handle() {
        return this.repository.load();
    }
}
exports.LoadManifestHandler = LoadManifestHandler;
