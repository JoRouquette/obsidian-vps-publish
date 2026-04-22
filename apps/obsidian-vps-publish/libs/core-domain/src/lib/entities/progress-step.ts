/**
 * Identifiant unique pour chaque étape du pipeline de publication
 */
export enum ProgressStepId {
  PARSE_VAULT = 'PARSE_VAULT',
  UPLOAD_NOTES = 'UPLOAD_NOTES',
  UPLOAD_ASSETS = 'UPLOAD_ASSETS',
  FINALIZE_SESSION = 'FINALIZE_SESSION',
}

/**
 * État d'une étape de progression
 */
export enum ProgressStepStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

/**
 * Métadonnées pour une étape du pipeline
 */
export interface ProgressStepMetadata {
  /** Identifiant unique de l'étape */
  id: ProgressStepId;
  /** Libellé de l'étape (pour affichage) */
  label: string;
  /** État actuel de l'étape */
  status: ProgressStepStatus;
  /** Nombre total d'items à traiter dans cette étape */
  total: number;
  /** Nombre d'items traités */
  current: number;
  /** Message d'erreur si l'étape a échoué */
  errorMessage?: string;
  /** Timestamp de début (ISO 8601) */
  startedAt?: string;
  /** Timestamp de fin (ISO 8601) */
  completedAt?: string;
}

/**
 * Entité représentant une étape du pipeline avec progress et état
 */
export class ProgressStep {
  constructor(private readonly metadata: ProgressStepMetadata) {}

  get id(): ProgressStepId {
    return this.metadata.id;
  }

  get label(): string {
    return this.metadata.label;
  }

  get status(): ProgressStepStatus {
    return this.metadata.status;
  }

  get total(): number {
    return this.metadata.total;
  }

  get current(): number {
    return this.metadata.current;
  }

  get percentage(): number {
    if (this.metadata.total === 0) return 100;
    return Math.floor((this.metadata.current / this.metadata.total) * 100);
  }

  get errorMessage(): string | undefined {
    return this.metadata.errorMessage;
  }

  get isCompleted(): boolean {
    return this.metadata.status === ProgressStepStatus.COMPLETED;
  }

  get isFailed(): boolean {
    return this.metadata.status === ProgressStepStatus.FAILED;
  }

  get isInProgress(): boolean {
    return this.metadata.status === ProgressStepStatus.IN_PROGRESS;
  }

  toJSON(): ProgressStepMetadata {
    return { ...this.metadata };
  }
}
