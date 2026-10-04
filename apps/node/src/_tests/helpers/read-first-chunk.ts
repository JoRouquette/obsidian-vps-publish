import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FirstChunk {
  contentEncoding: string | undefined;
  body: string;
}

export interface ReadFirstChunkOptions {
  /** Resolve as soon as the body contains this text. */
  until?: string;
  /** Upper bound, armed when the request is sent. Only reached on a regression. */
  timeoutMs?: number;
}

/**
 * Opens a request against a listening server and resolves with the response
 * encoding and the body received so far, then closes the connection.
 *
 * It resolves early once `until` appears in the body, when the response ends,
 * or at `timeoutMs` at the latest. A stream held in a compression buffer
 * therefore resolves with an empty or encoded body instead of hanging the
 * test, and a route that never sends headers resolves with an empty body.
 */
export function readFirstChunk(
  server: http.Server,
  path: string,
  headers: http.OutgoingHttpHeaders,
  { until, timeoutMs = 2000 }: ReadFirstChunkOptions = {}
): Promise<FirstChunk> {
  const { port } = server.address() as AddressInfo;

  return new Promise((resolve, reject) => {
    let contentEncoding: string | undefined;
    const chunks: Buffer[] = [];
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      req.destroy();
      resolve({ contentEncoding, body: Buffer.concat(chunks).toString('utf8') });
    };

    const req = http.get({ port, path, headers }, (res) => {
      contentEncoding = res.headers['content-encoding'];
      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        if (until !== undefined && Buffer.concat(chunks).toString('utf8').includes(until)) {
          finish();
        }
      });
      res.on('end', finish);
    });

    const timer = setTimeout(finish, timeoutMs);

    req.on('error', (error) => {
      // destroy() in finish() resets the socket on purpose; any other error is real.
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}
