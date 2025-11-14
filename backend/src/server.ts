import express, { Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { initializeSocket } from './socket';
import { logger, ServerToClientEvents, ClientToServerEvents } from '@chat-app/shared';
import { DEFAULT_PORT, DEFAULT_CORS_ORIGIN } from './utils/constants';
import { shutdownRedis } from './redis';

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.io with type-safe events
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: process.env.FRONTEND_URL || DEFAULT_CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  logger.debug('Health check endpoint accessed');
  res.json({ status: 'ok', message: 'WebSocket server is running' });
});

// Initialize socket event handlers
initializeSocket(io);

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

    // Close Redis connection
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
