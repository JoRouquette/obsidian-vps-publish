"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbortSessionHandler = void 0;
const _core_domain_1 = require("@core-domain");
class AbortSessionHandler {
    constructor(sessionRepository, logger) {
        this.sessionRepository = sessionRepository;
        this.logger = logger?.child({ scope: 'sessions', operation: 'abortSession' });
    }
    async handle(command) {
        const logger = this.logger?.child({ sessionId: command.sessionId });
        const session = await this.sessionRepository.findById(command.sessionId);
        if (!session) {
            logger?.error('Abort failed: session not found', {
                sessionId: command.sessionId,
                reason: 'SessionNotFoundError',
                action: 'Verify sessionId or start new session',
            });
            throw new _core_domain_1.SessionNotFoundError(command.sessionId);
        }
        if (session.status === 'finished') {
            logger?.error('Abort failed: session already finished', {
                sessionId: session.id,
                status: session.status,
                reason: 'SessionInvalidError',
                action: 'Cannot abort a committed session',
            });
            throw new _core_domain_1.SessionInvalidError('Cannot abort a finished session', session.id);
        }
        session.status = 'aborted';
        session.updatedAt = new Date();
        await this.sessionRepository.save(session);
        logger?.info('Session aborted successfully', {
            sessionId: session.id,
            previousStatus: 'active',
        });
        return {
            sessionId: session.id,
            success: true,
        };
    }
}
exports.AbortSessionHandler = AbortSessionHandler;
