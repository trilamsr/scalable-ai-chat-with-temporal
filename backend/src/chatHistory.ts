import { redis } from './redis';
import { Message, createChildLogger } from '@chat-app/shared';
import { handleRedisError } from './utils/errorHelpers';
import { REDIS_KEYS, CHAT_HISTORY } from './utils/constants';

const historyLogger = createChildLogger({ module: 'chat-history' });

/**
 * Chat history service using Redis Streams
 */
export class ChatHistoryService {
  /**
   * Add a message to the chat history stream
   * @param message - The message to store
   * @returns The Redis stream entry ID
   */
  async addMessage(message: Message): Promise<string | null> {
    try {
      // XADD chat:messages * field1 value1 field2 value2 ...
      const streamId = await redis.xadd(
        REDIS_KEYS.CHAT_MESSAGES,
        '*', // Auto-generate ID based on timestamp
        'id', message.id,
        'username', message.username,
        'userId', message.userId,
        'text', message.text,
        'timestamp', message.timestamp
      );

      historyLogger.debug(
        { messageId: message.id, streamId },
        'Message added to history stream'
      );

      return streamId;
    } catch (error) {
      handleRedisError(historyLogger, error, { messageId: message.id }, 'Failed to add message to history');
      return null;
    }
  }

  /**
   * Get recent messages from the chat history
   * @param count - Number of messages to retrieve (default: 50)
   * @returns Array of messages in chronological order
   */
  async getRecentMessages(count: number = CHAT_HISTORY.DEFAULT_MESSAGE_COUNT): Promise<Message[]> {
    try {
      // XREVRANGE returns messages in reverse chronological order
      // We use XREVRANGE to get the most recent messages efficiently
      const results = await redis.xrevrange(REDIS_KEYS.CHAT_MESSAGES, '+', '-', 'COUNT', count);

      if (!results || results.length === 0) {
        historyLogger.debug('No messages found in history');
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

          return {
            id: fieldMap.id,
            username: fieldMap.username,
            userId: fieldMap.userId,
            text: fieldMap.text,
            timestamp: fieldMap.timestamp,
          } as Message;
        })
        .reverse(); // Reverse to get chronological order (oldest first)

      historyLogger.debug({ count: messages.length }, 'Retrieved messages from history');

      return messages;
    } catch (error) {
      handleRedisError(historyLogger, error, {}, 'Failed to retrieve message history');
      return [];
    }
  }

  /**
   * Get the total number of messages in the stream
   * @returns Total message count
   */
  async getMessageCount(): Promise<number> {
    try {
      const length = await redis.xlen(REDIS_KEYS.CHAT_MESSAGES);
      return length;
    } catch (error) {
      handleRedisError(historyLogger, error, {}, 'Failed to get message count', false);
      return 0;
    }
  }

  /**
   * Trim the stream to keep only the most recent messages
   * This helps manage memory usage
   * @param maxLength - Maximum number of messages to keep (default: 1000)
   */
  async trimHistory(maxLength: number = CHAT_HISTORY.MAX_HISTORY_LENGTH): Promise<void> {
    try {
      // XTRIM with MAXLEN keeps approximately the specified number of entries
      await redis.xtrim(REDIS_KEYS.CHAT_MESSAGES, 'MAXLEN', '~', maxLength);
      historyLogger.info({ maxLength }, 'Chat history trimmed');
    } catch (error) {
      handleRedisError(historyLogger, error, {}, 'Failed to trim chat history', false);
    }
  }

  /**
   * Clear all chat history
   * WARNING: This is a destructive operation
   */
  async clearHistory(): Promise<void> {
    try {
      await redis.del(REDIS_KEYS.CHAT_MESSAGES);
      historyLogger.warn('Chat history cleared');
    } catch (error) {
      handleRedisError(historyLogger, error, {}, 'Failed to clear chat history');
    }
  }
}

// Export singleton instance
export const chatHistory = new ChatHistoryService();
