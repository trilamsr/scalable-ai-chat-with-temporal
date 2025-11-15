import { Worker, NativeConnection } from '@temporalio/worker';
import { createChildLogger } from '@chat-app/shared';
import { TEMPORAL_CONFIG } from './client';
import * as activities from './activities/aiActivities';
import { Server } from 'socket.io';
import { ServiceContainer } from '../services/ServiceContainer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const logger = createChildLogger({ module: 'temporal-worker' });
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Temporal worker instance (singleton)
 */
let temporalWorker: Worker | null = null;

/**
 * Create and start Temporal worker
 *
 * The worker runs activities and workflows.
 * Activities need access to Socket.IO and services, so we initialize them first.
 *
 * @param io - Socket.IO server instance
 * @param services - Service container
 */
export async function startTemporalWorker(
  io: Server,
  services: ServiceContainer
): Promise<Worker> {
  if (temporalWorker) {
    logger.warn('Temporal worker already running');
    return temporalWorker;
  }

  try {
    logger.info({ address: TEMPORAL_CONFIG.address }, 'Starting Temporal worker');

    // Initialize activities with Socket.IO and services
    activities.initializeActivities(io, services);

    // Connect to Temporal server
    const connection = await NativeConnection.connect({
      address: TEMPORAL_CONFIG.address,
    });

    // Create worker
    temporalWorker = await Worker.create({
      connection,
      namespace: TEMPORAL_CONFIG.namespace,
      taskQueue: TEMPORAL_CONFIG.taskQueue,
      workflowsPath: join(__dirname, 'workflows'),
      activities,
      maxConcurrentActivityTaskExecutions: 5, // Limit concurrent AI streaming
      maxConcurrentWorkflowTaskExecutions: 100,
    });

    // Start the worker
    await temporalWorker.run();

    logger.info('Temporal worker started successfully');
    return temporalWorker;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'Failed to start Temporal worker');
    throw error;
  }
}

/**
 * Stop Temporal worker gracefully
 */
export async function stopTemporalWorker(): Promise<void> {
  if (temporalWorker) {
    logger.info('Stopping Temporal worker');
    await temporalWorker.shutdown();
    temporalWorker = null;
    logger.info('Temporal worker stopped');
  }
}
