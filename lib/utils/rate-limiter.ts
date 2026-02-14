/**
 * In-memory sliding-window rate limiter.
 *
 * For production with multiple API server instances,
 * replace with Redis-backed implementation using INCR + EXPIRE.
 */

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimitConfig {
  /** Max requests allowed in the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(config: RateLimitConfig) {
    this.config = config;
    // Periodically clean up expired entries
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
  }

  /**
   * Check if a request is allowed for the given key.
   * Returns { allowed, remaining, resetMs }.
   */
  check(key: string): {
    allowed: boolean;
    remaining: number;
    resetMs: number;
    limit: number;
  } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

    const remaining = Math.max(
      0,
      this.config.maxRequests - entry.timestamps.length
    );
    const oldestInWindow = entry.timestamps[0];
    const resetMs = oldestInWindow
      ? oldestInWindow + this.config.windowMs - now
      : this.config.windowMs;

    if (entry.timestamps.length >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetMs,
        limit: this.config.maxRequests,
      };
    }

    // Record this request
    entry.timestamps.push(now);

    return {
      allowed: true,
      remaining: remaining - 1,
      resetMs: this.config.windowMs,
      limit: this.config.maxRequests,
    };
  }

  /**
   * Remove old entries from the store.
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [key, entry] of this.store) {
      entry.timestamps = entry.timestamps.filter((t) => t > windowStart);
      if (entry.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
    this.store.clear();
  }
}

// --- Pre-configured limiters for different operations ---

/** Agent execution: 20 runs per minute per user */
export const agentExecutionLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 60_000,
});

/** API routes: 100 requests per minute per user */
export const apiLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60_000,
});

/** Sandbox operations: 10 per minute per user */
export const sandboxLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60_000,
});

/** File operations: 200 per minute per user */
export const fileOpsLimiter = new RateLimiter({
  maxRequests: 200,
  windowMs: 60_000,
});

/**
 * Helper to create rate limit headers for Next.js responses.
 */
export function rateLimitHeaders(result: {
  remaining: number;
  resetMs: number;
  limit: number;
}): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetMs / 1000)),
  };
}
