import { useState, useEffect, useCallback } from 'react';
import { Message, UserJoinedPayload, UserLeftPayload, ILogger } from '@chat-app/shared';
import { TypedSocket } from '../types';
import { createSystemMessage } from '../utils/messageHelpers';
import { registerSocketEvents, unregisterSocketEvents } from '../utils/socketHelpers';
import { CHAT_CONFIG } from '../utils/constants';

/**
 * Hook for managing chat messages and history using a two-phase loading pattern
 * Phase 1: Load chat history first
 * Phase 2: Subscribe to real-time events (messages, user join/leave) only after history is loaded
 * This eliminates race conditions and duplicate messages without needing deduplication logic
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
  const [isHistoryLoaded, setIsHistoryLoaded] = useState<boolean>(false);

  const requestHistory = useCallback(() => {
    if (!isHistoryLoaded && socket) {
      setIsLoadingHistory(true);
      logger.info('Requesting chat history');
      socket.emit('get_history', CHAT_CONFIG.HISTORY_REQUEST_COUNT);
    }
  }, [socket, logger, isHistoryLoaded]);

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const addSystemMessageForUser = useCallback((
    username: string,
    action: 'joined' | 'left',
    timestamp: string,
    roomId: string
  ) => {
    const systemMessage = createSystemMessage(username, action, timestamp, roomId);
    addMessage(systemMessage);
  }, [addMessage]);

  // Phase 1: Load history FIRST
  useEffect(() => {
    if (!socket || isHistoryLoaded) return;

    const handleChatHistory = (historyMessages: Message[]) => {
      logger.info({ messageCount: historyMessages.length }, 'Chat history received');
      setIsLoadingHistory(false);

      // Set history messages (filter out system messages from history)
      const nonSystemMessages = historyMessages.filter(msg => !msg.isSystem);
      setMessages(nonSystemMessages);

      // Mark history as loaded, which will trigger Phase 2
      setIsHistoryLoaded(true);
    };

    socket.on('chat_history', handleChatHistory);

    return () => {
      socket.off('chat_history', handleChatHistory);
    };
  }, [socket, logger, isHistoryLoaded]);

  // Phase 2: Subscribe to real-time events ONLY after history is loaded
  useEffect(() => {
    if (!socket || !isHistoryLoaded) return;

    logger.info('History loaded, subscribing to real-time events');

    const handleReceiveMessage = (message: Message) => {
      logger.debug({ messageId: message.id, from: message.username, textLength: message.text.length },'Message received');
      addMessage(message);
    };

    const handleUserJoined = (data: UserJoinedPayload) => {
      logger.info({ joinedUser: data.username }, 'User joined chat');
      addSystemMessageForUser(data.username, 'joined', data.timestamp, data.roomId);
    };

    const handleUserLeft = (data: UserLeftPayload) => {
      logger.info({ leftUser: data.username }, 'User left chat');
      addSystemMessageForUser(data.username, 'left', data.timestamp, data.roomId);
    };

    const eventMap = {
      receive_message: handleReceiveMessage,
      user_joined: handleUserJoined,
      user_left: handleUserLeft,
    };

    registerSocketEvents(socket, eventMap);

    return () => {
      unregisterSocketEvents(socket, eventMap);
    };
  }, [socket, logger, isHistoryLoaded, addMessage, addSystemMessageForUser]);

  return { messages, isLoadingHistory, setMessages, requestHistory };
}
