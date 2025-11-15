import Redis from 'ioredis';
import { createChildLogger, REDIS_RETRY } from '@chat-app/shared';

const logger = createChildLogger({ module: 'redis' });

/**
 * Default Redis configuration
 */
const DEFAULT_REDIS_CONFIG = {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * REDIS_RETRY.INITIAL_DELAY_MS, REDIS_RETRY.MAX_DELAY_MS);
    return delay;
  },
  reconnectOnError(err: Error) {
    return err.message.includes('READONLY');
  },
};

/**
 * Create a new Redis client with standard configuration
 * Used for creating pub/sub clients for Socket.IO adapter
 * @param lazyConnect - If true, client won't connect automatically (useful for Socket.IO adapter)
 */
export function createRedisClient(lazyConnect: boolean = false): Redis {
  const config = {
    ...DEFAULT_REDIS_CONFIG,
    lazyConnect, // Only connect when explicitly told to
  };

  const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', config);

  client.on('connect', () => logger.debug('Redis client connecting'));
  client.on('ready', () => logger.debug('Redis client ready'));
  client.on('error', (err) => logger.error({ error: err.message }, 'Redis client error'));
  client.on('close', () => logger.warn('Redis client connection closed'));
  client.on('reconnecting', () => logger.info('Redis client reconnecting'));

  return client;
}

/**
 * Redis client instance (main client for chat history)
 */
export const redis = createRedisClient();

/**
 * Graceful shutdown handler for Redis
 * Exported to be called by main server shutdown coordinator
 */
export async function shutdownRedis(): Promise<void> {
  logger.info('Shutting down Redis client');
  await redis.quit();
  logger.info('Redis client closed');
}
