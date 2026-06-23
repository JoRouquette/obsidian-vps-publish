"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Slug = void 0;
class Slug {
    constructor(value) {
        this.value = value;
        if (!value) {
            throw new Error('Slug cannot be empty');
        }
        if (!/^[a-z0-9-]+$/.test(value)) {
            throw new Error(`Slug "${value}" contains invalid characters. Only lowercase letters, numbers, and hyphens are allowed.`);
        }
    }
    static from(value) {
        return new Slug(value);
    }
    static fromRoute(route) {
        const last = route
            .replace(/^\/+|\/+$/g, '')
            .split('/')
            .pop() ?? '';
        const norm = decodeURIComponent(last)
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$|/g, '');
        return Slug.from(norm || 'index');
    }
    toString() {
        return this.value;
    }
}
exports.Slug = Slug;
