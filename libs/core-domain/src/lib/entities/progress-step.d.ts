/**
 * Identifiant unique pour chaque étape du pipeline de publication
 */
export declare enum ProgressStepId {
    PARSE_VAULT = "PARSE_VAULT",
    UPLOAD_NOTES = "UPLOAD_NOTES",
    UPLOAD_ASSETS = "UPLOAD_ASSETS",
    FINALIZE_SESSION = "FINALIZE_SESSION"
}
/**
 * État d'une étape de progression
 */
export declare enum ProgressStepStatus {
    PENDING = "PENDING",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    SKIPPED = "SKIPPED"
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
export declare class ProgressStep {
    private readonly metadata;
    constructor(metadata: ProgressStepMetadata);
    get id(): ProgressStepId;
    get label(): string;
    get status(): ProgressStepStatus;
    get total(): number;
    get current(): number;
    get percentage(): number;
    get errorMessage(): string | undefined;
    get isCompleted(): boolean;
    get isFailed(): boolean;
    get isInProgress(): boolean;
    toJSON(): ProgressStepMetadata;
}
//# sourceMappingURL=progress-step.d.ts.map