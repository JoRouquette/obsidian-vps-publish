import type { Request, Response } from 'express';
import type { PublishNotesUseCase } from '../../../../application/usecases/PublishNotesUseCase';
import { UploadNotesRequestSchema } from '../dto/UploadNotesDto';
import { mapNoteDtoToDomain } from '../mappers/noteMapper';
import { Note } from '../../../../domain/entities/Note';

export function createUploadController(useCase: PublishNotesUseCase) {
  return async function uploadController(req: Request, res: Response) {
    const parseResult = UploadNotesRequestSchema.safeParse(req.body);
    console.log('Upload request received, parsing result:', parseResult);

    if (!parseResult.success) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid request body',
        details: parseResult.error.format(),
      });
    }

    const notesDto = parseResult.data.notes;
    const notes = notesDto.map(mapNoteDtoToDomain) as Note[];

    try {
      const result = await useCase.execute({ notes });

      return res.status(200).json({
        ok: result.errors.length === 0,
        published: result.published,
        errors: result.errors,
      });
    } catch (err) {
      console.error('Upload error', err);

      return res.status(500).json({
        ok: false,
        error: 'Internal server error',
      });
    }
  };
}
