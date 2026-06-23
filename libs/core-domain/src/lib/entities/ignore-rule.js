"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IgnoreRule = void 0;
class IgnoreRule {
    constructor(data) {
        this.property = data.property;
        this.ignoreIf = data.ignoreIf;
        this.ignoreValues = data.ignoreValues;
    }
    toString() {
        return `IgnoreRule(property=${this.property}, ignoreIf=${this.ignoreIf}, ignoreValues=${this.ignoreValues})`;
    }
}
exports.IgnoreRule = IgnoreRule;
