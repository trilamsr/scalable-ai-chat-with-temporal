export type AIMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AIMessage {
  role: AIMessageRole;
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface AIToolParameter {
  type: string;
  description?: string;
  required?: boolean;
  properties?: Record<string, AIToolParameter>;
  items?: AIToolParameter;
  enum?: string[];
}

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

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface AIToolResult {
  toolCallId: string;
  toolName: string;
  result: any;
  error?: string;
}

export type AIStreamEventType =
  | 'text-delta'      
  | 'tool-call'       
  | 'tool-result'     
  | 'finish'          
  | 'error';          

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

export interface IAIStreamService {

  streamText(options: AIStreamOptions): AsyncIterable<AIStreamEvent>;

  streamTextComplete(options: AIStreamOptions): Promise<AIStreamResult>;
}

