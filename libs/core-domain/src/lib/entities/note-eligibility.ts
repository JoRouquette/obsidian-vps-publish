import { NoteIgnoredByRule } from './note-ignored-by-rule';

export interface NoteEligibility {
  isPublishable: boolean;
  ignoredByRule?: NoteIgnoredByRule;
}
