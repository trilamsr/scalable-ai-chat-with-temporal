import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createChildLogger, AI_CONFIG } from '@chat-app/shared';
import { Worker, NativeConnection } from '@temporalio/worker';
import { Server } from 'socket.io';
import { ServiceContainer } from '../services/ServiceContainer';
import { getErrorMessage } from '../utils/errorHelpers';
import * as activities from './activities/aiActivities';
import { TEMPORAL_CONFIG } from './client';

const logger = createChildLogger({ module: 'temporal-worker' });
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let temporalWorker: Worker | null = null;

export async function startTemporalWorker(
  io: Server,
  services: ServiceContainer
): Promise<Worker> {
  if (temporalWorker) {
    return temporalWorker;
  }

  try {
    logger.info({ address: TEMPORAL_CONFIG.address }, 'Starting Temporal worker');

    activities.initializeActivities(io, services);

    const connection = await NativeConnection.connect({
      address: TEMPORAL_CONFIG.address,
    });

    temporalWorker = await Worker.create({
      connection,
      namespace: TEMPORAL_CONFIG.namespace,
      taskQueue: TEMPORAL_CONFIG.taskQueue,
      workflowsPath: join(__dirname, 'workflows'),
      activities,
      maxConcurrentActivityTaskExecutions: AI_CONFIG.MAX_CONCURRENT_ACTIVITIES,
      maxConcurrentWorkflowTaskExecutions: AI_CONFIG.MAX_CONCURRENT_WORKFLOWS,
    });

    await temporalWorker.run();

    logger.info('Temporal worker started successfully');
    return temporalWorker;
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error({ error: errorMessage }, 'Failed to start Temporal worker');
    throw error;
  }
}

export async function stopTemporalWorker(): Promise<void> {
  if (temporalWorker) {
    logger.info('Stopping Temporal worker');
    await temporalWorker.shutdown();
    temporalWorker = null;
    logger.info('Temporal worker stopped');
  }
}

