/**
 * Shared type definitions for socket events and messages
 * Used by both backend and frontend
 */

// Base interfaces
export interface BaseUserEvent {
  username: string;
  userId: string;
  timestamp: string;
}

export interface UserInfo {
  id: string;
  name: string;
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
}

export interface Message extends BaseUserEvent {
  id: string;
  text: string;
  isSystem?: boolean;
}

// Socket event types for type-safe event handling
export interface ServerToClientEvents {
  user_joined: (payload: UserJoinedPayload) => void;
  user_left: (payload: UserLeftPayload) => void;
  user_typing: (payload: UserTypingPayload) => void;
  receive_message: (message: Message) => void;
  users_list: (users: UserInfo[]) => void;
}

export interface ClientToServerEvents {
  join: (username: string) => void;
  send_message: (data: MessageData) => void;
  typing: (isTyping: boolean) => void;
}
