import { Router, Request, Response, NextFunction } from 'express';
import { UploadBodyDto } from '../dto/UploadNotesDto';
import { Note } from '../../../../domain/entities/Note';
import { PublishNotesUseCase } from '../../../../application/usecases/PublishNotesUseCase';
import { LoggerPort } from '../../../../application/ports/LoggerPort';

function mapDtoToDomainNote(dto: any): Note {
  return {
    id: dto.id,
    slug: dto.slug,
    route: dto.route,
    relativePath: dto.relativePath ?? '',
    markdown: dto.markdown,
    frontmatter: dto.frontmatter,
    publishedAt: new Date(dto.publishedAt),
    updatedAt: new Date(dto.updatedAt),
  } as Note;
}

export function createUploadController(
  publishNotesUseCase: PublishNotesUseCase,
  logger?: LoggerPort
): Router {
  const router = Router();

  router.post('/upload', async (req: Request, res: Response, next: NextFunction) => {
    const log = logger?.child({ module: 'uploadController', route: '/upload' }) ?? logger;
    try {
      const parseResult = UploadBodyDto.safeParse(req.body);

      if (!parseResult.success) {
        log?.warn?.('UploadBodyDto validation error', { error: parseResult.error });
        return res.status(400).json({ status: 'invalid_payload' });
      }

      const { notes } = parseResult.data;

      log?.info?.('Received upload request', { notesCount: notes.length });

      const domainNotes = notes.map(mapDtoToDomainNote);

      const result = await publishNotesUseCase.execute({
        notes: domainNotes,
      });

      log?.info?.('Notes published', { publishedCount: result.published });

      return res.status(200).json({
        publishedCount: result.published,
      });
    } catch (err) {
      log?.error?.('Error in /api/upload', { error: err });
      return res.status(500).json({ status: 'error' });
    }
  });

  return router;
}
