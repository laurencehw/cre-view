import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory rate limiter.
 * For production, swap this with a Redis-backed solution (e.g. ioredis + sliding window).
 */
export function rateLimit(opts: { windowMs?: number; max?: number; maxStoreSize?: number } = {}) {
  const windowMs = opts.windowMs ?? 60_000; // 1 minute default
  const max = opts.max ?? 100;              // 100 requests per window
  const maxStoreSize = opts.maxStoreSize ?? 10_000; // Cap entries to prevent memory exhaustion
  const store = new Map<string, RateLimitEntry>();

  // Periodically prune expired entries to prevent unbounded memory growth
  const pruneInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) store.delete(key);
    }
  }, windowMs);
  pruneInterval.unref(); // Don't keep the process alive

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || now >= entry.resetAt) {
      // If store is at capacity and this is a new key, reject to prevent memory exhaustion
      if (!store.has(key) && store.size >= maxStoreSize) {
        res.status(503).json({ error: 'Service temporarily unavailable', code: 'OVERLOADED' });
        return;
      }
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      res.status(429).json({
        error: 'Too many requests, please try again later',
        code: 'RATE_LIMITED',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
      return;
    }

    next();
  };
}
