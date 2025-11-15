/**
 * Simple rate limiter for Socket.IO events
 * Tracks requests per user per event type
 */

import { createChildLogger } from '@chat-app/shared';

const logger = createChildLogger({ module: 'rate-limiter' });

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  maxRequests: number;     // Maximum requests allowed
  windowMs: number;        // Time window in milliseconds
}

/**
 * Rate limiter class using sliding window algorithm
 */
export class RateLimiter {
  private limits: Map<string, RateLimitEntry>;
  private config: Record<string, RateLimitConfig>;

  constructor(config: Record<string, RateLimitConfig>) {
    this.limits = new Map();
    this.config = config;

    // Cleanup old entries periodically
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  /**
   * Check if request is allowed
   * @param socketId - Socket ID making the request
   * @param eventName - Event name being rate limited
   * @returns true if allowed, false if rate limited
   */
  check(socketId: string, eventName: string): boolean {
    const config = this.config[eventName];
    if (!config) {
      // No rate limit configured for this event
      return true;
    }

    const key = `${socketId}:${eventName}`;
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now > entry.resetAt) {
      // First request or window expired
      this.limits.set(key, {
        count: 1,
        resetAt: now + config.windowMs,
      });
      return true;
    }

    if (entry.count >= config.maxRequests) {
      // Rate limit exceeded
      logger.warn(
        { socketId, eventName, count: entry.count, maxRequests: config.maxRequests },
        'Rate limit exceeded'
      );
      return false;
    }

    // Increment count
    entry.count++;
    return true;
  }

  /**
   * Reset rate limit for a specific user/event
   */
  reset(socketId: string, eventName?: string): void {
    if (eventName) {
      const key = `${socketId}:${eventName}`;
      this.limits.delete(key);
    } else {
      // Reset all events for this socket
      for (const key of this.limits.keys()) {
        if (key.startsWith(`${socketId}:`)) {
          this.limits.delete(key);
        }
      }
    }
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetAt) {
        this.limits.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug({ cleaned }, 'Cleaned up expired rate limit entries');
    }
  }

  /**
   * Get current stats for a socket
   */
  getStats(socketId: string): Record<string, RateLimitEntry> {
    const stats: Record<string, RateLimitEntry> = {};
    for (const [key, entry] of this.limits.entries()) {
      if (key.startsWith(`${socketId}:`)) {
        const eventName = key.split(':')[1];
        stats[eventName] = entry;
      }
    }
    return stats;
  }
}

/**
 * Default rate limit configurations
 */
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  send_message: { maxRequests: 10, windowMs: 10000 },     // 10 messages per 10 seconds
  typing: { maxRequests: 30, windowMs: 10000 },           // 30 typing events per 10 seconds
  get_history: { maxRequests: 5, windowMs: 60000 },       // 5 history requests per minute
};
