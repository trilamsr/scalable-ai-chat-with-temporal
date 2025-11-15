import { useState, useEffect, useRef } from 'react';
import { UserTypingPayload, ILogger, CHAT_CONFIG } from '@chat-app/shared';
import { TypedSocket } from '../types';
import { registerSocketEvents, unregisterSocketEvents } from '../utils/socketHelpers';

export interface UseTypingIndicatorResult {
  typingUsers: Set<string>;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => void;
  clearTypingOnSubmit: () => void;
}

export function useTypingIndicator(
  socket: TypedSocket,
  isConnected: boolean,
  logger: ILogger
): UseTypingIndicatorResult {
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!socket) return;

    const handleUserTyping = (data: UserTypingPayload) => {
      logger.debug({ typingUser: data.username, isTyping: data.isTyping }, 'Typing status changed');
      if (data.isTyping) {
        setTypingUsers((prev) => new Set(prev).add(data.username));
      } else {
        setTypingUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(data.username);
          return newSet;
        });
      }
    };

    const eventMap = {
      user_typing: handleUserTyping,
    };

    registerSocketEvents(socket, eventMap);

    return () => {
      unregisterSocketEvents(socket, eventMap);
    };
  }, [socket, logger]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => {
    onChange(e.target.value);

    if (!socket || !isConnected) return;

    socket.emit('typing', true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', false);
    }, CHAT_CONFIG.TYPING_INDICATOR_TIMEOUT);
  };

  const clearTypingOnSubmit = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (socket && isConnected) {
      socket.emit('typing', false);
    }
  };

  return { typingUsers, handleInputChange, clearTypingOnSubmit };
}
