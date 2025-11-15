import { createChildLogger, UserTypingPayload } from '@chat-app/shared';
import { TypedServer, TypedSocket } from '../types';
import { ServiceContainer } from '../services/ServiceContainer';

const logger = createChildLogger({ module: 'typing-handler' });

export function createTypingHandler(_io: TypedServer, socket: TypedSocket, services: ServiceContainer) {
  return (isTyping: boolean): void => {
    if (services.userManager.isUserConnected(socket.id)) {
      const { username, roomId } = services.userManager.getUserContext(socket.id);

      if (!roomId) return;

      logger.debug({ username, socketId: socket.id, roomId, isTyping }, 'User typing status');

      const payload: UserTypingPayload = {
        username,
        userId: socket.id,
        isTyping,
        roomId,
      };

      
      socket.to(roomId).emit('user_typing', payload);
    }
  };
}
