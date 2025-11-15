import { Message, SYSTEM_USER } from '@chat-app/shared';

export function createSystemMessage(
  username: string,
  action: string,
  timestamp: string,
  roomId: string
): Message {
  return {
    id: `${username}-${action}-${timestamp}`,
    username: SYSTEM_USER.USERNAME,
    userId: SYSTEM_USER.USER_ID,
    text: `${username} ${action} the chat`,
    timestamp,
    roomId,
    isSystem: true,
  };
}

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
