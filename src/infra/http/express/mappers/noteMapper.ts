import type { Note } from '../../../../domain/entities/Note';
import type { NoteDto } from '../dto/UploadNotesDto';

export function mapNoteDtoToDomain(dto: NoteDto): Note {
  return {
    id: dto.id,
    slug: dto.slug,
    route: dto.route,
    vaultPath: dto.vaultPath,
    relativePath: dto.relativePath,
    markdown: dto.markdown,
    frontmatter: { ...dto.frontmatter },
    publishedAt: new Date(dto.publishedAt),
    updatedAt: new Date(dto.updatedAt),
  };
}
