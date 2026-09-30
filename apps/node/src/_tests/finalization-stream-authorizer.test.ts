import express from 'express';
import request from 'supertest';

import {
  createFinalizationEventsController,
  createFinalizationStreamAuthorizer,
} from '../infra/http/express/controllers/finalization-events.controller';
import { FinalizationStreamTokenService } from '../infra/http/express/finalization-stream-token.service';

describe('createFinalizationStreamAuthorizer', () => {
  const tokens = new FinalizationStreamTokenService('authorizer-test-secret');
  const forgedTokens = new FinalizationStreamTokenService('another-secret');
  const authorize = createFinalizationStreamAuthorizer(tokens);

  const valid = tokens.createToken('session-1', 'job-1').token;
  const forged = forgedTokens.createToken('session-1', 'job-1').token;
  const validForEncodedSession = tokens.createToken('a b', 'job-1').token;

  // A probe mounted where the backpressure middleware sits, before routing,
  // records the authorizer's verdict on the real Express request. The router
  // behind it shows what the stream handler made of the same request: with no
  // job registered, a request it accepts ends in `job_not_found`.
  function probeApp(): { app: express.Express; verdicts: boolean[] } {
    const verdicts: boolean[] = [];
    const app = express();
    app.use((req, _res, next) => {
      verdicts.push(authorize(req));
      next();
    });

    const jobService = {
      getJobStatus: () => undefined,
      subscribe: () => () => undefined,
    };
    app.use(createFinalizationEventsController(jobService as any, tokens));

    return { app, verdicts };
  }

  it.each([
    ['the canonical path', '/events/session/session-1/finalization', `jobId=job-1&token=${valid}`],
    ['a trailing slash', '/events/session/session-1/finalization/', `jobId=job-1&token=${valid}`],
    ['another letter case', '/EVENTS/Session/session-1/FINALIZATION', `jobId=job-1&token=${valid}`],
    [
      'an encoded session id',
      '/events/session/a%20b/finalization',
      `jobId=job-1&token=${validForEncodedSession}`,
    ],
    [
      'a duplicated token, the valid one first',
      '/events/session/session-1/finalization',
      `jobId=job-1&token=${valid}&token=${forged}`,
    ],
  ])('should authorize %s, as the stream handler does', async (_label, path, query) => {
    const { app, verdicts } = probeApp();

    const res = await request(app).get(`${path}?${query}`);

    expect(verdicts).toEqual([true]);
    expect(res.body.error).toBe('job_not_found');
  });

  it.each([
    [
      'a token for another session',
      '/events/session/session-2/finalization',
      `jobId=job-1&token=${valid}`,
      'scope_mismatch',
    ],
    [
      'a token for another job',
      '/events/session/session-1/finalization',
      `jobId=job-2&token=${valid}`,
      'scope_mismatch',
    ],
    [
      'a forged token',
      '/events/session/session-1/finalization',
      `jobId=job-1&token=${forged}`,
      'invalid',
    ],
    ['no token', '/events/session/session-1/finalization', 'jobId=job-1', 'missing'],
    [
      'a duplicated token, the forged one first',
      '/events/session/session-1/finalization',
      `jobId=job-1&token=${forged}&token=${valid}`,
      'invalid',
    ],
  ])('should refuse %s, as the stream handler does', async (_label, path, query, handlerError) => {
    const { app, verdicts } = probeApp();

    const res = await request(app).get(`${path}?${query}`);

    expect(verdicts).toEqual([false]);
    expect(res.body.error).toBe(handlerError);
  });

  it.each([
    ['a longer path', '/events/session/session-1/finalization/extra'],
    ['a malformed escape in the session id', '/events/session/%E0%A4%A/finalization'],
  ])('should refuse %s without throwing', async (_label, path) => {
    const { app, verdicts } = probeApp();

    const res = await request(app).get(`${path}?jobId=job-1&token=${valid}`);

    expect(verdicts).toEqual([false]);
    expect(res.body.error).toBeUndefined();
  });
});
