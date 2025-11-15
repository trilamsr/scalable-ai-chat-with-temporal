import express, { Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import cors from 'cors';
import { initializeSocket, getConnectedUsersCount } from './socket';
import { logger, ServerToClientEvents, ClientToServerEvents, SHUTDOWN_TIMEOUT_MS, SERVER_DEFAULTS, SOCKET_CONFIG } from '@chat-app/shared';
import { redis, shutdownRedis, createRedisClient } from './redis';
import { ServiceContainer } from './services/ServiceContainer';
import { getTemporalClient, closeTemporalClient } from './temporal/client';
import { startTemporalWorker, stopTemporalWorker } from './temporal/worker';
import { getErrorMessage } from './utils/errorHelpers';

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
  // Connection timeout settings
  pingTimeout: SOCKET_CONFIG.PING_TIMEOUT,
  pingInterval: SOCKET_CONFIG.PING_INTERVAL,
  connectTimeout: SOCKET_CONFIG.CONNECT_TIMEOUT,
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
    logger.error({ error: getErrorMessage(error) }, 'Failed to initialize Redis adapter');
    process.exit(1);
  });

// Initialize Temporal client and worker
let temporalWorkerStarted = false;

/**
 * Initialize Temporal services asynchronously
 * Handles errors gracefully to prevent server crash
 */
async function initializeTemporalServices(): Promise<void> {
  try {
    const client = await getTemporalClient();
    logger.info('Temporal client initialized');

    // Register Temporal client with services
    services.setTemporalClient(client);
    services.aiStreamManager.setTemporalClient(client);

    // Start Temporal worker in background (non-blocking)
    try {
      await startTemporalWorker(io, services);
      temporalWorkerStarted = true;
      logger.info('Temporal worker started - AI streaming now using durable workflows');
    } catch (error) {
      logger.error(
        { error: getErrorMessage(error) },
        'Failed to start Temporal worker - AI streaming will not work'
      );
    }
  } catch (error) {
    logger.error(
      { error: getErrorMessage(error) },
      'Failed to initialize Temporal client - AI streaming will not work'
    );
  }
}

initializeTemporalServices().catch((error) => {
  logger.error(
    { error: getErrorMessage(error) },
    'Unhandled error during Temporal initialization'
  );
});

app.use(cors());
app.use(express.json());

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
    logger.error({ error: getErrorMessage(error) }, 'Health check failed');
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
 * Close Socket.IO connections
 */
async function closeSocketIO(): Promise<void> {
  return new Promise((resolve) => {
    io.close(() => {
      logger.info('Socket.IO connections closed');
      resolve();
    });
  });
}

/**
 * Close HTTP server
 */
async function closeHTTPServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        logger.error({ error: getErrorMessage(err) }, 'Error closing HTTP server');
        reject(err);
      } else {
        logger.info('HTTP server closed');
        resolve();
      }
    });
  });
}

/**
 * Stop Temporal services
 */
async function stopTemporalServices(): Promise<void> {
  if (temporalWorkerStarted) {
    try {
      await stopTemporalWorker();
      logger.info('Temporal worker stopped');
    } catch (error) {
      logger.error({ error: getErrorMessage(error) }, 'Error stopping Temporal worker');
    }
  }

  try {
    await closeTemporalClient();
    logger.info('Temporal client closed');
  } catch (error) {
    logger.error({ error: getErrorMessage(error) }, 'Error closing Temporal client');
  }
}

/**
 * Close Redis connections
 */
async function closeRedisConnections(): Promise<void> {
  try {
    await Promise.all([pubClient.quit(), subClient.quit()]);
    logger.info('Redis pub/sub clients closed');
  } catch (error) {
    logger.error({ error: getErrorMessage(error) }, 'Error closing Redis pub/sub clients');
  }

  try {
    await shutdownRedis();
  } catch (error) {
    logger.error({ error: getErrorMessage(error) }, 'Error closing Redis');
  }
}

/**
 * Cleanup services
 */
async function cleanupServices(): Promise<void> {
  try {
    await services.cleanup();
    logger.info('Service container cleaned up');
  } catch (error) {
    logger.error({ error: getErrorMessage(error) }, 'Error cleaning up services');
  }
}

/**
 * Graceful shutdown handler
 * Coordinates shutdown of all services
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received, starting graceful shutdown');

  // Set timeout for forced shutdown
  const forceShutdownTimeout = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    // Close all connections in order
    await closeSocketIO();
    await closeHTTPServer();
    await stopTemporalServices();
    await cleanupServices();
    await closeRedisConnections();

    logger.info('Graceful shutdown completed');
    clearTimeout(forceShutdownTimeout);
    process.exit(0);
  } catch (error) {
    logger.error({ error: getErrorMessage(error) }, 'Error during graceful shutdown');
    clearTimeout(forceShutdownTimeout);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
