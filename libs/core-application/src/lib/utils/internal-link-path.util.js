"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripMarkdownExtensionPreservingFragment = stripMarkdownExtensionPreservingFragment;
exports.splitInternalLinkTarget = splitInternalLinkTarget;
exports.normalizeInternalLinkPath = normalizeInternalLinkPath;
exports.normalizeInternalLinkKey = normalizeInternalLinkKey;
exports.getInternalLinkBasename = getInternalLinkBasename;
exports.resolveRelativeInternalLinkPath = resolveRelativeInternalLinkPath;
function safeDecodeURIComponent(value) {
    try {
        return decodeURIComponent(value);
    }
    catch {
        return value;
    }
}
function stripMarkdownExtensionPreservingFragment(value) {
    const hashIndex = value.indexOf('#');
    const basePath = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
    const fragment = hashIndex >= 0 ? value.slice(hashIndex) : '';
    return `${basePath.replace(/\.md$/i, '')}${fragment}`;
}
function splitInternalLinkTarget(value) {
    const hashIndex = value.indexOf('#');
    if (hashIndex === -1) {
        return { path: value.trim() };
    }
    const path = value.slice(0, hashIndex).trim();
    const fragment = value.slice(hashIndex + 1).trim();
    return {
        path,
        fragment: fragment || undefined,
    };
}
function normalizeInternalLinkPath(value) {
    return safeDecodeURIComponent(value)
        .replace(/\\/g, '/')
        .replace(/(^|\/)\.\//g, '$1')
        .replace(/\/{2,}/g, '/')
        .replace(/^\/+|\/+$/g, '')
        .trim();
}
function normalizeInternalLinkKey(value) {
    const normalized = normalizeInternalLinkPath(value);
    if (!normalized) {
        return '';
    }
    return normalized
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}
function getInternalLinkBasename(value) {
    const normalized = normalizeInternalLinkPath(value);
    if (!normalized) {
        return '';
    }
    const segments = normalized.split('/');
    return segments[segments.length - 1] ?? normalized;
}
function getInternalLinkDirname(value) {
    const normalized = normalizeInternalLinkPath(value);
    if (!normalized) {
        return '';
    }
    const segments = normalized.split('/');
    segments.pop();
    return segments.join('/');
}
function resolvePosixLikePath(baseDirectory, relativePath) {
    const combinedSegments = [...baseDirectory.split('/'), ...relativePath.split('/')];
    const resolvedSegments = [];
    for (const segment of combinedSegments) {
        if (!segment || segment === '.') {
            continue;
        }
        if (segment === '..') {
            resolvedSegments.pop();
            continue;
        }
        resolvedSegments.push(segment);
    }
    return resolvedSegments.join('/');
}
function resolveRelativeInternalLinkPath(value, currentNoteRelativePath) {
    const normalizedValue = normalizeInternalLinkPath(value);
    if (!normalizedValue || !/^(?:\.\.\/|\.\/)/.test(normalizedValue) || !currentNoteRelativePath) {
        return normalizedValue;
    }
    const currentDirectory = getInternalLinkDirname(currentNoteRelativePath);
    return resolvePosixLikePath(currentDirectory, normalizedValue);
}
