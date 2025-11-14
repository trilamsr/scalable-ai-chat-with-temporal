import { Message } from '@chat-app/shared';
import { SYSTEM_USER } from './constants';

export function createSystemMessage(
  username: string,
  action: string,
  timestamp: string
): Message {
  return {
    id: `${username}-${action}-${timestamp}`,
    username: SYSTEM_USER.USERNAME,
    userId: SYSTEM_USER.USER_ID,
    text: `${username} ${action} the chat`,
    timestamp,
    isSystem: true,
  };
}

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
