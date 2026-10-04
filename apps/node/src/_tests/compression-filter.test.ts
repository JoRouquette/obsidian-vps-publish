import type http from 'node:http';

import compression from 'compression';
import express, { type Request, type Response } from 'express';

import { shouldCompress } from '../infra/http/express/middleware/compression-filter';
import { readFirstChunk } from './helpers/read-first-chunk';

const CONNECTED_EVENT = '"type":"connected"';

describe('shouldCompress', () => {
  describe('content type matching', () => {
    function decide(contentType: string): boolean {
      const req = { headers: { 'accept-encoding': 'gzip' } } as unknown as Request;
      const res = {
        getHeader: (name: string) =>
          name.toLowerCase() === 'content-type' ? contentType : undefined,
      } as unknown as Response;
      return shouldCompress(req, res);
    }

    it.each([
      'text/event-stream',
      'text/event-stream; charset=utf-8',
      'TEXT/EVENT-STREAM',
      '  text/event-stream',
      'text/event-stream ;charset=utf-8',
    ])('never compresses %p', (contentType) => {
      expect(decide(contentType)).toBe(false);
    });

    it.each(['text/event-streamx', 'text/event-stream-foo', 'text/html'])(
      'leaves %p to the default filter',
      (contentType) => {
        expect(decide(contentType)).toBe(true);
      }
    );
  });

  describe('behind compression()', () => {
    let server: http.Server;

    beforeAll((done) => {
      const app = express();
      app.use(compression({ threshold: 1024, filter: shouldCompress }));
      app.get('/stream', (_req, res) => {
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.flushHeaders();
        res.write(`data: {${CONNECTED_EVENT}}\n\n`);
      });
      app.get('/large-json', (_req, res) => {
        res.json({ payload: 'x'.repeat(4096) });
      });
      server = app.listen(0, done);
    });

    afterAll((done) => {
      server.closeAllConnections();
      server.close(done);
    });

    it('delivers server-sent events at once, uncompressed, to a client that accepts gzip', async () => {
      const res = await readFirstChunk(
        server,
        '/stream',
        { Accept: 'text/event-stream', 'Accept-Encoding': 'gzip, deflate, br' },
        { until: CONNECTED_EVENT }
      );

      expect(res.contentEncoding).toBeUndefined();
      expect(res.body).toContain(CONNECTED_EVENT);
    });

    it('still compresses a large JSON response', async () => {
      const res = await readFirstChunk(server, '/large-json', { 'Accept-Encoding': 'gzip' });

      expect(res.contentEncoding).toBe('gzip');
    });

    it('honours x-no-compression', async () => {
      const res = await readFirstChunk(server, '/large-json', {
        'Accept-Encoding': 'gzip',
        'x-no-compression': '1',
      });

      expect(res.contentEncoding).toBeUndefined();
    });
  });
});
