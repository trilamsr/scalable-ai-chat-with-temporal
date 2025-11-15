import {
  Message,
  createChildLogger,
  AIStreamChunkPayload,
  AIStreamStartPayload,
  AIStreamFinishPayload,
  AIStreamErrorPayload,
  AI_USER,
  AI_SYSTEM_PROMPT,
  AI_CONFIG,
} from '@chat-app/shared';
import { Context } from '@temporalio/activity';
import { Server } from 'socket.io';
import { ServiceContainer } from '../../services/ServiceContainer';
import { getErrorMessage } from '../../utils/errorHelpers';

const logger = createChildLogger({ module: 'ai-activities' });

let ioServer: Server | null = null;
let services: ServiceContainer | null = null;

export function initializeActivities(io: Server, serviceContainer: ServiceContainer) {
  ioServer = io;
  services = serviceContainer;
  logger.info('AI activities initialized with Socket.IO and services');
}

export interface StreamAIResponseParams {
  userMessage: Message;
  conversationHistory: Message[];
  roomId: string;
  socketId: string;
  workflowId: string;
}

export interface SaveCompletedResponseParams {
  message: Message;
}

export async function streamAIResponse(params: StreamAIResponseParams): Promise<string> {
  if (!ioServer || !services) {
    throw new Error('Activities not initialized with Socket.IO server');
  }

  const { userMessage, conversationHistory, roomId, workflowId } = params;
  const messageId = `ai-${userMessage.id}`;

  logger.info({ roomId, messageId, workflowId }, 'Starting AI streaming activity');

  const startPayload: AIStreamStartPayload = {
    messageId,
    roomId,
    timestamp: new Date().toISOString(),
  };
  ioServer.to(roomId).emit('ai_stream_start', startPayload);

  let accumulatedText = '';

  try {
    const messages = conversationHistory.map((msg) => ({
      role: (msg.role || (msg.userId === AI_USER.USER_ID ? 'assistant' : 'user')) as 'user' | 'assistant',
      content: msg.text,
    }));

    messages.push({
      role: 'user',
      content: userMessage.text,
    });

    Context.current().heartbeat();

    for await (const event of services.aiService.streamText({
      system: AI_SYSTEM_PROMPT,
      messages,
      temperature: AI_CONFIG.DEFAULT_TEMPERATURE,
      maxTokens: AI_CONFIG.DEFAULT_MAX_TOKENS,
    })) {

      Context.current().heartbeat();

      if (event.type === 'text-delta' && event.delta) {
        accumulatedText += event.delta;

        const chunkPayload: AIStreamChunkPayload = {
          messageId,
          roomId,
          chunk: event.delta,
          accumulatedText,
        };
        ioServer.to(roomId).emit('ai_stream_chunk', chunkPayload);

      }

      if (event.type === 'finish') {
        const timestamp = new Date().toISOString();
        const finishPayload: AIStreamFinishPayload = {
          messageId,
          roomId,
          fullText: accumulatedText,
          timestamp,
          usage: event.usage,
        };
        ioServer.to(roomId).emit('ai_stream_finish', finishPayload);

        logger.info(
          { roomId, messageId, textLength: accumulatedText.length, usage: event.usage },
          'AI streaming activity completed'
        );
      }

      if (event.type === 'error') {
        throw new Error(event.error);
      }
    }

    return accumulatedText;
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error({ error: errorMessage, roomId, messageId }, 'AI streaming activity error');

    const errorPayload: AIStreamErrorPayload = {
      messageId,
      roomId,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };
    ioServer.to(roomId).emit('ai_stream_error', errorPayload);

    throw error;
  }
}

export async function saveCompletedResponse(params: SaveCompletedResponseParams): Promise<boolean> {
  if (!services) {
    throw new Error('Activities not initialized with services');
  }
  const { message } = params;
  logger.info({ messageId: message.id, roomId: message.roomId }, 'Saving AI response to history');

  try {
    const streamId = await services.chatHistory.addMessage(message);
    if (!streamId) {
      logger.error({ messageId: message.id }, 'Failed to save AI message (null streamId)');
      return false;
    }
    logger.info({ messageId: message.id, streamId, roomId: message.roomId }, 'AI message saved to history');
    return true;
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error({ error: errorMessage, messageId: message.id }, 'Failed to save AI message');
    throw error;
  }
}

