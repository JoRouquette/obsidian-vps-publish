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

/**
 * Réponse HTTP normalisée.
 *
 * La branche d'erreur porte un `Error`, jamais un `unknown` : la conversion est faite par les
 * producteurs (`HttpResponseHandler`, `http-connection.service`), au plus près de la frontière
 * réseau. Les appelants peuvent donc relancer ou chaîner sans revérifier le type.
 */
export type HttpResponse =
  | { isError: false; httpStatus: string; text: string }
  | { isError: true; error: Error; httpStatus?: string; text?: string };
