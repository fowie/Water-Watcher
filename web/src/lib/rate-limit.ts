/**
 * In-memory rate limiter using token bucket algorithm.
 * Keys are based on client IP address.
 */

export interface RateLimitConfig {
  maxTokens: number;
  refillRate: number; // tokens per second
  refillInterval: number; // seconds between refills
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

// Stale entry cleanup every 60 seconds
const CLEANUP_INTERVAL = 60_000;
const STALE_THRESHOLD = 300_000; // 5 minutes

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now - bucket.lastRefill > STALE_THRESHOLD) {
        buckets.delete(key);
      }
    }
    // Stop cleanup if no buckets left
    if (buckets.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL);
}

export const defaultConfig: RateLimitConfig = {
  maxTokens: 60,
  refillRate: 1, // 1 token per second = 60 per minute
  refillInterval: 1,
};

export const authConfig: RateLimitConfig = {
  maxTokens: 10,
  refillRate: 10 / 60, // 10 per minute
  refillInterval: 1,
};

export const strictAuthConfig: RateLimitConfig = {
  maxTokens: 5,
  refillRate: 5 / 60, // 5 per minute
  refillInterval: 1,
};

export const reviewConfig: RateLimitConfig = {
  maxTokens: 10,
  refillRate: 10 / 60, // 10 per minute
  refillInterval: 1,
};

function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return "127.0.0.1";
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number; // timestamp when bucket fully refills
}

export function rateLimit(
  request: Request,
  config: RateLimitConfig = defaultConfig
): RateLimitResult {
  const ip = getClientIP(request);
  const key = `${ip}:${config.maxTokens}`;
  const now = Date.now();

  startCleanup();

  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: config.maxTokens, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = (now - bucket.lastRefill) / 1000;
  const tokensToAdd = elapsed * config.refillRate;
  bucket.tokens = Math.min(config.maxTokens, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    const secondsToFull =
      (config.maxTokens - bucket.tokens) / config.refillRate;
    return {
      success: true,
      remaining: Math.floor(bucket.tokens),
      reset: Math.ceil(now / 1000 + secondsToFull),
    };
  }

  // Rate limited
  const secondsToRefill = (1 - bucket.tokens) / config.refillRate;
  return {
    success: false,
    remaining: 0,
    reset: Math.ceil(now / 1000 + secondsToRefill),
  };
}

/** Reset all buckets — mainly for testing */
export function resetRateLimiter() {
  buckets.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
