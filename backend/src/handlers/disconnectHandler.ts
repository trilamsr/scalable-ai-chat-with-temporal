import { createChildLogger, UserLeftPayload } from '@chat-app/shared';
import { TypedServer, TypedSocket } from '../types';
import { ServiceContainer } from '../services/ServiceContainer';
import { broadcastUsersList } from '../utils/broadcastHelpers';

const logger = createChildLogger({ module: 'disconnect-handler' });

/**
 * Handle user disconnection
 */
export function createDisconnectHandler(io: TypedServer, socket: TypedSocket, services: ServiceContainer) {
  return (): void => {
    const userData = services.userManager.removeUser(socket.id);

    if (userData) {
      const { username, roomId } = userData;
      logger.info({ username, socketId: socket.id, roomId }, 'User disconnected from room');

      const payload: UserLeftPayload = {
        username,
        userId: socket.id,
        timestamp: new Date().toISOString(),
        roomId,
      };
      io.to(roomId).emit('user_left', payload);

      // Broadcast updated users list to room
      broadcastUsersList(io, services, roomId);
    } else {
      logger.info({ socketId: socket.id }, 'User disconnected (no room data)');
    }
  };
}
