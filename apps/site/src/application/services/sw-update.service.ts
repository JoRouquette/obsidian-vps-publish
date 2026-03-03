import { isPlatformBrowser } from '@angular/common';
import { ApplicationRef, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { concat, filter, first, interval } from 'rxjs';

/**
 * Service pour gérer les mises à jour du Service Worker PWA.
 * Vérifie périodiquement les nouvelles versions et notifie l'utilisateur.
 *
 * @example
 * ```typescript
 * // Dans un component ou service
 * constructor(private swUpdate: SwUpdateService) {
 *   this.swUpdate.checkForUpdates();
 * }
 * ```
 *
 * Note: Ce service est automatiquement activé côté browser uniquement.
 * Il ne fait rien en mode SSR ou développement.
 */
@Injectable({ providedIn: 'root' })
export class SwUpdateService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly appRef = inject(ApplicationRef);

  /**
   * Vérifie si les mises à jour SW sont possibles.
   * Retourne false en SSR, dev mode, ou si SW non disponible.
   */
  get isEnabled(): boolean {
    return isPlatformBrowser(this.platformId) && !!this.swUpdate?.isEnabled;
  }

  /**
   * Initialise la vérification automatique des mises à jour.
   * Vérifie toutes les 6 heures après stabilisation de l'app.
   */
  initializeUpdateCheck(): void {
    if (!this.isEnabled || !this.swUpdate) {
      return;
    }

    // Attendre que l'app soit stable, puis vérifier toutes les 6 heures
    const appIsStable$ = this.appRef.isStable.pipe(first((isStable) => isStable));
    const checkInterval$ = interval(6 * 60 * 60 * 1000); // 6 heures
    const checkWhenStable$ = concat(appIsStable$, checkInterval$);

    checkWhenStable$.subscribe(() => {
      void this.swUpdate!.checkForUpdate();
    });

    // Observer les nouvelles versions disponibles
    this.swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe((event) => {
        console.log(`[PWA] Nouvelle version disponible: ${event.latestVersion.hash}`);
        this.promptUserForUpdate();
      });
  }

  /**
   * Force une vérification immédiate des mises à jour.
   * @returns Promise qui résout à true si une mise à jour est disponible
   */
  async checkForUpdates(): Promise<boolean> {
    if (!this.isEnabled || !this.swUpdate) {
      return false;
    }

    try {
      return await this.swUpdate.checkForUpdate();
    } catch (err) {
      console.error('[PWA] Erreur lors de la vérification des mises à jour:', err);
      return false;
    }
  }

  /**
   * Active la nouvelle version et recharge la page.
   * Appelé après confirmation de l'utilisateur.
   */
  async activateUpdate(): Promise<void> {
    if (!this.isEnabled || !this.swUpdate) {
      return;
    }

    try {
      await this.swUpdate.activateUpdate();
      // Recharger pour utiliser la nouvelle version
      document.location.reload();
    } catch (err) {
      console.error("[PWA] Erreur lors de l'activation de la mise à jour:", err);
    }
  }

  /**
   * Invite l'utilisateur à mettre à jour.
   * Implémentation simple avec confirm() - peut être remplacé par un snackbar/dialog.
   */
  private promptUserForUpdate(): void {
    // Note: Pour une meilleure UX, remplacer par un MatSnackBar ou dialog
    const shouldUpdate = confirm(
      "Une nouvelle version de l'application est disponible. Voulez-vous recharger la page pour la mettre à jour ?"
    );

    if (shouldUpdate) {
      void this.activateUpdate();
    }
  }
}
