import { redis } from './redis';
import { Message, createChildLogger, REDIS_KEYS, CHAT_CONFIG } from '@chat-app/shared';
import { handleRedisError } from './utils/errorHelpers';

const logger = createChildLogger({ module: 'chat-history' });

/**
 * Chat history service using Redis Streams
 */
export class ChatHistoryService {
  /**
   * Get Redis key for a room's message stream
   * @param roomId - Room name
   * @returns Redis key
   */
  private getRoomKey(roomId: string): string {
    return `${REDIS_KEYS.CHAT_MESSAGES}:${roomId}`;
  }

  /**
   * Add a message to the chat history stream
   * @param message - The message to store
   * @returns The Redis stream entry ID
   */
  async addMessage(message: Message): Promise<string | null> {
    const roomId = message.roomId;
    const streamKey = this.getRoomKey(message.roomId);

    try {
      // XADD chat:messages:room * field1 value1 field2 value2 ...
      const fields = [
        'id', message.id,
        'username', message.username,
        'userId', message.userId,
        'text', message.text,
        'timestamp', message.timestamp,
        'roomId', roomId,
      ];

      // Add role if present (for AI conversation context)
      if (message.role) {
        fields.push('role', message.role);
      }

      const streamId = await redis.xadd(streamKey, '*', ...fields);

      logger.debug(
        { messageId: message.id, streamId, roomId },
        'Message added to history stream'
      );

      return streamId;
    } catch (error) {
      handleRedisError(logger, error, { messageId: message.id, roomId }, 'Failed to add message to history');
      return null;
    }
  }

  /**
   * Get recent messages from the chat history
   * @param roomId - Room name to get messages from
   * @param count - Number of messages to retrieve (default: 50)
   * @returns Array of messages in chronological order
   */
  async getRecentMessages(roomId: string, count: number = CHAT_CONFIG.DEFAULT_MESSAGE_COUNT): Promise<Message[]> {
    const streamKey = this.getRoomKey(roomId);

    try {
      // XREVRANGE returns messages in reverse chronological order
      // We use XREVRANGE to get the most recent messages efficiently
      const results = await redis.xrevrange(streamKey, '+', '-', 'COUNT', count);

      // Early return if no results
      if (!results || results.length === 0) {
        logger.debug({ roomId }, 'No messages found in history');
        return [];
      }

      // Parse Redis stream entries and reverse to get chronological order
      const messages: Message[] = results
        .map(([_streamId, fields]) => {
          // Redis returns fields as [key1, value1, key2, value2, ...]
          const fieldMap: Record<string, string> = {};
          for (let i = 0; i < fields.length; i += 2) {
            fieldMap[fields[i]] = fields[i + 1];
          }

          const message: Message = {
            id: fieldMap.id,
            username: fieldMap.username,
            userId: fieldMap.userId,
            text: fieldMap.text,
            timestamp: fieldMap.timestamp,
            roomId: fieldMap.roomId,
            role: fieldMap.role as 'user' | 'assistant' || 'user'
          };

          return message;
        })
        .reverse(); // Reverse to get chronological order (oldest first)

      logger.debug({ count: messages.length, roomId }, 'Retrieved messages from history');

      return messages;
    } catch (error) {
      handleRedisError(logger, error, { roomId }, 'Failed to retrieve message history');
      return [];
    }
  }

  /**
   * Get the total number of messages in the stream
   * @param roomId - Room name
   * @returns Total message count
   */
  async getMessageCount(roomId: string): Promise<number> {
    const streamKey = this.getRoomKey(roomId);

    try {
      const length = await redis.xlen(streamKey);
      return length;
    } catch (error) {
      handleRedisError(logger, error, { roomId }, 'Failed to get message count', false);
      return 0;
    }
  }

  /**
   * Trim the stream to keep only the most recent messages
   * This helps manage memory usage
   * @param roomId - Room name
   * @param maxLength - Maximum number of messages to keep (default: 1000)
   */
  async trimHistory(roomId: string, maxLength: number = CHAT_CONFIG.MAX_HISTORY_LENGTH): Promise<void> {
    const streamKey = this.getRoomKey(roomId);

    try {
      // XTRIM with MAXLEN keeps approximately the specified number of entries
      await redis.xtrim(streamKey, 'MAXLEN', '~', maxLength);
      logger.info({ roomId, maxLength }, 'Chat history trimmed');
    } catch (error) {
      handleRedisError(logger, error, { roomId }, 'Failed to trim chat history', false);
    }
  }

  /**
   * Clear all chat history for a room
   * WARNING: This is a destructive operation
   * @param roomId - Room name (optional - clears all rooms if not provided)
   */
  async clearHistory(roomId?: string): Promise<void> {
    try {
      if (roomId) {
        const streamKey = this.getRoomKey(roomId);
        await redis.del(streamKey);
        logger.warn({ roomId }, 'Room chat history cleared');
      }
    } catch (error) {
      handleRedisError(logger, error, { roomId }, 'Failed to clear chat history');
    }
  }
}
