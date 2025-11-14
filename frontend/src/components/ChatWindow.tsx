import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createChildLogger, Message, UserInfo, UserJoinedPayload, UserLeftPayload, UserTypingPayload } from '@chat-app/shared';
import { ChatWindowProps } from '../types';
import Header from './Header';
import OnlineStatusBar from './OnlineStatusBar';
import MessagesContainer from './MessagesContainer';
import MessageInputForm from './MessageInputForm';

const ChatWindow: React.FC<ChatWindowProps> = ({ socket, windowId, username, color }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [onlineUsers, setOnlineUsers] = useState<UserInfo[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create a logger specific to this chat window
  const logger = useMemo(
    () => createChildLogger({ component: 'ChatWindow', windowId, username }),
    [windowId, username]
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setIsConnected(true);
      logger.info('Connected to server');
      socket.emit('join', username);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      logger.warn('Disconnected from server');
    };

    const handleReceiveMessage = (message: Message) => {
      logger.debug(
        { messageId: message.id, from: message.username, textLength: message.text.length },
        'Message received'
      );
      setMessages((prevMessages) => [...prevMessages, message]);
    };

    const handleUserJoined = (data: UserJoinedPayload) => {
      logger.info({ joinedUser: data.username }, 'User joined chat');
      const systemMessage: Message = {
        id: `${data.username}-joined-${data.timestamp}`,
        username: 'System',
        userId: 'system',
        text: `${data.username} joined the chat`,
        timestamp: data.timestamp,
        isSystem: true
      };
      setMessages((prevMessages) => [...prevMessages, systemMessage]);
    };

    const handleUserLeft = (data: UserLeftPayload) => {
      logger.info({ leftUser: data.username }, 'User left chat');
      const systemMessage: Message = {
        id: `${data.username}-left-${data.timestamp}`,
        username: 'System',
        userId: 'system',
        text: `${data.username} left the chat`,
        timestamp: data.timestamp,
        isSystem: true
      };
      setMessages((prevMessages) => [...prevMessages, systemMessage]);
    };

    const handleUsersList = (users: UserInfo[]) => {
      logger.debug({ userCount: users.length }, 'Users list updated');
      setOnlineUsers(users);
    };

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

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('receive_message', handleReceiveMessage);
    socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft);
    socket.on('users_list', handleUsersList);
    socket.on('user_typing', handleUserTyping);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft);
      socket.off('users_list', handleUsersList);
      socket.off('user_typing', handleUserTyping);
    };
  }, [socket, windowId, username, logger]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() && socket && isConnected) {
      logger.info({ textLength: inputMessage.length }, 'Sending message');
      socket.emit('send_message', { text: inputMessage });
      setInputMessage('');

      // Stop typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      socket.emit('typing', false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);

    if (!socket || !isConnected) return;

    // Emit typing indicator
    socket.emit('typing', true);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 1 second of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', false);
    }, 1000);
  };

  return (
    <div
      className="flex flex-col h-full bg-white rounded-lg shadow-lg overflow-hidden border-t-4"
      style={{ borderTopColor: color }}
    >
      <Header windowId={windowId} color={color} isConnected={isConnected} username={username} />
      <OnlineStatusBar onlineUsers={onlineUsers} />
      <MessagesContainer
        messages={messages}
        username={username}
        typingUsers={typingUsers}
        messagesEndRef={messagesEndRef}
      />
      <MessageInputForm
        inputMessage={inputMessage}
        isConnected={isConnected}
        onSubmit={handleSendMessage}
        onChange={handleInputChange}
      />
    </div>
  );
};

export default ChatWindow;
