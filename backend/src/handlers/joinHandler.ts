import {
  createChildLogger,
  validateData,
  usernameSchema,
  roomIdSchema,
  UserJoinedPayload,
} from '@chat-app/shared';
import { TypedServer, TypedSocket } from '../types';
import { ServiceContainer } from '../services/ServiceContainer';
import { broadcastUsersList } from '../utils/broadcastHelpers';

const logger = createChildLogger({ module: 'join-handler' });

/**
 * Handle user joining a chat room
 */
export function createJoinHandler(io: TypedServer, socket: TypedSocket, services: ServiceContainer) {
  return (
    username: string,
    roomId: string,
    callback?: (response: { success: boolean; error?: string }) => void
  ): void => {
    // Validate username
    const usernameValidation = validateData(usernameSchema, username);
    if (!usernameValidation.success) {
      logger.warn({ socketId: socket.id, error: usernameValidation.error }, 'Invalid username');
      callback?.({ success: false, error: usernameValidation.error });
      return;
    }

    // Validate roomId
    const roomIdValidation = validateData(roomIdSchema, roomId);
    if (!roomIdValidation.success) {
      logger.warn({ socketId: socket.id, error: roomIdValidation.error }, 'Invalid roomId');
      callback?.({ success: false, error: roomIdValidation.error });
      return;
    }

    // Join the Socket.IO room
    socket.join(roomId);

    // Add user to manager
    services.userManager.addUser(socket.id, username, roomId);
    logger.info({ username, socketId: socket.id, roomId }, 'User joined room');

    // Broadcast to room that a new user joined
    const payload: UserJoinedPayload = {
      username,
      userId: socket.id,
      timestamp: new Date().toISOString(),
      roomId,
    };
    io.to(roomId).emit('user_joined', payload);

    // Broadcast updated users list to room
    broadcastUsersList(io, services, roomId);

    callback?.({ success: true });
  };
}
