import { type HttpResponse } from '@core-domain/entities/http-response';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import { type Handler, type MapperFunction } from '@core-domain/utils/mapper.util';
export type HandleHttpResponseUseCaseCommand<T> = {
    response: T;
    url?: string;
};
export declare class HttpResponseHandler<T> implements Handler<T> {
    private readonly _logger;
    defaultMapper: MapperFunction<T>;
    constructor(mapper: MapperFunction<T>, logger: LoggerPort);
    handleResponseAsync(command: HandleHttpResponseUseCaseCommand<T>): Promise<HttpResponse>;
}
//# sourceMappingURL=http-response.handler.d.ts.map