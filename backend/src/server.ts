import express, { Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import cors from 'cors';
import { initializeSocket, getConnectedUsersCount } from './socket';
import { logger, ServerToClientEvents, ClientToServerEvents } from '@chat-app/shared';
import { DEFAULT_PORT, DEFAULT_CORS_ORIGIN } from './utils/constants';
import { redis, shutdownRedis, createRedisClient } from './redis';
import { ServiceContainer } from './services/ServiceContainer';

const app = express();
const server = http.createServer(app);

// Initialize service container
const services = ServiceContainer.getInstance();
logger.info('Service container initialized');

// Configure CORS for Socket.io with type-safe events
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: process.env.FRONTEND_URL || DEFAULT_CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Configure Redis Adapter for horizontal scaling
// Creates a pub/sub pair for Socket.IO communication across multiple instances
const pubClient = createRedisClient();
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

const PORT = process.env.PORT || DEFAULT_PORT;

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
  }, 10000); // 10 second timeout
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
