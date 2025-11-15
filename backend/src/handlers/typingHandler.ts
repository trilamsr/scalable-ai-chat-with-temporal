import { UserTypingPayload } from '@chat-app/shared';
import { ServiceContainer } from '../services/ServiceContainer';
import { TypedServer, TypedSocket } from '../types';

export function createTypingHandler(_io: TypedServer, socket: TypedSocket, services: ServiceContainer) {
  return (isTyping: boolean): void => {
    if (services.userManager.isUserConnected(socket.id)) {
      const { username, roomId } = services.userManager.getUserContext(socket.id);

      if (!roomId) {
        return;
      }
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

