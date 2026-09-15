import type { IgnorePrimitive } from './ignore-primitive';

export class IgnoreRule {
  property: string;
  ignoreIf?: boolean;
  ignoreValues?: IgnorePrimitive[];

  constructor(data: { property: string; ignoreIf?: boolean; ignoreValues?: IgnorePrimitive[] }) {
    this.property = data.property;
    this.ignoreIf = data.ignoreIf;
    this.ignoreValues = data.ignoreValues;
  }

  toString(): string {
    // `ignoreValues` est un tableau : l'interpoler directement donnait la
    // conversion implicite d'Array#toString, illisible dès qu'une valeur contient
    // une virgule. On le sérialise explicitement.
    const valeurs = this.ignoreValues ? JSON.stringify(this.ignoreValues) : 'undefined';
    return `IgnoreRule(property=${this.property}, ignoreIf=${String(this.ignoreIf)}, ignoreValues=${valeurs})`;
  }
}
