import { useState, useEffect, useRef, useCallback } from 'react';
import { Message, UserJoinedPayload, UserLeftPayload, ILogger } from '@chat-app/shared';
import { TypedSocket } from '../types';
import { createSystemMessage } from '../utils/messageHelpers';
import { registerSocketEvents, unregisterSocketEvents } from '../utils/socketHelpers';
import { CHAT_CONFIG } from '../utils/constants';

/**
 * Hook for managing chat messages and history
 * Handles message reception, user join/leave events, and chat history loading
 */
export interface UseChatMessagesResult {
  messages: Message[];
  isLoadingHistory: boolean;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  requestHistory: () => void;
}

export function useChatMessages(socket: TypedSocket, logger: ILogger): UseChatMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const historyLoadedRef = useRef<boolean>(false);
  // Persistent Set for O(1) duplicate checking instead of O(n) Set creation
  const messageIdsRef = useRef<Set<string>>(new Set());

  const requestHistory = useCallback(() => {
    if (!historyLoadedRef.current && socket) {
      setIsLoadingHistory(true);
      logger.info('Requesting chat history');
      socket.emit('get_history', CHAT_CONFIG.HISTORY_REQUEST_COUNT);
    }
  }, [socket, logger]);

  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (message: Message) => {
      logger.debug(
        { messageId: message.id, from: message.username, textLength: message.text.length },
        'Message received'
      );
      // Only add to Set if history has already loaded (to avoid filtering out history messages)
      if (historyLoadedRef.current) {
        messageIdsRef.current.add(message.id);
      }
      setMessages((prevMessages) => [...prevMessages, message]);
    };

    const handleUserJoined = (data: UserJoinedPayload) => {
      logger.info({ joinedUser: data.username }, 'User joined chat');
      const systemMessage = createSystemMessage(data.username, 'joined', data.timestamp, data.roomId);
      // Only add to Set if history has already loaded
      if (historyLoadedRef.current) {
        messageIdsRef.current.add(systemMessage.id);
      }
      setMessages((prevMessages) => [...prevMessages, systemMessage]);
    };

    const handleUserLeft = (data: UserLeftPayload) => {
      logger.info({ leftUser: data.username }, 'User left chat');
      const systemMessage = createSystemMessage(data.username, 'left', data.timestamp, data.roomId);
      // Only add to Set if history has already loaded
      if (historyLoadedRef.current) {
        messageIdsRef.current.add(systemMessage.id);
      }
      setMessages((prevMessages) => [...prevMessages, systemMessage]);
    };

    const handleChatHistory = (historyMessages: Message[]) => {
      logger.info({ messageCount: historyMessages.length }, 'Chat history received');
      setIsLoadingHistory(false);

      if (historyMessages.length > 0) {
        const nonSystemMessages = historyMessages.filter(msg => !msg.isSystem);

        // Initialize Set with all history message IDs
        nonSystemMessages.forEach(msg => messageIdsRef.current.add(msg.id));

        setMessages((prevMessages) => {
          // Remove any messages that arrived before history (they're duplicates)
          const preHistoryMessages = prevMessages.filter(msg => !messageIdsRef.current.has(msg.id));

          // Combine: history first (oldest), then any new messages that arrived during load
          return [...nonSystemMessages, ...preHistoryMessages];
        });
      }

      // Mark history as loaded AFTER processing to ensure new messages start being tracked
      historyLoadedRef.current = true;
    };

    const eventMap = {
      receive_message: handleReceiveMessage,
      user_joined: handleUserJoined,
      user_left: handleUserLeft,
      chat_history: handleChatHistory,
    };

    registerSocketEvents(socket, eventMap);

    return () => {
      unregisterSocketEvents(socket, eventMap);
    };
  }, [socket, logger]);

  return { messages, isLoadingHistory, setMessages, requestHistory };
}
