"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinishSessionHandler = void 0;
const _core_domain_1 = require("@core-domain");
class FinishSessionHandler {
    constructor(sessionRepository, logger) {
        this.sessionRepository = sessionRepository;
        this.logger = logger?.child({ scope: 'sessions', operation: 'finishSession' });
    }
    async handle(command) {
        const logger = this.logger?.child({ sessionId: command.sessionId });
        const session = await this.sessionRepository.findById(command.sessionId);
        if (!session) {
            logger?.error('Finish failed: session not found', {
                sessionId: command.sessionId,
                reason: 'SessionNotFoundError',
                action: 'Verify sessionId or start new session',
            });
            throw new _core_domain_1.SessionNotFoundError(command.sessionId);
        }
        if (session.status === 'aborted' || session.status === 'finished') {
            logger?.error('Finish failed: invalid session status', {
                sessionId: session.id,
                status: session.status,
                validStatuses: ['pending', 'active'],
                reason: 'SessionInvalidError',
                action: 'Can only finish pending or active sessions',
            });
            throw new _core_domain_1.SessionInvalidError(`Cannot finish session with status ${session.status}`, session.id);
        }
        // Règles métier minimales (à toi de les durcir si besoin)
        session.notesProcessed = command.notesProcessed;
        session.assetsProcessed = command.assetsProcessed;
        session.status = 'finished';
        session.updatedAt = new Date();
        await this.sessionRepository.save(session);
        logger?.info('Session finished successfully', {
            sessionId: session.id,
            notesProcessed: session.notesProcessed,
            assetsProcessed: session.assetsProcessed,
            previousStatus: session.status,
        });
        return {
            sessionId: session.id,
            success: true,
        };
    }
}
exports.FinishSessionHandler = FinishSessionHandler;
