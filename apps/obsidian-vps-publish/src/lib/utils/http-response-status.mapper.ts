import { type LoggerPort } from '@core-domain/ports/logger-port';
import { type ApiRequestMapper, type MappingResult } from '@core-domain/utils/mapper.util';
import { type RequestUrlResponse } from 'obsidian';

export class RequestUrlResponseMapper implements ApiRequestMapper<RequestUrlResponse> {
  private readonly _logger: LoggerPort;

  constructor(logger: LoggerPort) {
    this._logger = logger.child({ module: 'HttpResponseStatusMapper' });
    this._logger.debug('HttpResponseStatusMapper initialized');
  }

  execute(response: RequestUrlResponse, url?: string): MappingResult {
    this._logger.debug('Mapping Obsidian response to Fetch Response', {
      response,
      url,
    });

    const options: ResponseInit = {
      status: response.status,
      statusText: this.getStatusText(response.status),
      headers: response.headers,
    };

    const responseObj = {
      response: new Response(response.text, options),
      url,
    };

    this._logger.debug('Mapped Response object', { responseObj });
    return responseObj;
  }

  private getStatusText(status: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      202: 'Accepted',
      203: 'Non-Authoritative Information',
      204: 'No Content',
      205: 'Reset Content',
      206: 'Partial Content',
      300: 'Multiple Choices',
      301: 'Moved Permanently',
      302: 'Found',
      303: 'See Other',
      304: 'Not Modified',
      305: 'Use Proxy',
      307: 'Temporary Redirect',
      308: 'Permanent Redirect',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      409: 'Conflict',
      413: 'Payload Too Large',
      414: 'URI Too Long',
      415: 'Unsupported Media Type',
      500: 'Internal Server Error',
      501: 'Not Implemented',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };

    return statusTexts[status] || 'Unknown Status';
  }
}
