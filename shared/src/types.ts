/**
 * Shared type definitions for socket events and messages
 * Used by both backend and frontend
 */

// Base interfaces
export interface BaseUserEvent {
  username: string;
  userId: string;
  timestamp: string;
  roomId: string;
}

export interface UserInfo {
  id: string;
  name: string;
  roomId: string;
}

// Socket event payloads
export type UserJoinedPayload = BaseUserEvent;
export type UserLeftPayload = BaseUserEvent;

export interface UserTypingPayload extends Omit<BaseUserEvent, 'timestamp'> {
  isTyping: boolean;
}

// Message types
export interface MessageData {
  text: string;
  roomId: string;
}

export interface Message extends BaseUserEvent {
  id: string;
  text: string;
  isSystem?: boolean;
  role?: 'user' | 'assistant'; // AI conversation role
}

// Acknowledgment response types
export interface MessageAckSuccess {
  success: true;
  messageId: string;
  timestamp: string;
}

export interface MessageAckError {
  success: false;
  error: string;
  code?: string;
}

export type MessageAck = MessageAckSuccess | MessageAckError;

export interface ValidationError {
  success: false;
  error: string;
}

// AI Streaming types
export interface AIStreamStartPayload {
  messageId: string;
  roomId: string;
  timestamp: string;
}

export interface AIStreamChunkPayload {
  messageId: string;
  roomId: string;
  chunk: string;
  accumulatedText: string;
}

export interface AIStreamFinishPayload {
  messageId: string;
  roomId: string;
  fullText: string;
  timestamp: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIStreamErrorPayload {
  messageId: string;
  roomId: string;
  error: string;
  timestamp: string;
}

// Socket event types for type-safe event handling
export interface ServerToClientEvents {
  connect: () => void;
  disconnect: () => void;
  user_joined: (payload: UserJoinedPayload) => void;
  user_left: (payload: UserLeftPayload) => void;
  user_typing: (payload: UserTypingPayload) => void;
  receive_message: (message: Message) => void;
  users_list: (users: UserInfo[]) => void;
  chat_history: (messages: Message[]) => void;
  validation_error: (error: ValidationError) => void;
  ai_stream_start: (payload: AIStreamStartPayload) => void;
  ai_stream_chunk: (payload: AIStreamChunkPayload) => void;
  ai_stream_finish: (payload: AIStreamFinishPayload) => void;
  ai_stream_error: (payload: AIStreamErrorPayload) => void;
}

export interface ClientToServerEvents {
  join: (username: string, roomId: string, callback?: (response: { success: boolean; error?: string }) => void) => void;
  send_message: (data: MessageData, callback: (ack: MessageAck) => void) => void;
  typing: (isTyping: boolean) => void;
  get_history: (count?: number) => void;
  clear_history: (roomId: string, callback?: (response: { success: boolean; error?: string }) => void) => void;
}
