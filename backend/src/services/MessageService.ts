import { v4 as uuidv4 } from 'uuid';
import {
  Message,
  MessageAck,
  createChildLogger,
  validateData,
  messageDataSchema,
} from '@chat-app/shared';
import { ChatHistoryService } from '../chatHistory';
import { UserManager } from '../UserManager';
import { getErrorMessage } from '../utils/errorHelpers';

const logger = createChildLogger({ module: 'message-service' });

export class MessageService {
  constructor(
    private readonly chatHistory: ChatHistoryService,
    private readonly userManager: UserManager
  ) {}

  
  async createMessage(
    data: unknown,
    socketId: string
  ): Promise<{ success: true; message: Message } | { success: false; error: string; code?: string }> {
    
    const validation = validateData(messageDataSchema, data);
    if (!validation.success) {
      logger.error({ socketId, error: validation.error }, 'Invalid message data');
      return {
        success: false,
        error: validation.error,
        code: 'VALIDATION_ERROR',
      };
    }

    const validatedData = validation.data;
    const username = this.userManager.getUsername(socketId);
    const roomId = this.userManager.getRoomId(socketId);

    if (!roomId) {
      return {
        success: false,
        error: 'You must join a room before sending messages',
        code: 'NOT_IN_ROOM',
      };
    }

    
    if (validatedData.roomId !== roomId) {
      logger.error({ socketId, requestedRoom: validatedData.roomId, userRoom: roomId },'Room ID mismatch');
      return {
        success: false,
        error: 'Room ID does not match your current room',
        code: 'ROOM_MISMATCH',
      };
    }

    
    const message: Message = {
      id: uuidv4(),
      username,
      userId: socketId,
      text: validatedData.text,
      timestamp: new Date().toISOString(),
      roomId,
      role: 'user', 
    };

    logger.info(
      { messageId: message.id, username, socketId, roomId, textLength: validatedData.text.length },
      'Message created'
    );

    return { success: true, message };
  }

  
  private createPersistenceError(): MessageAck {
    return {
      success: false,
      error: 'Failed to save message to history',
      code: 'PERSISTENCE_ERROR',
    };
  }

  
  async persistMessage(message: Message): Promise<MessageAck> {
    try {
      const streamId = await this.chatHistory.addMessage(message);

      if (streamId === null) {
        logger.error({ messageId: message.id }, 'Failed to persist message (null streamId)');
        return this.createPersistenceError();
      }

      return {
        success: true,
        messageId: message.id,
        timestamp: message.timestamp,
      };
    } catch (error) {
      logger.error(
        { error: getErrorMessage(error), messageId: message.id },
        'Exception while persisting message'
      );
      return this.createPersistenceError();
    }
  }

  
  async processMessage(
    data: unknown,
    socketId: string
  ): Promise<
    | { success: true; message: Message; ack: MessageAck }
    | { success: false; error: string; code?: string }
  > {
    
    const createResult = await this.createMessage(data, socketId);
    if (!createResult.success) {
      return createResult;
    }

    const { message } = createResult;

    
    const ack = await this.persistMessage(message);

    return {
      success: true,
      message,
      ack,
    };
  }
}
