"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenderInlineDataviewService = void 0;
const INLINE_CODE_REGEX = /`([^`]*?)`/g;
class RenderInlineDataviewService {
    constructor(logger) {
        this._logger = logger.child({ usecase: 'RenderInlineDataviewUseCase' });
    }
    process(notes) {
        this._logger.debug('Starting inline dataview rendering for notes', {
            notesCount: notes.length,
        });
        return notes.map((note) => ({
            ...note,
            content: this.renderContent(note.content, note.frontmatter),
        }));
    }
    renderContent(content, frontmatter) {
        const expressions = [];
        const renderedMarkdown = content.replace(INLINE_CODE_REGEX, (fullMatch, innerCode) => {
            const codeRaw = innerCode;
            const trimmed = codeRaw.trim();
            if (!trimmed.startsWith('=')) {
                this._logger.debug(`Skipping non-dataview inline code: ${fullMatch}`);
                return fullMatch;
            }
            const expr = trimmed.slice(1).trim();
            const resolvedValue = this.evaluateExpression(expr, frontmatter, this._logger);
            const renderedText = this.renderValue(resolvedValue, this._logger);
            expressions.push({
                raw: fullMatch,
                code: codeRaw,
                expression: expr,
                propertyPath: this.extractPropertyPath(expr),
                resolvedValue,
                renderedText,
            });
            this._logger.debug(`Replaced inline code '${fullMatch}' with rendered value: '${renderedText}'`);
            return renderedText;
        });
        this._logger.debug(`Rendered ${expressions.length} inline dataview expressions in note.`);
        return renderedMarkdown;
    }
    /**
     * Evalue une expression Dataview inline.
     * Gere :
     *  - `this.property` : acces direct
     *  - `join(this.property, separator)` : jointure de liste
     *  - Autres fonctions peuvent etre ajoutees ici
     */
    evaluateExpression(expr, frontmatter, logger) {
        const trimmedExpr = expr.trim();
        const joinMatch = trimmedExpr.match(/^join\(\s*(this\.[^,]+)\s*,\s*["']([^"']*)["']\s*\)$/);
        if (joinMatch) {
            const propertyPath = joinMatch[1].replace(/^this\./, '').trim();
            const separator = joinMatch[2];
            logger.debug(`Detected join() function: property='${propertyPath}', separator='${separator}'`);
            const value = this.getValueFromFrontmatter(frontmatter, propertyPath, logger);
            const arrayValue = this.normalizeToArray(value);
            return arrayValue.map((v) => String(v)).join(separator);
        }
        const THIS_PREFIX = 'this.';
        if (trimmedExpr.startsWith(THIS_PREFIX)) {
            const propertyPath = trimmedExpr.slice(THIS_PREFIX.length).trim();
            if (!propertyPath) {
                logger.debug('Property path is empty after "this."');
                return undefined;
            }
            return this.getValueFromFrontmatter(frontmatter, propertyPath, logger);
        }
        logger.debug(`Expression '${expr}' not recognized, returning undefined`);
        return undefined;
    }
    extractPropertyPath(expr) {
        const joinMatch = expr.match(/join\(\s*this\.([^,]+)/);
        if (joinMatch) {
            return joinMatch[1].trim();
        }
        const thisMatch = expr.match(/this\.(.+)/);
        if (thisMatch) {
            return thisMatch[1].trim();
        }
        return '';
    }
    normalizeToArray(value) {
        if (value === null || value === undefined) {
            return [];
        }
        if (Array.isArray(value)) {
            return value;
        }
        return [value];
    }
    getValueFromFrontmatter(frontmatter, propertyPath, logger) {
        const segments = propertyPath.split('.').filter(Boolean);
        let current = frontmatter.nested;
        for (const segment of segments) {
            if (current == null || typeof current !== 'object') {
                logger.debug(`Property path segment '${segment}' not found in frontmatter.`);
                return undefined;
            }
            current = current[segment];
        }
        logger.debug(`Resolved property path '${propertyPath}' to value`, { value: current });
        return current;
    }
    renderValue(value, logger) {
        if (value === null || value === undefined) {
            logger.debug('Value is null or undefined, rendering as empty string.');
            return '';
        }
        if (Array.isArray(value)) {
            logger.debug('Rendering array value', { value, length: value.length });
            return value.map((v) => String(v)).join(', ');
        }
        logger.debug('Rendering scalar value', { value: String(value) });
        return String(value);
    }
}
exports.RenderInlineDataviewService = RenderInlineDataviewService;
