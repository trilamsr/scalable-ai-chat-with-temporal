/**
 * AI Stream Manager (Temporal Integration)
 * Manages ongoing AI streaming sessions per room using Temporal workflows
 * Provides durability and ensures no tokens are wasted
 */

import { Server } from 'socket.io';
import {
  createChildLogger,
  ServerToClientEvents,
  ClientToServerEvents,
  Message,
} from '@chat-app/shared';
import { Client } from '@temporalio/client';
import { TEMPORAL_CONFIG } from '../temporal/client';

const logger = createChildLogger({ module: 'AIStreamManager' });

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

/**
 * Represents an active AI streaming session
 */
interface AIStreamSession {
  workflowId: string;
  messageId: string;
  roomId: string;
  isActive: boolean;
  startedAt: Date;
}

/**
 * Manages AI streaming sessions across rooms using Temporal workflows
 */
export class AIStreamManager {
  private temporalClient: Client | null = null;
  private activeSessions: Map<string, AIStreamSession>; // roomId -> session

  constructor() {
    this.activeSessions = new Map();
    logger.info('AI Stream Manager initialized (Temporal mode)');
  }

  /**
   * Set Temporal client (must be called after initialization)
   */
  setTemporalClient(client: Client): void {
    this.temporalClient = client;
    logger.info('Temporal client registered with AI Stream Manager');
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
   * Start a new AI streaming session for a room using Temporal workflow
   * The workflow provides durability and ensures no tokens are wasted
   */
  async startStream(
    _io: TypedServer, // TypedServer passed but not used here - workflows handle Socket.IO via activities
    roomId: string,
    userMessage: Message,
    conversationHistory: Message[],
    socketId: string
  ): Promise<void> {
    if (!this.temporalClient) {
      logger.error('Temporal client not initialized');
      throw new Error('Temporal client not initialized');
    }

    // Check if there's already an active stream
    if (this.isStreamActive(roomId)) {
      logger.warn({ roomId }, 'AI stream already active for room');
      return;
    }

    const messageId = `ai-${userMessage.id}`;
    const workflowId = `ai-stream-${roomId}-${Date.now()}`;

    const session: AIStreamSession = {
      workflowId,
      messageId,
      roomId,
      isActive: true,
      startedAt: new Date(),
    };

    this.activeSessions.set(roomId, session);

    logger.info({ roomId, messageId, workflowId }, 'Starting AI stream workflow');

    try {
      // Start Temporal workflow
      // The workflow will:
      // 1. Stream AI response via activities (emits to Socket.IO in real-time)
      // 2. Save the complete response to Redis
      // 3. Provide durability - if server crashes, workflow resumes
      const handle = await this.temporalClient.workflow.start('aiStreamingWorkflow', {
        taskQueue: TEMPORAL_CONFIG.taskQueue,
        workflowId,
        args: [
          {
            userMessage,
            conversationHistory,
            roomId,
            socketId,
            workflowId,
          },
        ],
      });

      logger.info({ workflowId, roomId }, 'Temporal workflow started');

      // Monitor workflow completion in background (non-blocking)
      handle
        .result()
        .then((result) => {
          if (result.success) {
            logger.info({ workflowId, roomId, messageId: result.aiMessage?.id }, 'Workflow completed successfully');
          } else {
            logger.error({ workflowId, roomId, error: result.error }, 'Workflow completed with error');
          }
        })
        .catch((error) => {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error({ error: errorMessage, workflowId, roomId }, 'Workflow execution failed');
        })
        .finally(() => {
          // Mark session as inactive and cleanup
          const existingSession = this.activeSessions.get(roomId);
          if (existingSession && existingSession.workflowId === workflowId) {
            existingSession.isActive = false;
            // Clean up after delay
            setTimeout(() => {
              this.activeSessions.delete(roomId);
              logger.debug({ roomId, workflowId }, 'Removed completed AI stream session');
            }, 30000); // 30 seconds
          }
        });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, roomId, workflowId }, 'Failed to start AI stream workflow');

      // Clean up session
      this.activeSessions.delete(roomId);
      throw error;
    }
  }

  /**
   * Cancel an active stream by terminating the workflow
   */
  async cancelStream(roomId: string): Promise<boolean> {
    if (!this.temporalClient) {
      logger.warn('Cannot cancel stream - Temporal client not initialized');
      return false;
    }

    const session = this.activeSessions.get(roomId);
    if (session && session.isActive) {
      logger.info({ roomId, workflowId: session.workflowId }, 'Cancelling AI stream workflow');

      try {
        const handle = this.temporalClient.workflow.getHandle(session.workflowId);
        await handle.terminate('User cancelled stream');
        session.isActive = false;
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: errorMessage, workflowId: session.workflowId }, 'Failed to cancel workflow');
        return false;
      }
    }
    return false;
  }

  /**
   * Cleanup on shutdown
   */
  shutdown(): void {
    // Mark all sessions as inactive
    for (const [, session] of this.activeSessions.entries()) {
      session.isActive = false;
    }
    this.activeSessions.clear();
    logger.info('AI Stream Manager shut down');
  }
}
