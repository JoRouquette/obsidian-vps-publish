import type { Request } from 'express';

import { AngularSSRService } from '../angular-ssr.service';

// Angular ships as ESM only: the render path just needs the injection token.
jest.mock('@angular/common', () => ({ APP_BASE_HREF: 'APP_BASE_HREF' }), { virtual: true });

interface ReadyService {
  commonEngine: { render: jest.Mock };
  bootstrap: unknown;
  initialized: boolean;
}

function renderedUrl(render: jest.Mock): string {
  return (render.mock.calls[0][0] as { url: string }).url;
}

function buildReadyService(trustedOrigin: string | undefined): {
  service: AngularSSRService;
  render: jest.Mock;
} {
  const service = new AngularSSRService({
    serverDistPath: '/server',
    browserDistPath: '/browser',
    enabled: true,
    cacheEnabled: false,
    trustedOrigin,
  });
  const render = jest.fn().mockResolvedValue('<html></html>');
  // The Angular engine is an ESM bundle that unit tests cannot load: inject a stand-in.
  const internals = service as unknown as ReadyService;
  internals.commonEngine = { render };
  internals.bootstrap = {};
  internals.initialized = true;
  return { service, render };
}

function buildRequest(host: string, originalUrl: string): Request {
  return {
    protocol: 'http',
    originalUrl,
    baseUrl: '',
    get: (name: string) => (name.toLowerCase() === 'host' ? host : undefined),
  } as unknown as Request;
}

describe('AngularSSRService.render', () => {
  it('renders against the trusted origin when the Host header is forged', async () => {
    const { service, render } = buildReadyService('https://trusted.example');

    await service.render(buildRequest('evil.example', '/notes/page?x=1'));

    expect(render).toHaveBeenCalledTimes(1);
    expect(renderedUrl(render)).toBe('https://trusted.example/notes/page?x=1');
  });

  it('ignores a forged Host even when the target is protocol-relative', async () => {
    const { service, render } = buildReadyService('https://trusted.example');

    await service.render(buildRequest('evil.example', '//evil.example/x'));

    expect(new URL(renderedUrl(render)).origin).toBe('https://trusted.example');
  });

  it('falls back to the Host header when no trusted origin is configured', async () => {
    const { service, render } = buildReadyService(undefined);

    await service.render(buildRequest('localhost:4200', '/page'));

    expect(renderedUrl(render)).toBe('http://localhost:4200/page');
  });
});
