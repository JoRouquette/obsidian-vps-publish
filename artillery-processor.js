/**
 * Artillery processor for custom metrics and logging
 *
 * This processor tracks:
 * - 429 (backpressure) responses
 * - Response times by endpoint
 * - Session success rate
 * - Calculates progressive batch sizes based on test phase
 */

// Track test start time
let testStartTime = null;

module.exports = {
  // Called before test starts
  beforeScenario: (context, ee, next) => {
    if (!testStartTime) {
      testStartTime = Date.now();
    }

    context.vars.startTime = Date.now();
    return next();
  },

  // Custom function to calculate batch size based on elapsed time
  calculateBatchSize: (context, ee, next) => {
    const elapsedSeconds = (Date.now() - testStartTime) / 1000;

    let notesCount, assetsCount, notesChunks, assetsChunks;

    // Phase 1: Warmup (0-60s) - Small batches (10-20 notes)
    if (elapsedSeconds < 60) {
      notesCount = Math.floor(Math.random() * 11) + 10; // 10-20
      assetsCount = Math.floor(Math.random() * 6) + 5; // 5-10
      notesChunks = 1;
      assetsChunks = 1;
    }
    // Phase 2: Ramp up (60-180s) - Medium batches (50-100 notes)
    else if (elapsedSeconds < 180) {
      notesCount = Math.floor(Math.random() * 51) + 50; // 50-100
      assetsCount = Math.floor(Math.random() * 21) + 20; // 20-40
      notesChunks = Math.ceil(notesCount / 20);
      assetsChunks = Math.ceil(assetsCount / 10);
    }
    // Phase 3: Sustained (180-360s) - Large batches (200-300 notes)
    else if (elapsedSeconds < 360) {
      notesCount = Math.floor(Math.random() * 101) + 200; // 200-300
      assetsCount = Math.floor(Math.random() * 51) + 50; // 50-100
      notesChunks = Math.ceil(notesCount / 20);
      assetsChunks = Math.ceil(assetsCount / 10);
    }
    // Phase 4: Peak (360-480s) - Huge batches (500-1000 notes)
    else if (elapsedSeconds < 480) {
      notesCount = Math.floor(Math.random() * 501) + 500; // 500-1000
      assetsCount = Math.floor(Math.random() * 201) + 200; // 200-400
      notesChunks = Math.ceil(notesCount / 20);
      assetsChunks = Math.ceil(assetsCount / 10);
    }
    // Phase 5: Cool down (480+s) - Back to medium (50-100 notes)
    else {
      notesCount = Math.floor(Math.random() * 51) + 50;
      assetsCount = Math.floor(Math.random() * 21) + 20;
      notesChunks = Math.ceil(notesCount / 20);
      assetsChunks = Math.ceil(assetsCount / 10);
    }

    // Set variables in context
    context.vars.notesCount = notesCount;
    context.vars.assetsCount = assetsCount;
    context.vars.notesChunks = notesChunks;
    context.vars.assetsChunks = assetsChunks;

    // Emit custom metric for tracking
    ee.emit('histogram', 'batch.notesCount', notesCount);
    ee.emit('histogram', 'batch.assetsCount', assetsCount);
    ee.emit('counter', 'batch.totalChunks', notesChunks + assetsChunks);

    console.log(
      `[BATCH SIZE] Phase: ${getPhase(elapsedSeconds)} | Notes: ${notesCount} | Assets: ${assetsCount} | Chunks: ${notesChunks + assetsChunks}`
    );

    return next();
  },

  // Called after each request
  afterResponse: (req, res, context, ee, next) => {
    const endpoint = req.url.split('?')[0];
    const status = res.statusCode;
    const duration = res.timings?.phases?.firstByte || 0;

    // Track backpressure responses (429)
    if (status === 429) {
      ee.emit('counter', 'backpressure.triggered', 1);

      // Extract retry-after if present
      const retryAfter = res.body?.retryAfterMs || 5000;
      ee.emit('histogram', 'backpressure.retryAfterMs', retryAfter);

      console.log(`[BACKPRESSURE] ${endpoint} returned 429 - retry after ${retryAfter}ms`);
    }

    // Track successful session starts
    if (endpoint.includes('/session/start') && status === 200) {
      ee.emit('counter', 'session.started', 1);
    }

    // Track successful session finishes
    if (endpoint.includes('/finish') && status === 200) {
      ee.emit('counter', 'session.finished', 1);
    }

    // Track upload operations
    if (endpoint.includes('/upload')) {
      if (status === 200) {
        ee.emit('counter', 'upload.success', 1);
      } else if (status === 429) {
        ee.emit('counter', 'upload.backpressure', 1);
      } else {
        ee.emit('counter', 'upload.failed', 1);
      }
    }

    // Track slow requests (> 2s)
    if (duration > 2000) {
      ee.emit('counter', 'request.slow', 1);
      console.log(`[SLOW REQUEST] ${endpoint} took ${duration}ms`);
    }

    return next();
  },

  // Called after scenario completes
  afterScenario: (context, ee, next) => {
    const elapsed = Date.now() - context.vars.startTime;
    ee.emit('histogram', 'scenario.duration', elapsed);
    return next();
  },

  // Custom metrics summary at the end
  beforeExit: (context, ee, next) => {
    console.log('\n=== Custom Metrics Summary ===');
    console.log('See Artillery report for detailed metrics');
    console.log('Check for [BACKPRESSURE], [SLOW REQUEST], and [BATCH SIZE] logs above');
    return next();
  },
};

// Helper function to determine phase name
function getPhase(elapsedSeconds) {
  if (elapsedSeconds < 60) return 'Warmup';
  if (elapsedSeconds < 180) return 'Ramp Up';
  if (elapsedSeconds < 360) return 'Sustained';
  if (elapsedSeconds < 480) return 'Peak';
  return 'Cool Down';
}
