import {
  createChildLogger,
  validateData,
  usernameSchema,
  roomIdSchema,
  UserJoinedPayload,
} from '@chat-app/shared';
import { ServiceContainer } from '../services/ServiceContainer';
import { TypedServer, TypedSocket } from '../types';
import { broadcastUsersList } from '../utils/broadcastHelpers';

const logger = createChildLogger({ module: 'join-handler' });

export function createJoinHandler(io: TypedServer, socket: TypedSocket, services: ServiceContainer) {
  return async (
    username: string,
    roomId: string,
    callback?: (response: { success: boolean; error?: string }) => void
  ): Promise<void> => {

    const usernameValidation = validateData(usernameSchema, username);
    if (!usernameValidation.success) {
      callback?.({ success: false, error: usernameValidation.error });
      return;
    }

    const roomIdValidation = validateData(roomIdSchema, roomId);
    if (!roomIdValidation.success) {
      callback?.({ success: false, error: roomIdValidation.error });
      return;
    }

    await socket.join(roomId);

    services.userManager.addUser(socket.id, username, roomId);
    logger.info({ username, socketId: socket.id, roomId }, 'User joined room');

    const payload: UserJoinedPayload = {
      username,
      userId: socket.id,
      timestamp: new Date().toISOString(),
      roomId,
    };
    io.to(roomId).emit('user_joined', payload);

    broadcastUsersList(io, services, roomId);

    callback?.({ success: true });
  };
}

