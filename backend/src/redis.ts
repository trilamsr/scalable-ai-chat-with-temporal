import { createChildLogger, REDIS_RETRY } from '@chat-app/shared';
import Redis from 'ioredis';

const logger = createChildLogger({ module: 'redis' });

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

export function createRedisClient(lazyConnect: boolean = false): Redis {
  const config = {
    ...DEFAULT_REDIS_CONFIG,
    lazyConnect, 
  };

  const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', config);

  client.on('connect', () => logger.info('Redis client connecting'));
  client.on('ready', () => logger.info('Redis client ready'));
  client.on('error', (err) => logger.error({ error: err.message }, 'Redis client error'));
  client.on('close', () => logger.info('Redis client connection closed'));
  client.on('reconnecting', () => logger.info('Redis client reconnecting'));

  return client;
}

export const redis = createRedisClient();
export async function shutdownRedis(): Promise<void> {
  logger.info('Shutting down Redis client');
  await redis.quit();
  logger.info('Redis client closed');
}
