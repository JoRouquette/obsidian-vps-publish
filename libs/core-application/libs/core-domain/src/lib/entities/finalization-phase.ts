export type FinalizationPhase =
  | 'queued'
  | 'rebuilding_notes'
  | 'rendering_html'
  | 'promoting_content'
  | 'rebuilding_indexes'
  | 'validating_links'
  | 'completing_publication'
  | 'completed'
  | 'failed';

export const FINALIZATION_PHASE_PROGRESS: Record<FinalizationPhase, number> = {
  queued: 0,
  rebuilding_notes: 20,
  rendering_html: 45,
  promoting_content: 70,
  rebuilding_indexes: 85,
  validating_links: 95,
  completing_publication: 98,
  completed: 100,
  failed: 100,
};
