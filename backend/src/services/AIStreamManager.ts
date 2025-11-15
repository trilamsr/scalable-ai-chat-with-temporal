

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

export class AIStreamManager {
  private temporalClient: Client | null = null;

  constructor() {
    logger.info('AI Stream Manager initialized (Temporal mode)');
  }

  
  setTemporalClient(client: Client): void {
    this.temporalClient = client;
    logger.info('Temporal client registered with AI Stream Manager');
  }

  
  async isStreamActive(roomId: string): Promise<boolean> {
    if (!this.temporalClient) return false;

    try {
      
      const workflows = this.temporalClient.workflow.list({
        query: `WorkflowId STARTS_WITH "ai-stream-${roomId}-" AND ExecutionStatus = "Running"`,
      });

      
      for await (const _workflow of workflows) {
        return true; 
      }
      return false;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error({ error: errorMessage, roomId }, 'Failed to check stream status');
      return false;
    }
  }

  
  async startStream(
    _io: TypedServer, 
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

    
    
    
    
    
    await this.temporalClient.workflow.start('aiStreamingWorkflow', {
      taskQueue: TEMPORAL_CONFIG.taskQueue,
      workflowId,
      args: [{ userMessage, conversationHistory, roomId, socketId, workflowId }],
    });

    logger.info({ workflowId, roomId }, 'Temporal workflow started successfully');
  }

  
  async cancelStream(roomId: string): Promise<boolean> {
    if (!this.temporalClient) {
      logger.error('Cannot cancel stream - Temporal client not initialized');
      return false;
    }

    try {
      
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

  
  shutdown(): void {
    logger.info('AI Stream Manager shut down');
    
  }
}
