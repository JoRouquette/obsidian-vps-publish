export declare class HttpStatus {
    code: number;
    text: string;
    constructor(code: number, text: string);
    toString(): string;
}
export type HttpResponse = {
    isError: false;
    httpStatus: string;
    text: string;
} | {
    isError: true;
    error: unknown;
    httpStatus?: string;
    text?: string;
};
//# sourceMappingURL=http-response.d.ts.map