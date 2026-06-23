"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FindPageHandler = void 0;
class FindPageHandler {
    async handle(params) {
        const { manifest, slugOrRoute } = params;
        return manifest.pages.find((p) => p.slug.value === slugOrRoute || p.route === slugOrRoute);
    }
}
exports.FindPageHandler = FindPageHandler;
