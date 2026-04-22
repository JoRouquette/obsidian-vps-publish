import type { ProgressStep, ProgressStepId } from '../entities/progress-step';

/**
 * Callback appelé lors de l'avancement d'une étape
 * @param step État actuel de l'étape
 */
export type ProgressStepCallback = (step: ProgressStep) => void;

/**
 * Port pour gérer le progress et les notifications par étape
 * Orchestre la progression globale du pipeline (parsing → upload → finalize)
 */
export interface StepProgressManagerPort {
  /**
   * Initialise une étape et la démarre
   * @param stepId Identifiant de l'étape
   * @param label Libellé de l'étape (pour affichage)
   * @param total Nombre total d'items à traiter
   * @returns L'étape créée
   */
  startStep(stepId: ProgressStepId, label: string, total: number): ProgressStep;

  /**
   * Avance le progress d'une étape
   * @param stepId Identifiant de l'étape
   * @param step Nombre d'items traités (défaut: 1)
   */
  advanceStep(stepId: ProgressStepId, step?: number): void;

  /**
   * Marque une étape comme terminée avec succès
   * @param stepId Identifiant de l'étape
   */
  completeStep(stepId: ProgressStepId): void;

  /**
   * Marque une étape comme échouée
   * @param stepId Identifiant de l'étape
   * @param errorMessage Message d'erreur
   */
  failStep(stepId: ProgressStepId, errorMessage: string): void;

  /**
   * Marque une étape comme ignorée (skip)
   * @param stepId Identifiant de l'étape
   * @param reason Raison du skip (optionnel)
   */
  skipStep(stepId: ProgressStepId, reason?: string): void;

  /**
   * Récupère l'état actuel d'une étape
   * @param stepId Identifiant de l'étape
   * @returns L'étape ou undefined si elle n'existe pas
   */
  getStep(stepId: ProgressStepId): ProgressStep | undefined;

  /**
   * Récupère toutes les étapes
   * @returns Array des étapes
   */
  getAllSteps(): ProgressStep[];

  /**
   * Calcule le pourcentage global de progression
   * @returns Pourcentage global (0-100)
   */
  getGlobalPercentage(): number;

  /**
   * Réinitialise toutes les étapes
   */
  reset(): void;

  /**
   * Enregistre un callback appelé lors de l'avancement d'une étape
   * @param callback Fonction appelée à chaque mise à jour
   */
  onStepUpdate(callback: ProgressStepCallback): void;
}
