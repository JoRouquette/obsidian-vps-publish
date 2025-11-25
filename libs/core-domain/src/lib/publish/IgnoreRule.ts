import { IgnorePrimitive } from './IgnorePrimitive';

export class IgnoreRule {
  property: string;
  ignoreIf?: boolean;
  ignoreValues?: IgnorePrimitive[];

  constructor(data: {
    property: string;
    ignoreIf?: boolean;
    ignoreValues?: IgnorePrimitive[];
  }) {
    this.property = data.property;
    this.ignoreIf = data.ignoreIf;
    this.ignoreValues = data.ignoreValues;
  }

  toString(): string {
    return `IgnoreRule(property=${this.property}, ignoreIf=${this.ignoreIf}, ignoreValues=${this.ignoreValues})`;
  }
}
