/**
 * Background Throttle Monitor
 *
 * Detects if publishing is "paused" or throttled when the window/tab loses focus.
 * Monitors:
 * - Page visibility changes (visibilitychange event)
 * - Window focus/blur events
 * - Heartbeat timing (should tick every ~250ms)
 * - Actual elapsed time between heartbeats vs expected
 *
 * This helps diagnose if browser/OS background throttling is affecting the publishing process.
 */

import type { LoggerPort } from '@core-domain/ports/logger-port';

export interface VisibilityEvent {
  timestamp: number;
  type: 'visible' | 'hidden' | 'focus' | 'blur';
  state: DocumentVisibilityState;
}

export interface HeartbeatTick {
  timestamp: number;
  expectedTimestamp: number;
  drift: number; // Actual delay beyond expected interval
}

export interface BackgroundThrottleMetrics {
  /** Total heartbeats recorded */
  totalHeartbeats: number;
  /** Visibility state changes */
  visibilityEvents: VisibilityEvent[];
  /** All heartbeat ticks with drift */
  heartbeats: HeartbeatTick[];
  /** Maximum heartbeat drift detected (ms) */
  maxHeartbeatDriftMs: number;
  /** Average heartbeat drift (ms) */
  avgHeartbeatDriftMs: number;
  /** Number of "stalled" heartbeats (drift > 500ms) */
  stalledHeartbeats: number;
  /** Time spent in hidden/background state (ms) */
  timeInBackgroundMs: number;
  /** Time spent in visible/foreground state (ms) */
  timeInForegroundMs: number;
}

export class BackgroundThrottleMonitorAdapter {
  private heartbeatHandle: ReturnType<typeof setInterval> | null = null;
  private lastHeartbeatTime = 0;
  private expectedNextHeartbeat = 0;
  private heartbeats: HeartbeatTick[] = [];
  private visibilityEvents: VisibilityEvent[] = [];
  private readonly heartbeatIntervalMs: number;
  private readonly logger: LoggerPort;
  private isRunning = false;
  private startTime = 0;
  private lastVisibilityChangeTime = 0;
  private timeInBackgroundMs = 0;
  private timeInForegroundMs = 0;
  private currentlyVisible = true;

  // Event listeners
  private visibilityChangeListener: (() => void) | null = null;
  private focusListener: (() => void) | null = null;
  private blurListener: (() => void) | null = null;

  /**
   * @param heartbeatIntervalMs Interval for heartbeat checks (default: 250ms)
   * @param logger Logger instance
   */
  constructor(logger: LoggerPort, heartbeatIntervalMs = 250) {
    this.logger = logger;
    this.heartbeatIntervalMs = heartbeatIntervalMs;
  }

  /**
   * Start monitoring background throttling
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('[BackgroundThrottle] Monitor already running');
      return;
    }

    this.isRunning = true;
    this.startTime = performance.now();
    this.lastHeartbeatTime = this.startTime;
    this.expectedNextHeartbeat = this.startTime + this.heartbeatIntervalMs;
    this.lastVisibilityChangeTime = this.startTime;
    this.heartbeats = [];
    this.visibilityEvents = [];
    this.timeInBackgroundMs = 0;
    this.timeInForegroundMs = 0;

    // Record initial visibility state
    this.currentlyVisible = document.visibilityState === 'visible';
    this.visibilityEvents.push({
      timestamp: this.startTime,
      type: this.currentlyVisible ? 'visible' : 'hidden',
      state: document.visibilityState,
    });

    // Setup visibility change listener
    this.visibilityChangeListener = () => {
      const now = performance.now();
      const wasVisible = this.currentlyVisible;
      this.currentlyVisible = document.visibilityState === 'visible';

      // Accumulate time in previous state
      const elapsed = now - this.lastVisibilityChangeTime;
      if (wasVisible) {
        this.timeInForegroundMs += elapsed;
      } else {
        this.timeInBackgroundMs += elapsed;
      }
      this.lastVisibilityChangeTime = now;

      this.visibilityEvents.push({
        timestamp: now,
        type: this.currentlyVisible ? 'visible' : 'hidden',
        state: document.visibilityState,
      });

      this.logger.debug(`[BackgroundThrottle] Visibility changed`, {
        state: document.visibilityState,
        timestampMs: now.toFixed(2),
      });
    };

    // Setup focus/blur listeners
    this.focusListener = () => {
      const now = performance.now();
      this.visibilityEvents.push({
        timestamp: now,
        type: 'focus',
        state: document.visibilityState,
      });
      this.logger.debug(`[BackgroundThrottle] Window focused`, {
        timestampMs: now.toFixed(2),
      });
    };

    this.blurListener = () => {
      const now = performance.now();
      this.visibilityEvents.push({
        timestamp: now,
        type: 'blur',
        state: document.visibilityState,
      });
      this.logger.debug(`[BackgroundThrottle] Window blurred`, {
        timestampMs: now.toFixed(2),
      });
    };

    // Attach event listeners
    document.addEventListener('visibilitychange', this.visibilityChangeListener);
    window.addEventListener('focus', this.focusListener);
    window.addEventListener('blur', this.blurListener);

    // Start heartbeat
    this.heartbeatHandle = globalThis.setInterval(() => {
      const now = performance.now();
      const drift = now - this.expectedNextHeartbeat;

      this.heartbeats.push({
        timestamp: now,
        expectedTimestamp: this.expectedNextHeartbeat,
        drift: Math.max(drift, 0), // Only record positive drift
      });

      // Log stalled heartbeats
      if (drift > 500) {
        this.logger.warn(`[BackgroundThrottle] Heartbeat stalled`, {
          expectedMs: this.expectedNextHeartbeat.toFixed(2),
          actualMs: now.toFixed(2),
          driftMs: drift.toFixed(2),
          visibilityState: document.visibilityState,
        });
      }

      this.lastHeartbeatTime = now;
      this.expectedNextHeartbeat = now + this.heartbeatIntervalMs;
    }, this.heartbeatIntervalMs);

    this.logger.info('[BackgroundThrottle] Monitor started', {
      heartbeatIntervalMs: this.heartbeatIntervalMs,
      initialVisibilityState: document.visibilityState,
    });
  }

  /**
   * Stop monitoring and return metrics
   */
  stop(): BackgroundThrottleMetrics {
    if (!this.isRunning) {
      this.logger.warn('[BackgroundThrottle] Monitor not running');
      return this.getEmptyMetrics();
    }

    const now = performance.now();

    // Accumulate final time slice
    const elapsed = now - this.lastVisibilityChangeTime;
    if (this.currentlyVisible) {
      this.timeInForegroundMs += elapsed;
    } else {
      this.timeInBackgroundMs += elapsed;
    }

    // Stop heartbeat
    if (this.heartbeatHandle !== null) {
      globalThis.clearInterval(this.heartbeatHandle);
      this.heartbeatHandle = null;
    }

    // Remove event listeners
    if (this.visibilityChangeListener) {
      document.removeEventListener('visibilitychange', this.visibilityChangeListener);
      this.visibilityChangeListener = null;
    }
    if (this.focusListener) {
      window.removeEventListener('focus', this.focusListener);
      this.focusListener = null;
    }
    if (this.blurListener) {
      window.removeEventListener('blur', this.blurListener);
      this.blurListener = null;
    }

    this.isRunning = false;

    const metrics = this.computeMetrics();
    this.logger.info('[BackgroundThrottle] Monitor stopped', {
      totalHeartbeats: metrics.totalHeartbeats,
      maxDriftMs: metrics.maxHeartbeatDriftMs.toFixed(2),
      avgDriftMs: metrics.avgHeartbeatDriftMs.toFixed(2),
      stalledCount: metrics.stalledHeartbeats,
      visibilityEventsCount: metrics.visibilityEvents.length,
      timeInBackgroundMs: metrics.timeInBackgroundMs.toFixed(2),
      timeInForegroundMs: metrics.timeInForegroundMs.toFixed(2),
    });

    return metrics;
  }

  /**
   * Get current metrics without stopping
   */
  getMetrics(): BackgroundThrottleMetrics {
    if (!this.isRunning) {
      return this.getEmptyMetrics();
    }
    return this.computeMetrics();
  }

  private computeMetrics(): BackgroundThrottleMetrics {
    if (this.heartbeats.length === 0) {
      return this.getEmptyMetrics();
    }

    const drifts = this.heartbeats.map((hb) => hb.drift);
    const maxDrift = Math.max(...drifts);
    const avgDrift = drifts.reduce((sum, val) => sum + val, 0) / drifts.length;
    const stalledCount = this.heartbeats.filter((hb) => hb.drift > 500).length;

    return {
      totalHeartbeats: this.heartbeats.length,
      visibilityEvents: [...this.visibilityEvents],
      heartbeats: [...this.heartbeats],
      maxHeartbeatDriftMs: maxDrift,
      avgHeartbeatDriftMs: avgDrift,
      stalledHeartbeats: stalledCount,
      timeInBackgroundMs: this.timeInBackgroundMs,
      timeInForegroundMs: this.timeInForegroundMs,
    };
  }

  private getEmptyMetrics(): BackgroundThrottleMetrics {
    return {
      totalHeartbeats: 0,
      visibilityEvents: [],
      heartbeats: [],
      maxHeartbeatDriftMs: 0,
      avgHeartbeatDriftMs: 0,
      stalledHeartbeats: 0,
      timeInBackgroundMs: 0,
      timeInForegroundMs: 0,
    };
  }

  /**
   * Generate a human-readable summary report
   */
  generateSummary(): string {
    const metrics = this.computeMetrics();
    const lines: string[] = [
      '=== Background Throttle Monitor Summary ===',
      `Total heartbeats: ${metrics.totalHeartbeats}`,
      `Visibility events: ${metrics.visibilityEvents.length}`,
      '',
    ];

    // Time distribution
    const totalTime = metrics.timeInForegroundMs + metrics.timeInBackgroundMs;
    if (totalTime > 0) {
      const fgPercent = ((metrics.timeInForegroundMs / totalTime) * 100).toFixed(1);
      const bgPercent = ((metrics.timeInBackgroundMs / totalTime) * 100).toFixed(1);
      lines.push(
        `Time in foreground: ${(metrics.timeInForegroundMs / 1000).toFixed(2)}s (${fgPercent}%)`,
        `Time in background: ${(metrics.timeInBackgroundMs / 1000).toFixed(2)}s (${bgPercent}%)`,
        ''
      );
    }

    // Heartbeat drift statistics
    if (metrics.totalHeartbeats > 0) {
      lines.push(
        `Max heartbeat drift: ${metrics.maxHeartbeatDriftMs.toFixed(2)}ms`,
        `Avg heartbeat drift: ${metrics.avgHeartbeatDriftMs.toFixed(2)}ms`,
        `Stalled heartbeats (>500ms): ${metrics.stalledHeartbeats}`,
        ''
      );
    }

    // Visibility events timeline
    if (metrics.visibilityEvents.length > 0) {
      lines.push('Visibility Events Timeline:');
      for (const event of metrics.visibilityEvents) {
        const timeOffset = ((event.timestamp - (this.startTime || 0)) / 1000).toFixed(2);
        lines.push(`  [+${timeOffset}s] ${event.type} (${event.state})`);
      }
      lines.push('');
    }

    // Warnings
    if (metrics.stalledHeartbeats > 0) {
      lines.push(
        `⚠️ WARNING: ${metrics.stalledHeartbeats} stalled heartbeats detected`,
        '   This indicates the event loop was significantly delayed,',
        '   possibly due to background throttling or CPU blocking.'
      );
    }

    if (metrics.maxHeartbeatDriftMs > 1000) {
      lines.push(
        `⚠️ WARNING: Very large heartbeat drift detected (${metrics.maxHeartbeatDriftMs.toFixed(2)}ms)`,
        '   Publishing may have been severely throttled or paused.'
      );
    }

    if (metrics.timeInBackgroundMs > 5000) {
      lines.push(
        `ℹ️ INFO: Publishing ran ${(metrics.timeInBackgroundMs / 1000).toFixed(1)}s in background.`,
        '   Check if background throttling affected performance.'
      );
    }

    return lines.join('\n');
  }
}
