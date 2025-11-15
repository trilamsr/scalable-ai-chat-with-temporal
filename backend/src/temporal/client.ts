import { Connection, Client } from '@temporalio/client';
import { createChildLogger } from '@chat-app/shared';
import { getErrorMessage } from '../utils/errorHelpers';

const logger = createChildLogger({ module: 'temporal-client' });

let temporalClient: Client | null = null;

export const TEMPORAL_CONFIG = {
  address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  namespace: 'default',
  taskQueue: 'ai-chat-queue',
  maxRetries: 20,
  retryDelayMs: 1500,
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
      const errorMessage = getErrorMessage(error);

      if (attempt < TEMPORAL_CONFIG.maxRetries) {
        logger.error(
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

export async function closeTemporalClient(): Promise<void> {
  if (temporalClient) {
    logger.info('Closing Temporal client connection');
    temporalClient.connection.close();
    temporalClient = null;
    logger.info('Temporal client connection closed');
  }
}
