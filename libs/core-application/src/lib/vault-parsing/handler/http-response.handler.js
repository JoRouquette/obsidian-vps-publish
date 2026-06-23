"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpResponseHandler = void 0;
const http_response_1 = require("@core-domain/entities/http-response");
class HttpResponseHandler {
    constructor(mapper, logger) {
        this.defaultMapper = mapper;
        this._logger = logger.child({ usecase: 'HandleHttpResponseUseCase' });
        this._logger.debug('HandleHttpResponseUseCase initialized');
    }
    async handleResponseAsync(command) {
        try {
            let { response: res, url } = command;
            this._logger.debug('Handling HTTP response', { res });
            const mappingResult = await this.defaultMapper(res, url);
            let response = mappingResult.response;
            url = mappingResult.url;
            if (!response || typeof response !== 'object' || typeof response.text !== 'function') {
                this._logger.debug('Mapper did not return a valid Response object', {
                    response,
                });
                return {
                    isError: true,
                    error: new Error('Mapper did not return a valid Response object'),
                };
            }
            const text = await response.text();
            if (response.ok) {
                this._logger.debug(`HTTP request successful: ${response.status}`);
                return {
                    isError: false,
                    httpStatus: new http_response_1.HttpStatus(response.status, response.statusText).toString(),
                    text,
                };
            }
            else {
                this._logger.debug(`HTTP request failed ${response.status}`, {
                    text,
                    status: response.status,
                    statusText: response.statusText,
                });
                return {
                    isError: true,
                    error: new Error(`HTTP Error ${response.status} ${response.statusText}`),
                    httpStatus: new http_response_1.HttpStatus(response.status, response.statusText).toString(),
                    text,
                };
            }
        }
        catch (error) {
            this._logger.debug('Error handling HTTP response', { error });
            return {
                isError: true,
                error: error instanceof Error ? error : new Error(String(error)),
            };
        }
    }
}
exports.HttpResponseHandler = HttpResponseHandler;
