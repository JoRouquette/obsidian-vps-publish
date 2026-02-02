import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { LoggerPort, Manifest, ManifestPage } from '@core-domain';

/**
 * Service pour détecter les changements de slug entre deux versions du manifest
 * et construire automatiquement le canonicalMap pour les redirections 301.
 *
 * Logique:
 * - Compare les pages de l'ancien manifest avec le nouveau
 * - Identifie les pages dont le slug a changé (même relativePath, slug différent)
 * - Ajoute un mapping: ancien route → nouveau route dans canonicalMap
 */
export class SlugChangeDetectorService {
  constructor(private readonly logger?: LoggerPort) {}

  /**
   * Détecte les changements de slug et met à jour le canonicalMap.
   *
   * @param oldManifest - Manifest actuellement déployé en production
   * @param newManifest - Nouveau manifest généré par la session
   * @returns Nouveau manifest avec canonicalMap mis à jour
   */
  async detectAndUpdateCanonicalMap(
    oldManifest: Manifest | null,
    newManifest: Manifest
  ): Promise<Manifest> {
    const log = this.logger?.child({ service: 'SlugChangeDetector' });

    if (!oldManifest) {
      log?.debug('No old manifest found, skipping slug change detection');
      return newManifest;
    }

    // Créer index des anciennes pages par relativePath
    const oldPagesByPath = new Map<string, ManifestPage>();
    for (const page of oldManifest.pages) {
      if (page.relativePath) {
        oldPagesByPath.set(page.relativePath, page);
      }
    }

    // Initialiser canonicalMap (préserver les mappings existants)
    const canonicalMap = {
      ...(newManifest.canonicalMap || {}),
      ...(oldManifest.canonicalMap || {}),
    };
    let changesDetected = 0;

    // Comparer chaque nouvelle page avec son ancienne version
    for (const newPage of newManifest.pages) {
      if (!newPage.relativePath) {
        continue; // Skip pages without relativePath
      }
      const oldPage = oldPagesByPath.get(newPage.relativePath);

      if (!oldPage) {
        // Nouvelle page, pas de slug change
        continue;
      }

      // Vérifier si le route a changé
      if (oldPage.route !== newPage.route) {
        // Slug change détecté: ajouter mapping
        canonicalMap[oldPage.route] = newPage.route;
        changesDetected++;

        log?.info('Slug change detected', {
          relativePath: newPage.relativePath,
          oldRoute: oldPage.route,
          newRoute: newPage.route,
          action: 'Added 301 redirect mapping',
        });
      }
    }

    // Détecter les pages supprimées (optionnel: log warning)
    for (const [relativePath, oldPage] of oldPagesByPath.entries()) {
      const stillExists = newManifest.pages.some((p) => p.relativePath === relativePath);
      if (!stillExists) {
        log?.warn('Page deleted', {
          relativePath,
          route: oldPage.route,
          note: 'Old route will remain in canonicalMap if already present',
        });
      }
    }

    if (changesDetected > 0) {
      log?.info('Canonical map updated', {
        newMappings: changesDetected,
        totalMappings: Object.keys(canonicalMap).length,
      });
    } else {
      log?.debug('No slug changes detected');
    }

    // Retourner manifest avec canonicalMap mis à jour
    return {
      ...newManifest,
      canonicalMap: Object.keys(canonicalMap).length > 0 ? canonicalMap : undefined,
    };
  }

  /**
   * Charge le manifest actuellement déployé en production.
   * Utilisé pour comparaison avec le nouveau manifest de session.
   */
  async loadProductionManifest(contentRoot: string): Promise<Manifest | null> {
    const manifestPath = path.join(contentRoot, '_manifest.json');

    try {
      const raw = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(raw) as Manifest;

      this.logger?.debug('Production manifest loaded', {
        path: manifestPath,
        pagesCount: manifest.pages.length,
        hasCanonicalMap: !!manifest.canonicalMap,
      });

      return manifest;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger?.debug('No production manifest found (first deployment?)');
        return null;
      }

      this.logger?.warn('Failed to load production manifest', {
        path: manifestPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Nettoie le canonicalMap en supprimant les mappings obsolètes.
   * Un mapping est obsolète si la source (oldRoute) n'existe plus dans aucune page.
   *
   * Garde les mappings tant que la source existe, pour gérer les chaînes de redirections:
   * A → B → C devient: { A: C, B: C }
   */
  cleanupCanonicalMap(manifest: Manifest): Manifest {
    if (!manifest.canonicalMap || Object.keys(manifest.canonicalMap).length === 0) {
      return manifest;
    }

    const currentRoutes = new Set(manifest.pages.map((p) => p.route));
    const cleanedMap: Record<string, string> = {};
    let removed = 0;

    for (const [oldRoute, newRoute] of Object.entries(manifest.canonicalMap)) {
      // Garder le mapping si la destination existe toujours
      if (currentRoutes.has(newRoute)) {
        cleanedMap[oldRoute] = newRoute;
      } else {
        removed++;
        this.logger?.debug('Removing obsolete canonical mapping', {
          from: oldRoute,
          to: newRoute,
          reason: 'Destination route no longer exists',
        });
      }
    }

    if (removed > 0) {
      this.logger?.info('Canonical map cleaned', {
        removedMappings: removed,
        remainingMappings: Object.keys(cleanedMap).length,
      });
    }

    return {
      ...manifest,
      canonicalMap: Object.keys(cleanedMap).length > 0 ? cleanedMap : undefined,
    };
  }
}
