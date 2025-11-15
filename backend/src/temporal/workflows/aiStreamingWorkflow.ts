import { Message } from '@chat-app/shared';
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/aiActivities';

const { streamAIResponse, saveCompletedResponse } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
    maximumAttempts: 3,
  },
});

export interface AIStreamingWorkflowInput {
  userMessage: Message;
  conversationHistory: Message[];
  roomId: string;
  socketId: string;
  workflowId: string;
}

export interface AIStreamingWorkflowResult {
  success: boolean;
  aiMessage?: Message;
  error?: string;
}

export async function aiStreamingWorkflow(
  input: AIStreamingWorkflowInput
): Promise<AIStreamingWorkflowResult> {
  try {
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

    const aiMessage: Message = {
      id: `ai-${input.userMessage.id}`,
      username: 'AI Assistant',
      userId: 'ai',
      text: completeText,
      timestamp: new Date().toISOString(),
      roomId: input.roomId,
      role: 'assistant',
    };

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
