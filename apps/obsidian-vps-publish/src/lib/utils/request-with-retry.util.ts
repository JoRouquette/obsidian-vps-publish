/**
 * HTTP client with automatic retry on backpressure (429)
 * Handles server-side backpressure gracefully with exponential backoff
 */

import type { LoggerPort } from '@core-domain/ports/logger-port';
import { requestUrl, type RequestUrlParam, type RequestUrlResponse } from 'obsidian';

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 5000, // Start with 5s delay
  maxDelayMs: 30000, // Max 30s delay
  backoffMultiplier: 2, // Double delay each retry
};

/**
 * Request with automatic retry on 429 (Too Many Requests)
 * Uses exponential backoff based on server's retryAfterMs hint
 */
export async function requestUrlWithRetry(
  params: RequestUrlParam,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  logger?: LoggerPort
): Promise<RequestUrlResponse> {
  let lastError: Error | null = null;
  let currentDelay = config.initialDelayMs;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await requestUrl({
        ...params,
        throw: false, // We handle errors ourselves
      });

      // Success or non-retryable error
      if (response.status !== 429) {
        return response;
      }

      // 429: Server is under load
      if (attempt < config.maxRetries) {
        // Extract server's suggested retry delay
        const retryAfter = extractRetryAfter(response);
        const delayMs = Math.min(retryAfter || currentDelay, config.maxDelayMs);

        logger?.warn('[HTTP] Server backpressure detected, retrying', {
          attempt: attempt + 1,
          maxRetries: config.maxRetries,
          delayMs,
          url: params.url,
        });

        await sleep(delayMs);

        // Exponential backoff for next attempt
        currentDelay = Math.min(currentDelay * config.backoffMultiplier, config.maxDelayMs);
      } else {
        // Max retries reached
        lastError = new Error(`Server under load after ${config.maxRetries} retries (429)`);
        logger?.error('[HTTP] Max retries reached for 429', {
          url: params.url,
          maxRetries: config.maxRetries,
        });
      }
    } catch (error) {
      // Network error or other exception
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < config.maxRetries) {
        logger?.warn('[HTTP] Request failed, retrying', {
          attempt: attempt + 1,
          maxRetries: config.maxRetries,
          error: lastError.message,
          url: params.url,
        });

        await sleep(currentDelay);
        currentDelay = Math.min(currentDelay * config.backoffMultiplier, config.maxDelayMs);
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error('Request failed after retries');
}

/**
 * Extract retry delay from response body or headers
 */
function extractRetryAfter(response: RequestUrlResponse): number | null {
  try {
    // Check Retry-After header (in seconds)
    const retryAfterHeader = response.headers['retry-after'];
    if (retryAfterHeader) {
      const seconds = parseInt(retryAfterHeader, 10);
      if (!isNaN(seconds)) {
        return seconds * 1000; // Convert to ms
      }
    }

    // Check response body for retryAfterMs
    if (response.json && typeof response.json === 'object' && 'retryAfterMs' in response.json) {
      const retryAfterMs = response.json.retryAfterMs;
      if (typeof retryAfterMs === 'number') {
        return retryAfterMs;
      }
    }
  } catch {
    // Ignore parsing errors
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
