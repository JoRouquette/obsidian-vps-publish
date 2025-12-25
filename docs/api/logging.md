# Logging Policy

This document describes the unified logging policy for the entire monorepo (plugin, API, site).

## Philosophy

Logs should be **actionable** and **signal-focused**, not noisy. The goal is to:

- Enable investigation with **exhaustive debug logs** (without spam)
- Highlight **important events** with info logs (completion, stats)
- Surface **rare abnormal situations** with warn logs (actionable)
- Report **real failures** with error logs (full context, correlation)

## Log Levels

### debug (exhaustive tracing, no spam)

Use for detailed execution flow: steps, timings, sizes, decisions, branches.

**When to use:**

- Entry/exit of important operations with timings (`durationMs`)
- Decision points (if condition met, switch branch taken)
- Data sizes/counts (e.g., "Processing 42 notes", "Found 15 assets")
- Expected "no results" cases (e.g., "No wikilinks found in note X")

**DO:**

```typescript
logger.debug('Starting frontmatter normalization', { notesCount: input.length });
logger.debug('Frontmatter path exceeds depth limit, flattening', { path, depth });
```

**DON'T:**

```typescript
logger.debug('📌 START processing note 1'); // emoji spam
logger.debug('🔑 Processing entry 42'); // per-iteration spam
```

### info (important business/technical events)

Use for significant milestones, batch completions, aggregated stats.

**When to use:**

- Service/handler completion with summary stats
- Successful operations with outcome (e.g., "Session created")
- Batch processing results (counts, errors, duration)

**DO:**

```typescript
logger.info('Frontmatter normalization completed', {
  totalNotes: 100,
  successCount: 98,
  errorsCount: 2,
  durationMs: 235,
});
logger.info('Session created successfully', { sessionId, status, durationMs });
```

**DON'T:**

```typescript
logger.info('Processing note 42'); // per-item spam
logger.info('✅ DONE'); // no context
```

### warn (abnormal but recoverable, rare and actionable)

Use for unexpected situations that don't block execution but need attention.

**When to use:**

- Failed to parse optional data (e.g., invalid Leaflet block config)
- Degraded mode (e.g., missing optional dependency, fallback used)
- Threshold exceeded (e.g., content too large, truncating)
- User error (e.g., "Invalid session status for finish")

**DO:**

```typescript
logger.warn('Failed to parse Leaflet block', {
  noteId,
  blockContent: content.substring(0, 100), // bounded excerpt
  error: err.message,
  action: 'Block will be ignored, check syntax',
});
logger.warn('Invalid input provided to service', {
  inputType: typeof input,
  action: 'Returning empty result',
});
```

**DON'T:**

```typescript
logger.warn('No wikilinks found'); // normal case → debug
logger.warn('📌 START processing'); // not a warning
logger.warn('Session not found'); // real error → error
```

### error (real exceptions, actionable with full context)

Use for actual failures that prevent operation completion or indicate bugs.

**When to use:**

- Operation failed and cannot recover
- Unexpected exception (catch block)
- Precondition violation (session not found, invalid state)

**DO:**

```typescript
logger.error('Finish failed: session not found', {
  sessionId: command.sessionId,
  reason: 'SessionNotFoundError',
  action: 'Verify sessionId or start new session',
  correlationId: context.correlationId, // if available
});
logger.error('Failed to normalize frontmatter for note', {
  noteId,
  vaultPath,
  error: err.message,
  stack: err.stack,
});
```

**DON'T:**

```typescript
logger.error('Failed'); // vague
logger.error('No frontmatter in note'); // expected case → debug
```

## Structured Logging

All logs should include **structured metadata** (objects), not just strings.

### OperationContext

Use `OperationContext` for correlation and scope tracking:

```typescript
interface OperationContext {
  correlationId?: string; // Track request across systems
  scope?: string; // Component (e.g., 'vault-parsing', 'api.sessions', 'site.search')
  operation?: string; // Current operation (e.g., 'parseVault', 'uploadNotesBatch')
  [key: string]: unknown; // Additional context
}
```

**Example:**

```typescript
constructor(logger: LoggerPort) {
  this._logger = logger.child({
    scope: 'vault-parsing',
    operation: 'normalizeFrontmatter',
  });
}

// In method:
this._logger.info('Frontmatter normalization completed', {
  totalNotes: 100,
  durationMs: 235,
});
// Output includes scope + operation + custom metadata
```

### Child Loggers

Use `child()` to propagate context without repeating it:

```typescript
// Handler creates scoped logger
this.logger = logger?.child({ scope: 'sessions', operation: 'finishSession' });

// Per-request adds sessionId
const requestLogger = this.logger?.child({ sessionId: command.sessionId });

// All logs include scope, operation, sessionId
requestLogger.info('Session finished successfully', { notesProcessed: 42 });
```

### Standard Metadata Fields

- `correlationId`: Unique ID for request/operation tracking across systems
- `scope`: Logical component (plugin.upload, api.sessions, site.search)
- `operation`: Current action (parseVault, uploadNotesBatch, sanitizeHtml)
- `durationMs`: Operation duration (use `Date.now()` delta)
- `noteId` / `vaultPath`: Note identifiers
- `sessionId`: Session identifier
- `error`: Error message (`err.message`)
- `stack`: Stack trace (`err.stack`) for errors
- `reason`: Error type/code (e.g., "SessionNotFoundError")
- `action`: What user/operator should do (actionable guidance)

### Timing Example

```typescript
async process(input: Note[]): Promise<Result> {
  const startTime = Date.now();

  // ... processing ...

  const duration = Date.now() - startTime;
  this.logger.info('Processing completed', {
    notesCount: input.length,
    durationMs: duration,
  });
}
```

## Security: What NOT to Log

**NEVER log:**

- API keys, secrets, tokens
- Full content of notes (use `content.substring(0, 100)` + length)
- Full HTML output (use excerpts or lengths: `htmlLength: html.length`)
- Passwords, authorization headers

**DO log:**

- Content lengths/sizes (`contentLength: note.content.length`)
- Hashes (if needed for dedup: `hash: sha256(content).substring(0, 16)`)
- Excerpts (first 100 chars: `excerpt: content.substring(0, 100)`)

## Examples by Layer

### Plugin (Obsidian)

```typescript
// main.ts - publish operation
const publishLogger = this.logger.child({
  scope: 'plugin',
  operation: 'publish',
  correlationId: sessionId, // propagate to API
});

publishLogger.info('Publishing started', { notesCount, assetsCount });
publishLogger.info('Publishing completed', {
  notesUploaded,
  assetsUploaded,
  durationMs,
});
```

### API (Node)

```typescript
// express middleware - add correlationId
req.correlationId = req.headers['x-correlation-id'] || generateId();

const logger = baseLogger.child({
  correlationId: req.correlationId,
  scope: 'api.sessions',
  operation: req.method + ' ' + req.path,
});

logger.info('Request received', { sessionId: req.params.sessionId });
```

### Services (Core Application)

```typescript
constructor(logger: LoggerPort) {
  this._logger = logger.child({
    scope: 'vault-parsing',
    operation: 'detectAssets',
  });
}

process(notes: Note[]): Result {
  const startTime = Date.now();
  let assetsFound = 0;
  let skippedCount = 0;

  // ... process notes ...

  this._logger.info('Asset detection completed', {
    notesCount: notes.length,
    assetsFound,
    skippedCount,
    durationMs: Date.now() - startTime,
  });
}
```

### Site (Angular)

```typescript
// Create injectable logger service
@Injectable({ providedIn: 'root' })
export class LoggerService implements LoggerPort {
  child(context: OperationContext): LoggerPort { /* ... */ }
  debug(message: string, meta?: LogMeta): void { console.debug(/* ... */); }
  // ... info, warn, error
}

// Use in component
constructor(private logger: LoggerService) {
  this.componentLogger = logger.child({
    scope: 'site.viewer',
    operation: 'loadPage',
  });
}

loadPage(slug: string): void {
  this.componentLogger.debug('Loading page', { slug });
  // ... load ...
  this.componentLogger.info('Page loaded', { slug, renderTimeMs });
}
```

## Testing Logging

Use `FakeLogger` from `libs/core-application/src/lib/_tests/helpers/fake-logger.ts`:

```typescript
import { FakeLogger } from '../helpers/fake-logger';

it('should log completion with stats', () => {
  const logger = new FakeLogger();
  const service = new MyService(logger);

  service.process(notes);

  const infoLogs = logger.getByLevel('info');
  expect(infoLogs).toHaveLength(1);
  expect(infoLogs[0].message).toContain('completed');
  expect(infoLogs[0].meta).toEqual(
    expect.objectContaining({
      notesCount: 42,
      durationMs: expect.any(Number),
    })
  );
});
```

## Migration Checklist

When cleaning up existing logging:

1. **Remove emoji spam** (📌🔑✅💾🏷️❌) from messages
2. **Convert warn→debug** for normal cases (no results, skipped items)
3. **Convert debug→info** for completion with stats
4. **Group per-iteration logs** into single final summary
5. **Add timings** (`durationMs`) to operation completion logs
6. **Add OperationContext** to `child()` calls (scope, operation)
7. **Make errors actionable** (add reason, action, correlation)
8. **Test with FakeLogger** to verify levels and metadata

## References

- **Port definition**: [`libs/core-domain/src/lib/ports/logger-port.ts`](../libs/core-domain/src/lib/ports/logger-port.ts)
- **Node adapter**: [`apps/node/src/infra/logging/console-logger.ts`](../apps/node/src/infra/logging/console-logger.ts)
- **Plugin adapter**: [`apps/obsidian-vps-publish/src/lib/infra/console-logger.adapter.ts`](../apps/obsidian-vps-publish/src/lib/infra/console-logger.adapter.ts)
- **Test helper**: [`libs/core-application/src/lib/_tests/helpers/fake-logger.ts`](../libs/core-application/src/lib/_tests/helpers/fake-logger.ts)
