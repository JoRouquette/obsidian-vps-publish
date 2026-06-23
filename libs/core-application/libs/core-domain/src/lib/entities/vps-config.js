"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VpsConfigInvariants = void 0;
/**
 * Domain invariants for VPS configuration
 */
class VpsConfigInvariants {
    static validateUniqueName(vpsConfigs, name, excludeId) {
        const duplicate = vpsConfigs.find((vps) => vps.name === name && vps.id !== excludeId);
        if (duplicate) {
            throw new Error(`VPS name "${name}" is already used by another VPS`);
        }
    }
    static validateUniqueUrl(vpsConfigs, baseUrl, excludeId) {
        const normalized = normalizeUrl(baseUrl);
        const duplicate = vpsConfigs.find((vps) => normalizeUrl(vps.baseUrl) === normalized && vps.id !== excludeId);
        if (duplicate) {
            throw new Error(`VPS URL "${baseUrl}" is already used by another VPS`);
        }
    }
    static validateMinimumFolders(vps) {
        // Check new routeTree first, fallback to legacy folders
        const hasRoutes = vps.routeTree && vps.routeTree.roots && vps.routeTree.roots.length > 0;
        const hasFolders = vps.folders && vps.folders.length > 0;
        if (!hasRoutes && !hasFolders) {
            throw new Error(`VPS "${vps.name}" must have at least one route or folder`);
        }
    }
    static validateMinimumVps(vpsConfigs) {
        if (!vpsConfigs || vpsConfigs.length === 0) {
            throw new Error('At least one VPS configuration is required');
        }
    }
}
exports.VpsConfigInvariants = VpsConfigInvariants;
function normalizeUrl(url) {
    return url.trim().toLowerCase().replace(/\/+$/, '');
}
