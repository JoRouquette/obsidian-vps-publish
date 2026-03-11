/* eslint-disable @typescript-eslint/no-misused-promises */
import type { LoggerPort } from '@core-domain';
import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';

import type {
  ContentVersion,
  ContentVersionService,
} from '../../../content-version/content-version.service';

/**
 * Creates routes for content version endpoints.
 *
 * Endpoints:
 * - GET /_content-version.json - Returns current content version (public, no auth)
 * - GET /events/content - SSE stream for content version updates (public, no auth)
 */
export function createContentVersionController(
  contentVersionService: ContentVersionService,
  logger?: LoggerPort
): Router {
  const router = createRouter();
  const log = logger?.child({ module: 'contentVersionController' });

  /**
   * GET /_content-version.json
   * Returns current content version for polling fallback.
   * Public endpoint (no API key required).
   */
  router.get('/_content-version.json', async (_req: Request, res: Response) => {
    try {
      const version = await contentVersionService.getVersion();

      if (!version) {
        return res.status(404).json({ error: 'Content version not available' });
      }

      // No caching - always return fresh version
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');

      return res.json(version);
    } catch (error) {
      log?.error('Error getting content version', {
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /events/content
   * SSE stream for real-time content version updates.
   * Public endpoint (no API key required).
   */
  router.get('/events/content', (req: Request, res: Response) => {
    const clientId = Math.random().toString(36).slice(2, 10);
    log?.debug('SSE client connected', { clientId });

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Helper to send SSE message
    const sendEvent = (data: unknown) => {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      res.write(message);
    };

    // Send initial heartbeat
    sendEvent({ type: 'connected', clientId });

    // Subscribe to version updates
    const unsubscribe = contentVersionService.subscribe((version: ContentVersion) => {
      sendEvent({
        type: 'contentVersion',
        version: version.version,
        contentRevision: version.contentRevision,
        generatedAt: version.generatedAt,
      });
    });

    // Heartbeat to keep connection alive (every 30 seconds)
    const heartbeatInterval = setInterval(() => {
      try {
        sendEvent({ type: 'heartbeat', timestamp: new Date().toISOString() });
      } catch {
        // Connection might be closed
        clearInterval(heartbeatInterval);
      }
    }, 30000);

    // Cleanup on client disconnect
    req.on('close', () => {
      log?.debug('SSE client disconnected', { clientId });
      unsubscribe();
      clearInterval(heartbeatInterval);
    });

    // Handle errors
    req.on('error', (error) => {
      log?.error('SSE connection error', {
        clientId,
        error: error.message,
      });
      unsubscribe();
      clearInterval(heartbeatInterval);
    });
  });

  return router;
}
