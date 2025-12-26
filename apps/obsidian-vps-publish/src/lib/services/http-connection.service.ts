import { type HttpResponseHandler } from '@core-application/vault-parsing/handler/http-response.handler';
import { type HttpResponse } from '@core-domain/entities/http-response';
import type { VpsConfig } from '@core-domain/entities/vps-config';
import { type LoggerPort } from '@core-domain/ports/logger-port';
import { requestUrl, type RequestUrlResponse } from 'obsidian';

import { translate } from '../../i18n';
import type { Translations } from '../../i18n/locales';

function normalizeBaseUrl(url: string): string {
  let u = url.trim();
  if (u.endsWith('/')) u = u.slice(0, -1);
  return u;
}

export async function testVpsConnection(
  vps: VpsConfig,
  handleHttpResponse: HttpResponseHandler<RequestUrlResponse>,
  logger: LoggerPort,
  translations?: Translations
): Promise<HttpResponse> {
  logger = logger.child({ function: 'testVpsConnection' });
  logger.debug('Testing VPS connection', { vps });

  if (!vps.apiKey) {
    const errorMsg = translations
      ? translate(translations, 'sessionErrors.missingApiKey')
      : 'Missing API key';
    return { isError: true, error: new Error(errorMsg) };
  }

  if (!vps.baseUrl) {
    const errorMsg = translations
      ? translate(translations, 'sessionErrors.invalidUrl')
      : 'Invalid URL';
    return { isError: true, error: new Error(errorMsg) };
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
    logger.error(`something when wrong in testVpsConnection `, { error: e });
    return {
      isError: true,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}
