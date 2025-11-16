import { Router, Request, Response } from 'express';

export function createPingController(): Router {
  const router = Router();

  router.get('/ping', (req: Request, res: Response) => {
    return res.json({ status: 'ok' });
  });

  return router;
}
