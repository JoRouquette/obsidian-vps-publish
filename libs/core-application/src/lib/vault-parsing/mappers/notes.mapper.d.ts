import { type CollectedNote } from '@core-domain';
import { type Mapper } from '@core-domain/entities/mapper';
import { type PublishableNote } from '@core-domain/entities/publishable-note';
export declare class NotesMapper implements Mapper<CollectedNote, PublishableNote> {
    map(note: CollectedNote): PublishableNote;
}
//# sourceMappingURL=notes.mapper.d.ts.map