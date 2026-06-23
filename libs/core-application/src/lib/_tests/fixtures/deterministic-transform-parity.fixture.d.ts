import type { CollectedNote } from '@core-domain/entities/collected-note';
import type { IgnoreRule } from '@core-domain/entities/ignore-rule';
type FixtureCorpus = {
    id: string;
    notes: CollectedNote[];
    ignoredNoteIds: string[];
};
export declare const deterministicTransformParityIgnoreRules: IgnoreRule[];
export declare const deterministicTransformParityFixtures: FixtureCorpus[];
export {};
//# sourceMappingURL=deterministic-transform-parity.fixture.d.ts.map