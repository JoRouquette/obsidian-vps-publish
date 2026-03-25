import { createServer, type Server } from 'node:http';

import express from 'express';
import request from 'supertest';

import { createFinalizationEventsController } from '../infra/http/express/controllers/finalization-events.controller';
import { FinalizationStreamTokenService } from '../infra/http/express/finalization-stream-token.service';
import { type FinalizationJob } from '../infra/sessions/session-finalization-job.service';

type ParsedSseEvent = {
  event: string;
  data: unknown;
};

class FakeFinalizationJobService {
  private currentJob: FinalizationJob;
  private readonly listeners = new Map<string, Set<(job: FinalizationJob) => void>>();

  constructor(job: FinalizationJob) {
    this.currentJob = job;
  }

  getJobStatus(jobId: string): FinalizationJob | undefined {
    return this.currentJob.jobId === jobId ? this.currentJob : undefined;
  }

  subscribe(jobId: string, listener: (job: FinalizationJob) => void): () => void {
    const jobListeners = this.listeners.get(jobId) ?? new Set<(job: FinalizationJob) => void>();
    jobListeners.add(listener);
    this.listeners.set(jobId, jobListeners);

    return () => {
      const current = this.listeners.get(jobId);
      current?.delete(listener);
      if (current && current.size === 0) {
        this.listeners.delete(jobId);
      }
    };
  }

  emit(job: FinalizationJob): void {
    this.currentJob = job;
    for (const listener of this.listeners.get(job.jobId) ?? []) {
      listener(job);
    }
  }

  getListenerCount(jobId: string): number {
    return this.listeners.get(jobId)?.size ?? 0;
  }
}

describe('finalizationEventsController', () => {
  const baseJob: FinalizationJob = {
    jobId: 'job-1',
    sessionId: 'session-1',
    status: 'processing',
    progress: 25,
    createdAt: new Date('2026-03-25T09:00:00.000Z'),
    startedAt: new Date('2026-03-25T09:00:05.000Z'),
  };

  let app: express.Express;
  let server: Server;
  let baseUrl: string;
  let jobService: FakeFinalizationJobService;
  let tokenService: FinalizationStreamTokenService;

  beforeEach(async () => {
    jobService = new FakeFinalizationJobService({ ...baseJob });
    tokenService = new FinalizationStreamTokenService('test-secret', 15 * 60 * 1000);
    app = express();
    app.use(createFinalizationEventsController(jobService as any, tokenService));
    server = createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve test server address');
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });

  it('rejects an invalid token', async () => {
    const res = await request(app)
      .get('/events/session/session-1/finalization')
      .query({ jobId: 'job-1', token: 'bad-token' })
      .set('Accept', 'text/event-stream');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'invalid' });
  });

  it('rejects an expired token', async () => {
    const shortLivedService = new FinalizationStreamTokenService('test-secret', -1);
    const expiredToken = shortLivedService.createToken('session-1', 'job-1').token;

    const res = await request(app)
      .get('/events/session/session-1/finalization')
      .query({ jobId: 'job-1', token: expiredToken })
      .set('Accept', 'text/event-stream');

    expect(res.status).toBe(410);
    expect(res.body).toEqual({ error: 'expired' });
  });

  it('rejects a token scoped to a different job or session', async () => {
    const { token } = tokenService.createToken('session-2', 'job-2');

    const res = await request(app)
      .get('/events/session/session-1/finalization')
      .query({ jobId: 'job-1', token })
      .set('Accept', 'text/event-stream');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'scope_mismatch' });
  });

  it('streams an initial snapshot immediately for a valid token', async () => {
    const { token } = tokenService.createToken('session-1', 'job-1');
    const stream = await openSseStream(baseUrl, token);

    const events = await collectEventsUntil(stream.reader, (items) =>
      items.some((item) => item.event === 'connected')
    );

    expect(stream.response.status).toBe(200);
    expect(stream.response.headers.get('content-type')).toContain('text/event-stream');
    expect(stream.response.headers.get('cache-control')).toContain('no-store');
    expect(events[0]).toMatchObject({
      event: 'connected',
      data: expect.objectContaining({
        jobId: 'job-1',
        sessionId: 'session-1',
        status: 'processing',
        progress: 25,
      }),
    });

    stream.abortController.abort();
  });

  it('emits status progression events', async () => {
    const { token } = tokenService.createToken('session-1', 'job-1');
    const stream = await openSseStream(baseUrl, token);

    await collectEventsUntil(stream.reader, (items) => items.some((item) => item.event === 'connected'));

    jobService.emit({
      ...baseJob,
      progress: 80,
      status: 'processing',
    });

    const events = await collectEventsUntil(stream.reader, (items) =>
      items.some((item) => item.event === 'status')
    );

    expect(events.some((item) => item.event === 'status')).toBe(true);
    expect(events.find((item) => item.event === 'status')).toMatchObject({
      data: expect.objectContaining({
        status: 'processing',
        progress: 80,
      }),
    });

    stream.abortController.abort();
  });

  it('emits a completed event and cleans up its listener', async () => {
    const { token } = tokenService.createToken('session-1', 'job-1');
    const stream = await openSseStream(baseUrl, token);

    await waitFor(() => jobService.getListenerCount('job-1') === 1);

    jobService.emit({
      ...baseJob,
      status: 'completed',
      progress: 100,
      completedAt: new Date('2026-03-25T09:02:00.000Z'),
      result: {
        notesProcessed: 3,
        assetsProcessed: 1,
        promotionStats: {
          notesPublished: 3,
          notesDeduplicated: 0,
          notesDeleted: 0,
          assetsPublished: 1,
          assetsDeduplicated: 0,
        },
        contentRevision: 'rev-1',
      },
    });

    const events = await collectEventsUntil(stream.reader, (items) =>
      items.some((item) => item.event === 'completed')
    );

    expect(events.find((item) => item.event === 'completed')).toMatchObject({
      data: expect.objectContaining({
        status: 'completed',
        progress: 100,
        result: expect.objectContaining({
          contentRevision: 'rev-1',
        }),
      }),
    });

    await waitFor(() => jobService.getListenerCount('job-1') === 0);
  });

  it('emits a failed event', async () => {
    const { token } = tokenService.createToken('session-1', 'job-1');
    const stream = await openSseStream(baseUrl, token);

    await collectEventsUntil(stream.reader, (items) => items.some((item) => item.event === 'connected'));

    jobService.emit({
      ...baseJob,
      status: 'failed',
      progress: 90,
      completedAt: new Date('2026-03-25T09:03:00.000Z'),
      error: 'boom',
    });

    const events = await collectEventsUntil(stream.reader, (items) =>
      items.some((item) => item.event === 'failed')
    );

    expect(events.find((item) => item.event === 'failed')).toMatchObject({
      data: expect.objectContaining({
        status: 'failed',
        error: 'boom',
      }),
    });
  });

  it('cleans up listeners when the client disconnects', async () => {
    const { token } = tokenService.createToken('session-1', 'job-1');
    const stream = await openSseStream(baseUrl, token);

    await waitFor(() => jobService.getListenerCount('job-1') === 1);

    stream.abortController.abort();

    await waitFor(() => jobService.getListenerCount('job-1') === 0);
  });
});

async function openSseStream(baseUrl: string, token: string) {
  const abortController = new AbortController();
  const response = await fetch(
    `${baseUrl}/events/session/session-1/finalization?jobId=job-1&token=${encodeURIComponent(token)}`,
    {
      headers: {
        Accept: 'text/event-stream',
      },
      signal: abortController.signal,
    }
  );

  if (!response.body) {
    throw new Error('Missing SSE response body');
  }

  return {
    response,
    abortController,
    reader: response.body.getReader(),
  };
}

async function collectEventsUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  predicate: (events: ParsedSseEvent[]) => boolean,
  timeoutMs: number = 2000
): Promise<ParsedSseEvent[]> {
  const events: ParsedSseEvent[] = [];
  let buffer = '';
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const remainingMs = deadline - Date.now();
    const chunk = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timed out waiting for SSE events')), remainingMs)
      ),
    ]);

    if (chunk.done) {
      break;
    }

    buffer += Buffer.from(chunk.value).toString('utf8');
    const parsed = parseSseBuffer(buffer);
    buffer = parsed.remainder;
    events.push(...parsed.events);

    if (predicate(events)) {
      return events;
    }
  }

  throw new Error('Timed out waiting for expected SSE events');
}

function parseSseBuffer(buffer: string): { events: ParsedSseEvent[]; remainder: string } {
  const chunks = buffer.split('\n\n');
  const remainder = chunks.pop() ?? '';
  const events = chunks
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => {
      let eventName = 'message';
      let data = '';

      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) {
          eventName = line.slice('event:'.length).trim();
        } else if (line.startsWith('data:')) {
          data += line.slice('data:'.length).trim();
        }
      }

      return {
        event: eventName,
        data: JSON.parse(data),
      } satisfies ParsedSseEvent;
    });

  return { events, remainder };
}

async function waitFor(assertion: () => boolean, timeoutMs: number = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (assertion()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error('Timed out waiting for condition');
}
