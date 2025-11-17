import { Router, Request, Response, NextFunction } from 'express';
import { UploadBodyDto } from '../dto/UploadNotesDto';
import { Note } from '../../../../domain/entities/Note';
import { PublishNotesUseCase } from '../../../../application/usecases/PublishNotesUseCase';
import { LoggerPort } from '../../../../application/ports/LoggerPort';

function mapDtoToDomainNote(dto: any): Note {
  return {
    id: dto.id,
    title: dto.title,
    slug: dto.slug,
    route: dto.route,
    relativePath: dto.relativePath,
    markdown: dto.markdown,
    frontmatter: dto.frontmatter,
    publishedAt: new Date(dto.publishedAt),
  } as Note;
}

export function createUploadController(
  publishNotesUseCase: PublishNotesUseCase,
  logger?: LoggerPort
): Router {
  const router = Router();

  router.post('/upload', async (req: Request, res: Response, next: NextFunction) => {
    logger = logger?.child({ module: 'uploadController', route: '/upload' }) ?? logger;
    logger?.info?.('Handling /api/upload request');
    logger?.debug?.('Request body', { body: req.body });
    logger?.debug?.('Request headers', { headers: req.headers });

    try {
      const parseResult = UploadBodyDto.safeParse(req.body);
      logger?.debug?.('Parsed upload body', { parsed: parseResult });

      if (!parseResult.success) {
        logger?.warn?.('UploadBodyDto validation error', { error: parseResult.error });
        return res.status(400).json({ status: 'invalid_payload' });
      }

      const { notes } = parseResult.data;

      logger?.info?.('Received upload request', { notesCount: notes.length });

      const domainNotes = notes.map(mapDtoToDomainNote);
      const result = await publishNotesUseCase.execute(domainNotes);

      logger?.info?.('Notes published', { publishedCount: result.published });

      return res.status(200).json({
        publishedCount: result.published,
      });
    } catch (err: any) {
      logger?.error?.('Error in /api/upload', err);
      return res.status(500).json({ status: 'error' });
    }
  });

  return router;
}
