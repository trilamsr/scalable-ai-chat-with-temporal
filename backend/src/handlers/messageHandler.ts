import { createChildLogger, MessageData, MessageAck } from '@chat-app/shared';
import { TypedServer, TypedSocket } from '../types';
import { ServiceContainer } from '../services/ServiceContainer';
import { getErrorMessage } from '../utils/errorHelpers';

const logger = createChildLogger({ module: 'message-handler' });

export function createMessageHandler(io: TypedServer, socket: TypedSocket, services: ServiceContainer) {
  return async (data: MessageData, callback: (ack: MessageAck) => void): Promise<void> => {
    
    const result = await services.messageService.processMessage(data, socket.id);
    if (!result.success) {
      logger.error({ socketId: socket.id, error: result.error, code: result.code },'Message processing failed');
      callback({
        success: false,
        error: result.error,
        code: result.code,
      });
      return;
    }

    const { message, ack } = result;

    
    io.to(message.roomId).emit('receive_message', message);

    
    callback(ack);

    logger.info(
      {
        messageId: message.id,
        username: message.username,
        socketId: socket.id,
        roomId: message.roomId,
        persisted: ack.success,
      },
      'Message processed'
    );

    logger.info({ roomId: message.roomId }, 'Triggering AI response (Temporal workflow)');

    services.chatHistory
      .getRecentMessages(message.roomId, 5)
      .then((recentMessages) => {
        const conversationHistory = recentMessages.filter((msg) => !msg.isSystem);
        return services.aiStreamManager.startStream(
          io,
          message.roomId,
          message, 
          conversationHistory,
          socket.id
        );
      })
      .catch((error) => {
        const errorMsg = getErrorMessage(error);
        logger.error({ error: errorMsg, roomId: message.roomId }, 'Failed to start AI response workflow');
      });
  };
}
