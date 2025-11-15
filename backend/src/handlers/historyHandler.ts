import { createChildLogger } from '@chat-app/shared';
import { TypedServer, TypedSocket } from '../types';
import { ServiceContainer } from '../services/ServiceContainer';
import { getErrorMessage } from '../utils/errorHelpers';

const logger = createChildLogger({ module: 'history-handler' });

/**
 * Handle chat history request
 */
export function createGetHistoryHandler(_io: TypedServer, socket: TypedSocket, services: ServiceContainer) {
  return async (count?: number): Promise<void> => {
    const { username, roomId } = services.userManager.getUserContext(socket.id);

    if (!roomId) {
      logger.warn({ socketId: socket.id }, 'History request from user not in a room');
      socket.emit('chat_history', []);
      return;
    }

    logger.info(
      { username, socketId: socket.id, roomId, requestedCount: count },
      'Chat history requested'
    );

    try {
      const messages = await services.chatHistory.getRecentMessages(roomId, count);
      socket.emit('chat_history', messages);
      logger.debug(
        { username, socketId: socket.id, roomId, messagesReturned: messages.length },
        'Chat history sent'
      );
    } catch (error) {
      logger.error(
        { error: getErrorMessage(error), socketId: socket.id },
        'Failed to retrieve chat history'
      );
      // Send empty array on error
      socket.emit('chat_history', []);
    }
  };
}

/**
 * Handle clear history request
 */
export function createClearHistoryHandler(io: TypedServer, socket: TypedSocket, services: ServiceContainer) {
  return async (
    roomId: string,
    callback?: (response: { success: boolean; error?: string }) => void
  ): Promise<void> => {
    const username = services.userManager.getUsername(socket.id);

    logger.warn({ username, socketId: socket.id, roomId }, 'Clear history requested');

    try {
      await services.chatHistory.clearHistory(roomId);

      // Broadcast to all users in the room that history was cleared
      io.to(roomId).emit('chat_history', []);

      callback?.({ success: true });

      logger.info({ username, socketId: socket.id, roomId }, 'Chat history cleared successfully');
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error({ error: errorMessage, roomId }, 'Failed to clear chat history');

      callback?.({ success: false, error: 'Failed to clear history' });
    }
  };
}
