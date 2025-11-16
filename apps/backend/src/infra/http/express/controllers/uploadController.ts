import { Router, Request, Response, NextFunction } from 'express';
import { UploadBodyDto } from '../dto/UploadNotesDto';
import { Note } from '../../../../domain/entities/Note';
import { PublishNotesUseCase } from '../../../../application/usecases/PublishNotesUseCase';

function mapDtoToDomainNote(dto: any): Note {
  // Adapte à ta vraie entité Note.ts
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

export function createUploadController(publishNotesUseCase: PublishNotesUseCase): Router {
  const router = Router();

  router.post('/upload', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = UploadBodyDto.safeParse(req.body);

      if (!parseResult.success) {
        // Log détaillé en interne
        console.error('UploadBodyDto validation error', parseResult.error);
        return res.status(400).json({ status: 'invalid_payload' });
      }

      const { notes } = parseResult.data;

      const domainNotes = notes.map(mapDtoToDomainNote);

      const result = await publishNotesUseCase.execute({
        notes: domainNotes,
      });

      return res.json({
        status: 'ok',
        publishedCount: result.published,
      });
    } catch (err) {
      console.error('Error in /api/upload', err);
      return res.status(500).json({ status: 'error' });
    }
  });

  return router;
}
