import Redis from 'ioredis';
import { createChildLogger } from '@chat-app/shared';
import { REDIS_RETRY } from './utils/constants';

const redisLogger = createChildLogger({ module: 'redis' });

/**
 * Redis client instance
 */
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * REDIS_RETRY.INITIAL_DELAY_MS, REDIS_RETRY.MAX_DELAY_MS);
    return delay;
  },
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Only reconnect when the error contains "READONLY"
      return true;
    }
    return false;
  },
});

/**
 * Redis connection event handlers
 */
redis.on('connect', () => { redisLogger.info('Redis client connecting') });
redis.on('ready', () => { redisLogger.info('Redis client ready')});
redis.on('error', (err) => { redisLogger.error({ error: err.message }, 'Redis client error')});
redis.on('close', () => { redisLogger.warn('Redis client connection closed')});
redis.on('reconnecting', () => { redisLogger.info('Redis client reconnecting')});

/**
 * Graceful shutdown
 */
process.on('SIGINT', async () => {
  redisLogger.info('Shutting down Redis client');
  await redis.quit();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  redisLogger.info('Shutting down Redis client');
  await redis.quit();
  process.exit(0);
});
