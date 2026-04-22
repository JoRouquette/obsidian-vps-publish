export class HttpStatus {
  code: number;
  text: string;

  constructor(code: number, text: string) {
    this.code = code;
    this.text = text;
  }

  toString(): string {
    return `${this.code} ${this.text}`;
  }
}

export type HttpResponse =
  | { isError: false; httpStatus: string; text: string }
  | { isError: true; error: unknown; httpStatus?: string; text?: string };
