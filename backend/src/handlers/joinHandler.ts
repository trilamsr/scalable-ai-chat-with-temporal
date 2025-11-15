import {
  createChildLogger,
  validateData,
  usernameSchema,
  roomIdSchema,
  UserJoinedPayload,
} from '@chat-app/shared';
import { TypedServer, TypedSocket } from '../types';
import { ServiceContainer } from '../services/ServiceContainer';

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

    // Send current users list for this room
    const usersList = services.userManager.getUsersList(roomId);
    io.to(roomId).emit('users_list', usersList);

    // If there's an active AI stream, send the current state to the newly joined user
    const activeSession = services.aiStreamManager.getSession(roomId);
    if (activeSession && activeSession.isActive) {
      logger.info(
        { roomId, messageId: activeSession.messageId, username },
        'Sending active AI stream state to newly joined user'
      );

      // Send start event
      socket.emit('ai_stream_start', {
        messageId: activeSession.messageId,
        roomId,
        timestamp: activeSession.startedAt.toISOString(),
      });

      // Send current accumulated text as a single chunk
      if (activeSession.accumulatedText) {
        socket.emit('ai_stream_chunk', {
          messageId: activeSession.messageId,
          roomId,
          chunk: activeSession.accumulatedText,
          accumulatedText: activeSession.accumulatedText,
        });
      }
    }

    // Acknowledge success
    callback?.({ success: true });
  };
}
