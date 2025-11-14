/**
 * AI Streaming Abstraction
 * Simple, framework-agnostic interface for streaming text generation
 * Based on Vercel AI SDK's streamText API
 */

/**
 * Message roles for conversation history
 */
export type AIMessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Base message structure for AI conversations
 */
export interface AIMessage {
  role: AIMessageRole;
  content: string;
  name?: string;
  toolCallId?: string;
}

/**
 * Tool parameter schema definition
 */
export interface AIToolParameter {
  type: string;
  description?: string;
  required?: boolean;
  properties?: Record<string, AIToolParameter>;
  items?: AIToolParameter;
  enum?: string[];
}

/**
 * Tool definition for function calling
 */
export interface AITool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, AIToolParameter>;
    required?: string[];
  };
  execute: (args: Record<string, any>) => Promise<any> | any;
}

/**
 * Tool call made by the AI model
 */
export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

/**
 * Tool execution result
 */
export interface AIToolResult {
  toolCallId: string;
  toolName: string;
  result: any;
  error?: string;
}

/**
 * Streaming event types
 */
export type AIStreamEventType =
  | 'text-delta'      // Incremental text chunk
  | 'tool-call'       // Tool invocation
  | 'tool-result'     // Tool execution result
  | 'finish'          // Stream completion
  | 'error';          // Error occurred

/**
 * Streaming event data
 */
export interface AIStreamEvent {
  type: AIStreamEventType;
  delta?: string;
  toolCall?: AIToolCall;
  toolResult?: AIToolResult;
  finishReason?: 'stop' | 'length' | 'tool-calls' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}

/**
 * Configuration options for streaming
 */
export interface AIStreamOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stopSequences?: string[];
  seed?: number;

  system?: string;
  messages?: AIMessage[];
  prompt?: string;
  tools?: AITool[];

  onTextDelta?: (delta: string) => void;
  onToolCall?: (toolCall: AIToolCall) => void;
  onToolResult?: (toolResult: AIToolResult) => void;
  onFinish?: (result: AIStreamResult) => void;
  onError?: (error: Error) => void;

  abortSignal?: AbortSignal;
  maxRetries?: number;
}

/**
 * Final result of a streaming generation
 */
export interface AIStreamResult {
  text: string;
  finishReason: 'stop' | 'length' | 'tool-calls' | 'error';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls?: AIToolCall[];
  toolResults?: AIToolResult[];
}

/**
 * Interface for AI streaming service
 * Implementations should handle the actual streaming logic
 */
export interface IAIStreamService {
  /**
   * Stream text generation from an AI model
   * @param options Configuration for the streaming generation
   * @returns AsyncIterable of stream events
   */
  streamText(options: AIStreamOptions): AsyncIterable<AIStreamEvent>;

  /**
   * Stream text and collect the full result
   * @param options Configuration for the streaming generation
   * @returns Promise resolving to the complete result
   */
  streamTextComplete(options: AIStreamOptions): Promise<AIStreamResult>;
}
