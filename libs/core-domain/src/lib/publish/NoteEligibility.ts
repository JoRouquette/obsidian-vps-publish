import { NoteIgnoredByRule } from './NoteIgnoredByRule';

export interface NoteEligibility {
  isPublishable: boolean;
  ignoredByRule?: NoteIgnoredByRule;
}
