/**
 * Request Correlation Middleware
 * Generates and propagates request IDs for distributed tracing and log correlation
 */

import type { LoggerPort } from '@core-domain';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export interface RequestWithId extends Request {
  requestId: string;
}

export class RequestCorrelationMiddleware {
  constructor(private readonly logger?: LoggerPort) {}

  /**
   * Express middleware handler
   * Generates or extracts x-request-id and attaches to request
   */
  handle() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Extract or generate request ID
      const requestId = this.extractRequestId(req);

      // Attach to request for downstream use
      (req as RequestWithId).requestId = requestId;

      // Return in response headers for client correlation
      res.setHeader('x-request-id', requestId);

      // Log request start with correlation ID
      const startTime = Date.now();
      this.logger?.debug('[REQ] Request started', {
        requestId,
        method: req.method,
        path: req.path,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });

      // Track response
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.logger?.debug('[REQ] Request completed', {
          requestId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: duration,
        });
      });

      next();
    };
  }

  /**
   * Extract request ID from headers or generate new one
   * Supports multiple header formats for compatibility
   */
  private extractRequestId(req: Request): string {
    // Check common request ID headers (priority order)
    const headers = [
      req.headers['x-request-id'],
      req.headers['x-correlation-id'],
      req.headers['x-trace-id'],
      req.headers['request-id'],
    ];

    for (const header of headers) {
      if (header && typeof header === 'string') {
        return header;
      }
    }

    // Generate new UUID if no header present
    return randomUUID();
  }

  /**
   * Extract request ID from request (for use in controllers)
   */
  static getRequestId(req: Request): string {
    return (req as RequestWithId).requestId || 'unknown';
  }
}
