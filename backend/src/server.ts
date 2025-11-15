import express, { Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import cors from 'cors';
import { initializeSocket, getConnectedUsersCount } from './socket';
import { logger, ServerToClientEvents, ClientToServerEvents, SHUTDOWN_TIMEOUT_MS, SERVER_DEFAULTS } from '@chat-app/shared';
import { redis, shutdownRedis, createRedisClient } from './redis';
import { ServiceContainer } from './services/ServiceContainer';
import { getTemporalClient, closeTemporalClient } from './temporal/client';
import { startTemporalWorker, stopTemporalWorker } from './temporal/worker';

const app = express();
const server = http.createServer(app);

// Initialize service container
const services = ServiceContainer.getInstance();
logger.info('Service container initialized');

// Configure CORS for Socket.io with type-safe events
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: process.env.FRONTEND_URL || SERVER_DEFAULTS.CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Configure Redis Adapter for horizontal scaling
// Creates a pub/sub pair for Socket.IO communication across multiple instances
// Use lazyConnect=true to prevent automatic connection, then connect manually
const pubClient = createRedisClient(true);
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()])
  .then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Redis adapter for Socket.IO initialized - horizontal scaling enabled');
  })
  .catch((error) => {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to initialize Redis adapter');
    process.exit(1);
  });

// Initialize Temporal client and worker
let temporalWorkerStarted = false;

getTemporalClient()
  .then(async (client) => {
    logger.info('Temporal client initialized');

    // Register Temporal client with services
    services.setTemporalClient(client);
    services.aiStreamManager.setTemporalClient(client);

    // Start Temporal worker in background (non-blocking)
    // Worker runs workflows and activities
    startTemporalWorker(io, services)
      .then(() => {
        temporalWorkerStarted = true;
        logger.info('Temporal worker started - AI streaming now using durable workflows');
      })
      .catch((error) => {
        logger.error(
          { error: error instanceof Error ? error.message : 'Unknown error' },
          'Failed to start Temporal worker - AI streaming will not work'
        );
      });
  })
  .catch((error) => {
    logger.error(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'Failed to initialize Temporal client - AI streaming will not work'
    );
  });

app.use(cors());
app.use(express.json());

// Health check endpoint with Redis connectivity check
app.get('/health', async (_req: Request, res: Response) => {
  logger.debug('Health check endpoint accessed');

  try {
    // Check Redis connectivity
    await redis.ping();
    const userCount = getConnectedUsersCount(services);

    res.json({
      status: 'ok',
      message: 'WebSocket server is running',
      redis: 'connected',
      connectedUsers: userCount,
    });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Health check failed');
    res.status(503).json({
      status: 'error',
      message: 'Service unavailable',
      redis: 'disconnected',
    });
  }
});

// Initialize socket event handlers
initializeSocket(io, services);

const PORT = process.env.PORT || SERVER_DEFAULTS.PORT;

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'WebSocket server running');
});

/**
 * Graceful shutdown handler
 * Coordinates shutdown of all services
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received, starting graceful shutdown');

  // Close Socket.IO connections
  io.close(() => logger.info('Socket.IO connections closed'));

  // Close HTTP server
  server.close(async () => {
    logger.info('HTTP server closed');

    // Stop Temporal worker if running
    if (temporalWorkerStarted) {
      try {
        await stopTemporalWorker();
        logger.info('Temporal worker stopped');
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error stopping Temporal worker');
      }
    }

    // Close Temporal client
    try {
      await closeTemporalClient();
      logger.info('Temporal client closed');
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error closing Temporal client');
    }

    // Cleanup service container
    try {
      await services.cleanup();
      logger.info('Service container cleaned up');
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error cleaning up services');
    }

    // Close Redis pub/sub clients for Socket.IO adapter
    try {
      await Promise.all([pubClient.quit(), subClient.quit()]);
      logger.info('Redis pub/sub clients closed');
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error closing Redis pub/sub clients');
    }

    // Close main Redis connection
    try {
      await shutdownRedis();
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error closing Redis');
    }

    logger.info('Graceful shutdown completed');
    process.exit(0);
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
