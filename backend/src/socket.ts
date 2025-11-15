import { createChildLogger } from '@chat-app/shared';
import { ServiceContainer } from './services/ServiceContainer';
import { TypedServer, TypedSocket } from './types';
import {
  createJoinHandler,
  createMessageHandler,
  createTypingHandler,
  createGetHistoryHandler,
  createClearHistoryHandler,
  createDisconnectHandler,
} from './handlers';
import { RateLimiter, DEFAULT_RATE_LIMITS } from './utils/rateLimiter';

// Create a logger for socket events
const socketLogger = createChildLogger({ module: 'socket' });

// Create rate limiter instance
const rateLimiter = new RateLimiter(DEFAULT_RATE_LIMITS);

/**
 * Rate limit middleware wrapper
 * Checks rate limit before calling handler
 */
function withRateLimit<T extends (...args: any[]) => any>(
  eventName: string,
  handler: T,
  socket: TypedSocket
): T {
  return ((...args: any[]) => {
    if (!rateLimiter.check(socket.id, eventName)) {
      socketLogger.warn({ socketId: socket.id, eventName }, 'Rate limit exceeded');
      socket.emit('rate_limit_error', { message: 'Rate limit exceeded. Please slow down.' });
      return;
    }
    return handler(...args);
  }) as T;
}

/**
 * Initialize socket connection handlers with Redis adapter for horizontal scaling
 * Uses modular handler functions for better separation of concerns
 */
export const initializeSocket = (io: TypedServer, services: ServiceContainer): void => {
  io.on('connection', (socket: TypedSocket) => {
    socketLogger.info({ socketId: socket.id }, 'New client connected');

    // Create handler functions for this connection
    const onJoin = createJoinHandler(io, socket, services);
    const onSendMessage = createMessageHandler(io, socket, services);
    const onTyping = createTypingHandler(io, socket, services);
    const onGetHistory = createGetHistoryHandler(io, socket, services);
    const onClearHistory = createClearHistoryHandler(io, socket, services);
    const onDisconnect = createDisconnectHandler(io, socket, services);

    // Register event handlers with rate limiting
    socket.on('join', onJoin);
    socket.on('send_message', withRateLimit('send_message', onSendMessage, socket));
    socket.on('typing', withRateLimit('typing', onTyping, socket));
    socket.on('get_history', withRateLimit('get_history', onGetHistory, socket));
    socket.on('clear_history', onClearHistory);
    socket.on('disconnect', onDisconnect);

    // Reset rate limits when user disconnects
    socket.on('disconnect', () => {
      rateLimiter.reset(socket.id);
      onDisconnect();
    });
  });
};

/**
 * Get count of connected users
 */
export const getConnectedUsersCount = (services: ServiceContainer): number => {
  return services.userManager.getUserCount();
};
