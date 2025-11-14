import { useState, useEffect, useRef } from 'react';
import { Message, UserInfo, UserJoinedPayload, UserLeftPayload, UserTypingPayload } from '@chat-app/shared';
import { TypedSocket } from '../types';
import { createSystemMessage } from '../utils/messageHelpers';
import { registerSocketEvents, unregisterSocketEvents } from '../utils/socketHelpers';
import { CHAT_CONFIG } from '../utils/constants';

interface UseChatMessagesResult {
  messages: Message[];
  isLoadingHistory: boolean;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  requestHistory: () => void;
}

export function useChatMessages(socket: TypedSocket, logger: any): UseChatMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const historyLoadedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (message: Message) => {
      logger.debug(
        { messageId: message.id, from: message.username, textLength: message.text.length },
        'Message received'
      );
      setMessages((prevMessages) => [...prevMessages, message]);
    };

    const handleUserJoined = (data: UserJoinedPayload) => {
      logger.info({ joinedUser: data.username }, 'User joined chat');
      const systemMessage = createSystemMessage(data.username, 'joined', data.timestamp);
      setMessages((prevMessages) => [...prevMessages, systemMessage]);
    };

    const handleUserLeft = (data: UserLeftPayload) => {
      logger.info({ leftUser: data.username }, 'User left chat');
      const systemMessage = createSystemMessage(data.username, 'left', data.timestamp);
      setMessages((prevMessages) => [...prevMessages, systemMessage]);
    };

    const handleChatHistory = (historyMessages: Message[]) => {
      logger.info({ messageCount: historyMessages.length }, 'Chat history received');
      setIsLoadingHistory(false);
      historyLoadedRef.current = true;

      if (historyMessages.length > 0) {
        // Filter out system messages from history and add them
        // System messages (join/leave) will be generated again by current socket events
        const nonSystemMessages = historyMessages.filter(msg => !msg.isSystem);
        setMessages((prevMessages) => {
          // Create a set of existing message IDs to prevent duplicates
          const existingIds = new Set(prevMessages.map(m => m.id));
          const newMessages = nonSystemMessages.filter(msg => !existingIds.has(msg.id));
          return [...newMessages, ...prevMessages];
        });
      }
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

  const requestHistory = () => {
    if (!historyLoadedRef.current && socket) {
      setIsLoadingHistory(true);
      logger.info('Requesting chat history');
      socket.emit('get_history', CHAT_CONFIG.HISTORY_REQUEST_COUNT);
    }
  };

  return { messages, isLoadingHistory, setMessages, requestHistory };
}

interface UseSocketConnectionResult {
  isConnected: boolean;
}

export function useSocketConnection(
  socket: TypedSocket,
  username: string,
  logger: any,
  onConnect?: () => void
): UseSocketConnectionResult {
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setIsConnected(true);
      logger.info('Connected to server');
      socket.emit('join', username);
      onConnect?.();
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      logger.warn('Disconnected from server');
    };

    const eventMap = {
      connect: handleConnect,
      disconnect: handleDisconnect,
    };

    registerSocketEvents(socket, eventMap);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      unregisterSocketEvents(socket, eventMap);
    };
  }, [socket, username, logger, onConnect]);

  return { isConnected };
}

interface UseOnlineUsersResult {
  onlineUsers: UserInfo[];
}

export function useOnlineUsers(socket: TypedSocket, logger: any): UseOnlineUsersResult {
  const [onlineUsers, setOnlineUsers] = useState<UserInfo[]>([]);

  useEffect(() => {
    if (!socket) return;

    const handleUsersList = (users: UserInfo[]) => {
      logger.debug({ userCount: users.length }, 'Users list updated');
      setOnlineUsers(users);
    };

    const eventMap = {
      users_list: handleUsersList,
    };

    registerSocketEvents(socket, eventMap);

    return () => {
      unregisterSocketEvents(socket, eventMap);
    };
  }, [socket, logger]);

  return { onlineUsers };
}

interface UseTypingIndicatorResult {
  typingUsers: Set<string>;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => void;
  clearTypingOnSubmit: () => void;
}

export function useTypingIndicator(
  socket: TypedSocket,
  isConnected: boolean,
  logger: any
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

    // Emit typing indicator
    socket.emit('typing', true);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after timeout
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
