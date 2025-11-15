import { createChildLogger } from '@chat-app/shared';
import { TypedServer, TypedSocket } from '../types';
import { ServiceContainer } from '../services/ServiceContainer';
import { getErrorMessage } from '../utils/errorHelpers';

const logger = createChildLogger({ module: 'history-handler' });

export function createGetHistoryHandler(_io: TypedServer, socket: TypedSocket, services: ServiceContainer) {
  return async (count?: number): Promise<void> => {
    const { username, roomId } = services.userManager.getUserContext(socket.id);

    if (!roomId) {
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
    } catch (error) {
      logger.error(
        { error: getErrorMessage(error), socketId: socket.id },
        'Failed to retrieve chat history'
      );

      socket.emit('chat_history', []);
    }
  };
}

export function createClearHistoryHandler(io: TypedServer, socket: TypedSocket, services: ServiceContainer) {
  return async (
    roomId: string,
    callback?: (response: { success: boolean; error?: string }) => void
  ): Promise<void> => {
    const username = services.userManager.getUsername(socket.id);

    logger.info({ username, socketId: socket.id, roomId }, 'Clear history requested');

    try {
      await services.chatHistory.clearHistory(roomId);
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

