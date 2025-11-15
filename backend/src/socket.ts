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

// Create a logger for socket events
const socketLogger = createChildLogger({ module: 'socket' });

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

    // Register event handlers
    socket.on('join', onJoin);
    socket.on('send_message', onSendMessage);
    socket.on('typing', onTyping);
    socket.on('get_history', onGetHistory);
    socket.on('clear_history', onClearHistory);
    socket.on('disconnect', onDisconnect);
  });
};

/**
 * Get count of connected users
 */
export const getConnectedUsersCount = (services: ServiceContainer): number => {
  return services.userManager.getUserCount();
};
