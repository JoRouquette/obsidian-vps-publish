import type { IgnorePrimitive } from './ignore-primitive';
export declare class IgnoreRule {
    property: string;
    ignoreIf?: boolean;
    ignoreValues?: IgnorePrimitive[];
    constructor(data: {
        property: string;
        ignoreIf?: boolean;
        ignoreValues?: IgnorePrimitive[];
    });
    toString(): string;
}
//# sourceMappingURL=ignore-rule.d.ts.map