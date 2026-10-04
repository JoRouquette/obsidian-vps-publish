import compression from 'compression';
import type { Request, Response } from 'express';

const EVENT_STREAM_CONTENT_TYPE = /^\s*text\/event-stream\s*(;|$)/i;

/**
 * Decides whether `compression()` may encode a response.
 *
 * Server-sent events are never compressed. The default filter treats
 * `text/event-stream` as compressible (it matches `text/*`), and once
 * compressed, every small event stays in the zlib buffer: nothing reaches
 * the client until the buffer fills or the stream ends. The SSE controllers
 * never call `res.flush()`, so a client that sends `Accept-Encoding` (browsers
 * do, `EventSource` included) would receive no event at all.
 *
 * Runs when the headers are written, so the controllers must set
 * `Content-Type` before `flushHeaders()`, which they do.
 */
export function shouldCompress(req: Request, res: Response): boolean {
  if (req.headers['x-no-compression']) {
    return false;
  }

  const contentType = res.getHeader('Content-Type');
  if (typeof contentType === 'string' && EVENT_STREAM_CONTENT_TYPE.test(contentType)) {
    return false;
  }

  return compression.filter(req, res);
}
