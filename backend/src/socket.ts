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

const socketLogger = createChildLogger({ module: 'socket' });

const rateLimiter = new RateLimiter(DEFAULT_RATE_LIMITS);

function withRateLimit<T extends (...args: any[]) => any>(
  eventName: string,
  handler: T,
  socket: TypedSocket
): T {
  return ((...args: any[]) => {
    if (!rateLimiter.check(socket.id, eventName)) {
      socketLogger.error({ socketId: socket.id, eventName }, 'Rate limit exceeded');
      socket.emit('rate_limit_error', { message: 'Rate limit exceeded. Please slow down.' });
      return;
    }
    return handler(...args);
  }) as T;
}

export const initializeSocket = (io: TypedServer, services: ServiceContainer): void => {
  io.on('connection', (socket: TypedSocket) => {
    socketLogger.info({ socketId: socket.id }, 'New client connected');

    
    const onJoin = createJoinHandler(io, socket, services);
    const onSendMessage = createMessageHandler(io, socket, services);
    const onTyping = createTypingHandler(io, socket, services);
    const onGetHistory = createGetHistoryHandler(io, socket, services);
    const onClearHistory = createClearHistoryHandler(io, socket, services);
    const onDisconnect = createDisconnectHandler(io, socket, services);

    
    socket.on('join', onJoin);
    socket.on('send_message', withRateLimit('send_message', onSendMessage, socket));
    socket.on('typing', withRateLimit('typing', onTyping, socket));
    socket.on('get_history', withRateLimit('get_history', onGetHistory, socket));
    socket.on('clear_history', onClearHistory);
    socket.on('disconnect', onDisconnect);

    
    socket.on('disconnect', () => {
      rateLimiter.reset(socket.id);
      onDisconnect();
    });
  });
};

export const getConnectedUsersCount = (services: ServiceContainer): number => {
  return services.userManager.getUserCount();
};
