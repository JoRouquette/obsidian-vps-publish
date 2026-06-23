"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvaluateIgnoreRulesHandler = void 0;
const string_utils_1 = require("@core-domain/utils/string.utils");
class EvaluateIgnoreRulesHandler {
    constructor(rules, logger) {
        this.rules = rules;
        this._logger = logger.child({ usecase: 'EvaluateIgnoreRulesUseCase' });
    }
    async handle(input) {
        const notes = input;
        const evaluatedNotes = [];
        if (!this.rules || this.rules.length === 0) {
            this._logger.debug('No ignore rules provided, note is publishable');
            return notes.map((note) => ({ ...note, eligibility: { isPublishable: true } }));
        }
        for (const note of notes) {
            this._logger.debug('Evaluating ignore rules', {
                frontmatter: note.frontmatter,
                rules: this.rules,
            });
            this.rules?.map((r) => this._logger.debug(` - rule: ${JSON.stringify(r)}`));
            const nested = note.frontmatter.nested;
            let ignored = false;
            for (let index = 0; index < this.rules.length; index++) {
                const rule = this.rules[index];
                const value = getNestedValue(nested, (0, string_utils_1.normalizePropertyKey)(rule.property));
                this._logger.debug(`Evaluating rule ${index}`, { rule, value, index });
                if (value === undefined) {
                    continue;
                }
                if (rule.ignoreIf !== undefined && typeof value === 'boolean' && value === rule.ignoreIf) {
                    this._logger.debug(`Note ignored by ignoreIf rule property: ${rule.property}, value: ${value}, ruleIndex: ${index}`);
                    evaluatedNotes.push({
                        ...note,
                        eligibility: {
                            isPublishable: false,
                            ignoredByRule: {
                                property: rule.property,
                                reason: 'ignoreIf',
                                matchedValue: value,
                                ruleIndex: index,
                            },
                        },
                    });
                    ignored = true;
                    break;
                }
                if (rule.ignoreValues && rule.ignoreValues.length > 0) {
                    const matched = matchesAnyPrimitive(value, rule.ignoreValues);
                    if (matched !== undefined) {
                        this._logger.debug(`Note ignored by ignoreValues rule property: ${rule.property}, matchedValue: ${matched}, ruleIndex: ${index}`);
                        evaluatedNotes.push({
                            ...note,
                            eligibility: {
                                isPublishable: false,
                                ignoredByRule: {
                                    property: rule.property,
                                    reason: 'ignoreValues',
                                    matchedValue: matched,
                                    ruleIndex: index,
                                },
                            },
                        });
                        ignored = true;
                        break;
                    }
                }
            }
            if (!ignored) {
                this._logger.debug('No ignore rule matched, note is publishable');
                evaluatedNotes.push({
                    ...note,
                    eligibility: {
                        isPublishable: true,
                    },
                });
            }
        }
        return evaluatedNotes;
    }
}
exports.EvaluateIgnoreRulesHandler = EvaluateIgnoreRulesHandler;
function getNestedValue(nested, propertyPath) {
    const segments = propertyPath.split('.').map(string_utils_1.normalizePropertyKey);
    let current = nested;
    for (const segment of segments) {
        if (typeof current !== 'object' || current === null) {
            return undefined;
        }
        const matchKey = Object.keys(current).find((k) => (0, string_utils_1.normalizePropertyKey)(k) === segment);
        if (!matchKey) {
            return undefined;
        }
        current = current[matchKey];
    }
    return current;
}
function isEqualPrimitive(value, target) {
    if (typeof value === 'string' && typeof target === 'string') {
        const normalize = (s) => s
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
        return normalize(value) === normalize(target);
    }
    return value === target;
}
function matchesAnyPrimitive(value, targets) {
    if (targets.length === 0)
        return undefined;
    if (Array.isArray(value)) {
        for (const item of value) {
            for (const t of targets) {
                if (isEqualPrimitive(item, t)) {
                    return t;
                }
            }
        }
        return undefined;
    }
    for (const t of targets) {
        if (isEqualPrimitive(value, t)) {
            return t;
        }
    }
    return undefined;
}
