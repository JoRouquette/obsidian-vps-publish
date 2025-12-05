import { type HttpResponseHandler } from '@core-application/vault-parsing/handler/http-response.handler';
import { type HttpResponse } from '@core-domain/entities/http-response';
import type { VpsConfig } from '@core-domain/entities/vps-config';
import { type LoggerPort } from '@core-domain/ports/logger-port';
import { requestUrl, type RequestUrlResponse } from 'obsidian';

function normalizeBaseUrl(url: string): string {
  let u = url.trim();
  if (u.endsWith('/')) u = u.slice(0, -1);
  return u;
}

export async function testVpsConnection(
  vps: VpsConfig,
  handleHttpResponse: HttpResponseHandler<RequestUrlResponse>,
  logger: LoggerPort
): Promise<HttpResponse> {
  logger = logger.child({ function: 'testVpsConnection' });
  logger.debug('Testing VPS connection', { vps });

  if (!vps.apiKey) {
    return { isError: true, error: new Error('Missing API key') };
  }

  if (!vps.baseUrl) {
    return { isError: true, error: new Error('Invalid URL') };
  }

  const baseUrl = normalizeBaseUrl(vps.baseUrl);
  const url = `${baseUrl}/api/ping`;

  logger.debug(`Pinging VPS at ${url}`);

  try {
    const res = await requestUrl({
      url,
      method: 'GET',
      headers: {
        'x-api-key': vps.apiKey,
      },
      throw: false,
    });

    logger.debug('Received response from VPS ', { res });

    return await handleHttpResponse.handleResponseAsync({ response: res, url });
  } catch (e) {
    logger.error(`something when wrong in testVpsConnection `, e);
    return {
      isError: true,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}
