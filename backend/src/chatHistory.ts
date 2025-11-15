import { redis } from './redis';
import { Message, createChildLogger, REDIS_KEYS, CHAT_CONFIG } from '@chat-app/shared';
import { handleRedisError } from './utils/errorHelpers';

const logger = createChildLogger({ module: 'chat-history' });

export class ChatHistoryService {

  private getRoomKey(roomId: string): string {
    return `${REDIS_KEYS.CHAT_MESSAGES}:${roomId}`;
  }

  async addMessage(message: Message): Promise<string | null> {
    const roomId = message.roomId;
    const streamKey = this.getRoomKey(message.roomId);

    try {

      const fields = [
        'id', message.id,
        'username', message.username,
        'userId', message.userId,
        'text', message.text,
        'timestamp', message.timestamp,
        'roomId', roomId,
      ];

      if (message.role) {
        fields.push('role', message.role);
      }

      const streamId = await redis.xadd(streamKey, '*', ...fields);

      return streamId;
    } catch (error) {
      handleRedisError(logger, error, { messageId: message.id, roomId }, 'Failed to add message to history');
      return null;
    }
  }

  async getRecentMessages(roomId: string, count: number = CHAT_CONFIG.DEFAULT_MESSAGE_COUNT): Promise<Message[]> {
    const streamKey = this.getRoomKey(roomId);

    try {

      const results = await redis.xrevrange(streamKey, '+', '-', 'COUNT', count);

      if (!results || results.length === 0) { return [] }

      const messages: Message[] = results
        .map(([_streamId, fields]) => {

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
        }).reverse(); 

      return messages;
    } catch (error) {
      handleRedisError(logger, error, { roomId }, 'Failed to retrieve message history');
      return [];
    }
  }

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

  async trimHistory(roomId: string, maxLength: number = CHAT_CONFIG.MAX_HISTORY_LENGTH): Promise<void> {
    const streamKey = this.getRoomKey(roomId);

    try {

      await redis.xtrim(streamKey, 'MAXLEN', '~', maxLength);
      logger.info({ roomId, maxLength }, 'Chat history trimmed');
    } catch (error) {
      handleRedisError(logger, error, { roomId }, 'Failed to trim chat history', false);
    }
  }

  async clearHistory(roomId?: string): Promise<void> {
    try {
      if (roomId) {
        const streamKey = this.getRoomKey(roomId);
        await redis.del(streamKey);
        logger.info({ roomId }, 'Room chat history cleared');
      }
    } catch (error) {
      handleRedisError(logger, error, { roomId }, 'Failed to clear chat history');
    }
  }
}

