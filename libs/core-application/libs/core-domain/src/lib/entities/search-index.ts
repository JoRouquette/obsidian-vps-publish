export interface ContentSearchIndexEntry {
  route: string;
  title: string;
  sentences: string[];
}

export interface ContentSearchIndex {
  sessionId?: string;
  /** Publication revision that produced this index (matches manifest.contentRevision). */
  contentRevision?: string;
  builtAt: string;
  entries: ContentSearchIndexEntry[];
}
