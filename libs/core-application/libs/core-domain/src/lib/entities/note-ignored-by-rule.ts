export interface NoteIgnoredByRule {
  property: string;
  reason: 'ignoreIf' | 'ignoreValues';
  matchedValue: unknown;
  ruleIndex: number;
}
