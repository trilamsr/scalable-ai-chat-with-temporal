import { createChildLogger } from '@chat-app/shared';

const logger = createChildLogger({ module: 'rate-limiter' });

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  maxRequests: number;     
  windowMs: number;        
}

export class RateLimiter {
  private limits: Map<string, RateLimitEntry>;
  private config: Record<string, RateLimitConfig>;

  constructor(config: Record<string, RateLimitConfig>) {
    this.limits = new Map();
    this.config = config;
    setInterval(() => this.cleanup(), 60000); 
  }

  check(socketId: string, eventName: string): boolean {
    const config = this.config[eventName];
    if (!config) {
      return true;
    }

    const key = `${socketId}:${eventName}`;
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now > entry.resetAt) {
      this.limits.set(key, {
        count: 1,
        resetAt: now + config.windowMs,
      });
      return true;
    }

    if (entry.count >= config.maxRequests) {
      logger.error({ socketId, eventName, count: entry.count, maxRequests: config.maxRequests }, 'Rate limit exceeded');
      return false;
    }

    entry.count++;
    return true;
  }

  reset(socketId: string, eventName?: string): void {
    if (eventName) {
      const key = `${socketId}:${eventName}`;
      this.limits.delete(key);
    } else {

      for (const key of this.limits.keys()) {
        if (key.startsWith(`${socketId}:`)) {
          this.limits.delete(key);
        }
      }
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetAt) {
        this.limits.delete(key);
        cleaned++;
      }
    }
  }

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

export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  send_message: { maxRequests: 10, windowMs: 10000 },     
  typing: { maxRequests: 30, windowMs: 10000 },           
  get_history: { maxRequests: 5, windowMs: 60000 },       
};

