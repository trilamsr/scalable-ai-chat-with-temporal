/**
 * Shared type definitions for socket events and messages
 * Mirrors backend types for consistency
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

// Component props
export interface ChatWindowProps {
  socket: any; // Socket from socket.io-client
  windowId: number;
  username: string;
  color: string;
}
