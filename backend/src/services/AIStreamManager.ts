/**
 * AI Stream Manager
 * Manages ongoing AI streaming sessions per room
 * Allows clients to reconnect and continue receiving stream chunks
 */

import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import {
  createChildLogger,
  AIStreamStartPayload,
  AIStreamChunkPayload,
  AIStreamFinishPayload,
  AIStreamErrorPayload,
  ServerToClientEvents,
  ClientToServerEvents,
  Message,
  AI_USER,
  AI_STREAM_TIMEOUTS,
  AI_SYSTEM_PROMPT,
} from '@chat-app/shared';
import { AIService } from './AIService.js';
import { ChatHistoryService } from '../chatHistory.js';

const logger = createChildLogger({ module: 'AIStreamManager' });

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

/**
 * Represents an active AI streaming session
 */
interface AIStreamSession {
  messageId: string;
  roomId: string;
  accumulatedText: string;
  isActive: boolean;
  startedAt: Date;
  abortController: AbortController;
}

/**
 * Manages AI streaming sessions across rooms
 */
export class AIStreamManager {
  private aiService: AIService;
  private chatHistory: ChatHistoryService;
  private activeSessions: Map<string, AIStreamSession>; // roomId -> session
  private cleanupInterval: NodeJS.Timeout;

  constructor(aiService: AIService, chatHistory: ChatHistoryService) {
    this.aiService = aiService;
    this.chatHistory = chatHistory;
    this.activeSessions = new Map();

    // Clean up stale sessions periodically
    this.cleanupInterval = setInterval(
      () => this.cleanupStaleSessions(),
      AI_STREAM_TIMEOUTS.STALE_SESSION_CLEANUP_INTERVAL_MS
    );

    logger.info('AI Stream Manager initialized');
  }

  /**
   * Check if a room has an active AI streaming session
   */
  isStreamActive(roomId: string): boolean {
    const session = this.activeSessions.get(roomId);
    return session?.isActive || false;
  }

  /**
   * Get current session for a room
   */
  getSession(roomId: string): AIStreamSession | undefined {
    return this.activeSessions.get(roomId);
  }

  /**
   * Start a new AI streaming session for a room
   */
  async startStream(
    io: TypedServer,
    roomId: string,
    userMessage: string,
    conversationHistory?: Message[]
  ): Promise<void> {
    // Check if there's already an active stream
    if (this.isStreamActive(roomId)) {
      logger.warn({ roomId }, 'AI stream already active for room');
      return;
    }

    const messageId = uuidv4();
    const abortController = new AbortController();

    const session: AIStreamSession = {
      messageId,
      roomId,
      accumulatedText: '',
      isActive: true,
      startedAt: new Date(),
      abortController,
    };

    this.activeSessions.set(roomId, session);

    logger.info({ roomId, messageId }, 'Starting AI stream');

    // Emit stream start event
    const startPayload: AIStreamStartPayload = {
      messageId,
      roomId,
      timestamp: new Date().toISOString(),
    };
    io.to(roomId).emit('ai_stream_start', startPayload);

    try {
      // Build conversation context from history with proper roles
      const messages = conversationHistory
        ? conversationHistory.map((msg) => ({
            role: msg.role || (msg.userId === AI_USER.USER_ID ? 'assistant' : 'user') as 'user' | 'assistant',
            content: msg.text,
          }))
        : [];

      // Add current user message to context
      messages.push({
        role: 'user',
        content: userMessage,
      });

      // Start streaming
      for await (const event of this.aiService.streamText({
        system: AI_SYSTEM_PROMPT,
        messages,
        temperature: 0.7,
        maxTokens: 1000,
        abortSignal: abortController.signal,
        onTextDelta: (chunk: string) => {
          // Update accumulated text
          session.accumulatedText += chunk;

          // Emit chunk to room
          const chunkPayload: AIStreamChunkPayload = {
            messageId,
            roomId,
            chunk,
            accumulatedText: session.accumulatedText,
          };
          io.to(roomId).emit('ai_stream_chunk', chunkPayload);
        },
      })) {
        // Check if stream was cancelled
        if (!this.activeSessions.has(roomId)) {
          logger.info({ roomId, messageId }, 'Stream session removed, stopping');
          break;
        }

        if (event.type === 'finish') {
          const timestamp = new Date().toISOString();
          const finishPayload: AIStreamFinishPayload = {
            messageId,
            roomId,
            fullText: session.accumulatedText,
            timestamp,
            usage: event.usage,
          };
          io.to(roomId).emit('ai_stream_finish', finishPayload);

          logger.info(
            { roomId, messageId, textLength: session.accumulatedText.length, usage: event.usage },
            'AI stream completed'
          );

          // Save AI message to chat history
          const aiMessage: Message = {
            id: messageId,
            username: AI_USER.USERNAME,
            userId: AI_USER.USER_ID,
            text: session.accumulatedText,
            timestamp,
            roomId,
            isSystem: false,
            role: 'assistant', // Mark as assistant message for AI conversation context
          };

          try {
            await this.chatHistory.addMessage(aiMessage);
            logger.debug({ messageId, roomId }, 'AI message saved to history');
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ error: errorMsg, messageId, roomId }, 'Failed to save AI message to history');
          }
        } else if (event.type === 'error') {
          throw new Error(event.error);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, roomId, messageId }, 'AI stream error');

      const errorPayload: AIStreamErrorPayload = {
        messageId,
        roomId,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
      io.to(roomId).emit('ai_stream_error', errorPayload);
    } finally {
      // Mark session as inactive
      if (session) {
        session.isActive = false;
      }
      // Keep session in map for a while so reconnecting clients can see the final state
      setTimeout(() => {
        this.activeSessions.delete(roomId);
        logger.debug({ roomId, messageId }, 'Removed completed AI stream session');
      }, AI_STREAM_TIMEOUTS.SESSION_CLEANUP_MS);
    }
  }

  /**
   * Cancel an active stream
   */
  cancelStream(roomId: string): boolean {
    const session = this.activeSessions.get(roomId);
    if (session && session.isActive) {
      logger.info({ roomId, messageId: session.messageId }, 'Cancelling AI stream');
      session.abortController.abort();
      session.isActive = false;
      return true;
    }
    return false;
  }

  /**
   * Clean up stale sessions
   */
  private cleanupStaleSessions(): void {
    const now = new Date();
    const staleThreshold = AI_STREAM_TIMEOUTS.STALE_SESSION_THRESHOLD_MS;

    for (const [, session] of this.activeSessions.entries()) {
      const age = now.getTime() - session.startedAt.getTime();
      if (age > staleThreshold && !session.isActive) {
        this.activeSessions.delete(session.roomId);
        logger.debug({ roomId: session.roomId, age }, 'Cleaned up stale AI stream session');
      }
    }
  }

  /**
   * Cleanup on shutdown
   */
  shutdown(): void {
    clearInterval(this.cleanupInterval);
    // Cancel all active streams
    for (const [, session] of this.activeSessions.entries()) {
      if (session.isActive) {
        session.abortController.abort();
      }
    }
    this.activeSessions.clear();
    logger.info('AI Stream Manager shut down');
  }
}
