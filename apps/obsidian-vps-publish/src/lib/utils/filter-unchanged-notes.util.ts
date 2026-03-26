import { type PublishableNote } from '@core-domain';

type HashService = {
  computeHash(content: string): Promise<string>;
};

export interface FilterUnchangedNotesParams {
  notes: PublishableNote[];
  existingNoteHashes?: Record<string, string>;
  existingSourceNoteHashesByVaultPath?: Record<string, string>;
  pipelineChanged: boolean;
  apiOwnedDeterministicNoteTransformsEnabled: boolean;
  hashService: HashService;
}

export interface FilterUnchangedNotesResult {
  notesToUpload: PublishableNote[];
  skippedCount: number;
  applied: boolean;
}

export async function filterUnchangedNotes({
  notes,
  existingNoteHashes = {},
  existingSourceNoteHashesByVaultPath = {},
  pipelineChanged,
  apiOwnedDeterministicNoteTransformsEnabled,
  hashService,
}: FilterUnchangedNotesParams): Promise<FilterUnchangedNotesResult> {
  if (pipelineChanged) {
    return {
      notesToUpload: notes,
      skippedCount: 0,
      applied: false,
    };
  }

  const activeHashMap = apiOwnedDeterministicNoteTransformsEnabled
    ? existingSourceNoteHashesByVaultPath
    : existingNoteHashes;

  if (Object.keys(activeHashMap).length === 0) {
    return {
      notesToUpload: notes,
      skippedCount: 0,
      applied: false,
    };
  }

  const notesToUpload: PublishableNote[] = [];
  let skippedCount = 0;

  for (const note of notes) {
    const dedupKey = apiOwnedDeterministicNoteTransformsEnabled
      ? note.vaultPath
      : note.routing.fullPath;
    const existingHash = dedupKey ? activeHashMap[dedupKey] : undefined;

    if (!existingHash) {
      notesToUpload.push(note);
      continue;
    }

    const currentHash = await hashService.computeHash(note.content);
    if (currentHash === existingHash) {
      skippedCount++;
      continue;
    }

    notesToUpload.push(note);
  }

  return {
    notesToUpload,
    skippedCount,
    applied: true,
  };
}
