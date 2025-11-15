import { Context } from '@temporalio/activity';
import {
  Message,
  createChildLogger,
  AIStreamChunkPayload,
  AIStreamStartPayload,
  AIStreamFinishPayload,
  AIStreamErrorPayload,
  AI_USER,
  AI_SYSTEM_PROMPT,
} from '@chat-app/shared';
import { ServiceContainer } from '../../services/ServiceContainer';
import { Server } from 'socket.io';

const logger = createChildLogger({ module: 'ai-activities' });

/**
 * Global reference to Socket.IO server and services
 * Set during worker initialization
 */
let ioServer: Server | null = null;
let services: ServiceContainer | null = null;

/**
 * Initialize activities with Socket.IO server and services
 */
export function initializeActivities(io: Server, serviceContainer: ServiceContainer) {
  ioServer = io;
  services = serviceContainer;
  logger.info('AI activities initialized with Socket.IO and services');
}

/**
 * Parameters for streaming AI response
 */
export interface StreamAIResponseParams {
  userMessage: Message;
  conversationHistory: Message[];
  roomId: string;
  socketId: string;
  workflowId: string;
}

/**
 * Parameters for saving completed response
 */
export interface SaveCompletedResponseParams {
  message: Message;
}

/**
 * Activity: Stream AI response and emit chunks to Socket.IO
 *
 * This activity:
 * 1. Calls AI API to stream response
 * 2. Emits real-time chunks via Socket.IO for user experience
 * 3. Sends chunks back to workflow via signals
 * 4. Returns the complete text when finished
 *
 * The activity is retryable - if it fails, Temporal will retry automatically
 */
export async function streamAIResponse(params: StreamAIResponseParams): Promise<string> {
  if (!ioServer || !services) {
    throw new Error('Activities not initialized with Socket.IO server');
  }

  const { userMessage, conversationHistory, roomId, workflowId } = params;
  const messageId = `ai-${userMessage.id}`;

  logger.info({ roomId, messageId, workflowId }, 'Starting AI streaming activity');

  // Emit stream start event
  const startPayload: AIStreamStartPayload = {
    messageId,
    roomId,
    timestamp: new Date().toISOString(),
  };
  ioServer.to(roomId).emit('ai_stream_start', startPayload);

  let accumulatedText = '';

  try {
    // Build conversation context from history
    const messages = conversationHistory.map((msg) => ({
      role: (msg.role || (msg.userId === AI_USER.USER_ID ? 'assistant' : 'user')) as 'user' | 'assistant',
      content: msg.text,
    }));

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage.text,
    });

    // Check for heartbeat to ensure activity is still alive
    Context.current().heartbeat();

    // Start streaming from AI service
    for await (const event of services.aiService.streamText({
      system: AI_SYSTEM_PROMPT,
      messages,
      temperature: 0.7,
      maxTokens: 1000,
    })) {
      // Send heartbeat periodically
      Context.current().heartbeat();

      if (event.type === 'text-delta' && event.delta) {
        accumulatedText += event.delta;

        // Emit chunk to Socket.IO for real-time experience
        const chunkPayload: AIStreamChunkPayload = {
          messageId,
          roomId,
          chunk: event.delta,
          accumulatedText,
        };
        ioServer.to(roomId).emit('ai_stream_chunk', chunkPayload);

        // Send chunk signal to workflow (for workflow awareness)
        // Note: In Temporal, we can't actually send signals from activities to workflows
        // The workflow will wait for the activity to complete and return the full text
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage, roomId, messageId }, 'AI streaming activity error');

    // Emit error to Socket.IO
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

/**
 * Activity: Save completed AI response to Redis
 *
 * This activity persists the AI message to chat history
 * Separated from streaming for better retry isolation
 */
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage, messageId: message.id }, 'Failed to save AI message');
    throw error;
  }
}
