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

const serviceLogger = createChildLogger({ module: 'message-service' });

/**
 * Service layer for message-related business logic
 * Handles validation, persistence, and message creation
 */
export class MessageService {
  constructor(
    private readonly chatHistory: ChatHistoryService,
    private readonly userManager: UserManager
  ) {}

  /**
   * Process and create a message
   * @param data - Message data from client
   * @param socketId - Socket ID of sender
   * @returns Result with message or error
   */
  async createMessage(
    data: unknown,
    socketId: string
  ): Promise<{ success: true; message: Message } | { success: false; error: string; code?: string }> {
    // Validate input data
    const validation = validateData(messageDataSchema, data);
    if (!validation.success) {
      serviceLogger.warn({ socketId, error: validation.error }, 'Invalid message data');
      return {
        success: false,
        error: validation.error,
        code: 'VALIDATION_ERROR',
      };
    }

    const validatedData = validation.data;

    // Get user info
    const username = this.userManager.getUsername(socketId);
    const roomId = this.userManager.getRoomId(socketId);

    // Verify user is in a room
    if (!roomId) {
      serviceLogger.warn({ socketId }, 'Message from user not in a room');
      return {
        success: false,
        error: 'You must join a room before sending messages',
        code: 'NOT_IN_ROOM',
      };
    }

    // Verify roomId matches user's current room
    if (validatedData.roomId !== roomId) {
      serviceLogger.warn(
        { socketId, requestedRoom: validatedData.roomId, userRoom: roomId },
        'Room ID mismatch'
      );
      return {
        success: false,
        error: 'Room ID does not match your current room',
        code: 'ROOM_MISMATCH',
      };
    }

    // Create message with UUID
    const message: Message = {
      id: uuidv4(),
      username,
      userId: socketId,
      text: validatedData.text,
      timestamp: new Date().toISOString(),
      roomId,
    };

    serviceLogger.info(
      { messageId: message.id, username, socketId, roomId, textLength: validatedData.text.length },
      'Message created'
    );

    return { success: true, message };
  }

  /**
   * Persist message to history
   * @param message - Message to persist
   * @returns Acknowledgment response
   */
  async persistMessage(message: Message): Promise<MessageAck> {
    try {
      const streamId = await this.chatHistory.addMessage(message);

      if (streamId === null) {
        serviceLogger.error({ messageId: message.id }, 'Failed to persist message (null streamId)');
        return {
          success: false,
          error: 'Failed to save message to history',
          code: 'PERSISTENCE_ERROR',
        };
      }

      serviceLogger.debug(
        { messageId: message.id, streamId, roomId: message.roomId },
        'Message persisted successfully'
      );

      return {
        success: true,
        messageId: message.id,
        timestamp: message.timestamp,
      };
    } catch (error) {
      serviceLogger.error(
        { error: getErrorMessage(error), messageId: message.id },
        'Exception while persisting message'
      );
      return {
        success: false,
        error: 'Failed to save message to history',
        code: 'PERSISTENCE_ERROR',
      };
    }
  }

  /**
   * Process a message end-to-end: validate, create, and persist
   * @param data - Message data from client
   * @param socketId - Socket ID of sender
   * @returns Result with message and acknowledgment
   */
  async processMessage(
    data: unknown,
    socketId: string
  ): Promise<
    | { success: true; message: Message; ack: MessageAck }
    | { success: false; error: string; code?: string }
  > {
    // Create message
    const createResult = await this.createMessage(data, socketId);
    if (!createResult.success) {
      return createResult;
    }

    const { message } = createResult;

    // Persist message
    const ack = await this.persistMessage(message);

    return {
      success: true,
      message,
      ack,
    };
  }
}
