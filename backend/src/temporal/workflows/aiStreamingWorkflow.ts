import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/aiActivities';
import { Message } from '@chat-app/shared';

// Proxy activities with timeouts and retry policies
const { streamAIResponse, saveCompletedResponse } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
    maximumAttempts: 3,
  },
});

/**
 * Workflow input parameters
 */
export interface AIStreamingWorkflowInput {
  userMessage: Message;
  conversationHistory: Message[];
  roomId: string;
  socketId: string;
  workflowId: string;
}

/**
 * Workflow result
 */
export interface AIStreamingWorkflowResult {
  success: boolean;
  aiMessage?: Message;
  error?: string;
}

/**
 * AI Streaming Workflow
 *
 * This workflow:
 * 1. Accepts a user message and conversation history
 * 2. Calls AI API to stream response chunks (activity emits to Socket.IO in real-time)
 * 3. Receives the complete text from the streaming activity
 * 4. Saves the complete AI response to Redis when finished
 * 5. Provides durability - survives crashes and restarts
 *
 * The workflow is durable and will survive server restarts,
 * ensuring no tokens are wasted and all responses are saved.
 *
 * Socket.IO real-time streaming happens in the activity, while the
 * workflow coordinates and ensures persistence.
 */
export async function aiStreamingWorkflow(
  input: AIStreamingWorkflowInput
): Promise<AIStreamingWorkflowResult> {
  try {
    // Start the AI streaming activity
    // The activity will:
    // 1. Call AI API and stream chunks
    // 2. Emit chunks to Socket.IO in real-time
    // 3. Return the complete text when done
    const completeText = await streamAIResponse({
      userMessage: input.userMessage,
      conversationHistory: input.conversationHistory,
      roomId: input.roomId,
      socketId: input.socketId,
      workflowId: input.workflowId,
    });

    if (!completeText) {
      throw new Error('No AI response received');
    }

    // Create AI message object
    const aiMessage: Message = {
      id: `ai-${input.userMessage.id}`,
      username: 'AI Assistant',
      userId: 'ai',
      text: completeText,
      timestamp: new Date().toISOString(),
      roomId: input.roomId,
      role: 'assistant',
    };

    // Save the completed response to Redis
    const saved = await saveCompletedResponse({
      message: aiMessage,
    });

    if (!saved) {
      throw new Error('Failed to save AI response to history');
    }

    return {
      success: true,
      aiMessage,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      error: errorMessage,
    };
  }
}
