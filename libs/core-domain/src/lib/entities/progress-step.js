"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressStep = exports.ProgressStepStatus = exports.ProgressStepId = void 0;
/**
 * Identifiant unique pour chaque étape du pipeline de publication
 */
var ProgressStepId;
(function (ProgressStepId) {
    ProgressStepId["PARSE_VAULT"] = "PARSE_VAULT";
    ProgressStepId["UPLOAD_NOTES"] = "UPLOAD_NOTES";
    ProgressStepId["UPLOAD_ASSETS"] = "UPLOAD_ASSETS";
    ProgressStepId["FINALIZE_SESSION"] = "FINALIZE_SESSION";
})(ProgressStepId || (exports.ProgressStepId = ProgressStepId = {}));
/**
 * État d'une étape de progression
 */
var ProgressStepStatus;
(function (ProgressStepStatus) {
    ProgressStepStatus["PENDING"] = "PENDING";
    ProgressStepStatus["IN_PROGRESS"] = "IN_PROGRESS";
    ProgressStepStatus["COMPLETED"] = "COMPLETED";
    ProgressStepStatus["FAILED"] = "FAILED";
    ProgressStepStatus["SKIPPED"] = "SKIPPED";
})(ProgressStepStatus || (exports.ProgressStepStatus = ProgressStepStatus = {}));
/**
 * Entité représentant une étape du pipeline avec progress et état
 */
class ProgressStep {
    constructor(metadata) {
        this.metadata = metadata;
    }
    get id() {
        return this.metadata.id;
    }
    get label() {
        return this.metadata.label;
    }
    get status() {
        return this.metadata.status;
    }
    get total() {
        return this.metadata.total;
    }
    get current() {
        return this.metadata.current;
    }
    get percentage() {
        if (this.metadata.total === 0)
            return 100;
        return Math.floor((this.metadata.current / this.metadata.total) * 100);
    }
    get errorMessage() {
        return this.metadata.errorMessage;
    }
    get isCompleted() {
        return this.metadata.status === ProgressStepStatus.COMPLETED;
    }
    get isFailed() {
        return this.metadata.status === ProgressStepStatus.FAILED;
    }
    get isInProgress() {
        return this.metadata.status === ProgressStepStatus.IN_PROGRESS;
    }
    toJSON() {
        return { ...this.metadata };
    }
}
exports.ProgressStep = ProgressStep;
