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
}

export interface ClientToServerEvents {
  join: (username: string, roomId: string) => void;
  send_message: (data: MessageData) => void;
  typing: (isTyping: boolean) => void;
  get_history: (count?: number) => void;
}
