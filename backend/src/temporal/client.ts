import { Connection, Client } from '@temporalio/client';
import { createChildLogger } from '@chat-app/shared';

const logger = createChildLogger({ module: 'temporal-client' });

/**
 * Temporal client instance (singleton)
 */
let temporalClient: Client | null = null;

/**
 * Temporal configuration
 */
export const TEMPORAL_CONFIG = {
  address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  namespace: 'default',
  taskQueue: 'ai-chat-queue',
  // Connection retry settings (PostgreSQL starts faster than Cassandra)
  maxRetries: 20,
  retryDelayMs: 1500,
};

/**
 * Sleep helper for retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get or create Temporal client with retry logic
 * @returns Temporal client instance
 */
export async function getTemporalClient(): Promise<Client> {
  if (temporalClient) {
    return temporalClient;
  }

  let lastError: Error | unknown;

  for (let attempt = 1; attempt <= TEMPORAL_CONFIG.maxRetries; attempt++) {
    try {
      logger.info(
        { address: TEMPORAL_CONFIG.address, attempt, maxRetries: TEMPORAL_CONFIG.maxRetries },
        'Connecting to Temporal server'
      );

      const connection = await Connection.connect({
        address: TEMPORAL_CONFIG.address,
      });

      temporalClient = new Client({
        connection,
        namespace: TEMPORAL_CONFIG.namespace,
      });

      logger.info({ attempt }, 'Temporal client connected successfully');
      return temporalClient;
    } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (attempt < TEMPORAL_CONFIG.maxRetries) {
        logger.warn(
          { error: errorMessage, attempt, retryIn: TEMPORAL_CONFIG.retryDelayMs },
          'Failed to connect to Temporal server, retrying...'
        );
        await sleep(TEMPORAL_CONFIG.retryDelayMs);
      } else {
        logger.error(
          { error: errorMessage, attempts: attempt },
          'Failed to connect to Temporal server after all retries'
        );
      }
    }
  }

  throw lastError;
}

/**
 * Close Temporal client connection
 */
export async function closeTemporalClient(): Promise<void> {
  if (temporalClient) {
    logger.info('Closing Temporal client connection');
    temporalClient.connection.close();
    temporalClient = null;
    logger.info('Temporal client connection closed');
  }
}
