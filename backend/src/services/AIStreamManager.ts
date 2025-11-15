/**
 * AI Stream Manager (Temporal Integration)
 * Starts and manages AI streaming workflows using Temporal
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
import { getErrorMessage } from '../utils/errorHelpers';

const logger = createChildLogger({ module: 'AIStreamManager' });

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

/**
 * Manages AI streaming workflows using Temporal
 * All state is managed by Temporal - no in-memory session tracking needed
 */
export class AIStreamManager {
  private temporalClient: Client | null = null;

  constructor() {
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
   * Check if a room has an active AI streaming workflow
   * Queries Temporal directly for running workflows
   */
  async isStreamActive(roomId: string): Promise<boolean> {
    if (!this.temporalClient) return false;

    try {
      // Query Temporal for running workflows with this room ID prefix
      const workflows = this.temporalClient.workflow.list({
        query: `WorkflowId STARTS_WITH "ai-stream-${roomId}-" AND ExecutionStatus = "Running"`,
      });

      // Check if any workflow exists
      for await (const _workflow of workflows) {
        return true; // Found an active workflow
      }
      return false;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error({ error: errorMessage, roomId }, 'Failed to check stream status');
      return false;
    }
  }

  /**
   * Start a new AI streaming workflow for a room
   * The workflow provides durability and ensures no tokens are wasted
   *
   * Note: No need to track sessions in memory - Temporal manages all state
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

    const messageId = `ai-${userMessage.id}`;
    const workflowId = `ai-stream-${roomId}-${Date.now()}`;

    logger.info({ roomId, messageId, workflowId }, 'Starting AI stream workflow');

    // Start Temporal workflow
    // The workflow will:
    // 1. Stream AI response via activities (emits to Socket.IO in real-time)
    // 2. Save the complete response to Redis
    // 3. Provide durability - if server crashes, workflow resumes
    await this.temporalClient.workflow.start('aiStreamingWorkflow', {
      taskQueue: TEMPORAL_CONFIG.taskQueue,
      workflowId,
      args: [{ userMessage, conversationHistory, roomId, socketId, workflowId }],
    });

    logger.info({ workflowId, roomId }, 'Temporal workflow started successfully');
  }

  /**
   * Cancel an active stream by terminating the workflow
   * Queries Temporal to find and terminate running workflows for this room
   */
  async cancelStream(roomId: string): Promise<boolean> {
    if (!this.temporalClient) {
      logger.warn('Cannot cancel stream - Temporal client not initialized');
      return false;
    }

    try {
      // Find running workflows for this room
      const workflows = this.temporalClient.workflow.list({
        query: `WorkflowId STARTS_WITH "ai-stream-${roomId}-" AND ExecutionStatus = "Running"`,
      });

      let cancelled = false;
      for await (const workflow of workflows) {
        logger.info({ roomId, workflowId: workflow.workflowId }, 'Cancelling AI stream workflow');

        try {
          const handle = this.temporalClient.workflow.getHandle(workflow.workflowId);
          await handle.terminate('User cancelled stream');
          cancelled = true;
        } catch (error) {
          const errorMessage = getErrorMessage(error);
          logger.error({ error: errorMessage, workflowId: workflow.workflowId }, 'Failed to cancel workflow');
        }
      }

      return cancelled;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error({ error: errorMessage, roomId }, 'Failed to query workflows for cancellation');
      return false;
    }
  }

  /**
   * Cleanup on shutdown
   * Note: Workflows continue running in Temporal even after shutdown
   */
  shutdown(): void {
    logger.info('AI Stream Manager shut down');
    // No cleanup needed - Temporal manages workflow lifecycle
  }
}
