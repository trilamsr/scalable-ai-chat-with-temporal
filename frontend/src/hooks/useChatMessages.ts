import { Message, UserJoinedPayload, UserLeftPayload, ILogger, CHAT_CONFIG } from '@chat-app/shared';
import { useState, useEffect, useCallback } from 'react';
import { TypedSocket } from '../types';
import { createSystemMessage } from '../utils/messageHelpers';
import { registerSocketEvents, unregisterSocketEvents } from '../utils/socketHelpers';

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

  useEffect(() => {
    if (!socket || isHistoryLoaded) {
      return;
    }

    const handleChatHistory = (historyMessages: Message[]) => {
      logger.info({ messageCount: historyMessages.length }, 'Chat history received');
      setIsLoadingHistory(false);

      const nonSystemMessages = historyMessages.filter(msg => !msg.isSystem);
      setMessages(nonSystemMessages);

      setIsHistoryLoaded(true);
    };

    socket.on('chat_history', handleChatHistory);

    return () => {
      socket.off('chat_history', handleChatHistory);
    };
  }, [socket, logger, isHistoryLoaded]);

  useEffect(() => {
    if (!socket || !isHistoryLoaded) {
      return;
    }

    logger.info('History loaded, subscribing to real-time events');

    const handleReceiveMessage = (message: Message) => {
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
