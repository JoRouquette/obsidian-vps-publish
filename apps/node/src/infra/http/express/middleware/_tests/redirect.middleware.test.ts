import type { LogLevel, Manifest } from '@core-domain';
import { LogLevel as LogLevelEnum } from '@core-domain';
import type { NextFunction, Request, Response } from 'express';

import { createRedirectMiddleware } from '../redirect.middleware';

describe('Redirect Middleware', () => {
  let mockManifest: Manifest;
  let mockRequest: Request;
  let mockResponse: Response;
  let mockNext: jest.MockedFunction<NextFunction>;
  let mockLogger: {
    info: jest.Mock;
    warn: jest.Mock;
    debug: jest.Mock;
    error: jest.Mock;
    level: LogLevel;
    child: jest.Mock;
  };
  let manifestLoader: jest.Mock;

  beforeEach(() => {
    mockManifest = {
      sessionId: 'test',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      pages: [],
      canonicalMap: {
        '/old-route': '/new-route',
        '/legacy-page': '/current-page',
        '/blog/old-post': '/blog/new-post',
      },
    };

    manifestLoader = jest.fn().mockResolvedValue(mockManifest);

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      level: LogLevelEnum.info,
      child: jest.fn().mockReturnThis(),
    };

    // Create a proper mock Request with Object.defineProperty
    mockRequest = {
      headers: {
        'user-agent': 'test-agent',
      },
    } as unknown as Request;

    Object.defineProperty(mockRequest, 'path', {
      value: '/',
      writable: true,
      configurable: true,
    });

    mockResponse = {
      redirect: jest.fn(),
    } as unknown as Response;

    mockNext = jest.fn() as jest.MockedFunction<NextFunction>;
  });

  // Helper to set request path (mockRequest.path is read-only)
  const setRequestPath = (path: string) => {
    Object.defineProperty(mockRequest, 'path', {
      value: path,
      writable: true,
      configurable: true,
    });
  };

  it('should redirect 301 for old route to new route', async () => {
    setRequestPath('/old-route');

    const middleware = createRedirectMiddleware(manifestLoader, mockLogger);
    await middleware(mockRequest, mockResponse, mockNext);

    expect(mockResponse.redirect).toHaveBeenCalledWith(301, '/new-route');
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should redirect 301 for legacy page to current page', async () => {
    setRequestPath('/legacy-page');

    const middleware = createRedirectMiddleware(manifestLoader, mockLogger);
    await middleware(mockRequest, mockResponse, mockNext);

    expect(mockResponse.redirect).toHaveBeenCalledWith(301, '/current-page');
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should redirect 301 for blog old post', async () => {
    setRequestPath('/blog/old-post');

    const middleware = createRedirectMiddleware(manifestLoader, mockLogger);
    await middleware(mockRequest, mockResponse, mockNext);

    expect(mockResponse.redirect).toHaveBeenCalledWith(301, '/blog/new-post');
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next() when no redirect mapping exists', async () => {
    setRequestPath('/valid-route');

    const middleware = createRedirectMiddleware(manifestLoader, mockLogger);
    await middleware(mockRequest, mockResponse, mockNext);

    expect(mockResponse.redirect).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
  });

  it('should call next() when canonicalMap is empty', async () => {
    mockManifest.canonicalMap = {};
    setRequestPath('/any-route');

    const middleware = createRedirectMiddleware(manifestLoader, mockLogger);
    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.redirect).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
  });

  it('should call next() when canonicalMap is undefined', async () => {
    mockManifest.canonicalMap = undefined;
    setRequestPath('/any-route');

    const middleware = createRedirectMiddleware(manifestLoader, mockLogger);
    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.redirect).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
  });

  it('should skip redirect for /api/ routes', async () => {
    setRequestPath('/api/session/start');

    const middleware = createRedirectMiddleware(manifestLoader, mockLogger);
    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(manifestLoader).not.toHaveBeenCalled();
    expect(mockResponse.redirect).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
  });

  it('should skip redirect for /assets/ routes', async () => {
    setRequestPath('/assets/image.png');

    const middleware = createRedirectMiddleware(manifestLoader, mockLogger);
    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(manifestLoader).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
  });

  it('should skip redirect for /content/ routes', async () => {
    setRequestPath('/content/page.html');

    const middleware = createRedirectMiddleware(manifestLoader, mockLogger);
    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(manifestLoader).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
  });

  it('should skip redirect for /seo/ routes', async () => {
    setRequestPath('/seo/sitemap.xml');

    const middleware = createRedirectMiddleware(manifestLoader, mockLogger);
    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(manifestLoader).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
  });

  it('should skip redirect for /health endpoint', async () => {
    setRequestPath('/health');

    const middleware = createRedirectMiddleware(manifestLoader, mockLogger);
    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(manifestLoader).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
  });

  it('should skip redirect for /public-config endpoint', async () => {
    setRequestPath('/public-config');

    const middleware = createRedirectMiddleware(manifestLoader, mockLogger);
    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(manifestLoader).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
  });

  it('should skip redirect for static files (*.js, *.css, etc.)', async () => {
    const staticPaths = [
      '/main.js',
      '/styles.css',
      '/favicon.ico',
      '/logo.png',
      '/fonts/roboto.woff2',
    ];

    for (const path of staticPaths) {
      setRequestPath(path);
      mockNext.mockClear();

      const middleware = createRedirectMiddleware(manifestLoader, mockLogger);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.redirect).not.toHaveBeenCalled();
    }
  });

  it('should normalize trailing slash before checking mapping', async () => {
    setRequestPath('/old-route/'); // Avec trailing slash

    const middleware = createRedirectMiddleware(manifestLoader, mockLogger);
    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    // Doit matcher '/old-route' (sans trailing slash) dans le mapping
    expect(mockResponse.redirect).toHaveBeenCalledWith(301, '/new-route');
  });

  it('should not redirect if canonical route is same as current path', async () => {
    // Ajouter mapping identique (edge case)
    mockManifest.canonicalMap = {
      '/same-route': '/same-route',
    };
    setRequestPath('/same-route');

    const middleware = createRedirectMiddleware(manifestLoader, mockLogger);
    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.redirect).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle manifest loader error gracefully', async () => {
    manifestLoader.mockRejectedValue(new Error('Manifest load failed'));
    setRequestPath('/any-route');

    const localMockLogger = {
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      level: LogLevelEnum.info,
      child: jest.fn().mockReturnThis(),
    };

    const middleware = createRedirectMiddleware(manifestLoader, localMockLogger);
    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    // Doit appeler next() même en cas d'erreur
    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.redirect).not.toHaveBeenCalled();
    expect(localMockLogger.warn).toHaveBeenCalledWith('Redirect middleware error', {
      path: '/any-route',
      error: 'Manifest load failed',
    });
  });

  it('should log redirect with user-agent', async () => {
    setRequestPath('/old-route');
    mockRequest.headers = { 'user-agent': 'Mozilla/5.0 Test' };

    const localMockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      level: LogLevelEnum.info,
      child: jest.fn().mockReturnThis(),
    };

    const middleware = createRedirectMiddleware(manifestLoader, localMockLogger);
    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(localMockLogger.info).toHaveBeenCalledWith('301 redirect', {
      from: '/old-route',
      to: '/new-route',
      userAgent: 'Mozilla/5.0 Test',
    });
  });

  it('should preserve root path "/" without normalization', async () => {
    mockManifest.canonicalMap = {
      '/': '/home',
    };
    setRequestPath('/');

    const middleware = createRedirectMiddleware(manifestLoader, mockLogger);
    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.redirect).toHaveBeenCalledWith(301, '/home');
  });
});
